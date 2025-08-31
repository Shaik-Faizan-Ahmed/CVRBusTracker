const winston = require('winston');

// Environment validation
const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('💡 Please copy .env.example to .env and configure the required variables');
    process.exit(1);
  }

  // Warn about optional variables
  const optionalVars = {
    'FIREBASE_SERVER_KEY': 'Push notifications will not work',
    'NODE_ENV': 'Defaulting to development mode'
  };

  Object.entries(optionalVars).forEach(([varName, warning]) => {
    if (!process.env[varName]) {
      console.warn(`⚠️ ${varName} not set: ${warning}`);
    }
  });

  console.log('✅ Environment validation passed');
};

// Configure winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, stack }) => {
      return `${timestamp} [${level}]: ${stack || message}`;
    })
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true
    })
  ]
});

// In production, also log to file
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    handleExceptions: true
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    handleExceptions: true
  }));
}

module.exports = {
  validateEnvironment,
  logger
};