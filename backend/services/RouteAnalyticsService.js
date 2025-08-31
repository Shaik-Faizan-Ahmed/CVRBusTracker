const Route = require('../models/Route');
const TrackingHistory = require('../models/TrackingHistory');
const { logger } = require('../config/environment');

class RouteAnalyticsService {
  
  /**
   * Calculate comprehensive route analytics
   */
  static async calculateRouteAnalytics(routeId, days = 7) {
    try {
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000));

      // Get tracking history for the period
      const trackingData = await TrackingHistory.find({
        routeId,
        timestamp: { $gte: startDate, $lte: endDate }
      }).sort({ timestamp: 1 });

      const analytics = {
        routeId,
        routeName: route.name,
        period: { startDate, endDate, days },
        performance: await this.calculatePerformanceMetrics(trackingData, route),
        passengerPatterns: await this.analyzePassengerPatterns(routeId, startDate, endDate),
        delays: await this.analyzeDelayPatterns(routeData, route),
        efficiency: await this.calculateEfficiencyMetrics(route, trackingData),
        recommendations: []
      };

      // Generate recommendations based on analytics
      analytics.recommendations = this.generateRecommendations(analytics);

      return analytics;

    } catch (error) {
      logger.error('Route analytics calculation error:', error);
      throw error;
    }
  }

  /**
   * Calculate performance metrics from tracking data
   */
  static async calculatePerformanceMetrics(trackingData, route) {
    if (!trackingData.length) {
      return {
        onTimePerformance: 100,
        averageDelay: 0,
        totalTrips: 0,
        completedTrips: 0,
        averageSpeed: 0,
        distanceCovered: 0
      };
    }

    // Group tracking data by trips (using 30-minute gaps as trip separators)
    const trips = this.groupDataIntoTrips(trackingData);
    
    let totalDelay = 0;
    let onTimeTrips = 0;
    let totalDistance = 0;
    let totalDuration = 0;

    for (const trip of trips) {
      const tripAnalysis = this.analyzeTripPerformance(trip, route);
      totalDelay += tripAnalysis.delay;
      if (tripAnalysis.onTime) onTimeTrips++;
      totalDistance += tripAnalysis.distance;
      totalDuration += tripAnalysis.duration;
    }

    const averageDelay = trips.length > 0 ? totalDelay / trips.length : 0;
    const onTimePerformance = trips.length > 0 ? (onTimeTrips / trips.length) * 100 : 100;
    const averageSpeed = totalDuration > 0 ? (totalDistance / (totalDuration / 60)) : 0; // km/h

    return {
      onTimePerformance: Math.round(onTimePerformance * 100) / 100,
      averageDelay: Math.round(averageDelay * 100) / 100,
      totalTrips: trips.length,
      completedTrips: trips.filter(trip => trip.length > 3).length, // At least 3 location updates
      averageSpeed: Math.round(averageSpeed * 100) / 100,
      distanceCovered: Math.round(totalDistance * 100) / 100,
      tripDetails: trips.map(trip => ({
        startTime: trip[0].timestamp,
        endTime: trip[trip.length - 1].timestamp,
        locations: trip.length,
        distance: this.calculateTripDistance(trip)
      }))
    };
  }

  /**
   * Analyze passenger boarding/alighting patterns
   */
  static async analyzePassengerPatterns(routeId, startDate, endDate) {
    // This would integrate with passenger check-in data
    // For now, simulate based on popular stops and time patterns
    
    const route = await Route.findById(routeId);
    const patterns = {
      peakHours: {
        morning: { start: "07:00", end: "09:00", intensity: "high" },
        evening: { start: "17:00", end: "19:00", intensity: "high" }
      },
      popularStops: route.analytics.popularStops || [],
      dailyPatterns: {
        monday: { load: "high", pattern: "regular" },
        tuesday: { load: "high", pattern: "regular" },
        wednesday: { load: "high", pattern: "regular" },
        thursday: { load: "high", pattern: "regular" },
        friday: { load: "very-high", pattern: "extended-evening" },
        saturday: { load: "low", pattern: "irregular" },
        sunday: { load: "very-low", pattern: "minimal" }
      },
      recommendations: {
        suggestedCapacity: route.settings.maxCapacity,
        additionalServices: [],
        capacityOptimization: []
      }
    };

    // Analyze if additional services are needed
    if (patterns.peakHours.morning.intensity === "high" && patterns.peakHours.evening.intensity === "high") {
      patterns.recommendations.additionalServices.push("Consider additional buses during peak hours");
    }

    return patterns;
  }

  /**
   * Analyze delay patterns and their causes
   */
  static async analyzeDelayPatterns(trackingData, route) {
    const delays = route.currentTrip.delays || [];
    
    const analysis = {
      totalDelays: delays.length,
      averageDelayDuration: 0,
      commonCauses: {},
      delaysByStop: {},
      timePatterns: {
        morning: { count: 0, avgDuration: 0 },
        afternoon: { count: 0, avgDuration: 0 },
        evening: { count: 0, avgDuration: 0 }
      }
    };

    if (delays.length === 0) {
      return analysis;
    }

    // Calculate average delay duration
    const totalDelayMinutes = delays.reduce((sum, delay) => sum + delay.delayMinutes, 0);
    analysis.averageDelayDuration = totalDelayMinutes / delays.length;

    // Analyze common causes
    delays.forEach(delay => {
      const cause = delay.reason || 'Unknown';
      analysis.commonCauses[cause] = (analysis.commonCauses[cause] || 0) + 1;
      
      // Analyze by time of day
      const hour = new Date(delay.timestamp).getHours();
      let timeSlot;
      if (hour >= 6 && hour < 12) timeSlot = 'morning';
      else if (hour >= 12 && hour < 17) timeSlot = 'afternoon';
      else timeSlot = 'evening';
      
      analysis.timePatterns[timeSlot].count++;
      analysis.timePatterns[timeSlot].avgDuration = 
        (analysis.timePatterns[timeSlot].avgDuration + delay.delayMinutes) / analysis.timePatterns[timeSlot].count;
    });

    return analysis;
  }

  /**
   * Calculate route efficiency metrics
   */
  static async calculateEfficiencyMetrics(route, trackingData) {
    const metrics = {
      routeUtilization: 0, // How often the route is active vs scheduled
      fuelEfficiency: 0, // Estimated based on distance and duration
      passengerPerKm: 0, // Passenger efficiency
      scheduleAdherence: 0, // How well the bus follows the schedule
      costPerPassenger: 0, // Estimated operational cost per passenger
      environmentalImpact: {
        co2Saved: 0, // Compared to individual transportation
        passengerKmServed: 0
      }
    };

    // Calculate route utilization (simplified)
    const scheduledTrips = route.schedule.reduce((total, day) => total + day.trips.length, 0) * 7; // Weekly
    const actualTrips = this.groupDataIntoTrips(trackingData).length;
    metrics.routeUtilization = scheduledTrips > 0 ? (actualTrips / scheduledTrips) * 100 : 0;

    // Estimate passenger per km (based on capacity and utilization)
    const avgOccupancy = route.currentOccupancy || 60; // 60% default
    const routeDistance = route.totalDistance || 10; // Default 10km
    metrics.passengerPerKm = (route.settings.maxCapacity * (avgOccupancy / 100)) / routeDistance;

    // Environmental impact calculation
    const totalPassengerKm = metrics.passengerPerKm * routeDistance * actualTrips;
    metrics.environmentalImpact.passengerKmServed = Math.round(totalPassengerKm);
    // Assuming 120g CO2/km per person for private transport vs 20g for bus
    metrics.environmentalImpact.co2Saved = Math.round(totalPassengerKm * (120 - 20)); // grams

    return metrics;
  }

  /**
   * Generate recommendations based on analytics
   */
  static generateRecommendations(analytics) {
    const recommendations = [];

    // Performance recommendations
    if (analytics.performance.onTimePerformance < 80) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: 'On-time performance is below 80%. Consider reviewing schedule and identifying delay causes.',
        action: 'schedule_optimization'
      });
    }

    if (analytics.performance.averageDelay > 10) {
      recommendations.push({
        type: 'delays',
        priority: 'medium',
        message: 'Average delay exceeds 10 minutes. Review route timing and traffic patterns.',
        action: 'route_timing_review'
      });
    }

    // Efficiency recommendations
    if (analytics.efficiency.routeUtilization < 70) {
      recommendations.push({
        type: 'utilization',
        priority: 'medium',
        message: 'Route utilization is below 70%. Consider adjusting schedule or promoting the service.',
        action: 'schedule_adjustment'
      });
    }

    // Environmental impact recommendations
    if (analytics.efficiency.environmentalImpact.passengerKmServed > 1000) {
      recommendations.push({
        type: 'environmental',
        priority: 'low',
        message: `Great environmental impact! You've served ${analytics.efficiency.environmentalImpact.passengerKmServed} passenger-km and saved ${Math.round(analytics.efficiency.environmentalImpact.co2Saved/1000)}kg of CO2.`,
        action: 'continue_good_work'
      });
    }

    return recommendations;
  }

  /**
   * Group tracking data into individual trips
   */
  static groupDataIntoTrips(trackingData) {
    if (!trackingData.length) return [];

    const trips = [];
    let currentTrip = [];
    let lastTimestamp = null;

    for (const data of trackingData) {
      const currentTime = new Date(data.timestamp);
      
      if (lastTimestamp && (currentTime - lastTimestamp) > 30 * 60 * 1000) {
        // 30 minute gap indicates new trip
        if (currentTrip.length > 0) {
          trips.push([...currentTrip]);
        }
        currentTrip = [data];
      } else {
        currentTrip.push(data);
      }
      
      lastTimestamp = currentTime;
    }

    if (currentTrip.length > 0) {
      trips.push(currentTrip);
    }

    return trips;
  }

  /**
   * Analyze individual trip performance
   */
  static analyzeTripPerformance(trip, route) {
    if (!trip.length) return { delay: 0, onTime: true, distance: 0, duration: 0 };

    const startTime = new Date(trip[0].timestamp);
    const endTime = new Date(trip[trip.length - 1].timestamp);
    const duration = (endTime - startTime) / (1000 * 60); // minutes
    const distance = this.calculateTripDistance(trip);

    // Simple on-time calculation (within 5 minutes of expected)
    const expectedDuration = route.estimatedTotalTime || 30;
    const delay = Math.max(0, duration - expectedDuration);
    const onTime = delay <= 5;

    return {
      delay,
      onTime,
      distance,
      duration
    };
  }

  /**
   * Calculate total distance for a trip
   */
  static calculateTripDistance(trip) {
    if (trip.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 1; i < trip.length; i++) {
      const prev = trip[i - 1];
      const curr = trip[i];
      totalDistance += this.calculateDistance(
        prev.latitude, prev.longitude,
        curr.latitude, curr.longitude
      );
    }
    return totalDistance;
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
   * Get real-time route status
   */
  static async getRealTimeRouteStatus(routeId) {
    try {
      const route = await Route.findById(routeId);
      if (!route) {
        throw new Error('Route not found');
      }

      const status = {
        routeId,
        name: route.name,
        isActive: route.isActive,
        currentTrip: route.currentTrip,
        lastUpdated: route.currentLocation.lastUpdated,
        currentLocation: route.currentLocation,
        occupancy: {
          current: route.currentTrip.passengerCount || 0,
          capacity: route.settings.maxCapacity || 50,
          percentage: route.currentOccupancy || 0
        },
        nextStops: [],
        delays: route.currentTrip.delays || [],
        eta: {}
      };

      // Calculate next stops and ETAs
      if (route.currentTrip.isActive && route.currentLocation.latitude) {
        const currentStopIndex = route.currentTrip.currentStopIndex || 0;
        status.nextStops = route.stops.slice(currentStopIndex, currentStopIndex + 3).map((stop, index) => ({
          stopId: stop._id,
          name: stop.name,
          order: stop.order,
          eta: route.calculateETAToStop(currentStopIndex + index, route.currentLocation)
        }));

        // Calculate ETA for all remaining stops
        for (let i = currentStopIndex; i < route.stops.length; i++) {
          const stop = route.stops[i];
          status.eta[stop._id] = route.calculateETAToStop(i, route.currentLocation);
        }
      }

      return status;

    } catch (error) {
      logger.error('Real-time route status error:', error);
      throw error;
    }
  }
}

module.exports = RouteAnalyticsService;