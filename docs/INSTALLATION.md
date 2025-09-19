# Installation Guide

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (>= 20.0.0) - [Download](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)
- **Git** - [Download](https://git-scm.com/)

### Android Development
- **Android Studio** - [Download](https://developer.android.com/studio)
- **Android SDK** (API level 24 or higher)
- **Java Development Kit (JDK 11)**

### Environment Variables
Add these to your system environment variables:

```bash
# Windows
ANDROID_HOME=C:\Users\%USERNAME%\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\OpenJDK\openjdk-11

# macOS/Linux
export ANDROID_HOME=$HOME/Library/Android/sdk
export JAVA_HOME=/Library/Java/JavaVirtualMachines/openjdk-11.jdk/Contents/Home
```

## Step-by-Step Installation

### 1. Clone the Repository
```bash
git clone https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker.git
cd CVRBusTracker
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Configure Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Maps SDK for Android"
4. Create API key with Android app restrictions
5. Add your package name: `com.cvrbustracker`
6. Get your SHA-1 fingerprint:
   ```bash
   cd android && ./gradlew signingReport
   ```
7. Add SHA-1 to API key restrictions
8. Update the API key in:
   ```xml
   <!-- android/app/src/main/res/values/strings.xml -->
   <string name="google_maps_key">YOUR_API_KEY_HERE</string>
   ```

### 4. Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Add Android app with package name: `com.cvrbustracker`
4. Download `google-services.json`
5. Place it in `android/app/google-services.json`
6. Enable Realtime Database

### 5. Build and Run

#### For Android Device/Emulator
```bash
# Start Metro bundler
npm start

# In another terminal, run the app
npm run android
```

#### For Android Release Build
```bash
cd android
./gradlew assembleRelease
```

## Troubleshooting

### Common Issues

#### Metro bundler won't start
```bash
npx react-native start --reset-cache
```

#### Build fails with "ANDROID_HOME not found"
Make sure Android SDK path is correctly set in environment variables.

#### Google Maps not loading
- Check API key is correctly configured
- Verify SHA-1 fingerprint is added to API key restrictions
- Ensure "Maps SDK for Android" is enabled

#### Firebase connection issues
- Verify `google-services.json` is in correct location
- Check Firebase project configuration
- Ensure Realtime Database is enabled

### Getting Help
If you encounter issues:
1. Check our [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Search existing [GitHub Issues](https://github.com/Shaik-Faizan-Ahmed/CVRBusTracker/issues)
3. Create a new issue with detailed information