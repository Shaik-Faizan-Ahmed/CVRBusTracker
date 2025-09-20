# CVR Bus Tracker - Release v0.0.1

## Download

- **Android APK**: Available in GitHub Releases section (125MB APK file)

## Features

- Real-time bus tracking
- Interactive map view with Google Maps
- Route visualization
- Firebase integration for live data
- Location-based services with permissions
- Professional UI/UX design

## Installation

1. Download the APK from GitHub Releases
2. Enable "Unknown Sources" in Android settings
3. Install the APK file
4. Grant location permissions when prompted

## Requirements

- Android 7.0 (API level 24) or higher
- Location services enabled
- Internet connection for real-time data
- Google Play Services for maps

## Technical Details

- **Framework**: React Native 0.81.4
- **Platform**: Android
- **Build Type**: Debug (for testing)
- **Maps**: Google Maps integration
- **Database**: Firebase Realtime Database
- **Version**: 0.0.1
- **Build Date**: September 20, 2025

## Build Instructions

To build the APK yourself:

```bash
npm install
npm run android:release
```

The APK will be generated in `android/app/build/outputs/apk/debug/`