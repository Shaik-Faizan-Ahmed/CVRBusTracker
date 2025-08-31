const express = require('express');
const Route = require('../models/Route');
const { auth, adminAuth, trackerAuth } = require('../middleware/auth');
const { routeValidation } = require('../validation/schemas');
const RouteAnalyticsService = require('../services/RouteAnalyticsService');
const { logger } = require('../config/environment');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     RouteResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         stops:
 *           type: array
 *           items:
 *             type: object
 *         isActive:
 *           type: boolean
 */

// @route   GET /api/buses/routes
// @desc    Get all bus routes with enhanced analytics
// @access  Private
router.get('/routes', auth, async (req, res) => {
  try {
    const { includeAnalytics, activeOnly = true, sortBy = 'name' } = req.query;
    
    const filter = activeOnly === 'true' ? { isActive: true } : {};
    const sortOptions = {};
    sortOptions[sortBy] = 1;

    const routes = await Route.find(filter)
      .populate('tracker', 'name rollNumber')
      .select('-__v')
      .sort(sortOptions);

    const enhancedRoutes = await Promise.all(routes.map(async (route) => {
      const routeData = {
        id: route._id,
        name: route.name,
        description: route.description,
        routeCode: route.routeCode,
        stops: route.stops.map(stop => ({
          id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order,
          estimatedTime: stop.estimatedTime,
          address: stop.address,
          landmark: stop.landmark,
          averageWaitTime: stop.averageWaitTime,
          passengerLoad: stop.passengerLoad,
          accessibility: stop.accessibility
        })),
        tracker: route.tracker ? {
          id: route.tracker._id,
          name: route.tracker.name,
          rollNumber: route.tracker.rollNumber
        } : null,
        isActive: route.isActive,
        currentLocation: route.currentLocation,
        schedule: route.schedule,
        settings: route.settings,
        analytics: {
          totalTrips: route.analytics.totalTrips,
          totalPassengers: route.analytics.totalPassengers,
          averageRating: route.analytics.averageRating,
          popularStops: route.getPopularStops(),
          peakHours: route.analytics.peakHours
        },
        currentTrip: route.currentTrip,
        totalDistance: route.totalDistance,
        estimatedTotalTime: route.estimatedTotalTime,
        currentOccupancy: route.currentOccupancy
      };

      // Include detailed analytics if requested
      if (includeAnalytics === 'true') {
        try {
          const analytics = await RouteAnalyticsService.calculateRouteAnalytics(route._id, 7);
          routeData.detailedAnalytics = analytics;
        } catch (error) {
          logger.warn(`Failed to load analytics for route ${route._id}:`, error.message);
        }
      }

      return routeData;
    }));

    res.json({
      success: true,
      count: enhancedRoutes.length,
      routes: enhancedRoutes
    });

  } catch (error) {
    logger.error('Enhanced routes fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch routes'
    });
  }
});

// @route   GET /api/buses/routes/:routeId
// @desc    Get single route details with comprehensive analytics
// @access  Private
router.get('/routes/:routeId', auth, async (req, res) => {
  try {
    const { includeAnalytics = 'true' } = req.query;
    
    const route = await Route.findById(req.params.routeId)
      .populate('tracker', 'name rollNumber email');

    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    const routeData = {
      id: route._id,
      name: route.name,
      description: route.description,
      routeCode: route.routeCode,
      stops: route.stops.map(stop => ({
        id: stop._id,
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        order: stop.order,
        estimatedTime: stop.estimatedTime,
        address: stop.address,
        landmark: stop.landmark,
        averageWaitTime: stop.averageWaitTime,
        passengerLoad: stop.passengerLoad,
        accessibility: stop.accessibility
      })),
      tracker: route.tracker ? {
        id: route.tracker._id,
        name: route.tracker.name,
        rollNumber: route.tracker.rollNumber,
        email: route.tracker.email
      } : null,
      isActive: route.isActive,
      currentLocation: route.currentLocation,
      schedule: route.schedule,
      settings: route.settings,
      analytics: route.analytics,
      currentTrip: route.currentTrip,
      totalDistance: route.totalDistance,
      estimatedTotalTime: route.estimatedTotalTime,
      currentOccupancy: route.currentOccupancy,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt
    };

    // Add comprehensive analytics
    if (includeAnalytics === 'true') {
      try {
        const [analytics, realTimeStatus] = await Promise.all([
          RouteAnalyticsService.calculateRouteAnalytics(route._id, 30), // 30 days
          RouteAnalyticsService.getRealTimeRouteStatus(route._id)
        ]);
        
        routeData.detailedAnalytics = analytics;
        routeData.realTimeStatus = realTimeStatus;
      } catch (error) {
        logger.warn(`Failed to load detailed analytics for route ${route._id}:`, error.message);
      }
    }

    res.json({
      success: true,
      route: routeData
    });

  } catch (error) {
    logger.error('Route fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route'
    });
  }
});

// @route   POST /api/buses/routes
// @desc    Create new bus route with enhanced features (admin only)
// @access  Private (Admin)
router.post('/routes', auth, adminAuth, routeValidation, async (req, res) => {
  try {
    const { 
      name, description, stops, tracker, schedule, settings,
      routeCode, operatingDays, routeType, specialInstructions
    } = req.body;

    // Validate required fields
    if (!name || !stops || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Route name and stops are required'
      });
    }

    // Validate stops data with enhanced fields
    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      if (!stop.name || !stop.latitude || !stop.longitude) {
        return res.status(400).json({
          success: false,
          error: `Stop ${i + 1}: name, latitude, and longitude are required`
        });
      }

      // Validate coordinate ranges
      if (stop.latitude < -90 || stop.latitude > 90) {
        return res.status(400).json({
          success: false,
          error: `Stop ${i + 1}: Invalid latitude value`
        });
      }

      if (stop.longitude < -180 || stop.longitude > 180) {
        return res.status(400).json({
          success: false,
          error: `Stop ${i + 1}: Invalid longitude value`
        });
      }
    }

    // Add order and enhanced fields to stops if not provided
    const enhancedStops = stops.map((stop, index) => ({
      name: stop.name.trim(),
      latitude: stop.latitude,
      longitude: stop.longitude,
      order: stop.order || index + 1,
      estimatedTime: stop.estimatedTime || (index * 3), // 3 minutes per stop default
      address: stop.address?.trim() || '',
      landmark: stop.landmark?.trim() || '',
      averageWaitTime: stop.averageWaitTime || 2,
      passengerLoad: stop.passengerLoad || { morning: 0, evening: 0 },
      accessibility: stop.accessibility || { wheelchairAccessible: false, covered: false }
    }));

    // Enhanced settings with defaults
    const enhancedSettings = {
      notificationRadius: settings?.notificationRadius || 500,
      etaCalculationMethod: settings?.etaCalculationMethod || 'historical',
      maxCapacity: settings?.maxCapacity || 50,
      allowOverbooking: settings?.allowOverbooking || false,
      emergencyContact: settings?.emergencyContact || '',
      routeType: routeType || 'regular',
      operatingDays: operatingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      specialInstructions: specialInstructions || '',
      ...settings
    };

    // Create route with enhanced analytics structure
    const route = new Route({
      name: name.trim(),
      description: description?.trim(),
      routeCode: routeCode?.trim(),
      stops: enhancedStops,
      tracker,
      schedule: schedule || [],
      settings: enhancedSettings,
      analytics: {
        totalTrips: 0,
        totalPassengers: 0,
        averageRating: 5,
        popularStops: [],
        peakHours: {
          morning: { start: "08:00", end: "10:00" },
          evening: { start: "17:00", end: "19:00" }
        },
        performanceHistory: []
      },
      currentTrip: {
        isActive: false,
        currentStopIndex: 0,
        passengerCount: 0,
        delays: []
      }
    });

    await route.save();
    await route.populate('tracker', 'name rollNumber');

    logger.info(`New route created: ${route.name} (${route.routeCode}) by admin ${req.user.rollNumber}`);

    res.status(201).json({
      success: true,
      message: 'Route created successfully',
      route: {
        id: route._id,
        name: route.name,
        description: route.description,
        routeCode: route.routeCode,
        stops: route.stops.map(stop => ({
          id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order,
          estimatedTime: stop.estimatedTime,
          address: stop.address,
          landmark: stop.landmark,
          averageWaitTime: stop.averageWaitTime,
          passengerLoad: stop.passengerLoad,
          accessibility: stop.accessibility
        })),
        tracker: route.tracker ? {
          id: route.tracker._id,
          name: route.tracker.name,
          rollNumber: route.tracker.rollNumber
        } : null,
        isActive: route.isActive,
        schedule: route.schedule,
        settings: route.settings,
        analytics: route.analytics,
        totalDistance: route.totalDistance,
        estimatedTotalTime: route.estimatedTotalTime
      }
    });

  } catch (error) {
    logger.error('Route creation error:', error);
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create route'
    });
  }
});

// @route   PUT /api/buses/routes/:routeId
// @desc    Update bus route with enhanced features (admin only)
// @access  Private (Admin)
router.put('/routes/:routeId', auth, adminAuth, async (req, res) => {
  try {
    const { 
      name, description, stops, tracker, isActive, schedule, settings,
      routeCode, updateAnalytics 
    } = req.body;

    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Update basic fields
    if (name) route.name = name.trim();
    if (description !== undefined) route.description = description?.trim();
    if (routeCode) route.routeCode = routeCode.trim();
    
    // Update stops with enhanced validation
    if (stops && Array.isArray(stops)) {
      // Validate stops
      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (!stop.name || !stop.latitude || !stop.longitude) {
          return res.status(400).json({
            success: false,
            error: `Stop ${i + 1}: name, latitude, and longitude are required`
          });
        }
      }

      const enhancedStops = stops.map((stop, index) => ({
        _id: stop.id || stop._id, // Preserve existing IDs
        name: stop.name.trim(),
        latitude: stop.latitude,
        longitude: stop.longitude,
        order: stop.order || index + 1,
        estimatedTime: stop.estimatedTime ?? (index * 3),
        address: stop.address?.trim() || '',
        landmark: stop.landmark?.trim() || '',
        averageWaitTime: stop.averageWaitTime ?? 2,
        passengerLoad: stop.passengerLoad || { morning: 0, evening: 0 },
        accessibility: stop.accessibility || { wheelchairAccessible: false, covered: false }
      }));
      
      route.stops = enhancedStops;
    }

    if (tracker !== undefined) route.tracker = tracker;
    if (isActive !== undefined) route.isActive = Boolean(isActive);
    if (schedule) route.schedule = schedule;
    if (settings) route.settings = { ...route.settings, ...settings };

    // Update analytics if provided
    if (updateAnalytics) {
      route.analytics = { ...route.analytics, ...updateAnalytics };
    }

    await route.save();
    await route.populate('tracker', 'name rollNumber');

    logger.info(`Route updated: ${route.name} (${route.routeCode}) by admin ${req.user.rollNumber}`);

    res.json({
      success: true,
      message: 'Route updated successfully',
      route: {
        id: route._id,
        name: route.name,
        description: route.description,
        routeCode: route.routeCode,
        stops: route.stops.map(stop => ({
          id: stop._id,
          name: stop.name,
          latitude: stop.latitude,
          longitude: stop.longitude,
          order: stop.order,
          estimatedTime: stop.estimatedTime,
          address: stop.address,
          landmark: stop.landmark,
          averageWaitTime: stop.averageWaitTime,
          passengerLoad: stop.passengerLoad,
          accessibility: stop.accessibility
        })),
        tracker: route.tracker ? {
          id: route.tracker._id,
          name: route.tracker.name,
          rollNumber: route.tracker.rollNumber
        } : null,
        isActive: route.isActive,
        schedule: route.schedule,
        settings: route.settings,
        analytics: route.analytics,
        totalDistance: route.totalDistance,
        estimatedTotalTime: route.estimatedTotalTime,
        currentOccupancy: route.currentOccupancy
      }
    });

  } catch (error) {
    logger.error('Route update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update route'
    });
  }
});

// @route   DELETE /api/buses/routes/:routeId
// @desc    Soft delete bus route (admin only)
// @access  Private (Admin)
router.delete('/routes/:routeId', auth, adminAuth, async (req, res) => {
  try {
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Soft delete - just deactivate
    route.isActive = false;
    route.currentTrip.isActive = false;
    await route.save();

    logger.info(`Route soft deleted: ${route.name} (${route.routeCode}) by admin ${req.user.rollNumber}`);

    res.json({
      success: true,
      message: 'Route deactivated successfully'
    });

  } catch (error) {
    logger.error('Route deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete route'
    });
  }
});

// @route   GET /api/buses/routes/:routeId/analytics
// @desc    Get comprehensive analytics for a specific route
// @access  Private
router.get('/routes/:routeId/analytics', auth, async (req, res) => {
  try {
    const { days = 7, includeRecommendations = true } = req.query;
    
    const analytics = await RouteAnalyticsService.calculateRouteAnalytics(
      req.params.routeId, 
      parseInt(days)
    );

    if (!includeRecommendations || includeRecommendations === 'false') {
      delete analytics.recommendations;
    }

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    logger.error('Route analytics error:', error);
    
    if (error.message === 'Route not found') {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route analytics'
    });
  }
});

// @route   GET /api/buses/routes/:routeId/status
// @desc    Get real-time status of a specific route
// @access  Private
router.get('/routes/:routeId/status', auth, async (req, res) => {
  try {
    const status = await RouteAnalyticsService.getRealTimeRouteStatus(req.params.routeId);

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('Route status error:', error);
    
    if (error.message === 'Route not found') {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch route status'
    });
  }
});

// @route   POST /api/buses/routes/:routeId/trip/start
// @desc    Start a new trip for a route (tracker only)
// @access  Private (Tracker)
router.post('/routes/:routeId/trip/start', auth, trackerAuth, async (req, res) => {
  try {
    const { expectedPassengers, departureTime, notes } = req.body;
    
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Check if tracker is assigned to this route
    if (!route.tracker || route.tracker.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned as tracker for this route'
      });
    }

    // Check if there's already an active trip
    if (route.currentTrip.isActive) {
      return res.status(400).json({
        success: false,
        error: 'There is already an active trip for this route'
      });
    }

    // Start new trip
    route.currentTrip = {
      isActive: true,
      departureTime: departureTime ? new Date(departureTime) : new Date(),
      currentStopIndex: 0,
      passengerCount: expectedPassengers || 0,
      delays: [],
      notes: notes || ''
    };

    // Update analytics
    route.analytics.totalTrips += 1;

    await route.save();

    // Emit socket event for trip start
    const io = req.app.get('io');
    io.to(`route_${route._id}`).emit('trip-started', {
      routeId: route._id,
      routeName: route.name,
      departureTime: route.currentTrip.departureTime,
      expectedPassengers: route.currentTrip.passengerCount
    });

    logger.info(`Trip started for route ${route.name} by tracker ${req.user.rollNumber}`);

    res.json({
      success: true,
      message: 'Trip started successfully',
      trip: route.currentTrip
    });

  } catch (error) {
    logger.error('Trip start error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start trip'
    });
  }
});

// @route   POST /api/buses/routes/:routeId/trip/end
// @desc    End current trip for a route (tracker only)
// @access  Private (Tracker)
router.post('/routes/:routeId/trip/end', auth, trackerAuth, async (req, res) => {
  try {
    const { finalPassengerCount, notes, rating } = req.body;
    
    const route = await Route.findById(req.params.routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Check if tracker is assigned to this route
    if (!route.tracker || route.tracker.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'You are not assigned as tracker for this route'
      });
    }

    // Check if there's an active trip
    if (!route.currentTrip.isActive) {
      return res.status(400).json({
        success: false,
        error: 'No active trip found for this route'
      });
    }

    const tripDuration = (new Date() - new Date(route.currentTrip.departureTime)) / (1000 * 60); // minutes
    const totalDelay = route.currentTrip.delays.reduce((sum, delay) => sum + delay.delayMinutes, 0);
    
    // Update analytics with trip completion
    route.analytics.totalPassengers += finalPassengerCount || route.currentTrip.passengerCount;
    if (rating && rating >= 1 && rating <= 5) {
      const currentRating = route.analytics.averageRating || 5;
      const totalTrips = route.analytics.totalTrips;
      route.analytics.averageRating = ((currentRating * (totalTrips - 1)) + rating) / totalTrips;
    }

    // Update performance metrics
    await route.updatePerformanceMetrics({
      averageDelay: totalDelay,
      onTimePerformance: totalDelay <= 5 ? 100 : Math.max(0, 100 - (totalDelay - 5) * 10),
      passengerCount: {
        total: finalPassengerCount || route.currentTrip.passengerCount,
        morning: new Date().getHours() < 12 ? (finalPassengerCount || route.currentTrip.passengerCount) : 0,
        evening: new Date().getHours() >= 17 ? (finalPassengerCount || route.currentTrip.passengerCount) : 0
      }
    });

    // End the trip
    route.currentTrip = {
      isActive: false,
      currentStopIndex: 0,
      passengerCount: 0,
      delays: []
    };

    await route.save();

    // Emit socket event for trip end
    const io = req.app.get('io');
    io.to(`route_${route._id}`).emit('trip-ended', {
      routeId: route._id,
      routeName: route.name,
      duration: Math.round(tripDuration),
      totalDelay,
      passengerCount: finalPassengerCount || route.currentTrip.passengerCount
    });

    logger.info(`Trip ended for route ${route.name} by tracker ${req.user.rollNumber} - Duration: ${Math.round(tripDuration)}min, Delay: ${totalDelay}min`);

    res.json({
      success: true,
      message: 'Trip ended successfully',
      summary: {
        duration: Math.round(tripDuration),
        totalDelay,
        passengerCount: finalPassengerCount || route.currentTrip.passengerCount,
        onTimePerformance: totalDelay <= 5
      }
    });

  } catch (error) {
    logger.error('Trip end error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end trip'
    });
  }
});

// @route   GET /api/buses/dashboard
// @desc    Get admin dashboard with route overview and analytics
// @access  Private (Admin)
router.get('/dashboard', auth, adminAuth, async (req, res) => {
  try {
    const routes = await Route.find({}).populate('tracker', 'name rollNumber');
    
    const dashboard = {
      summary: {
        totalRoutes: routes.length,
        activeRoutes: routes.filter(r => r.isActive).length,
        routesWithTrackers: routes.filter(r => r.tracker).length,
        activeTrips: routes.filter(r => r.currentTrip.isActive).length
      },
      performance: {
        totalTrips: routes.reduce((sum, r) => sum + r.analytics.totalTrips, 0),
        totalPassengers: routes.reduce((sum, r) => sum + r.analytics.totalPassengers, 0),
        averageRating: routes.reduce((sum, r) => sum + r.analytics.averageRating, 0) / routes.length || 5,
        onTimePerformance: 0 // Will be calculated from recent performance data
      },
      recentActivity: routes
        .filter(r => r.currentTrip.isActive || r.currentLocation.lastUpdated > new Date(Date.now() - 24 * 60 * 60 * 1000))
        .map(r => ({
          routeId: r._id,
          routeName: r.name,
          trackerName: r.tracker?.name,
          lastActive: r.currentLocation.lastUpdated,
          isActive: r.currentTrip.isActive,
          currentOccupancy: r.currentOccupancy
        }))
        .sort((a, b) => new Date(b.lastActive) - new Date(a.lastActive))
        .slice(0, 10),
      alerts: []
    };

    // Generate alerts
    routes.forEach(route => {
      if (route.isActive && !route.tracker) {
        dashboard.alerts.push({
          type: 'warning',
          message: `Route "${route.name}" is active but has no assigned tracker`,
          routeId: route._id
        });
      }
      
      if (route.currentTrip.delays.length > 0) {
        const totalDelay = route.currentTrip.delays.reduce((sum, d) => sum + d.delayMinutes, 0);
        if (totalDelay > 15) {
          dashboard.alerts.push({
            type: 'error',
            message: `Route "${route.name}" has significant delays (${totalDelay} minutes)`,
            routeId: route._id
          });
        }
      }
    });

    res.json({
      success: true,
      dashboard
    });

  } catch (error) {
    logger.error('Dashboard fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

module.exports = router;