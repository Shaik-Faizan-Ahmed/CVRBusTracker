// Socket.io configuration for real-time communication
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const configureSocket = (io) => {
  
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.user = user;
      
      console.log(`🔌 User connected: ${user.name} (${user.role})`);
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.userId}`);

    // Join route-specific rooms
    socket.on('join-route', (routeId) => {
      socket.join(`route-${routeId}`);
      console.log(`📍 User ${socket.userId} joined route ${routeId}`);
      
      socket.emit('route-joined', { 
        success: true, 
        routeId,
        message: 'Successfully joined route updates'
      });
    });

    // Leave route rooms
    socket.on('leave-route', (routeId) => {
      socket.leave(`route-${routeId}`);
      console.log(`🚪 User ${socket.userId} left route ${routeId}`);
    });

    // Handle location updates from trackers
    socket.on('tracker-location', (locationData) => {
      if (socket.userRole !== 'tracker') {
        socket.emit('error', { message: 'Only trackers can send location updates' });
        return;
      }

      const { routeId, latitude, longitude, accuracy, speed } = locationData;
      
      // Validate location data
      if (!routeId || !latitude || !longitude) {
        socket.emit('error', { message: 'Invalid location data' });
        return;
      }

      // Broadcast location update to all users following this route
      socket.to(`route-${routeId}`).emit('location-update', {
        routeId,
        location: {
          latitude,
          longitude,
          accuracy: accuracy || null,
          speed: speed || null,
          timestamp: new Date().toISOString()
        },
        tracker: {
          id: socket.userId,
          name: socket.user.name
        }
      });

      console.log(`📡 Location update from ${socket.user.name} for route ${routeId}`);
    });

    // Handle tracker status updates
    socket.on('tracker-status', (statusData) => {
      if (socket.userRole !== 'tracker') {
        socket.emit('error', { message: 'Only trackers can update status' });
        return;
      }

      const { routeId, status, message } = statusData;
      
      // Broadcast status update to route followers
      socket.to(`route-${routeId}`).emit('route-status', {
        routeId,
        status, // 'active', 'inactive', 'delayed', 'stopped'
        message,
        timestamp: new Date().toISOString(),
        tracker: {
          id: socket.userId,
          name: socket.user.name
        }
      });

      console.log(`📢 Status update from ${socket.user.name}: ${status}`);
    });

    // Handle delay reports from students
    socket.on('report-delay', (delayData) => {
      const { routeId, delayMinutes, reason } = delayData;
      
      // Broadcast delay report to all route followers
      io.to(`route-${routeId}`).emit('delay-reported', {
        routeId,
        delayMinutes,
        reason,
        reportedBy: socket.user.name,
        timestamp: new Date().toISOString()
      });

      console.log(`⏰ Delay reported by ${socket.user.name}: ${delayMinutes} minutes`);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      console.error(`❌ Socket error for user ${socket.userId}:`, error);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User ${socket.userId} disconnected: ${reason}`);
    });

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to CVR Bus Tracker',
      userId: socket.userId,
      role: socket.userRole,
      timestamp: new Date().toISOString()
    });
  });

  return io;
};

module.exports = configureSocket;