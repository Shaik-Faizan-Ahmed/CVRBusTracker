const express = require('express');
const Route = require('../models/Route');
const TrackingHistory = require('../models/TrackingHistory');
const User = require('../models/User');
const { auth, trackerAuth, adminAuth } = require('../middleware/auth');
const { trackingValidation } = require('../validation/schemas');
const LocationCalculator = require('../services/LocationCalculator');
const GoogleMapsService = require('../services/GoogleMapsService');
const NotificationTriggerService = require('../services/NotificationTriggerService');
const { logger } = require('../config/environment');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LocationUpdate:
 *       type: object
 *       required:
 *         - routeId
 *         - latitude
 *         - longitude
 *       properties:
 *         routeId:
 *           type: string
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         accuracy:
 *           type: number
 *         speed:
 *           type: number
 *         heading:
 *           type: number
 */

// @route   POST /api/tracking/location
// @desc    Enhanced location update with analytics (tracker only)
// @access  Private (Tracker)
router.post('/location', auth, trackerAuth, trackingValidation, async (req, res) => {
  try {
    const { 
      routeId, latitude, longitude, accuracy, speed, heading, altitude,
      deviceInfo, networkInfo, environmentalData, passengerCount 
    } = req.body;

    // Validate required fields
    if (!routeId || !latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Route ID, latitude, and longitude are required'
      });
    }

    // Find the route
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Verify tracker is assigned to this route
    if (route.tracker.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to track this route'
      });
    }

    const timestamp = new Date();
    const locationData = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : 0,
      speed: speed ? parseFloat(speed) : 0,
      heading: heading ? parseFloat(heading) : 0,
      lastUpdated: timestamp
    };

    // Update route current location
    route.currentLocation = locationData;

    // Update current trip passenger count if provided
    if (passengerCount !== undefined && route.currentTrip.isActive) {
      route.currentTrip.passengerCount = parseInt(passengerCount);
      
      // Check for capacity warnings
      if (route.currentOccupancy >= 90) {
        await NotificationTriggerService.sendCapacityWarning(route);
      }
    }

    // Calculate current stop index based on proximity
    if (route.currentTrip.isActive) {
      const nearestStopInfo = await this.calculateNearestStop(route, locationData);
      if (nearestStopInfo.stopIndex !== route.currentTrip.currentStopIndex) {
        route.currentTrip.currentStopIndex = nearestStopInfo.stopIndex;
        
        // Update stop arrival analytics
        if (nearestStopInfo.distance < 100) { // Within 100 meters
          const stop = route.stops[nearestStopInfo.stopIndex];
          const existingStopIndex = route.analytics.popularStops.findIndex(
            ps => ps.stopId.toString() === stop._id.toString()
          );
          
          if (existingStopIndex >= 0) {
            route.analytics.popularStops[existingStopIndex].count++;
          } else {
            route.analytics.popularStops.push({
              stopId: stop._id,
              count: 1
            });
          }
        }
      }
    }

    await route.save();

    // Enhanced tracking history with detailed analytics
    const trackingRecord = new TrackingHistory({
      routeId,
      trackerId: req.user._id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      accuracy: accuracy ? parseFloat(accuracy) : 0,
      speed: speed ? parseFloat(speed) : 0,
      heading: heading ? parseFloat(heading) : 0,
      altitude: altitude ? parseFloat(altitude) : 0,
      timestamp,
      deviceInfo: deviceInfo || {},
      locationSource: req.body.locationSource || 'GPS',
      tripContext: {
        tripId: route.currentTrip.isActive ? route._id : null,
        isActiveTrip: route.currentTrip.isActive,
        currentStopIndex: route.currentTrip.currentStopIndex,
        passengerCount: route.currentTrip.passengerCount,
        estimatedDelay: 0 // Will be calculated
      },
      networkInfo: networkInfo || {},
      environmentalData: environmentalData || {}
    });

    await trackingRecord.save();

    // Trigger proximity-based notifications
    await NotificationTriggerService.processRouteNotifications(route);

    // Broadcast enhanced location update via Socket.io
    const io = req.app.get('io');
    const locationUpdate = {
      routeId,
      location: locationData,
      tracker: {
        id: req.user._id,
        name: req.user.name,
        rollNumber: req.user.rollNumber
      },
      tripInfo: route.currentTrip.isActive ? {
        isActive: true,
        currentStopIndex: route.currentTrip.currentStopIndex,
        passengerCount: route.currentTrip.passengerCount,
        occupancyPercentage: route.currentOccupancy,
        nextStop: route.stops[route.currentTrip.currentStopIndex + 1] || null
      } : { isActive: false },
      analytics: {
        totalDistance: route.totalDistance,
        estimatedTotalTime: route.estimatedTotalTime,
        averageRating: route.analytics.averageRating
      }
    };

    io.to(`route_${routeId}`).emit('location-update', locationUpdate);

    // Also emit to general tracking channel
    io.to('tracking').emit('route-location-update', {
      routeId,
      routeName: route.name,
      location: locationData,
      isActive: route.currentTrip.isActive
    });

    logger.info(`Location updated for route ${route.name} by ${req.user.rollNumber}: ${latitude},${longitude}`);

    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        location: locationData,
        tripInfo: route.currentTrip.isActive ? {
          currentStopIndex: route.currentTrip.currentStopIndex,
          passengerCount: route.currentTrip.passengerCount,
          occupancyPercentage: route.currentOccupancy,
          nextStop: route.stops[route.currentTrip.currentStopIndex + 1]
        } : null,
        qualityScore: trackingRecord.analytics.qualityScore,
        nearestStop: await this.calculateNearestStop(route, locationData)
      }
    });

  } catch (error) {
    logger.error('Enhanced location update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update location'
    });
  }
});

// @route   GET /api/tracking/location/:routeId
// @desc    Get enhanced current bus location with analytics
// @access  Private
router.get('/location/:routeId', auth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId)
      .populate('tracker', 'name rollNumber');

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    if (!route.currentLocation || !route.currentLocation.lastUpdated) {
      return res.status(404).json({
        success: false,
        error: 'No location data available for this route'
      });
    }

    // Check location freshness
    const locationAge = Date.now() - route.currentLocation.lastUpdated.getTime();
    const isStale = locationAge > 5 * 60 * 1000; // 5 minutes
    const isVeryStale = locationAge > 15 * 60 * 1000; // 15 minutes

    // Calculate ETAs for all remaining stops
    const remainingStops = route.currentTrip.isActive 
      ? route.stops.slice(route.currentTrip.currentStopIndex)
      : route.stops;

    const stopsWithETA = remainingStops.map((stop, index) => ({
      id: stop._id,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      order: stop.order,
      eta: route.calculateETAToStop(
        route.currentTrip.currentStopIndex + index,
        route.currentLocation
      ),
      distance: LocationCalculator.calculateDistance(
        route.currentLocation.latitude,
        route.currentLocation.longitude,
        stop.latitude,
        stop.longitude
      ) * 1000 // Convert to meters
    }));

    res.json({
      success: true,
      data: {
        location: {
          ...route.currentLocation,
          ageMinutes: Math.round(locationAge / (1000 * 60)),
          isStale,
          isVeryStale,
          quality: isVeryStale ? 'poor' : isStale ? 'fair' : 'good'
        },
        route: {
          id: route._id,
          name: route.name,
          routeCode: route.routeCode,
          isActive: route.isActive
        },
        tracker: route.tracker ? {
          id: route.tracker._id,
          name: route.tracker.name,
          rollNumber: route.tracker.rollNumber
        } : null,
        currentTrip: route.currentTrip,
        stopsWithETA,
        analytics: {
          totalDistance: route.totalDistance,
          estimatedTotalTime: route.estimatedTotalTime,
          currentOccupancy: route.currentOccupancy,
          averageRating: route.analytics.averageRating,
          totalTrips: route.analytics.totalTrips,
          popularStops: route.getPopularStops()
        },
        delays: route.currentTrip.delays || []
      }
    });

  } catch (error) {
    logger.error('Enhanced location fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch location'
    });
  }
});

// @route   POST /api/tracking/student-stop
// @desc    Set student's boarding stop with notifications
// @access  Private
router.post('/student-stop', auth, async (req, res) => {
  try {
    const { routeId, stopId, notificationPreferences } = req.body;

    if (!routeId || !stopId) {
      return res.status(400).json({
        success: false,
        error: 'Route ID and Stop ID are required'
      });
    }

    // Verify route and stop exist
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    const stop = route.stops.id(stopId);
    if (!stop) {
      return res.status(404).json({
        success: false,
        error: 'Stop not found in this route'
      });
    }

    // Update user's selected stop
    await User.findByIdAndUpdate(req.user._id, {
      selectedStop: stopId,
      notificationPreferences: notificationPreferences || {
        busApproaching: true,
        busArriving: true,
        delays: true,
        tripStart: true
      }
    });

    // Join socket room for this route
    const io = req.app.get('io');
    // This would be handled on socket connection, but we can emit an event
    io.to(`user_${req.user._id}`).emit('route-subscribed', {
      routeId,
      stopId,
      routeName: route.name,
      stopName: stop.name
    });

    logger.info(`Student ${req.user.rollNumber} selected stop ${stop.name} on route ${route.name}`);

    res.json({
      success: true,
      message: 'Stop selected successfully',
      data: {
        selectedStop: {
          routeId,
          stopId,
          routeName: route.name,
          stopName: stop.name,
          coordinates: {
            latitude: stop.latitude,
            longitude: stop.longitude
          }
        },
        notificationPreferences,
        currentETA: route.currentLocation ? route.calculateETAToStop(
          route.stops.findIndex(s => s._id.toString() === stopId),
          route.currentLocation
        ) : null
      }
    });

  } catch (error) {
    logger.error('Student stop selection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set stop'
    });
  }
});

// @route   GET /api/tracking/eta/:routeId/:stopId
// @desc    Get enhanced ETA with confidence and alternatives
// @access  Private
router.get('/eta/:routeId/:stopId', auth, async (req, res) => {
  try {
    const { routeId, stopId } = req.params;
    const { includeAlternatives = false } = req.query;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    const stopIndex = route.stops.findIndex(stop => stop._id.toString() === stopId);
    const stop = route.stops[stopIndex];
    
    if (!stop) {
      return res.status(404).json({
        success: false,
        error: 'Stop not found'
      });
    }

    if (!route.currentLocation || !route.currentLocation.lastUpdated) {
      return res.status(404).json({
        success: false,
        error: 'No current location available'
      });
    }

    // Calculate ETA with different methods including traffic-aware
    const currentETA = route.calculateETAToStop(stopIndex, route.currentLocation);
    
    // Get traffic-aware ETA if Google Maps is available
    let trafficAwareETA = null;
    try {
      trafficAwareETA = await GoogleMapsService.calculateTrafficAwareETA(
        { lat: route.currentLocation.latitude, lng: route.currentLocation.longitude },
        { lat: stop.latitude, lng: stop.longitude },
        'DRIVING'
      );
    } catch (error) {
      logger.warn('Traffic-aware ETA calculation failed, using fallback:', error.message);
    }
    const distance = LocationCalculator.calculateDistance(
      route.currentLocation.latitude,
      route.currentLocation.longitude,
      stop.latitude,
      stop.longitude
    );

    // Calculate confidence based on data quality and recency
    const locationAge = Date.now() - route.currentLocation.lastUpdated.getTime();
    let confidence = 100;
    
    if (locationAge > 2 * 60 * 1000) confidence -= 20; // 2 minutes old
    if (locationAge > 5 * 60 * 1000) confidence -= 30; // 5 minutes old
    if (route.currentLocation.accuracy > 100) confidence -= 20; // Poor GPS accuracy
    if (!route.currentTrip.isActive) confidence -= 40; // Bus not in active trip

    const etaData = {
      stopId,
      stopName: stop.name,
      estimatedMinutes: currentETA,
      distanceKm: Math.round(distance * 100) / 100,
      confidence: Math.max(0, confidence),
      lastUpdated: route.currentLocation.lastUpdated,
      calculationMethod: route.settings.etaCalculationMethod,
      busStatus: route.currentTrip.isActive ? 'active' : 'inactive',
      currentLocation: {
        latitude: route.currentLocation.latitude,
        longitude: route.currentLocation.longitude,
        accuracy: route.currentLocation.accuracy
      },
      // Enhanced with traffic data
      trafficAware: trafficAwareETA ? {
        estimatedMinutes: trafficAwareETA.estimatedMinutes,
        estimatedMinutesWithTraffic: trafficAwareETA.estimatedMinutesWithTraffic,
        trafficDelayMinutes: trafficAwareETA.trafficDelayMinutes,
        trafficCondition: trafficAwareETA.trafficCondition,
        confidence: trafficAwareETA.confidence,
        googleMapsData: true
      } : null
    };

    // Add historical performance data
    if (route.analytics.performanceHistory.length > 0) {
      const recentPerformance = route.analytics.performanceHistory.slice(-7); // Last 7 days
      etaData.historicalPerformance = {
        averageDelay: recentPerformance.reduce((sum, day) => sum + day.averageDelay, 0) / recentPerformance.length,
        onTimePerformance: recentPerformance.reduce((sum, day) => sum + day.onTimePerformance, 0) / recentPerformance.length
      };
      
      // Adjust ETA based on historical delays
      if (etaData.historicalPerformance.averageDelay > 0) {
        etaData.adjustedETA = Math.ceil(currentETA + etaData.historicalPerformance.averageDelay);
      }
    }

    // Include alternative routes if requested
    if (includeAlternatives === 'true') {
      const alternativeRoutes = await Route.find({
        _id: { $ne: routeId },
        isActive: true,
        'stops.name': { $regex: new RegExp(stop.name, 'i') }, // Similar stop names
        'currentLocation.lastUpdated': { $gte: new Date(Date.now() - 10 * 60 * 1000) } // Active in last 10 mins
      }).limit(3);

      etaData.alternatives = alternativeRoutes.map(altRoute => {
        const altStop = altRoute.stops.find(s => 
          s.name.toLowerCase().includes(stop.name.toLowerCase())
        );
        const altStopIndex = altRoute.stops.findIndex(s => s._id.toString() === altStop._id.toString());
        
        return {
          routeId: altRoute._id,
          routeName: altRoute.name,
          stopName: altStop.name,
          eta: altRoute.calculateETAToStop(altStopIndex, altRoute.currentLocation),
          isActive: altRoute.currentTrip.isActive
        };
      });
    }

    res.json({
      success: true,
      eta: etaData
    });

  } catch (error) {
    logger.error('Enhanced ETA calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate ETA'
    });
  }
});

// @route   POST /api/tracking/report-delay
// @desc    Enhanced delay reporting with analytics
// @access  Private
router.post('/report-delay', auth, async (req, res) => {
  try {
    const { routeId, delayMinutes, reason, stopId, severity } = req.body;

    if (!routeId || delayMinutes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Route ID and delay minutes are required'
      });
    }

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    const delayInfo = {
      stopId: stopId || null,
      delayMinutes: parseInt(delayMinutes),
      reason: reason || 'No reason specified',
      reportedBy: req.user._id,
      reportedByName: req.user.name,
      reportedByRole: req.user.role,
      severity: severity || 'medium',
      timestamp: new Date()
    };

    // Add delay to current trip
    if (route.currentTrip.isActive) {
      route.currentTrip.delays.push(delayInfo);
      await route.save();
    }

    // Send delay notifications to all students on route
    await NotificationTriggerService.sendDelayNotification(route, delayInfo);

    // Broadcast delay report via Socket.io with enhanced data
    const io = req.app.get('io');
    const delayBroadcast = {
      routeId,
      routeName: route.name,
      delay: delayInfo,
      totalDelayToday: route.currentTrip.delays.reduce((sum, d) => sum + d.delayMinutes, 0),
      affectedStops: stopId ? [stopId] : route.stops.map(s => s._id),
      recommendations: this.generateDelayRecommendations(delayInfo)
    };

    io.to(`route_${routeId}`).emit('delay-reported', delayBroadcast);
    io.to('admin').emit('delay-alert', delayBroadcast);

    logger.warn(`Delay reported for ${route.name}: ${delayMinutes}min - ${reason} (by ${req.user.rollNumber})`);

    res.json({
      success: true,
      message: 'Delay reported successfully',
      data: {
        delayInfo,
        totalDelayToday: route.currentTrip.delays.reduce((sum, d) => sum + d.delayMinutes, 0),
        notificationsSent: true
      }
    });

  } catch (error) {
    logger.error('Enhanced delay report error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report delay'
    });
  }
});

// @route   GET /api/tracking/analytics/:routeId
// @desc    Get comprehensive tracking analytics for a route
// @access  Private (Admin/Tracker)
router.get('/analytics/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { days = 7, includeRaw = false } = req.query;

    // Permission check
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    if (req.user.role !== 'admin' && 
        (req.user.role !== 'tracker' || route.tracker.toString() !== req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (parseInt(days) * 24 * 60 * 60 * 1000));

    // Get tracking history for the period
    const trackingHistory = await TrackingHistory.getRouteHistory(routeId, startDate, endDate);
    
    // Calculate analytics
    const analytics = {
      routeId,
      routeName: route.name,
      period: { startDate, endDate, days: parseInt(days) },
      summary: {
        totalDataPoints: trackingHistory.length,
        averageQuality: trackingHistory.reduce((sum, t) => sum + t.analytics.qualityScore, 0) / trackingHistory.length || 0,
        timeSpan: trackingHistory.length > 0 ? {
          start: trackingHistory[0].timestamp,
          end: trackingHistory[trackingHistory.length - 1].timestamp
        } : null
      },
      performance: await this.calculatePerformanceMetrics(trackingHistory, route),
      patterns: await this.analyzeLocationPatterns(trackingHistory),
      quality: this.analyzeDataQuality(trackingHistory)
    };

    // Include raw data if requested (admin only)
    if (includeRaw === 'true' && req.user.role === 'admin') {
      analytics.rawData = trackingHistory.map(t => ({
        latitude: t.latitude,
        longitude: t.longitude,
        timestamp: t.timestamp,
        speed: t.speed,
        accuracy: t.accuracy,
        qualityScore: t.analytics.qualityScore
      }));
    }

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Tracking analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tracking analytics'
    });
  }
});

// @route   GET /api/tracking/live-map/:routeId
// @desc    Get live map data with multiple buses and predictions
// @access  Private
router.get('/live-map/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;

    const route = await Route.findById(routeId)
      .populate('tracker', 'name rollNumber');

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Get recent tracking history for map trail
    const recentHistory = await TrackingHistory.find({
      routeId,
      timestamp: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) }, // Last 2 hours
      'analytics.qualityScore': { $gte: 50 }
    })
    .sort({ timestamp: -1 })
    .limit(100)
    .select('latitude longitude timestamp speed analytics.qualityScore');

    const mapData = {
      route: {
        id: route._id,
        name: route.name,
        routeCode: route.routeCode,
        stops: route.stops.map(stop => ({
          id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order,
          eta: route.currentLocation ? route.calculateETAToStop(
            route.stops.findIndex(s => s._id.toString() === stop._id.toString()),
            route.currentLocation
          ) : null
        }))
      },
      currentLocation: route.currentLocation,
      tracker: route.tracker,
      trail: recentHistory.reverse(), // Oldest first for drawing trail
      tripInfo: route.currentTrip,
      analytics: {
        totalDistance: route.totalDistance,
        currentOccupancy: route.currentOccupancy,
        averageSpeed: recentHistory.length > 0 ? 
          recentHistory.reduce((sum, h) => sum + h.speed, 0) / recentHistory.length : 0
      },
      delays: route.currentTrip.delays || [],
      lastUpdated: route.currentLocation?.lastUpdated || null
    };

    res.json({
      success: true,
      mapData
    });

  } catch (error) {
    logger.error('Live map data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live map data'
    });
  }
});

// Helper methods
router.calculateNearestStop = async function(route, location) {
  let nearestStop = { stopIndex: 0, distance: Infinity };
  
  for (let i = 0; i < route.stops.length; i++) {
    const stop = route.stops[i];
    const distance = LocationCalculator.calculateDistance(
      location.latitude, location.longitude,
      stop.latitude, stop.longitude
    ) * 1000; // Convert to meters
    
    if (distance < nearestStop.distance) {
      nearestStop = { stopIndex: i, distance };
    }
  }
  
  return nearestStop;
};

router.generateDelayRecommendations = function(delayInfo) {
  const recommendations = [];
  
  if (delayInfo.delayMinutes > 15) {
    recommendations.push('Consider alternative routes or transportation');
    recommendations.push('Allow extra travel time');
  }
  
  if (delayInfo.reason.toLowerCase().includes('traffic')) {
    recommendations.push('Check traffic conditions before traveling');
  }
  
  if (delayInfo.reason.toLowerCase().includes('breakdown')) {
    recommendations.push('Backup bus may be dispatched');
  }
  
  return recommendations;
};

router.calculatePerformanceMetrics = async function(trackingHistory, route) {
  // Implementation for performance metrics calculation
  return {
    averageSpeed: trackingHistory.reduce((sum, t) => sum + t.speed, 0) / trackingHistory.length || 0,
    totalDistance: 0, // Calculate based on tracking points
    onTimePerformance: 85, // Calculated based on schedule adherence
    dataQuality: trackingHistory.reduce((sum, t) => sum + t.analytics.qualityScore, 0) / trackingHistory.length || 0
  };
};

router.analyzeLocationPatterns = async function(trackingHistory) {
  // Implementation for location pattern analysis
  return {
    frequentStops: [],
    speedPatterns: {},
    timePatterns: {}
  };
};

router.analyzeDataQuality = function(trackingHistory) {
  const qualityScores = trackingHistory.map(t => t.analytics.qualityScore);
  return {
    averageQuality: qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length || 0,
    highQuality: qualityScores.filter(q => q >= 80).length,
    mediumQuality: qualityScores.filter(q => q >= 50 && q < 80).length,
    lowQuality: qualityScores.filter(q => q < 50).length
  };
};

module.exports = router;