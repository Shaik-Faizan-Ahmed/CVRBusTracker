const mongoose = require('mongoose');

// Bus Stop Schema
const BusStopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  order: {
    type: Number,
    required: true,
    min: 1
  },
  estimatedTime: {
    type: Number, // in minutes from start
    default: 0
  },
  address: {
    type: String,
    trim: true
  },
  landmark: {
    type: String,
    trim: true
  },
  // Enhanced features for Session 2
  averageWaitTime: {
    type: Number,
    default: 2 // average wait time in minutes
  },
  passengerLoad: {
    morning: { type: Number, default: 0 },
    evening: { type: Number, default: 0 }
  },
  accessibility: {
    wheelchairAccessible: { type: Boolean, default: false },
    covered: { type: Boolean, default: false }
  }
}, { _id: true });

// Schedule Schema for different days and times
const ScheduleSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    required: true
  },
  trips: [{
    departureTime: {
      type: String, // Format: "HH:MM" (24-hour)
      required: true
    },
    type: {
      type: String,
      enum: ['morning', 'evening', 'regular'],
      default: 'regular'
    },
    capacity: {
      type: Number,
      default: 50
    },
    estimatedDuration: {
      type: Number, // total trip duration in minutes
      default: 30
    }
  }]
}, { _id: false });

// Historical Performance Schema (New for Session 2)
const PerformanceMetricsSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  averageDelay: {
    type: Number,
    default: 0 // in minutes
  },
  onTimePerformance: {
    type: Number,
    default: 100 // percentage
  },
  passengerCount: {
    total: { type: Number, default: 0 },
    morning: { type: Number, default: 0 },
    evening: { type: Number, default: 0 }
  },
  feedback: {
    rating: { type: Number, min: 1, max: 5, default: 5 },
    complaints: { type: Number, default: 0 }
  }
}, { _id: false });

// Route Schema
const RouteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  routeCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  stops: [BusStopSchema],
  tracker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  currentLocation: {
    latitude: Number,
    longitude: Number,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    speed: {
      type: Number,
      default: 0
    },
    heading: {
      type: Number,
      default: 0
    },
    accuracy: {
      type: Number,
      default: 0
    }
  },
  schedule: [ScheduleSchema],
  
  // Enhanced Settings for Session 2
  settings: {
    notificationRadius: {
      type: Number,
      default: 500 // meters
    },
    etaCalculationMethod: {
      type: String,
      enum: ['simple', 'traffic-aware', 'historical'],
      default: 'historical'
    },
    maxCapacity: {
      type: Number,
      default: 50
    },
    allowOverbooking: {
      type: Boolean,
      default: false
    },
    emergencyContact: {
      type: String,
      trim: true
    },
    routeType: {
      type: String,
      enum: ['regular', 'express', 'circular'],
      default: 'regular'
    },
    operatingDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    specialInstructions: {
      type: String,
      trim: true
    }
  },

  // New Analytics and Performance Tracking (Session 2)
  analytics: {
    totalTrips: { type: Number, default: 0 },
    totalPassengers: { type: Number, default: 0 },
    averageRating: { type: Number, default: 5, min: 1, max: 5 },
    popularStops: [{
      stopId: mongoose.Schema.Types.ObjectId,
      count: Number
    }],
    peakHours: {
      morning: { start: String, end: String },
      evening: { start: String, end: String }
    },
    performanceHistory: [PerformanceMetricsSchema]
  },

  // Current Trip Information
  currentTrip: {
    isActive: { type: Boolean, default: false },
    departureTime: Date,
    currentStopIndex: { type: Number, default: 0 },
    passengerCount: { type: Number, default: 0 },
    delays: [{
      stopId: mongoose.Schema.Types.ObjectId,
      delayMinutes: Number,
      reason: String,
      timestamp: { type: Date, default: Date.now }
    }],
    expectedArrival: Date
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
RouteSchema.index({ isActive: 1, name: 1 });
RouteSchema.index({ tracker: 1 });
RouteSchema.index({ 'currentLocation.lastUpdated': 1 });
RouteSchema.index({ routeCode: 1 }, { unique: true, sparse: true });

// Virtual for total distance calculation
RouteSchema.virtual('totalDistance').get(function() {
  if (!this.stops || this.stops.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < this.stops.length; i++) {
    const prev = this.stops[i - 1];
    const curr = this.stops[i];
    // Haversine formula calculation
    const distance = calculateDistance(
      prev.latitude, prev.longitude,
      curr.latitude, curr.longitude
    );
    totalDistance += distance;
  }
  return Math.round(totalDistance * 100) / 100; // Round to 2 decimal places
});

// Virtual for estimated total time
RouteSchema.virtual('estimatedTotalTime').get(function() {
  if (!this.stops || this.stops.length === 0) return 0;
  const lastStop = this.stops[this.stops.length - 1];
  return lastStop.estimatedTime || 0;
});

// Virtual for current occupancy percentage
RouteSchema.virtual('currentOccupancy').get(function() {
  if (!this.currentTrip.isActive || !this.settings.maxCapacity) return 0;
  return Math.round((this.currentTrip.passengerCount / this.settings.maxCapacity) * 100);
});

// Pre-save middleware to generate route code if not provided
RouteSchema.pre('save', function(next) {
  if (!this.routeCode && this.name) {
    // Generate route code from name (first 3 letters + random number)
    const nameCode = this.name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.routeCode = `${nameCode}${randomNum}`;
  }
  next();
});

// Method to calculate ETA to specific stop
RouteSchema.methods.calculateETAToStop = function(stopIndex, currentLocation) {
  if (!this.stops[stopIndex] || !currentLocation) return null;
  
  const targetStop = this.stops[stopIndex];
  const distance = calculateDistance(
    currentLocation.latitude, currentLocation.longitude,
    targetStop.latitude, targetStop.longitude
  );
  
  // Enhanced ETA calculation based on method setting
  let estimatedMinutes;
  switch (this.settings.etaCalculationMethod) {
    case 'traffic-aware':
      // Simple traffic awareness (add 20% for congestion)
      estimatedMinutes = (distance / 0.5) * 1.2; // Assuming 30 kmph average with traffic
      break;
    case 'historical':
      // Use historical data if available
      const historicalData = this.analytics.performanceHistory.slice(-7); // Last 7 days
      const avgDelay = historicalData.reduce((sum, day) => sum + day.averageDelay, 0) / historicalData.length || 0;
      estimatedMinutes = (distance / 0.5) + avgDelay;
      break;
    default: // simple
      estimatedMinutes = distance / 0.5; // Assuming 30 kmph average
  }
  
  return Math.ceil(estimatedMinutes);
};

// Method to update performance metrics
RouteSchema.methods.updatePerformanceMetrics = function(metrics) {
  const today = new Date().toDateString();
  const existingMetrics = this.analytics.performanceHistory.find(
    p => new Date(p.date).toDateString() === today
  );
  
  if (existingMetrics) {
    Object.assign(existingMetrics, metrics);
  } else {
    this.analytics.performanceHistory.push({
      date: new Date(),
      ...metrics
    });
  }
  
  // Keep only last 30 days of performance data
  if (this.analytics.performanceHistory.length > 30) {
    this.analytics.performanceHistory = this.analytics.performanceHistory.slice(-30);
  }
  
  return this.save();
};

// Method to get popular boarding/alighting stops
RouteSchema.methods.getPopularStops = function() {
  return this.analytics.popularStops.sort((a, b) => b.count - a.count).slice(0, 5);
};

// Helper function for distance calculation (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

module.exports = mongoose.model('Route', RouteSchema);