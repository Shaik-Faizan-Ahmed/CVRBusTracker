const express = require('express');
const Route = require('../../models/Route');
const TrackingHistory = require('../../models/TrackingHistory');
const GoogleMapsService = require('../../services/GoogleMapsService');
const AdvancedMappingTestService = require('../../services/testing/AdvancedMappingTestService');
const { auth, adminAuth } = require('../../middleware/auth');
const { logger } = require('../../config/environment');

const router = express.Router();

/**
 * @swagger
 * /api/mapping/traffic-eta/{routeId}:
 *   get:
 *     summary: Get traffic-aware ETA for all stops on a route
 *     tags: [Advanced Mapping]
 *     parameters:
 *       - in: path
 *         name: routeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeAlternatives
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Traffic-aware ETA data for all stops
 */

// @route   GET /api/mapping/traffic-eta/:routeId
// @desc    Get traffic-aware ETA with Google Maps integration
// @access  Private
router.get('/traffic-eta/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { includeAlternatives = false } = req.query;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    if (!route.currentLocation || !route.currentLocation.lastUpdated) {
      return res.status(404).json({
        success: false,
        error: 'No current bus location available'
      });
    }

    const currentLocation = {
      lat: route.currentLocation.latitude,
      lng: route.currentLocation.longitude
    };

    // Calculate traffic-aware ETA for remaining stops
    const currentStopIndex = route.currentTrip.isActive ? route.currentTrip.currentStopIndex : 0;
    const remainingStops = route.stops.slice(currentStopIndex);

    const trafficETAs = [];
    let cumulativeLocation = currentLocation;

    for (let i = 0; i < remainingStops.length; i++) {
      const stop = remainingStops[i];
      const destination = {
        lat: stop.latitude,
        lng: stop.longitude
      };

      try {
        // Get traffic-aware ETA using Google Maps
        const trafficETA = await GoogleMapsService.calculateTrafficAwareETA(
          cumulativeLocation, 
          destination,
          'DRIVING'
        );

        // Get alternative routes if requested and it's a major stop
        let alternatives = [];
        if (includeAlternatives === 'true' && i < 3) { // Only for first 3 stops
          alternatives = await GoogleMapsService.getAlternativeRoutes(
            cumulativeLocation,
            destination,
            2
          );
        }

        trafficETAs.push({
          stopId: stop._id,
          stopName: stop.name,
          stopOrder: stop.order,
          coordinates: destination,
          ...trafficETA,
          alternatives,
          cumulativeDistance: i === 0 ? trafficETA.distance.meters : 
            trafficETAs[i-1].cumulativeDistance + trafficETA.distance.meters,
          cumulativeTimeMinutes: i === 0 ? trafficETA.estimatedMinutesWithTraffic || trafficETA.estimatedMinutes :
            trafficETAs[i-1].cumulativeTimeMinutes + (trafficETA.estimatedMinutesWithTraffic || trafficETA.estimatedMinutes)
        });

        // Update cumulative location for next calculation
        cumulativeLocation = destination;

      } catch (error) {
        logger.error(`Traffic ETA error for stop ${stop.name}:`, error);
        
        // Fallback to simple calculation
        trafficETAs.push({
          stopId: stop._id,
          stopName: stop.name,
          stopOrder: stop.order,
          coordinates: destination,
          estimatedMinutes: route.calculateETAToStop(currentStopIndex + i, route.currentLocation),
          estimatedMinutesWithTraffic: null,
          trafficDelayMinutes: 0,
          distance: { text: 'N/A', meters: 0 },
          trafficCondition: 'unknown',
          confidence: 'low',
          fallback: true,
          alternatives: [],
          cumulativeDistance: 0,
          cumulativeTimeMinutes: 0
        });
      }
    }

    // Get overall route traffic conditions
    const routeWaypoints = [currentLocation, ...remainingStops.map(stop => ({
      lat: stop.latitude,
      lng: stop.longitude
    }))];

    let routeTrafficData = null;
    try {
      routeTrafficData = await GoogleMapsService.getTrafficData(routeWaypoints, 'DRIVING');
    } catch (error) {
      logger.error('Route traffic data error:', error);
    }

    // Calculate traffic summary
    const trafficSummary = {
      totalStops: remainingStops.length,
      totalDistanceKm: Math.round(trafficETAs.reduce((sum, eta) => sum + (eta.distance?.meters || 0), 0) / 10) / 100,
      totalTimeMinutes: trafficETAs.reduce((sum, eta) => sum + (eta.estimatedMinutes || 0), 0),
      totalTimeWithTrafficMinutes: trafficETAs.reduce((sum, eta) => sum + (eta.estimatedMinutesWithTraffic || eta.estimatedMinutes), 0),
      totalTrafficDelayMinutes: trafficETAs.reduce((sum, eta) => sum + (eta.trafficDelayMinutes || 0), 0),
      overallTrafficCondition: routeTrafficData?.trafficCondition || 'unknown',
      averageConfidence: trafficETAs.reduce((sum, eta) => {
        const confidence = eta.confidence === 'high' ? 3 : eta.confidence === 'medium' ? 2 : 1;
        return sum + confidence;
      }, 0) / trafficETAs.length
    };

    res.json({
      success: true,
      data: {
        routeId,
        routeName: route.name,
        currentLocation,
        lastUpdated: route.currentLocation.lastUpdated,
        trafficETAs,
        summary: trafficSummary,
        routeTrafficData,
        recommendations: generateTrafficRecommendations(trafficSummary)
      }
    });

  } catch (error) {
    logger.error('Advanced traffic ETA error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate traffic-aware ETA'
    });
  }
});

// @route   GET /api/mapping/live-traffic/:routeId
// @desc    Get live traffic conditions for entire route
// @access  Private
router.get('/live-traffic/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { detailed = false } = req.query;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Get all route waypoints
    const waypoints = route.stops.map(stop => ({
      lat: stop.latitude,
      lng: stop.longitude,
      name: stop.name,
      order: stop.order
    }));

    // Get traffic data for entire route
    const routeTrafficData = await GoogleMapsService.getTrafficData(waypoints, 'DRIVING');

    // Get segment-by-segment traffic if detailed requested
    let segmentTraffic = [];
    if (detailed === 'true') {
      for (let i = 0; i < waypoints.length - 1; i++) {
        try {
          const segmentData = await GoogleMapsService.getTrafficData([waypoints[i], waypoints[i + 1]], 'DRIVING');
          segmentTraffic.push({
            fromStop: waypoints[i].name,
            toStop: waypoints[i + 1].name,
            segment: i + 1,
            ...segmentData
          });
        } catch (error) {
          logger.error(`Segment traffic error ${i}:`, error);
          segmentTraffic.push({
            fromStop: waypoints[i].name,
            toStop: waypoints[i + 1].name,
            segment: i + 1,
            trafficCondition: 'unknown',
            trafficDelay: 0,
            error: true
          });
        }
      }
    }

    // Get nearby traffic incidents (if available)
    let nearbyPlaces = [];
    if (route.currentLocation) {
      try {
        nearbyPlaces = await GoogleMapsService.getNearbyPlaces(
          { lat: route.currentLocation.latitude, lng: route.currentLocation.longitude },
          2000,
          'bus_station'
        );
      } catch (error) {
        logger.error('Nearby places error:', error);
      }
    }

    res.json({
      success: true,
      data: {
        routeId,
        routeName: route.name,
        routeTrafficData,
        segmentTraffic,
        nearbyPlaces: nearbyPlaces.slice(0, 5), // Limit to 5 nearby places
        trafficInsights: {
          worstSegment: segmentTraffic.length > 0 ? 
            segmentTraffic.reduce((worst, segment) => 
              segment.trafficDelay > (worst.trafficDelay || 0) ? segment : worst
            ) : null,
          averageDelayMinutes: segmentTraffic.length > 0 ?
            segmentTraffic.reduce((sum, seg) => sum + (seg.trafficDelay || 0), 0) / segmentTraffic.length / 60 : 0,
          totalSegments: segmentTraffic.length,
          highTrafficSegments: segmentTraffic.filter(seg => 
            seg.trafficCondition === 'heavy' || seg.trafficCondition === 'moderate'
          ).length
        },
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Live traffic data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live traffic data'
    });
  }
});

// @route   POST /api/mapping/optimize-route
// @desc    Get route optimization suggestions based on traffic
// @access  Private (Admin)
router.post('/optimize-route', auth, adminAuth, async (req, res) => {
  try {
    const { routeId, optimizationGoal = 'time' } = req.body;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Get current route waypoints
    const currentWaypoints = route.stops.map(stop => ({
      lat: stop.latitude,
      lng: stop.longitude,
      name: stop.name,
      order: stop.order,
      stopId: stop._id
    }));

    // Get alternative routes between key waypoints
    const optimizationSuggestions = [];
    
    for (let i = 0; i < currentWaypoints.length - 1; i++) {
      try {
        const alternatives = await GoogleMapsService.getAlternativeRoutes(
          currentWaypoints[i],
          currentWaypoints[i + 1],
          3
        );

        if (alternatives.length > 1) {
          // Compare with current segment
          const currentSegmentData = await GoogleMapsService.getTrafficData([
            currentWaypoints[i], 
            currentWaypoints[i + 1]
          ]);

          const bestAlternative = alternatives[0];
          const timeSavings = currentSegmentData.durationInTraffic ? 
            (currentSegmentData.durationInTraffic.seconds - (bestAlternative.durationInTraffic?.value || bestAlternative.duration.value)) : 0;

          if (timeSavings > 300) { // More than 5 minutes savings
            optimizationSuggestions.push({
              segment: `${currentWaypoints[i].name} → ${currentWaypoints[i + 1].name}`,
              fromStopId: currentWaypoints[i].stopId,
              toStopId: currentWaypoints[i + 1].stopId,
              currentTime: Math.ceil((currentSegmentData.durationInTraffic?.seconds || currentSegmentData.duration.seconds) / 60),
              suggestedTime: Math.ceil((bestAlternative.durationInTraffic?.value || bestAlternative.duration.value) / 60),
              timeSavingsMinutes: Math.ceil(timeSavings / 60),
              alternativeRoute: {
                summary: bestAlternative.summary,
                polyline: bestAlternative.polyline,
                trafficCondition: bestAlternative.trafficCondition,
                warnings: bestAlternative.warnings
              },
              priority: timeSavings > 900 ? 'high' : timeSavings > 600 ? 'medium' : 'low'
            });
          }
        }
      } catch (error) {
        logger.error(`Route optimization error for segment ${i}:`, error);
      }
    }

    // Generate overall optimization recommendations
    const optimizationReport = {
      routeId,
      routeName: route.name,
      optimizationGoal,
      suggestions: optimizationSuggestions,
      summary: {
        totalSuggestions: optimizationSuggestions.length,
        totalTimeSavingsMinutes: optimizationSuggestions.reduce((sum, s) => sum + s.timeSavingsMinutes, 0),
        highPrioritySuggestions: optimizationSuggestions.filter(s => s.priority === 'high').length,
        potentialFuelSavings: optimizationSuggestions.reduce((sum, s) => sum + s.timeSavingsMinutes * 0.1, 0) // Rough estimate
      },
      implementationComplexity: optimizationSuggestions.length > 3 ? 'high' : 
                               optimizationSuggestions.length > 1 ? 'medium' : 'low',
      lastAnalyzed: new Date().toISOString()
    };

    res.json({
      success: true,
      data: optimizationReport
    });

  } catch (error) {
    logger.error('Route optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize route'
    });
  }
});

// @route   GET /api/mapping/heatmap/:routeId
// @desc    Get traffic heatmap data for route visualization
// @access  Private
router.get('/heatmap/:routeId', auth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { timeRange = '24h', resolution = 'medium' } = req.query;

    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    // Calculate time range
    const endTime = new Date();
    const startTime = new Date();
    switch (timeRange) {
      case '1h': startTime.setHours(endTime.getHours() - 1); break;
      case '6h': startTime.setHours(endTime.getHours() - 6); break;
      case '24h': startTime.setDate(endTime.getDate() - 1); break;
      case '7d': startTime.setDate(endTime.getDate() - 7); break;
      default: startTime.setHours(endTime.getHours() - 24);
    }

    // Get historical tracking data for heatmap
    const trackingHistory = await TrackingHistory.find({
      routeId,
      timestamp: { $gte: startTime, $lte: endTime },
      'analytics.qualityScore': { $gte: 60 } // Only good quality data
    })
    .sort({ timestamp: 1 })
    .select('latitude longitude timestamp speed analytics.qualityScore tripContext.estimatedDelay');

    // Create grid for heatmap
    const gridSize = resolution === 'high' ? 0.001 : resolution === 'low' ? 0.01 : 0.005; // degrees
    const heatmapData = {};

    trackingHistory.forEach(point => {
      const gridLat = Math.floor(point.latitude / gridSize) * gridSize;
      const gridLng = Math.floor(point.longitude / gridSize) * gridSize;
      const key = `${gridLat},${gridLng}`;

      if (!heatmapData[key]) {
        heatmapData[key] = {
          lat: gridLat,
          lng: gridLng,
          count: 0,
          totalSpeed: 0,
          totalDelay: 0,
          timestamps: []
        };
      }

      heatmapData[key].count++;
      heatmapData[key].totalSpeed += point.speed || 0;
      heatmapData[key].totalDelay += point.tripContext?.estimatedDelay || 0;
      heatmapData[key].timestamps.push(point.timestamp);
    });

    // Convert to array and calculate averages
    const heatmapPoints = Object.values(heatmapData).map(point => ({
      lat: point.lat,
      lng: point.lng,
      weight: point.count,
      averageSpeed: point.totalSpeed / point.count,
      averageDelay: point.totalDelay / point.count,
      intensity: Math.min(point.count / 10, 1), // Normalize to 0-1
      congestionLevel: point.totalSpeed / point.count < 10 ? 'high' : 
                      point.totalSpeed / point.count < 25 ? 'medium' : 'low',
      timeSpan: {
        first: Math.min(...point.timestamps.map(t => t.getTime())),
        last: Math.max(...point.timestamps.map(t => t.getTime()))
      }
    }));

    // Sort by intensity for better visualization
    heatmapPoints.sort((a, b) => b.intensity - a.intensity);

    res.json({
      success: true,
      data: {
        routeId,
        routeName: route.name,
        timeRange,
        resolution,
        totalDataPoints: trackingHistory.length,
        heatmapPoints: heatmapPoints.slice(0, 1000), // Limit for performance
        bounds: calculateBounds(heatmapPoints),
        statistics: {
          averageSpeed: heatmapPoints.reduce((sum, p) => sum + p.averageSpeed, 0) / heatmapPoints.length,
          averageDelay: heatmapPoints.reduce((sum, p) => sum + p.averageDelay, 0) / heatmapPoints.length,
          highCongestionAreas: heatmapPoints.filter(p => p.congestionLevel === 'high').length,
          mediumCongestionAreas: heatmapPoints.filter(p => p.congestionLevel === 'medium').length,
          lowCongestionAreas: heatmapPoints.filter(p => p.congestionLevel === 'low').length
        },
        lastUpdated: endTime.toISOString()
      }
    });

  } catch (error) {
    logger.error('Heatmap data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate heatmap data'
    });
  }
});

// @route   POST /api/mapping/geocode
// @desc    Geocode address to coordinates for new stops
// @access  Private (Admin)
router.post('/geocode', auth, adminAuth, async (req, res) => {
  try {
    const { address, validateProximity = true } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        error: 'Address is required'
      });
    }

    const geocodingResult = await GoogleMapsService.geocodeAddress(address);
    
    // Get nearby places for validation
    const nearbyPlaces = await GoogleMapsService.getNearbyPlaces(
      geocodingResult.location,
      500,
      'bus_station'
    );

    // Check proximity to existing routes if validation requested
    let proximityCheck = null;
    if (validateProximity) {
      const existingRoutes = await Route.find({ isActive: true });
      proximityCheck = {
        nearbyRoutes: [],
        suggestedRoute: null
      };

      for (const route of existingRoutes) {
        const nearbyStops = route.stops.filter(stop => {
          const distance = GoogleMapsService.calculateDistance(
            geocodingResult.location.lat,
            geocodingResult.location.lng,
            stop.latitude,
            stop.longitude
          );
          return distance < 1; // Within 1km
        });

        if (nearbyStops.length > 0) {
          proximityCheck.nearbyRoutes.push({
            routeId: route._id,
            routeName: route.name,
            nearbyStops: nearbyStops.map(stop => ({
              stopId: stop._id,
              stopName: stop.name,
              distance: GoogleMapsService.calculateDistance(
                geocodingResult.location.lat,
                geocodingResult.location.lng,
                stop.latitude,
                stop.longitude
              )
            }))
          });
        }
      }

      // Suggest best route for this location
      if (proximityCheck.nearbyRoutes.length > 0) {
        proximityCheck.suggestedRoute = proximityCheck.nearbyRoutes.reduce((best, route) => {
          const avgDistance = route.nearbyStops.reduce((sum, stop) => sum + stop.distance, 0) / route.nearbyStops.length;
          return !best || avgDistance < best.avgDistance ? 
            { ...route, avgDistance } : best;
        }, null);
      }
    }

    res.json({
      success: true,
      data: {
        originalAddress: address,
        ...geocodingResult,
        nearbyPlaces,
        proximityCheck,
        recommendations: {
          suitableForBusStop: nearbyPlaces.length > 0 || geocodingResult.locationType === 'ROOFTOP',
          accessibilityNotes: nearbyPlaces.some(place => place.types.includes('hospital')) ? 
            'Medical facility nearby - ensure accessibility compliance' : null,
          trafficNotes: geocodingResult.addressComponents?.some(comp => 
            comp.types.includes('route') && comp.long_name.includes('Highway')) ?
            'Highway location - check traffic patterns' : null
        }
      }
    });

  } catch (error) {
    logger.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode address'
    });
  }
});

// Helper functions
function generateTrafficRecommendations(trafficSummary) {
  const recommendations = [];
  
  if (trafficSummary.totalTrafficDelayMinutes > 15) {
    recommendations.push({
      type: 'delay_warning',
      priority: 'high',
      message: `Significant delays expected: ${trafficSummary.totalTrafficDelayMinutes} minutes`,
      action: 'Consider leaving earlier or taking alternative transport'
    });
  }

  if (trafficSummary.overallTrafficCondition === 'heavy') {
    recommendations.push({
      type: 'traffic_heavy',
      priority: 'high',
      message: 'Heavy traffic detected on route',
      action: 'Allow extra travel time and check alternative routes'
    });
  }

  if (trafficSummary.averageConfidence < 2) {
    recommendations.push({
      type: 'low_confidence',
      priority: 'medium',
      message: 'ETA estimates have low confidence',
      action: 'Monitor real-time updates closely'
    });
  }

  return recommendations;
}

function calculateBounds(points) {
  if (points.length === 0) return null;
  
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs)
  };
}

module.exports = router;