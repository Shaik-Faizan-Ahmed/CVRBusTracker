import {Alert, Linking} from 'react-native';
import {request, PERMISSIONS, RESULTS} from 'react-native-permissions';
import {Platform} from 'react-native';

export class PermissionHandler {
  static async requestLocationPermission(): Promise<boolean> {
    try {
      const permission = Platform.select({
        android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
        ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
      });

      if (!permission) {
        return false;
      }

      const result = await request(permission);

      switch (result) {
        case RESULTS.GRANTED:
          return true;
        case RESULTS.DENIED:
          this.showPermissionDeniedAlert();
          return false;
        case RESULTS.BLOCKED:
          this.showPermissionBlockedAlert();
          return false;
        default:
          return false;
      }
    } catch (error) {
      console.log('Permission request error:', error);
      return false;
    }
  }

  static showPermissionExplanation(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Location Permission Required',
        'CVR Bus Tracker needs location permission to:\n\n• Share your bus location with other students\n• Show your current position on the map\n• Automatically stop tracking when you reach college\n\nThis helps other students find and track buses in real-time.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Grant Permission',
            onPress: async () => {
              const granted = await this.requestLocationPermission();
              resolve(granted);
            },
          },
        ]
      );
    });
  }

  private static showPermissionDeniedAlert() {
    Alert.alert(
      'Permission Denied',
      'Location permission is required to use this app. Please grant permission to continue.',
      [
        {
          text: 'OK',
          style: 'default',
        },
      ]
    );
  }

  private static showPermissionBlockedAlert() {
    Alert.alert(
      'Permission Blocked',
      'Location permission has been permanently denied. Please enable it in your device settings to use this app.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Open Settings',
          onPress: () => Linking.openSettings(),
        },
      ]
    );
  }

  static async requestBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const result = await request(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
        return result === RESULTS.GRANTED;
      } catch (error) {
        console.log('Background permission request error:', error);
        return false;
      }
    }
    return true; // iOS handles this differently
  }
}