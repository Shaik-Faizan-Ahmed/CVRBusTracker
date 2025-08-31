const mongoose = require('mongoose');
const { logger } = require('../config/environment');

/**
 * Health Check Service
 * Monitors system health and provides detailed status
 */
class HealthCheckService {

  /**
   * Check overall system health
   * @returns {Object} Health status report
   */
  static async checkSystemHealth() {
    const healthReport = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {},
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };

    try {
      // Check database connectivity
      healthReport.checks.database = await this.checkDatabase();
      
      // Check memory usage
      healthReport.checks.memory = this.checkMemoryUsage();
      
      // Check disk space
      healthReport.checks.disk = this.checkDiskUsage();
      
      // Check environment configuration
      healthReport.checks.environment = this.checkEnvironmentConfig();
      
      // Check external services
      healthReport.checks.firebase = this.checkFirebaseConfig();

      // Determine overall status
      const allChecks = Object.values(healthReport.checks);
      const hasErrors = allChecks.some(check => check.status === 'error');
      const hasWarnings = allChecks.some(check => check.status === 'warning');

      if (hasErrors) {
        healthReport.status = 'unhealthy';
      } else if (hasWarnings) {
        healthReport.status = 'degraded';
      }

    } catch (error) {
      logger.error('Health check error:', error);
      healthReport.status = 'error';
      healthReport.error = error.message;
    }

    return healthReport;
  }

  /**
   * Check database connectivity and stats
   * @returns {Object} Database health status
   */
  static async checkDatabase() {
    try {
      const dbState = mongoose.connection.readyState;
      const stateMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };

      if (dbState !== 1) {
        return {
          status: 'error',
          message: `Database ${stateMap[dbState]}`,
          details: { connectionState: stateMap[dbState] }
        };
      }

      // Test database operation
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      // Get database stats
      const stats = await mongoose.connection.db.stats();

      return {
        status: 'healthy',
        message: 'Database connected and responsive',
        details: {
          connectionState: 'connected',
          responseTime: `${responseTime}ms`,
          databaseName: mongoose.connection.name,
          collections: stats.collections,
          dataSize: this.formatBytes(stats.dataSize),
          storageSize: this.formatBytes(stats.storageSize)
        }
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'Database connection failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check memory usage
   * @returns {Object} Memory usage status
   */
  static checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const freeMemory = process.memoryUsage().heapTotal - process.memoryUsage().heapUsed;
    const memoryUsagePercent = ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2);

    let status = 'healthy';
    if (memoryUsagePercent > 90) {
      status = 'error';
    } else if (memoryUsagePercent > 80) {
      status = 'warning';
    }

    return {
      status,
      message: `Memory usage: ${memoryUsagePercent}%`,
      details: {
        heapUsed: this.formatBytes(memUsage.heapUsed),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        external: this.formatBytes(memUsage.external),
        arrayBuffers: this.formatBytes(memUsage.arrayBuffers),
        usagePercent: `${memoryUsagePercent}%`
      }
    };
  }

  /**
   * Check disk usage (basic)
   * @returns {Object} Disk usage status
   */
  static checkDiskUsage() {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      return {
        status: 'healthy',
        message: 'Disk access working',
        details: {
          workingDirectory: process.cwd(),
          accessible: true
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: 'Disk access failed',
        details: { error: error.message }
      };
    }
  }

  /**
   * Check environment configuration
   * @returns {Object} Environment config status
   */
  static checkEnvironmentConfig() {
    const requiredVars = ['MONGODB_URI', 'JWT_SECRET'];
    const optionalVars = ['FIREBASE_SERVER_KEY', 'NODE_ENV'];
    
    const missing = requiredVars.filter(varName => !process.env[varName]);
    const optionalMissing = optionalVars.filter(varName => !process.env[varName]);

    let status = 'healthy';
    let message = 'All required environment variables configured';

    if (missing.length > 0) {
      status = 'error';
      message = `Missing required variables: ${missing.join(', ')}`;
    } else if (optionalMissing.length > 0) {
      status = 'warning';
      message = `Missing optional variables: ${optionalMissing.join(', ')}`;
    }

    return {
      status,
      message,
      details: {
        environment: process.env.NODE_ENV || 'development',
        requiredVariables: requiredVars.map(v => ({
          name: v,
          configured: !!process.env[v]
        })),
        optionalVariables: optionalVars.map(v => ({
          name: v,
          configured: !!process.env[v]
        }))
      }
    };
  }

  /**
   * Check Firebase configuration
   * @returns {Object} Firebase config status
   */
  static checkFirebaseConfig() {
    const hasServerKey = !!process.env.FIREBASE_SERVER_KEY;
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!hasServerKey && !hasServiceAccount) {
      return {
        status: 'warning',
        message: 'Firebase not configured - push notifications disabled',
        details: {
          serverKeyConfigured: false,
          serviceAccountConfigured: false,
          functionality: 'Push notifications will not work'
        }
      };
    }

    return {
      status: 'healthy',
      message: 'Firebase configured for push notifications',
      details: {
        serverKeyConfigured: hasServerKey,
        serviceAccountConfigured: hasServiceAccount,
        functionality: 'Push notifications available'
      }
    };
  }

  /**
   * Format bytes to human readable format
   * @param {Number} bytes 
   * @returns {String}
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Quick health check (for load balancer)
   * @returns {Object} Simple health status
   */
  static async quickCheck() {
    try {
      const dbConnected = mongoose.connection.readyState === 1;
      
      return {
        status: dbConnected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        database: dbConnected
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

module.exports = HealthCheckService;