const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema({
  rollNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['admin', 'tracker', 'student'],
    default: 'student',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Student-specific fields
  currentStop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route.stops'
  },
  assignedRoute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Route'
  },
  
  // Tracker-specific fields
  assignedBus: {
    busNumber: String,
    capacity: { type: Number, default: 50 }
  },
  
  // Notification settings
  fcmToken: {
    type: String,
    sparse: true
  },
  notificationSettings: {
    busApproaching: { type: Boolean, default: true },
    busArrival: { type: Boolean, default: true },
    delays: { type: Boolean, default: true },
    routeChanges: { type: Boolean, default: true }
  },
  
  // User activity tracking
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 0
  },
  
  // Profile information
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    sparse: true
  },
  
  // Location and preferences
  homeLocation: {
    latitude: Number,
    longitude: Number,
    address: String
  },
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'hi', 'te']
    },
    theme: {
      type: String,
      default: 'light',
      enum: ['light', 'dark', 'auto']
    }
  }

}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ rollNumber: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ assignedRoute: 1 });
UserSchema.index({ lastLogin: 1 });

// Virtual for full profile
UserSchema.virtual('fullProfile').get(function() {
  return {
    id: this._id,
    rollNumber: this.rollNumber,
    name: this.name,
    role: this.role,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    assignedRoute: this.assignedRoute,
    currentStop: this.currentStop,
    notificationSettings: this.notificationSettings,
    preferences: this.preferences
  };
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to increment login count on lastLogin update
UserSchema.pre('save', function(next) {
  if (this.isModified('lastLogin') && !this.isNew) {
    this.loginCount += 1;
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to update last login
UserSchema.methods.updateLastLogin = function() {
  this.lastLogin = new Date();
  this.loginCount += 1;
  return this.save();
};

// Method to check if user can access route
UserSchema.methods.canAccessRoute = function(routeId) {
  // Admin can access all routes
  if (this.role === 'admin') return true;
  
  // Tracker can access assigned route
  if (this.role === 'tracker' && this.assignedRoute) {
    return this.assignedRoute.toString() === routeId.toString();
  }
  
  // Student can access assigned route
  if (this.role === 'student' && this.assignedRoute) {
    return this.assignedRoute.toString() === routeId.toString();
  }
  
  return false;
};

// Method to get user's role permissions
UserSchema.methods.getPermissions = function() {
  const permissions = {
    canViewAllRoutes: false,
    canEditRoutes: false,
    canManageUsers: false,
    canTrackLocation: false,
    canReceiveNotifications: true,
    canViewAnalytics: false
  };
  
  switch (this.role) {
    case 'admin':
      permissions.canViewAllRoutes = true;
      permissions.canEditRoutes = true;
      permissions.canManageUsers = true;
      permissions.canViewAnalytics = true;
      break;
    case 'tracker':
      permissions.canTrackLocation = true;
      permissions.canViewAnalytics = true;
      break;
    case 'student':
      // Students have default permissions
      break;
  }
  
  return permissions;
};

// Static method to find by roll number
UserSchema.statics.findByRollNumber = function(rollNumber) {
  return this.findOne({ 
    rollNumber: rollNumber.toUpperCase(),
    isActive: true 
  });
};

// Static method to get users by role
UserSchema.statics.getUsersByRole = function(role) {
  return this.find({ 
    role: role,
    isActive: true 
  }).select('-password');
};

// Static method to get active trackers
UserSchema.statics.getActiveTrackers = function() {
  return this.find({ 
    role: 'tracker',
    isActive: true 
  }).populate('assignedRoute', 'name routeCode');
};

// Static method to get students by route
UserSchema.statics.getStudentsByRoute = function(routeId) {
  return this.find({ 
    role: 'student',
    assignedRoute: routeId,
    isActive: true 
  }).select('-password');
};

// Method to safely update profile
UserSchema.methods.updateProfile = function(updateData) {
  const allowedUpdates = ['name', 'email', 'phoneNumber', 'fcmToken', 'notificationSettings', 'preferences', 'homeLocation'];
  const updates = {};
  
  for (const key of allowedUpdates) {
    if (updateData[key] !== undefined) {
      updates[key] = updateData[key];
    }
  }
  
  Object.assign(this, updates);
  return this.save();
};

// Method to assign route to user
UserSchema.methods.assignRoute = function(routeId, stopId = null) {
  this.assignedRoute = routeId;
  if (stopId && this.role === 'student') {
    this.currentStop = stopId;
  }
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);