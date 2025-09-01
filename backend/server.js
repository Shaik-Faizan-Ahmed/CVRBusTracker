const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Environment and logging setup
require('dotenv').config();
const { validateEnvironment, logger } = require('./config/environment');
const HealthCheckService = require('./services/HealthCheckService');
const NotificationTriggerService = require('./services/NotificationTriggerService');
const GoogleMapsService = require('./services/GoogleMapsService');

// Validate environment before starting
validateEnvironment();

// Import routes
const authRoutes = require('./routes/auth');
const busRoutes = require('./routes/buses');
const trackingRoutes = require('./routes/tracking');
const notificationRoutes = require('./routes/notifications');
const advancedMappingRoutes = require('./routes/mapping/advancedMapping');

// Import socket configuration
const configureSocket = require('./config/socket');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Swagger API Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CVR Bus Tracker API',
      version: '1.0.0',
      description: 'Real-time bus tracking API for CVR College',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://cvr-bus-tracker.railway.app/api'
          : 'http://localhost:3000/api',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./routes/*.js'], // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

// Custom morgan logging with winston
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, `${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });
  });
  
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting with different limits for different endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.'
  },
  skip: (req) => req.url.includes('/profile') // Skip rate limit for profile endpoints
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

const trackingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 location updates per minute (1 per second)
  message: {
    success: false,
    error: 'Location updates too frequent, please slow down.'
  }
});

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/tracking/location', trackingLimiter);
app.use('/api/', generalLimiter);

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  logger.info('✅ Connected to MongoDB');
})
.catch((error) => {
  logger.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Configure Socket.io
configureSocket(io);

// Make io accessible to routes
app.set('io', io);

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customSiteTitle: 'CVR Bus Tracker API Documentation'
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/mapping', advancedMappingRoutes);

// Enhanced health check endpoints
app.get('/api/health', async (req, res) => {
  try {
    const healthReport = await HealthCheckService.checkSystemHealth();
    
    const statusCode = healthReport.status === 'healthy' ? 200 : 
                      healthReport.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthReport);
  } catch (error) {
    logger.error('Health check endpoint error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Quick health check for load balancers
app.get('/api/health/quick', async (req, res) => {
  try {
    const quickHealth = await HealthCheckService.quickCheck();
    const statusCode = quickHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(quickHealth);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Quick health check failed'
    });
  }
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'CVR Bus Tracker API',
    version: '1.0.0',
    documentation: '/api/docs',
    health: '/api/health',
    endpoints: {
      auth: '/api/auth',
      buses: '/api/buses', 
      tracking: '/api/tracking',
      notifications: '/api/notifications',
      mapping: '/api/mapping'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  logger.warn(`404 - API endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'API endpoint not found',
    availableEndpoints: ['/api/auth', '/api/buses', '/api/tracking', '/api/notifications', '/api/mapping', '/api/health', '/api/docs']
  });
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  // Log error with context
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: messages
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication token has expired'
    });
  }

  // MongoDB connection errors
  if (error.name === 'MongooseError') {
    return res.status(503).json({
      success: false,
      error: 'Database connection error'
    });
  }

  // Default error (don't expose internal details in production)
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(500).json({
    success: false,
    error: message
  });
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('🔌 HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logger.info('📴 MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('🔌 HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logger.info('📴 MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the server, but log the error
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  logger.info(`🚀 CVR Bus Tracker server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  logger.info(`🏥 Health Check: http://localhost:${PORT}/api/health`);
  
  // Initialize enhanced notification system
  NotificationTriggerService.initialize();
  logger.info('🔔 Proximity-based notification system started');
  
  // Initialize Google Maps Service
  const mapsInitialized = GoogleMapsService.initialize();
  if (mapsInitialized) {
    logger.info('🗺️ Google Maps Service initialized - Traffic features enabled');
  } else {
    logger.warn('⚠️ Google Maps Service not configured - Using fallback calculations');
  }
});

module.exports = app;