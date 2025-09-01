const Route = require('../models/Route');
const User = require('../models/User');
const NotificationService = require('./NotificationService');
const { logger } = require('../config/environment');

class NotificationTriggerService {
  
  constructor() {
    this.sentNotifications = new Map(); // Track sent notifications to avoid spam
    this.notificationCooldown = 10 * 60 * 1000; // 10 minutes cooldown
  }

  /**
   * Check proximity-based notifications for all active routes
   */
  static async checkProximityNotifications() {
    try {
      const activeRoutes = await Route.find({ 
        isActive: true,
        'currentTrip.isActive': true,
        'currentLocation.latitude': { $exists: true }
      }).populate('tracker');

      for (const route of activeRoutes) {
        await this.processRouteNotifications(route);
      }

    } catch (error) {
      logger.error('Proximity notification check error:', error);
    }
  }

  /**
   * Process notifications for a specific route
   */
  static async processRouteNotifications(route) {
    try {
      const currentLocation = route.currentLocation;
      const notificationRadius = route.settings.notificationRadius || 500; // meters
      
      // Get all students who have selected stops on this route
      const studentsOnRoute = await User.find({
        role: 'student',
        selectedStop: { $in: route.stops.map(stop => stop._id) },
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      for (const student of studentsOnRoute) {
        await this.checkStudentNotifications(route, student, currentLocation, notificationRadius);
      }

    } catch (error) {
      logger.error('Route notification processing error:', error);
    }
  }

  /**
   * Check and send notifications for a specific student
   */
  static async checkStudentNotifications(route, student, currentLocation, notificationRadius) {
    try {
      const studentStop = route.stops.find(stop => stop._id.toString() === student.selectedStop.toString());
      if (!studentStop) return;

      const distanceToStop = this.calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        studentStop.latitude,
        studentStop.longitude
      ) * 1000; // Convert to meters

      const notificationKey = `route_${route._id}_student_${student._id}_stop_${studentStop._id}`;
      
      // Different notification triggers based on distance
      if (distanceToStop <= notificationRadius) {
        await this.sendArrivalNotification(route, student, studentStop, distanceToStop, notificationKey);
      } else if (distanceToStop <= notificationRadius * 2) {
        await this.sendApproachingNotification(route, student, studentStop, distanceToStop, notificationKey);
      } else if (distanceToStop <= notificationRadius * 4) {
        await this.sendETANotification(route, student, studentStop, distanceToStop, notificationKey);
      }

    } catch (error) {
      logger.error('Student notification check error:', error);
    }
  }

  /**
   * Send arrival notification (bus is very close - within notification radius)
   */
  static async sendArrivalNotification(route, student, stop, distance, notificationKey) {
    const cooldownKey = `arrival_${notificationKey}`;
    
    if (this.isInCooldown(cooldownKey)) return;

    const eta = route.calculateETAToStop(
      route.stops.findIndex(s => s._id.toString() === stop._id.toString()),
      route.currentLocation
    );

    const notification = {
      title: '🚌 Bus Arriving Soon!',
      body: `${route.name} bus is ${Math.round(distance)}m away from ${stop.name}. ETA: ${eta || 2} minutes`,
      data: {
        type: 'bus_arrival',
        routeId: route._id.toString(),
        routeName: route.name,
        stopId: stop._id.toString(),
        stopName: stop.name,
        distance: Math.round(distance),
        eta: eta || 2,
        priority: 'high'
      }
    };

    await NotificationService.sendToDevice(student.fcmToken, notification);
    this.setCooldown(cooldownKey);

    logger.info(`Arrival notification sent to ${student.rollNumber} for ${route.name} at ${stop.name}`);
  }

  /**
   * Send approaching notification (bus is approaching - within 2x notification radius)
   */
  static async sendApproachingNotification(route, student, stop, distance, notificationKey) {
    const cooldownKey = `approaching_${notificationKey}`;
    
    if (this.isInCooldown(cooldownKey)) return;

    const eta = route.calculateETAToStop(
      route.stops.findIndex(s => s._id.toString() === stop._id.toString()),
      route.currentLocation
    );

    const notification = {
      title: '🚌 Bus Approaching',
      body: `${route.name} bus is approaching ${stop.name}. ETA: ${eta || 5} minutes`,
      data: {
        type: 'bus_approaching',
        routeId: route._id.toString(),
        routeName: route.name,
        stopId: stop._id.toString(),
        stopName: stop.name,
        distance: Math.round(distance),
        eta: eta || 5,
        priority: 'normal'
      }
    };

    await NotificationService.sendToDevice(student.fcmToken, notification);
    this.setCooldown(cooldownKey);

    logger.info(`Approaching notification sent to ${student.rollNumber} for ${route.name} at ${stop.name}`);
  }

  /**
   * Send ETA notification (bus is on route - within 4x notification radius)
   */
  static async sendETANotification(route, student, stop, distance, notificationKey) {
    const cooldownKey = `eta_${notificationKey}`;
    
    if (this.isInCooldown(cooldownKey)) return;

    const eta = route.calculateETAToStop(
      route.stops.findIndex(s => s._id.toString() === stop._id.toString()),
      route.currentLocation
    );

    // Only send ETA notification if ETA is reasonable (less than 20 minutes)
    if (eta && eta <= 20) {
      const notification = {
        title: '📍 Bus Location Update',
        body: `${route.name} bus ETA to ${stop.name}: ${eta} minutes`,
        data: {
          type: 'bus_eta',
          routeId: route._id.toString(),
          routeName: route.name,
          stopId: stop._id.toString(),
          stopName: stop.name,
          eta: eta,
          priority: 'low'
        }
      };

      await NotificationService.sendToDevice(student.fcmToken, notification);
      this.setCooldown(cooldownKey);

      logger.info(`ETA notification sent to ${student.rollNumber} for ${route.name} at ${stop.name}: ${eta}min`);
    }
  }

  /**
   * Send delay notification
   */
  static async sendDelayNotification(route, delayInfo) {
    try {
      // Get all students on this route
      const studentsOnRoute = await User.find({
        role: 'student',
        selectedStop: { $in: route.stops.map(stop => stop._id) },
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      const notification = {
        title: '⚠️ Bus Delayed',
        body: `${route.name} is delayed by ${delayInfo.delayMinutes} minutes. Reason: ${delayInfo.reason}`,
        data: {
          type: 'bus_delay',
          routeId: route._id.toString(),
          routeName: route.name,
          delayMinutes: delayInfo.delayMinutes,
          reason: delayInfo.reason,
          priority: 'high'
        }
      };

      // Send to all students on route
      const tokens = studentsOnRoute.map(student => student.fcmToken);
      await NotificationService.sendToMultipleDevices(tokens, notification);

      logger.info(`Delay notification sent to ${tokens.length} students for ${route.name}: ${delayInfo.delayMinutes}min delay`);

    } catch (error) {
      logger.error('Delay notification error:', error);
    }
  }

  /**
   * Send trip start notification
   */
  static async sendTripStartNotification(route) {
    try {
      const studentsOnRoute = await User.find({
        role: 'student',
        selectedStop: { $in: route.stops.map(stop => stop._id) },
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      const notification = {
        title: '🚀 Bus Journey Started',
        body: `${route.name} bus has started its journey. Track your bus live!`,
        data: {
          type: 'trip_start',
          routeId: route._id.toString(),
          routeName: route.name,
          departureTime: route.currentTrip.departureTime,
          priority: 'normal'
        }
      };

      const tokens = studentsOnRoute.map(student => student.fcmToken);
      await NotificationService.sendToMultipleDevices(tokens, notification);

      logger.info(`Trip start notification sent to ${tokens.length} students for ${route.name}`);

    } catch (error) {
      logger.error('Trip start notification error:', error);
    }
  }

  /**
   * Send emergency notification
   */
  static async sendEmergencyNotification(route, emergencyInfo) {
    try {
      // Send to all users (students and admin) on this route
      const users = await User.find({
        $or: [
          { role: 'student', selectedStop: { $in: route.stops.map(stop => stop._id) } },
          { role: 'admin' }
        ],
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      const notification = {
        title: '🚨 Emergency Alert',
        body: `Emergency on ${route.name}: ${emergencyInfo.message}. ${emergencyInfo.instructions || 'Stay safe and follow instructions.'}`,
        data: {
          type: 'emergency',
          routeId: route._id.toString(),
          routeName: route.name,
          emergency: emergencyInfo,
          priority: 'max'
        }
      };

      const tokens = users.map(user => user.fcmToken);
      await NotificationService.sendToMultipleDevices(tokens, notification);

      logger.warn(`Emergency notification sent to ${tokens.length} users for ${route.name}: ${emergencyInfo.message}`);

    } catch (error) {
      logger.error('Emergency notification error:', error);
    }
  }

  /**
   * Send capacity warning notification
   */
  static async sendCapacityWarning(route) {
    try {
      const occupancyPercentage = route.currentOccupancy;
      
      if (occupancyPercentage >= 90) {
        const studentsWaiting = await User.find({
          role: 'student',
          selectedStop: { $in: route.stops.slice(route.currentTrip.currentStopIndex).map(stop => stop._id) },
          isActive: true,
          fcmToken: { $exists: true, $ne: null }
        });

        const notification = {
          title: '⚠️ Bus Nearly Full',
          body: `${route.name} is at ${occupancyPercentage}% capacity. Consider alternative transport or wait for next bus.`,
          data: {
            type: 'capacity_warning',
            routeId: route._id.toString(),
            routeName: route.name,
            occupancyPercentage,
            priority: 'normal'
          }
        };

        const tokens = studentsWaiting.map(student => student.fcmToken);
        await NotificationService.sendToMultipleDevices(tokens, notification);

        logger.info(`Capacity warning sent to ${tokens.length} students for ${route.name}: ${occupancyPercentage}% full`);
      }

    } catch (error) {
      logger.error('Capacity warning notification error:', error);
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Check if notification is in cooldown period
   */
  static isInCooldown(cooldownKey) {
    const instance = NotificationTriggerService.getInstance();
    const lastSent = instance.sentNotifications.get(cooldownKey);
    if (!lastSent) return false;
    
    return (Date.now() - lastSent) < instance.notificationCooldown;
  }

  /**
   * Set cooldown for notification type
   */
  static setCooldown(cooldownKey) {
    const instance = NotificationTriggerService.getInstance();
    instance.sentNotifications.set(cooldownKey, Date.now());
    
    // Clean up old cooldowns (older than 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    for (const [key, timestamp] of instance.sentNotifications.entries()) {
      if (timestamp < oneHourAgo) {
        instance.sentNotifications.delete(key);
      }
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance() {
    if (!NotificationTriggerService.instance) {
      NotificationTriggerService.instance = new NotificationTriggerService();
    }
    return NotificationTriggerService.instance;
  }

  /**
   * Initialize notification triggers (call this when server starts)
   */
  static initialize() {
    logger.info('Initializing proximity-based notification system...');
    
    // Check for notifications every 30 seconds
    setInterval(() => {
      this.checkProximityNotifications();
    }, 30000);

    // Clean up notification cooldowns every hour
    setInterval(() => {
      const instance = this.getInstance();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      let cleanedCount = 0;
      
      for (const [key, timestamp] of instance.sentNotifications.entries()) {
        if (timestamp < oneHourAgo) {
          instance.sentNotifications.delete(key);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old notification cooldowns`);
      }
    }, 60 * 60 * 1000); // Every hour

    logger.info('Proximity-based notification system initialized');
  }

  /**
   * Send notification for route schedule changes
   */
  static async sendScheduleChangeNotification(route, changes) {
    try {
      const studentsOnRoute = await User.find({
        role: 'student',
        selectedStop: { $in: route.stops.map(stop => stop._id) },
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      const notification = {
        title: '📅 Schedule Updated',
        body: `${route.name} schedule has been updated. Check the app for latest timings.`,
        data: {
          type: 'schedule_change',
          routeId: route._id.toString(),
          routeName: route.name,
          changes: changes,
          priority: 'normal'
        }
      };

      const tokens = studentsOnRoute.map(student => student.fcmToken);
      await NotificationService.sendToMultipleDevices(tokens, notification);

      logger.info(`Schedule change notification sent to ${tokens.length} students for ${route.name}`);

    } catch (error) {
      logger.error('Schedule change notification error:', error);
    }
  }

  /**
   * Send weather-related notifications
   */
  static async sendWeatherAlert(route, weatherInfo) {
    try {
      if (!weatherInfo.isExtreme) return; // Only send for extreme weather

      const studentsOnRoute = await User.find({
        role: 'student',
        selectedStop: { $in: route.stops.map(stop => stop._id) },
        isActive: true,
        fcmToken: { $exists: true, $ne: null }
      });

      const notification = {
        title: '🌧️ Weather Alert',
        body: `${weatherInfo.condition} expected. ${route.name} may experience delays. ${weatherInfo.advice}`,
        data: {
          type: 'weather_alert',
          routeId: route._id.toString(),
          routeName: route.name,
          weather: weatherInfo,
          priority: 'normal'
        }
      };

      const tokens = studentsOnRoute.map(student => student.fcmToken);
      await NotificationService.sendToMultipleDevices(tokens, notification);

      logger.info(`Weather alert sent to ${tokens.length} students for ${route.name}: ${weatherInfo.condition}`);

    } catch (error) {
      logger.error('Weather alert notification error:', error);
    }
  }
}

module.exports = NotificationTriggerService;