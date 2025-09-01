# GOOGLE CLI TASK REQUEST

## 🎯 TASK SUMMARY
Initialize React Native CLI project for CVRBusTracker mobile app with all required dependencies and proper project structure.

## 📁 SPECIFIC ACTIONS REQUIRED

### 1. Navigate to Mobile Directory
```bash
cd D:\vibecoding\CVRBusTracker\mobile
```

### 2. Initialize React Native CLI Project (if not already done)
```bash
# If package.json is empty/missing, initialize new RN project
npx react-native init CVRBusTracker --template react-native-template-typescript
# OR if project exists, just install dependencies
npm install
```

### 3. Install Core Dependencies
```bash
npm install @react-navigation/native @react-navigation/stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context
npm install react-native-maps react-native-geolocation-service
npm install @react-native-async-storage/async-storage
npm install react-native-vector-icons
npm install socket.io-client
npm install axios
```

### 4. Install Development Dependencies
```bash
npm install --save-dev @babel/core @babel/runtime
npm install --save-dev metro-react-native-babel-preset
```

### 5. Android Setup (if needed)
```bash
cd android
# Ensure gradlew has execute permissions
chmod +x gradlew
cd ..
```

### 6. iOS Setup (if on macOS and needed)
```bash
cd ios
pod install
cd ..
```

## 🗂️ EXPECTED FILE STRUCTURE AFTER COMPLETION
```
mobile/
├── android/
├── ios/
├── src/
│   ├── components/
│   ├── screens/
│   ├── navigation/
│   ├── services/
│   └── utils/
├── package.json (with all dependencies)
├── node_modules/
├── babel.config.js
├── metro.config.js
└── index.js
```

## ✅ CONFIRMATION CHECKLIST
- [ ] React Native CLI project properly initialized
- [ ] All navigation dependencies installed successfully
- [ ] React Native Maps and location services installed
- [ ] Socket.io client and axios installed
- [ ] node_modules folder exists with all packages
- [ ] Android project can build (gradlew permissions set)
- [ ] No npm/dependency installation errors

## 🔄 WHAT CLAUDE WILL DO NEXT
After CLI completion, I will:
1. Create the main App.js with navigation setup
2. Build the authentication flow (LoginScreen)
3. Create the student dashboard with real-time bus tracking
4. Implement the tracker dashboard for bus drivers
5. Set up API service integration with the backend
6. Test the complete mobile app foundation

---
PREVIOUS REQUESTS: [CLEARED - This is the current active request]