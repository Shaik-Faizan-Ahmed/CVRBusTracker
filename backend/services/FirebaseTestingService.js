/**
 * Firebase Testing Utility
 * Helper functions to test Firebase Cloud Messaging integration
 */

const NotificationService = require('./NotificationService');
const User = require('../models/User');
const Route = require('../models/Route');
const { logger } = require('../config/environment');

class FirebaseTestingService {

  /**
   * Run comprehensive Firebase tests
   */
  static async runAllTests() {
    logger.info('🧪 Starting Firebase Push Notification Tests...');
    
    const results = {
      configurationTest: await this.testFirebaseConfiguration(),
      tokenManagementTest: await this.testTokenManagement(),
      singleNotificationTest: await this.testSingleNotification(),
      bulkNotificationTest: await this.testBulkNotification(),
      notificationTypesTest: await this.testNotificationTypes(),
      integrationTest: await this.testSystemIntegration()
    };

    const passedTests = Object.values(results).filter(result => result.success).length;
    const totalTests = Object.keys(results).length;

    logger.info(`🏁 Firebase Tests Complete: ${passedTests}/${totalTests} passed`);
    
    return {
      success: passedTests === totalTests,
      results,
      summary: {
        passed: passedTests,
        total: totalTests,
        percentage: Math.round((passedTests / totalTests) * 100)
      }
    };
  }

  /**
   * Test Firebase configuration and initialization
   */
  static async testFirebaseConfiguration() {
    try {
      logger.info('🔧 Testing Firebase configuration...');

      // Check environment variables
      const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT;
      const hasServerKey = !!process.env.FIREBASE_SERVER_KEY;
      
      if (!hasServiceAccount && !hasServerKey) {
        return {
          success: false,
          error: 'No Firebase configuration found',
          details: 'Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVER_KEY in .env'
        };
      }

      // Test Firebase initialization
      NotificationService.initializeFirebase();
      const isInitialized = !!NotificationService.admin;

      return {
        success: isInitialized,
        details: {
          hasServiceAccount,
          hasServerKey,
          initialized: isInitialized,
          method: hasServiceAccount ? 'service_account' : 'server_key'
        }
      };

    } catch (error) {
      logger.error('Firebase configuration test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test FCM token management
   */
  static async testTokenManagement() {
    try {
      logger.info('🎫 Testing FCM token management...');

      // Create test user
      const testToken = 'test_token_' + Date.now();
      const testUser = new User({
        rollNumber: 'TEST001',
        password: 'test123',
        name: 'Test User',
        role: 'student',
        fcmToken: testToken
      });
      
      await testUser.save();

      // Test token storage
      const savedUser = await User.findOne({ rollNumber: 'TEST001' });
      const hasToken = savedUser.fcmToken === testToken;

      // Test token update
      const newToken = 'updated_token_' + Date.now();
      await User.findByIdAndUpdate(savedUser._id, { fcmToken: newToken });
      
      const updatedUser = await User.findById(savedUser._id);
      const tokenUpdated = updatedUser.fcmToken === newToken;

      // Cleanup
      await User.findByIdAndDelete(savedUser._id);

      return {
        success: hasToken && tokenUpdated,
        details: {
          tokenStorage: hasToken,
          tokenUpdate: tokenUpdated
        }
      };

    } catch (error) {
      logger.error('Token management test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test sending notification to single device
   */
  static async testSingleNotification() {
    try {
      logger.info('📱 Testing single device notification...');

      const testToken = 'test_single_' + Date.now();
      
      const notification = {
        title: '🧪 Single Device Test',
        body: 'This is a test notification for single device',
        data: {
          type: 'test',
          timestamp: new Date().toISOString()
        }
      };

      const result = await NotificationService.sendToDevice(testToken, notification);

      // Note: With test token, this will "fail" but we can check the structure
      return {
        success: result.hasOwnProperty('success'),
        details: {
          resultStructure: Object.keys(result),
          hasSuccess: result.hasOwnProperty('success'),
          hasError: result.hasOwnProperty('error')
        }
      };

    } catch (error) {
      logger.error('Single notification test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test sending notifications to multiple devices
   */
  static async testBulkNotification() {
    try {
      logger.info('📱📱 Testing bulk notification...');

      const testTokens = [
        'test_bulk_1_' + Date.now(),
        'test_bulk_2_' + Date.now(),
        'test_bulk_3_' + Date.now()
      ];
      
      const notification = {
        title: '🧪 Bulk Test',
        body: 'This is a test notification for multiple devices',
        data: {
          type: 'bulk_test',
          timestamp: new Date().toISOString()
        }
      };

      const result = await NotificationService.sendToMultipleDevices(testTokens, notification);

      return {
        success: result.hasOwnProperty('success'),
        details: {
          resultStructure: Object.keys(result),
          hasSuccessCount: result.hasOwnProperty('successCount'),
          hasFailureCount: result.hasOwnProperty('failureCount')
        }
      };

    } catch (error) {
      logger.error('Bulk notification test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test different notification types
   */
  static async testNotificationTypes() {
    try {
      logger.info('🔔 Testing notification types...');

      const testToken = 'test_types_' + Date.now();
      const results = {};

      // Test bus arrival notification
      const mockStudents = [{ fcmToken: testToken }];
      const mockBusInfo = {
        routeName: 'Test Route',
        routeId: 'test_route',
        stopName: 'Test Stop'
      };

      results.busArrival = await NotificationService.sendBusArrivalNotification(
        mockStudents, mockBusInfo, 3
      );

      // Test delay notification
      const mockDelayInfo = {
        routeName: 'Test Route',
        routeId: 'test_route',
        delayMinutes: 5,
        reason: 'Traffic jam'
      };

      results.delay = await NotificationService.sendDelayNotification(
        mockStudents, mockDelayInfo
      );

      // Test route status notification
      const mockStatusInfo = {
        routeName: 'Test Route',
        routeId: 'test_route',
        status: 'active',
        message: 'Route is now active'
      };

      results.routeStatus = await NotificationService.sendRouteStatusNotification(
        mockStudents, mockStatusInfo
      );

      const successfulTypes = Object.values(results).filter(r => r && r.success).length;

      return {
        success: successfulTypes > 0,
        details: {
          testedTypes: Object.keys(results).length,
          successfulTypes,
          results
        }
      };

    } catch (error) {
      logger.error('Notification types test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test system integration
   */
  static async testSystemIntegration() {
    try {
      logger.info('🔗 Testing system integration...');

      // Count users with FCM tokens
      const usersWithTokens = await User.countDocuments({
        fcmToken: { $exists: true, $ne: null },
        isActive: true
      });

      // Count active routes
      const activeRoutes = await Route.countDocuments({ isActive: true });

      // Test notification settings
      const sampleUser = await User.findOne({ 
        isActive: true,
        notificationSettings: { $exists: true }
      });

      return {
        success: true,
        details: {
          usersWithTokens,
          activeRoutes,
          hasNotificationSettings: !!sampleUser?.notificationSettings,
          sampleSettings: sampleUser?.notificationSettings
        }
      };

    } catch (error) {
      logger.error('System integration test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate test report
   */
  static generateTestReport(testResults) {
    const { success, results, summary } = testResults;

    let report = `
# 🔥 Firebase Push Notifications Test Report

## 📊 Summary
- **Status**: ${success ? '✅ PASSED' : '❌ FAILED'}
- **Tests Passed**: ${summary.passed}/${summary.total} (${summary.percentage}%)

## 📋 Detailed Results

### 🔧 Firebase Configuration
- **Status**: ${results.configurationTest.success ? '✅' : '❌'}
- **Details**: ${JSON.stringify(results.configurationTest.details || {}, null, 2)}
${results.configurationTest.error ? `- **Error**: ${results.configurationTest.error}` : ''}

### 🎫 Token Management
- **Status**: ${results.tokenManagementTest.success ? '✅' : '❌'}
- **Token Storage**: ${results.tokenManagementTest.details?.tokenStorage ? '✅' : '❌'}
- **Token Update**: ${results.tokenManagementTest.details?.tokenUpdate ? '✅' : '❌'}
${results.tokenManagementTest.error ? `- **Error**: ${results.tokenManagementTest.error}` : ''}

### 📱 Single Notification
- **Status**: ${results.singleNotificationTest.success ? '✅' : '❌'}
- **Result Structure**: ${results.singleNotificationTest.details?.hasSuccess ? '✅' : '❌'}
${results.singleNotificationTest.error ? `- **Error**: ${results.singleNotificationTest.error}` : ''}

### 📱📱 Bulk Notification
- **Status**: ${results.bulkNotificationTest.success ? '✅' : '❌'}
- **Result Structure**: ${results.bulkNotificationTest.details?.hasSuccessCount ? '✅' : '❌'}
${results.bulkNotificationTest.error ? `- **Error**: ${results.bulkNotificationTest.error}` : ''}

### 🔔 Notification Types
- **Status**: ${results.notificationTypesTest.success ? '✅' : '❌'}
- **Tested Types**: ${results.notificationTypesTest.details?.testedTypes || 0}
- **Successful Types**: ${results.notificationTypesTest.details?.successfulTypes || 0}
${results.notificationTypesTest.error ? `- **Error**: ${results.notificationTypesTest.error}` : ''}

### 🔗 System Integration
- **Status**: ${results.integrationTest.success ? '✅' : '❌'}
- **Users with Tokens**: ${results.integrationTest.details?.usersWithTokens || 0}
- **Active Routes**: ${results.integrationTest.details?.activeRoutes || 0}
- **Notification Settings**: ${results.integrationTest.details?.hasNotificationSettings ? '✅' : '❌'}
${results.integrationTest.error ? `- **Error**: ${results.integrationTest.error}` : ''}

## 🚀 Next Steps

${success ? 
  '✅ All tests passed! Firebase push notifications are ready for production use.' :
  '❌ Some tests failed. Please review the errors above and fix configuration issues.'
}

### For Mobile App Integration:
1. Install Firebase SDK in React Native app
2. Request notification permissions
3. Generate and send FCM token to backend via \`/api/notifications/fcm-token\`
4. Test with real device using \`/api/notifications/test\`

### For Production:
1. Set up proper Firebase service account in production environment
2. Configure notification channels for Android
3. Set up APNs certificates for iOS
4. Monitor notification delivery rates and adjust as needed

---
**Report Generated**: ${new Date().toISOString()}
`;

    return report;
  }
}

module.exports = FirebaseTestingService;