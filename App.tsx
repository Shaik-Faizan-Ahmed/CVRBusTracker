/**
 * CVR Bus Tracker App
 * Track college buses in real-time
 *
 * @format
 */

import React, {useEffect, useState, useCallback} from 'react';
import {StatusBar, StyleSheet, View, Alert} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {PermissionHandler} from './src/utils/PermissionHandler';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);

  useEffect(() => {
    checkLocationPermission();
  }, [checkLocationPermission]);

  const checkLocationPermission = useCallback(async () => {
    setIsCheckingPermission(true);
    const hasPermission = await PermissionHandler.showPermissionExplanation();
    setHasLocationPermission(hasPermission);
    setIsCheckingPermission(false);

    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'CVR Bus Tracker cannot function without location permission. Please restart the app and grant permission.',
        [
          {
            text: 'Retry',
            onPress: checkLocationPermission,
          },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => {
              // In a real app, you might want to close the app here
            },
          },
        ]
      );
    }
  }, []);

  if (isCheckingPermission || !hasLocationPermission) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.container} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#2c3e50" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default App;
