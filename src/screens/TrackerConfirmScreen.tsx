import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {LocationService} from '../services/LocationService';

interface TrackerConfirmScreenProps {
  navigation: any;
  route: {
    params: {
      busNumber: number;
    };
  };
}

const TrackerConfirmScreen: React.FC<TrackerConfirmScreenProps> = ({
  navigation,
  route,
}) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const {busNumber} = route.params;
  const locationService = LocationService.getInstance();

  useEffect(() => {
    // Set up disconnect handler
    locationService.setOnTrackerDisconnected((disconnectedBusNumber) => {
      if (disconnectedBusNumber === busNumber) {
        Alert.alert(
          'Tracking Stopped',
          'You have arrived at college or lost connection. Tracking has been stopped automatically.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      }
    });

    // Check if already tracking this bus
    if (locationService.isCurrentlyTracking() && locationService.getCurrentBusNumber() === busNumber) {
      setIsTracking(true);
      setStatusMessage('Location sharing is active');
    }

    return () => {
      // Cleanup is handled by LocationService
    };
  }, [busNumber, navigation, locationService]);

  const startTracking = () => {
    Alert.alert(
      'Start Tracking',
      `Are you sure you want to start tracking Bus ${busNumber}? Your location will be shared with other students in real-time.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Start Tracking',
          onPress: handleStartTracking,
        },
      ]
    );
  };

  const handleStartTracking = async () => {
    setIsLoading(true);
    setStatusMessage('Starting tracking...');

    try {
      const result = await locationService.startTracking(busNumber);

      if (result.success) {
        setIsTracking(true);
        setStatusMessage('Location sharing is active');
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Unable to Track', result.message);
      }
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const stopTracking = () => {
    Alert.alert(
      'Stop Tracking',
      'Are you sure you want to stop sharing your location? Other students will no longer be able to track this bus.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Stop Tracking',
          style: 'destructive',
          onPress: handleStopTracking,
        },
      ]
    );
  };

  const handleStopTracking = async () => {
    setIsLoading(true);
    setStatusMessage('Stopping tracking...');

    try {
      const success = await locationService.stopTracking();

      if (success) {
        setIsTracking(false);
        Alert.alert(
          'Tracking Stopped',
          'You have stopped sharing your location.',
          [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
        );
      } else {
        Alert.alert('Error', 'Failed to stop tracking. Please try again.');
      }
    } catch (error) {
      console.error('Error stopping tracking:', error);
      Alert.alert('Error', 'Failed to stop tracking. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Bus {busNumber} Tracker</Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3498db" />
            <Text style={styles.loadingText}>{statusMessage}</Text>
          </View>
        ) : !isTracking ? (
          <View style={styles.confirmContainer}>
            <Text style={styles.confirmText}>
              You're about to become the tracker for Bus {busNumber}.
            </Text>
            <Text style={styles.warningText}>
              Your location will be shared with other students who want to track this bus.
            </Text>

            <TouchableOpacity
              style={styles.startButton}
              onPress={startTracking}
              activeOpacity={0.8}>
              <Text style={styles.buttonText}>Start Tracking</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.trackingContainer}>
            <View style={styles.statusContainer}>
              <ActivityIndicator size="large" color="#27ae60" />
              <Text style={styles.trackingText}>
                You are now tracking Bus {busNumber}
              </Text>
              <Text style={styles.statusText}>
                {statusMessage}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.stopButton, isLoading && styles.disabledButton]}
              onPress={stopTracking}
              activeOpacity={0.8}
              disabled={isLoading}>
              <Text style={styles.buttonText}>Stop Tracking</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}>
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 40,
    textAlign: 'center',
  },
  confirmContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  confirmText: {
    fontSize: 18,
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  warningText: {
    fontSize: 14,
    color: '#e67e22',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  trackingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  trackingText: {
    fontSize: 18,
    color: '#27ae60',
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  stopButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#3498db',
    textAlign: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default TrackerConfirmScreen;