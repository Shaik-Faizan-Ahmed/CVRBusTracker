const mongoose = require('mongoose');

// Enhanced Tracking History Schema for Session 2
const TrackingHistorySchema = new mongoose.Schema({
  routeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route',
    required: true,
    index: true
  },
  trackerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  accuracy: {
    type: Number,
    default: 0 // GPS accuracy in meters
  },
  speed: {
    type: Number,
    default: 0 // Speed in km/h
  },
  heading: {
    type: Number,
    default: 0 // Direction in degrees (0-360)
  },
  altitude: {
    type: Number,
    default: 0 // Altitude in meters
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Enhanced tracking data for Session 2
  deviceInfo: {
    deviceId: String,
    platform: { type: String, enum: ['iOS', 'Android', 'Web'] },
    appVersion: String,
    batteryLevel: Number // 0-100
  },
  
  locationSource: {
    type: String,
    enum: ['GPS', 'Network', 'Passive', 'Fused'],
    default: 'GPS'
  },
  
  tripContext: {
    tripId: mongoose.Schema.Types.ObjectId,
    isActiveTrip: { type: Boolean, default: false },
    currentStopIndex: { type: Number, default: 0 },
    passengerCount: { type: Number, default: 0 },
    estimatedDelay: { type: Number, default: 0 } // in minutes
  },
  
  // Performance tracking
  networkInfo: {
    connectionType: { type: String, enum: ['wifi', '4g', '3g', '2g', 'offline'] },
    signalStrength: Number // 0-100
  },
  
  // Environmental data
  environmentalData: {
    temperature: Number, // in Celsius
    weather: String, // weather condition
    visibility: Number, // in meters
    roadCondition: { 
      type: String, 
      enum: ['good', 'fair', 'poor', 'construction', 'flooded'],
      default: 'good'
    }
  },
  
  // Analytics flags
  analytics: {
    isOutlier: { type: Boolean, default: false }, // Unusual location/speed
    qualityScore: { type: Number, default: 100, min: 0, max: 100 }, // Data quality
    processingFlags: [{
      flag: String,
      description: String,
      timestamp: { type: Date, default: Date.now }
    }]
  }

}, {
  timestamps: true, // Adds createdAt and updatedAt
  
  // Optimize for time-series queries
  timeseries: {
    timeField: 'timestamp',
    metaField: 'routeId',
    granularity: 'minutes'
  }
});

// Compound indexes for efficient queries
TrackingHistorySchema.index({ routeId: 1, timestamp: -1 });
TrackingHistorySchema.index({ trackerId: 1, timestamp: -1 });
TrackingHistorySchema.index({ 'tripContext.tripId': 1, timestamp: 1 });
TrackingHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // 30 days TTL

// Geospatial index for location-based queries
TrackingHistorySchema.index({ 
  location: '2dsphere' 
});

// Virtual for location as GeoJSON point
TrackingHistorySchema.virtual('location').get(function() {
  return {
    type: 'Point',
    coordinates: [this.longitude, this.latitude]
  };
});

// Pre-save middleware for data validation and enhancement
TrackingHistorySchema.pre('save', function(next) {
  // Calculate quality score based on accuracy, speed reasonableness, etc.
  let qualityScore = 100;
  
  // Reduce score for poor GPS accuracy
  if (this.accuracy > 50) qualityScore -= 20;
  if (this.accuracy > 100) qualityScore -= 30;
  
  // Check for unreasonable speed (buses typically don't exceed 80 kmph)
  if (this.speed > 80) {
    qualityScore -= 40;
    this.analytics.isOutlier = true;
    this.analytics.processingFlags.push({
      flag: 'high_speed',
      description: `Speed of ${this.speed} km/h seems unreasonable for a bus`
    });
  }
  
  // Check for zero coordinates (invalid GPS)
  if (this.latitude === 0 && this.longitude === 0) {
    qualityScore = 0;
    this.analytics.processingFlags.push({
      flag: 'invalid_coordinates',
      description: 'Coordinates are 0,0 which indicates GPS failure'
    });
  }
  
  this.analytics.qualityScore = qualityScore;
  next();
});

// Static methods for analytics and queries

// Get location history for a route within time range
TrackingHistorySchema.statics.getRouteHistory = function(routeId, startDate, endDate, limit = 1000) {
  return this.find({
    routeId,
    timestamp: { $gte: startDate, $lte: endDate },
    'analytics.qualityScore': { $gte: 50 } // Only include good quality data
  })
  .sort({ timestamp: 1 })
  .limit(limit)
  .select('latitude longitude timestamp speed heading accuracy tripContext');
};

// Get tracking data for specific trip
TrackingHistorySchema.statics.getTripHistory = function(tripId) {
  return this.find({
    'tripContext.tripId': tripId,
    'analytics.qualityScore': { $gte: 30 }
  })
  .sort({ timestamp: 1 })
  .select('latitude longitude timestamp speed heading accuracy passengerCount');
};

// Get average speed for route during specific time periods
TrackingHistorySchema.statics.getAverageSpeed = function(routeId, timeOfDay = null) {
  const matchCondition = {
    routeId,
    speed: { $gt: 0, $lt: 80 }, // Reasonable speed range
    'analytics.qualityScore': { $gte: 70 }
  };
  
  // Add time of day filter if specified
  if (timeOfDay) {
    const hourRange = this.getHourRange(timeOfDay);
    matchCondition.$expr = {
      $and: [
        { $gte: [{ $hour: '$timestamp' }, hourRange.start] },
        { $lte: [{ $hour: '$timestamp' }, hourRange.end] }
      ]
    };
  }
  
  return this.aggregate([
    { $match: matchCondition },
    { 
      $group: {
        _id: null,
        averageSpeed: { $avg: '$speed' },
        maxSpeed: { $max: '$speed' },
        minSpeed: { $min: '$speed' },
        dataPoints: { $sum: 1 }
      }
    }
  ]);
};

// Get location clusters (frequent stops/delays)
TrackingHistorySchema.statics.getLocationClusters = function(routeId, days = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        routeId,
        timestamp: { $gte: startDate },
        speed: { $lte: 5 }, // Stationary or very slow
        'analytics.qualityScore': { $gte: 60 }
      }
    },
    {
      $group: {
        _id: {
          lat: { $round: ['$latitude', 4] }, // Group by approximate location
          lng: { $round: ['$longitude', 4] }
        },
        count: { $sum: 1 },
        avgDuration: { $avg: '$tripContext.estimatedDelay' },
        locations: {
          $push: {
            lat: '$latitude',
            lng: '$longitude',
            timestamp: '$timestamp'
          }
        }
      }
    },
    {
      $match: { count: { $gte: 3 } } // At least 3 occurrences
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]);
};

// Helper method to convert time of day to hour range
TrackingHistorySchema.statics.getHourRange = function(timeOfDay) {
  switch (timeOfDay.toLowerCase()) {
    case 'morning':
      return { start: 6, end: 12 };
    case 'afternoon':
      return { start: 12, end: 17 };
    case 'evening':
      return { start: 17, end: 21 };
    case 'night':
      return { start: 21, end: 6 };
    default:
      return { start: 0, end: 23 };
  }
};

// Instance methods

// Calculate distance from previous location
TrackingHistorySchema.methods.calculateDistanceFromPrevious = async function() {
  const previousLocation = await this.constructor.findOne({
    routeId: this.routeId,
    timestamp: { $lt: this.timestamp }
  }).sort({ timestamp: -1 });
  
  if (!previousLocation) return 0;
  
  return this.calculateDistance(
    this.latitude, this.longitude,
    previousLocation.latitude, previousLocation.longitude
  );
};

// Calculate distance between two points
TrackingHistorySchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Check if this location is near a bus stop
TrackingHistorySchema.methods.getNearestStop = async function() {
  const Route = require('./Route');
  const route = await Route.findById(this.routeId);
  
  if (!route) return null;
  
  let nearestStop = null;
  let minDistance = Infinity;
  
  for (const stop of route.stops) {
    const distance = this.calculateDistance(
      this.latitude, this.longitude,
      stop.latitude, stop.longitude
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestStop = {
        stop: stop,
        distance: distance * 1000 // Convert to meters
      };
    }
  }
  
  return nearestStop;
};

module.exports = mongoose.model('TrackingHistory', TrackingHistorySchema);