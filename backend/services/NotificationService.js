/**
 * Notification Service
 * Handles push notifications via Firebase Cloud Messaging
 */

class NotificationService {
  
  constructor() {
    // Firebase admin will be initialized when needed
    this.admin = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  initializeFirebase() {
    if (this.admin) return;

    try {
      const admin = require('firebase-admin');
      
      // Initialize with service account (in production)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
      } else if (process.env.FIREBASE_SERVER_KEY) {
        // Fallback to server key method for development
        console.log('Using Firebase server key for notifications');
      } else {
        console.warn('No Firebase configuration found. Notifications disabled.');
        return;
      }

      this.admin = admin;
      console.log('✅ Firebase initialized for notifications');
    } catch (error) {
      console.error('❌ Firebase initialization error:', error);
    }
  }

  /**
   * Send notification to a single device
   * @param {String} fcmToken - FCM token of the device
   * @param {Object} notification - {title, body, data}
   * @returns {Promise}
   */
  async sendToDevice(fcmToken, notification) {
    if (!fcmToken || !notification) {
      throw new Error('FCM token and notification data are required');
    }

    try {
      this.initializeFirebase();

      if (!this.admin) {
        console.warn('Firebase not initialized. Notification not sent.');
        return { success: false, error: 'Firebase not configured' };
      }

      const message = {
        token: fcmToken,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        android: {
          notification: {
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            channelId: 'bus_updates'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await this.admin.messaging().send(message);
      console.log('📱 Notification sent successfully:', response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Notification send error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple devices
   * @param {Array} fcmTokens - Array of FCM tokens
   * @param {Object} notification - {title, body, data}
   * @returns {Promise}
   */
  async sendToMultipleDevices(fcmTokens, notification) {
    if (!fcmTokens || !Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      throw new Error('FCM tokens array is required');
    }

    try {
      this.initializeFirebase();

      if (!this.admin) {
        console.warn('Firebase not initialized. Notifications not sent.');
        return { success: false, error: 'Firebase not configured' };
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        tokens: fcmTokens,
        android: {
          notification: {
            priority: 'high',
            defaultSound: true,
            defaultVibrateTimings: true,
            channelId: 'bus_updates'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await this.admin.messaging().sendMulticast(message);
      console.log(`📱 Sent ${response.successCount}/${fcmTokens.length} notifications`);
      
      // Log failed tokens for cleanup
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.warn(`Failed to send to token ${idx}:`, resp.error);
          }
        });
      }
      
      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('❌ Bulk notification send error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bus arrival notification to students waiting at a stop
   * @param {Array} students - Array of student objects with FCM tokens
   * @param {Object} busInfo - Bus and route information
   * @param {Number} etaMinutes - Estimated arrival time in minutes
   */
  async sendBusArrivalNotification(students, busInfo, etaMinutes) {
    if (!students || students.length === 0) return;

    const fcmTokens = students
      .filter(student => student.fcmToken)
      .map(student => student.fcmToken);

    if (fcmTokens.length === 0) {
      console.log('No FCM tokens found for students');
      return;
    }

    const notification = {
      title: '🚌 Bus Update',
      body: etaMinutes <= 2 
        ? `Your bus (${busInfo.routeName}) is arriving now!`
        : `Your bus (${busInfo.routeName}) will arrive in ${etaMinutes} minutes`,
      data: {
        type: 'bus_arrival',
        routeId: busInfo.routeId,
        routeName: busInfo.routeName,
        etaMinutes: etaMinutes.toString(),
        stopName: busInfo.stopName || ''
      }
    };

    return await this.sendToMultipleDevices(fcmTokens, notification);
  }

  /**
   * Send delay notification to all route followers
   * @param {Array} students - Array of student objects with FCM tokens
   * @param {Object} delayInfo - Delay information
   */
  async sendDelayNotification(students, delayInfo) {
    if (!students || students.length === 0) return;

    const fcmTokens = students
      .filter(student => student.fcmToken)
      .map(student => student.fcmToken);

    if (fcmTokens.length === 0) return;

    const notification = {
      title: '⏰ Bus Delayed',
      body: `${delayInfo.routeName} is delayed by ${delayInfo.delayMinutes} minutes. ${delayInfo.reason || ''}`,
      data: {
        type: 'bus_delay',
        routeId: delayInfo.routeId,
        routeName: delayInfo.routeName,
        delayMinutes: delayInfo.delayMinutes.toString(),
        reason: delayInfo.reason || ''
      }
    };

    return await this.sendToMultipleDevices(fcmTokens, notification);
  }

  /**
   * Send route status notification (active/inactive)
   * @param {Array} students - Array of student objects with FCM tokens
   * @param {Object} statusInfo - Status information
   */
  async sendRouteStatusNotification(students, statusInfo) {
    if (!students || students.length === 0) return;

    const fcmTokens = students
      .filter(student => student.fcmToken)
      .map(student => student.fcmToken);

    if (fcmTokens.length === 0) return;

    let title, body;
    switch (statusInfo.status) {
      case 'active':
        title = '✅ Bus Active';
        body = `${statusInfo.routeName} is now running`;
        break;
      case 'inactive':
        title = '❌ Bus Inactive';
        body = `${statusInfo.routeName} is not currently running`;
        break;
      case 'stopped':
        title = '🛑 Bus Stopped';
        body = `${statusInfo.routeName} has stopped. ${statusInfo.message || ''}`;
        break;
      default:
        title = '📢 Bus Update';
        body = `${statusInfo.routeName}: ${statusInfo.message || 'Status updated'}`;
    }

    const notification = {
      title,
      body,
      data: {
        type: 'route_status',
        routeId: statusInfo.routeId,
        routeName: statusInfo.routeName,
        status: statusInfo.status,
        message: statusInfo.message || ''
      }
    };

    return await this.sendToMultipleDevices(fcmTokens, notification);
  }

  /**
   * Clean up invalid FCM tokens from user records
   * @param {Array} invalidTokens - Array of invalid FCM tokens
   */
  async cleanupInvalidTokens(invalidTokens) {
    if (!invalidTokens || invalidTokens.length === 0) return;

    try {
      const User = require('../models/User');
      
      // Remove invalid tokens from user records
      await User.updateMany(
        { fcmToken: { $in: invalidTokens } },
        { $unset: { fcmToken: "" } }
      );

      console.log(`🧹 Cleaned up ${invalidTokens.length} invalid FCM tokens`);
    } catch (error) {
      console.error('❌ Token cleanup error:', error);
    }
  }

  /**
   * Test notification send (for debugging)
   * @param {String} fcmToken - Test FCM token
   */
  async sendTestNotification(fcmToken) {
    const notification = {
      title: '🧪 Test Notification',
      body: 'CVR Bus Tracker notifications are working!',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    return await this.sendToDevice(fcmToken, notification);
  }
}

// Export singleton instance
module.exports = new NotificationService();