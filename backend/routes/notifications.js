const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { validateSchema } = require('../middleware/validation');
const Joi = require('joi');
const User = require('../models/User');
const Route = require('../models/Route');
const NotificationService = require('../services/NotificationService');
const FirebaseTestingService = require('../services/FirebaseTestingService');
const logger = require('../config/environment').logger;

/**
 * @swagger
 * components:
 *   schemas:
 *     FCMTokenUpdate:
 *       type: object
 *       required:
 *         - fcmToken
 *       properties:
 *         fcmToken:
 *           type: string
 *           description: Firebase Cloud Messaging token
 *           example: "dGhpc19pc19hX3Rlc3RfdG9rZW4"
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         busApproaching:
 *           type: boolean
 *           example: true
 *         busArrival:
 *           type: boolean
 *           example: true
 *         delays:
 *           type: boolean
 *           example: true
 *         routeChanges:
 *           type: boolean
 *           example: true
 *     TestNotification:
 *       type: object
 *       required:
 *         - fcmToken
 *       properties:
 *         fcmToken:
 *           type: string
 *           description: FCM token to test
 *         title:
 *           type: string
 *           example: "Test Notification"
 *         body:
 *           type: string
 *           example: "This is a test notification"
 */

// Validation schemas
const fcmTokenSchema = Joi.object({
  fcmToken: Joi.string().required().trim()
});

const notificationSettingsSchema = Joi.object({
  busApproaching: Joi.boolean().optional(),
  busArrival: Joi.boolean().optional(),
  delays: Joi.boolean().optional(),
  routeChanges: Joi.boolean().optional()
});

const testNotificationSchema = Joi.object({
  fcmToken: Joi.string().required().trim(),
  title: Joi.string().optional().max(100),
  body: Joi.string().optional().max(500)
});

const broadcastNotificationSchema = Joi.object({
  routeId: Joi.string().optional(),
  role: Joi.string().valid('student', 'tracker').optional(),
  title: Joi.string().required().max(100),
  body: Joi.string().required().max(500),
  data: Joi.object().optional()
});

/**
 * @swagger
 * /api/notifications/fcm-token:
 *   post:
 *     summary: Update user's FCM token
 *     description: Updates the Firebase Cloud Messaging token for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FCMTokenUpdate'
 *     responses:
 *       200:
 *         description: FCM token updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "FCM token updated successfully"
 *       400:
 *         description: Invalid FCM token
 *       401:
 *         description: Unauthorized
 */
router.post('/fcm-token', 
  auth, 
  validateSchema(fcmTokenSchema), 
  async (req, res) => {
    try {
      const { fcmToken } = req.body;
      const userId = req.user.id;

      await User.findByIdAndUpdate(userId, { fcmToken });

      logger.info(`FCM token updated for user ${req.user.rollNumber}`, {
        userId,
        hasToken: !!fcmToken
      });

      res.json({
        success: true,
        message: 'FCM token updated successfully'
      });

    } catch (error) {
      logger.error('FCM token update error:', {
        error: error.message,
        userId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update FCM token'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update notification settings
 *     description: Updates notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationSettings'
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/settings', 
  auth, 
  validateSchema(notificationSettingsSchema), 
  async (req, res) => {
    try {
      const userId = req.user.id;
      const settings = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Update notification settings
      Object.assign(user.notificationSettings, settings);
      await user.save();

      logger.info(`Notification settings updated for user ${user.rollNumber}`, {
        userId,
        settings
      });

      res.json({
        success: true,
        message: 'Notification settings updated successfully',
        settings: user.notificationSettings
      });

    } catch (error) {
      logger.error('Notification settings update error:', {
        error: error.message,
        userId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to update notification settings'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get notification settings
 *     description: Retrieves current notification preferences for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 settings:
 *                   $ref: '#/components/schemas/NotificationSettings'
 */
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      settings: user.notificationSettings,
      hasFirebaseToken: !!user.fcmToken
    });

  } catch (error) {
    logger.error('Get notification settings error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification settings'
    });
  }
});

/**
 * @swagger
 * /api/notifications/test-firebase:
 *   post:
 *     summary: Run Firebase system tests
 *     description: Comprehensive Firebase push notification testing (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test results
 *       403:
 *         description: Admin access required
 */
router.post('/test-firebase', auth, async (req, res) => {
  try {
    // Only admins can run system tests
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    logger.info(`Firebase system test initiated by admin ${req.user.rollNumber}`);
    
    const testResults = await FirebaseTestingService.runAllTests();
    const report = FirebaseTestingService.generateTestReport(testResults);

    logger.info(`Firebase tests completed: ${testResults.summary.passed}/${testResults.summary.total} passed`);

    res.json({
      success: true,
      message: 'Firebase testing completed',
      results: testResults,
      report: report
    });

  } catch (error) {
    logger.error('Firebase testing error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to run Firebase tests'
    });
  }
});

/**
 * @swagger
 * /api/notifications/test-user:
 *   post:
 *     summary: Send test notification to current user
 *     description: Sends a test notification to the authenticated user's FCM token
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       400:
 *         description: No FCM token found for user
 */
router.post('/test-user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'No FCM token found. Please update your token first.'
      });
    }

    const result = await NotificationService.sendTestNotification(user.fcmToken);

    if (result.success) {
      logger.info(`Test notification sent to user ${user.rollNumber}`, {
        userId: user._id,
        messageId: result.messageId
      });

      res.json({
        success: true,
        message: 'Test notification sent to your device',
        messageId: result.messageId
      });
    } else {
      logger.warn(`Test notification failed for user ${user.rollNumber}`, {
        userId: user._id,
        error: result.error
      });

      res.status(500).json({
        success: false,
        error: result.error || 'Failed to send test notification'
      });
    }

  } catch (error) {
    logger.error('User test notification error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to send test notification'
    });
  }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: Send test notification
 *     description: Sends a test push notification to verify Firebase setup
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestNotification'
 *     responses:
 *       200:
 *         description: Test notification sent successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Firebase not configured or send failed
 */
router.post('/test', 
  auth, 
  validateSchema(testNotificationSchema), 
  async (req, res) => {
    try {
      const { fcmToken, title, body } = req.body;

      const result = await NotificationService.sendTestNotification(fcmToken);

      if (result.success) {
        logger.info(`Test notification sent successfully`, {
          userId: req.user.id,
          messageId: result.messageId
        });

        res.json({
          success: true,
          message: 'Test notification sent successfully',
          messageId: result.messageId
        });
      } else {
        logger.warn(`Test notification failed`, {
          userId: req.user.id,
          error: result.error
        });

        res.status(500).json({
          success: false,
          error: result.error || 'Failed to send test notification'
        });
      }

    } catch (error) {
      logger.error('Test notification error:', {
        error: error.message,
        userId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to send test notification'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/broadcast:
 *   post:
 *     summary: Broadcast notification to users
 *     description: Send notification to multiple users (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               routeId:
 *                 type: string
 *                 description: Send to users on specific route
 *               role:
 *                 type: string
 *                 enum: [student, tracker]
 *                 description: Send to users with specific role
 *               title:
 *                 type: string
 *                 maxLength: 100
 *               body:
 *                 type: string
 *                 maxLength: 500
 *               data:
 *                 type: object
 *                 description: Additional data to include
 *     responses:
 *       200:
 *         description: Broadcast sent successfully
 *       403:
 *         description: Admin access required
 */
router.post('/broadcast', 
  auth, 
  validateSchema(broadcastNotificationSchema), 
  async (req, res) => {
    try {
      // Only admins can broadcast
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }

      const { routeId, role, title, body, data } = req.body;

      // Build user query
      const query = { isActive: true, fcmToken: { $exists: true, $ne: null } };
      
      if (routeId) {
        query.assignedRoute = routeId;
      }
      if (role) {
        query.role = role;
      }

      const users = await User.find(query).select('fcmToken rollNumber name');
      
      if (users.length === 0) {
        return res.json({
          success: true,
          message: 'No users found matching criteria',
          sentCount: 0
        });
      }

      const fcmTokens = users.map(user => user.fcmToken);

      const notification = {
        title,
        body,
        data: {
          type: 'broadcast',
          ...data
        }
      };

      const result = await NotificationService.sendToMultipleDevices(fcmTokens, notification);

      logger.info(`Broadcast notification sent`, {
        adminId: req.user.id,
        targetUsers: users.length,
        successCount: result.successCount,
        failureCount: result.failureCount,
        routeId,
        role
      });

      res.json({
        success: true,
        message: 'Broadcast notification sent',
        targetUsers: users.length,
        sentCount: result.successCount,
        failedCount: result.failureCount
      });

    } catch (error) {
      logger.error('Broadcast notification error:', {
        error: error.message,
        userId: req.user.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Failed to send broadcast notification'
      });
    }
  }
);

/**
 * @swagger
 * /api/notifications/firebase-status:
 *   get:
 *     summary: Check Firebase configuration status
 *     description: Returns Firebase setup status and configuration info
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Firebase status retrieved successfully
 */
router.get('/firebase-status', auth, async (req, res) => {
  try {
    // Initialize Firebase to check status
    NotificationService.initializeFirebase();

    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const hasServerKey = !!process.env.FIREBASE_SERVER_KEY;
    const isInitialized = !!NotificationService.admin;

    res.json({
      success: true,
      firebase: {
        configured: hasServiceAccount || hasServerKey,
        initialized: isInitialized,
        hasServiceAccount,
        hasServerKey,
        method: hasServiceAccount ? 'service_account' : hasServerKey ? 'server_key' : 'none'
      },
      user: {
        hasToken: !!req.user.fcmToken,
        notificationsEnabled: req.user.notificationSettings
      }
    });

  } catch (error) {
    logger.error('Firebase status check error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to check Firebase status'
    });
  }
});

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     description: Returns notification usage statistics (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification statistics retrieved successfully
 */
router.get('/stats', auth, async (req, res) => {
  try {
    // Only admins can view stats
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const totalUsers = await User.countDocuments({ isActive: true });
    const usersWithTokens = await User.countDocuments({ 
      isActive: true, 
      fcmToken: { $exists: true, $ne: null } 
    });
    const studentTokens = await User.countDocuments({ 
      isActive: true, 
      role: 'student',
      fcmToken: { $exists: true, $ne: null } 
    });
    const trackerTokens = await User.countDocuments({ 
      isActive: true, 
      role: 'tracker',
      fcmToken: { $exists: true, $ne: null } 
    });

    // Notification settings analysis
    const notificationSettings = await User.aggregate([
      { $match: { isActive: true } },
      { 
        $group: {
          _id: null,
          busApproaching: { 
            $sum: { $cond: ['$notificationSettings.busApproaching', 1, 0] } 
          },
          busArrival: { 
            $sum: { $cond: ['$notificationSettings.busArrival', 1, 0] } 
          },
          delays: { 
            $sum: { $cond: ['$notificationSettings.delays', 1, 0] } 
          },
          routeChanges: { 
            $sum: { $cond: ['$notificationSettings.routeChanges', 1, 0] } 
          }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          withTokens: usersWithTokens,
          students: studentTokens,
          trackers: trackerTokens,
          tokenCoverage: totalUsers > 0 ? (usersWithTokens / totalUsers * 100).toFixed(1) : 0
        },
        settings: notificationSettings[0] || {
          busApproaching: 0,
          busArrival: 0,
          delays: 0,
          routeChanges: 0
        },
        firebase: {
          configured: !!(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVER_KEY),
          initialized: !!NotificationService.admin
        }
      }
    });

  } catch (error) {
    logger.error('Notification stats error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification statistics'
    });
  }
});


/**
 * @swagger
 * /api/notifications/simulate-bus-arrival:
 *   post:
 *     summary: Simulate bus arrival notification
 *     description: Simulate a bus arrival scenario for testing (Admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routeId
 *               - stopId
 *               - etaMinutes
 *             properties:
 *               routeId:
 *                 type: string
 *                 description: Route ID to simulate
 *               stopId:
 *                 type: string
 *                 description: Stop ID where bus is arriving
 *               etaMinutes:
 *                 type: number
 *                 description: ETA in minutes
 *                 minimum: 0
 *                 maximum: 60
 *     responses:
 *       200:
 *         description: Simulation completed successfully
 *       403:
 *         description: Admin access required
 *       404:
 *         description: Route or stop not found
 */
router.post('/simulate-bus-arrival', auth, async (req, res) => {
  try {
    // Only admins can run simulations
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const { routeId, stopId, etaMinutes } = req.body;

    // Validate input
    if (!routeId || !stopId || etaMinutes === undefined) {
      return res.status(400).json({
        success: false,
        error: 'routeId, stopId, and etaMinutes are required'
      });
    }

    // Find route and stop
    const route = await Route.findById(routeId);
    if (!route) {
      return res.status(404).json({
        success: false,
        error: 'Route not found'
      });
    }

    const stop = route.stops.find(s => s._id.toString() === stopId);
    if (!stop) {
      return res.status(404).json({
        success: false,
        error: 'Stop not found on this route'
      });
    }

    // Find students at this stop
    const students = await User.find({
      role: 'student',
      assignedRoute: routeId,
      currentStop: stopId,
      isActive: true,
      fcmToken: { $exists: true, $ne: null }
    });

    if (students.length === 0) {
      return res.json({
        success: true,
        message: 'No students found at this stop with FCM tokens',
        studentsNotified: 0
      });
    }

    // Send bus arrival notifications
    const busInfo = {
      routeId: route._id.toString(),
      routeName: route.name,
      stopName: stop.name
    };

    const result = await NotificationService.sendBusArrivalNotification(
      students,
      busInfo,
      etaMinutes
    );

    logger.info(`Bus arrival simulation completed`, {
      adminId: req.user.id,
      routeId,
      stopId,
      etaMinutes,
      studentsNotified: students.length,
      successCount: result?.successCount || 0
    });

    res.json({
      success: true,
      message: 'Bus arrival simulation completed',
      route: {
        id: route._id,
        name: route.name
      },
      stop: {
        id: stop._id,
        name: stop.name
      },
      etaMinutes,
      studentsNotified: students.length,
      notificationResult: result
    });

  } catch (error) {
    logger.error('Bus arrival simulation error:', {
      error: error.message,
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to simulate bus arrival'
    });
  }
});

module.exports = router;