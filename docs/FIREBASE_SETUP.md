# Firebase Push Notifications Setup Guide

## 📱 Firebase Cloud Messaging (FCM) Integration

This guide will help you set up Firebase Cloud Messaging for CVR Bus Tracker push notifications.

## 🚀 Quick Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `CVRBusTracker`
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Generate Service Account Key
1. In Firebase Console, go to **Project Settings** (gear icon)
2. Click **Service accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. Keep this file secure - it contains admin credentials

### 3. Configure Backend Environment
Add to your `.env` file:

```bash
# Method 1: Service Account (Recommended for Production)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}

# OR Method 2: Server Key (Legacy - for Development)
FIREBASE_SERVER_KEY=your_server_key_here
```

### 4. Mobile App Configuration

#### For React Native Android:
1. In Firebase Console, click **Add app** → **Android**
2. Enter package name: `com.cvrbusracker`
3. Download `google-services.json`
4. Place in `android/app/` directory
5. Follow the setup instructions in Firebase Console

#### For React Native iOS:
1. In Firebase Console, click **Add app** → **iOS**
2. Enter bundle ID: `com.cvrbustracker`
3. Download `GoogleService-Info.plist`
4. Add to iOS project in Xcode
5. Follow the setup instructions in Firebase Console

## 🧪 Testing Firebase Integration

### 1. Check Firebase Status
```bash
GET /api/notifications/firebase-status
Authorization: Bearer YOUR_JWT_TOKEN
```

Expected Response:
```json
{
  "success": true,
  "firebase": {
    "configured": true,
    "initialized": true,
    "hasServiceAccount": true,
    "method": "service_account"
  },
  "user": {
    "hasToken": false,
    "notificationsEnabled": {
      "busApproaching": true,
      "busArrival": true,
      "delays": true,
      "routeChanges": true
    }
  }
}
```

### 2. Update FCM Token
```bash
POST /api/notifications/fcm-token
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fcmToken": "test_token_from_mobile_app"
}
```

### 3. Send Test Notification
```bash
POST /api/notifications/test
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fcmToken": "test_token_from_mobile_app",
  "title": "Test Notification",
  "body": "Firebase is working!"
}
```

## 📊 Notification System Features

### ✅ Implemented Features

#### User Management
- **FCM Token Storage**: Users can update their Firebase tokens
- **Notification Settings**: Granular control over notification types
- **Automatic Cleanup**: Invalid tokens are automatically removed

#### Smart Notifications
- **Bus Approaching**: Sent when bus is 5-10 minutes away
- **Bus Arrival**: Sent when bus arrives at user's stop
- **Delay Alerts**: Automatic delay notifications with reasons
- **Route Status**: Active/inactive route notifications
- **Emergency Alerts**: Critical system-wide notifications

#### Admin Tools
- **Broadcast Notifications**: Send to all users or filtered groups
- **Statistics Dashboard**: Track notification usage and engagement
- **Token Management**: Monitor FCM token coverage and health

### 🔧 API Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| `POST` | `/api/notifications/fcm-token` | Update user's FCM token | All users |
| `GET/PUT` | `/api/notifications/settings` | Manage notification preferences | All users |
| `POST` | `/api/notifications/test` | Send test notification | All users |
| `POST` | `/api/notifications/broadcast` | Send broadcast notification | Admin only |
| `GET` | `/api/notifications/firebase-status` | Check Firebase configuration | All users |
| `GET` | `/api/notifications/stats` | Get notification statistics | Admin only |

## 🔔 Notification Types

### Automatic Notifications (via NotificationTriggerService)
1. **Bus Approaching** - Triggered by proximity detection
2. **Bus Arrival** - Triggered when bus reaches stop
3. **Delay Alerts** - Triggered when delays are detected
4. **Capacity Warnings** - Triggered when bus is overcrowded

### Manual Notifications (via Admin Panel)
1. **Route Status Changes** - Service disruptions/resumptions
2. **Emergency Alerts** - Critical safety or service information
3. **General Announcements** - College events, schedule changes
4. **Maintenance Alerts** - Planned service interruptions

## 🏗️ Integration with Existing Systems

### Real-time Tracking Integration
```javascript
// In tracking service
const NotificationService = require('./NotificationService');

// Trigger notifications based on location updates
if (busNearStop) {
  await NotificationService.sendBusArrivalNotification(
    studentsAtStop, 
    busInfo, 
    etaMinutes
  );
}
```

### Socket.io Integration
```javascript
// Broadcast to web clients + send push notifications
io.to(`route_${routeId}`).emit('bus_update', busData);
await NotificationService.sendBusArrivalNotification(students, busInfo, eta);
```

## 🔒 Security & Privacy

### Data Protection
- FCM tokens are stored securely with user records
- Tokens are automatically cleaned up when invalid
- Users control their notification preferences
- No personal data is included in push notification payloads

### Permission Management
- Students: Receive notifications for their assigned routes
- Trackers: Receive operational notifications
- Admins: Can send broadcasts and view statistics

## 🚨 Troubleshooting

### Common Issues

#### "Firebase not initialized"
- Check `.env` file for `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_SERVER_KEY`
- Ensure service account JSON is valid
- Verify Firebase project exists and is active

#### "Invalid FCM token"
- Token may have expired (tokens expire when app is uninstalled)
- Ensure mobile app is properly configured with Firebase
- Test with a fresh token from mobile app

#### "Notification not received"
- Check notification settings in user profile
- Verify app has notification permissions on device
- Test with Firebase Console's test message feature

### Debug Commands

#### Check System Health
```bash
GET /api/health
```

#### Verify Firebase Status
```bash
GET /api/notifications/firebase-status
```

#### View Notification Stats
```bash
GET /api/notifications/stats
Authorization: Bearer ADMIN_JWT_TOKEN
```

## 📈 Performance Considerations

### Batch Processing
- Notifications are sent in batches to multiple users
- Failed tokens are automatically cleaned up
- Rate limiting prevents spam

### Scalability
- Service supports unlimited users
- Firebase FCM has generous free tier limits
- Automatic token cleanup prevents database bloat

## 🎯 Next Steps for Mobile Integration

1. **Install Firebase SDK** in React Native app
2. **Request notification permissions** on app startup
3. **Generate FCM token** and send to backend
4. **Handle notification taps** and deep linking
5. **Test end-to-end** notification flow

---

**🔥 Firebase Push Notifications are now fully integrated and ready for testing!**

**Use the test endpoints to verify everything works before mobile app development.**