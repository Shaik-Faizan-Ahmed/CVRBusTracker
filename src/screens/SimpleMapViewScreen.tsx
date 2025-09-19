import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {FirebaseService, BusData, Location} from '../services/FirebaseService';

interface SimpleMapViewScreenProps {
  navigation: any;
  route: {
    params: {
      busNumber: number;
    };
  };
}

const SimpleMapViewScreen: React.FC<SimpleMapViewScreenProps> = ({navigation, route}) => {
  const [busLocation, setBusLocation] = useState<Location | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTrackerOnline, setIsTrackerOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const {busNumber} = route.params;
  const firebaseService = FirebaseService.getInstance();

  // College coordinates
  const collegeLocation = {
    latitude: 17.19664395356277,
    longitude: 78.59606101533295,
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const startListening = () => {
      setIsLoading(true);

      unsubscribe = firebaseService.listenToBusUpdates(busNumber, (busData: BusData | null) => {
        setIsLoading(false);

        if (busData && busData.tracker) {
          setIsTrackerOnline(true);
          setBusLocation(busData.tracker.location);
          setLastUpdated(new Date(busData.tracker.lastUpdate));
        } else {
          setIsTrackerOnline(false);
          setBusLocation(null);
          setLastUpdated(null);
        }
      });
    };

    startListening();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [busNumber, firebaseService]);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const busData = await firebaseService.getBusInfo(busNumber);

      if (busData && busData.tracker) {
        setIsTrackerOnline(true);
        setBusLocation(busData.tracker.location);
        setLastUpdated(new Date(busData.tracker.lastUpdate));
      } else {
        setIsTrackerOnline(false);
        setBusLocation(null);
        setLastUpdated(null);
      }
    } catch (error) {
      console.error('Error refreshing bus data:', error);
      Alert.alert('Connection Error', 'Unable to refresh bus location. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Bus {busNumber}</Text>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>Loading bus location...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isTrackerOnline) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Bus {busNumber}</Text>
          <Text style={styles.noTrackerText}>
            No one is currently tracking Bus {busNumber}
          </Text>
          <Text style={styles.subtitleText}>
            Ask someone on the bus to become a tracker, or check back later.
          </Text>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            activeOpacity={0.8}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.8}>
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const distanceToCollege = busLocation
    ? calculateDistance(busLocation.latitude, busLocation.longitude, collegeLocation.latitude, collegeLocation.longitude)
    : 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bus {busNumber} Location</Text>
        {lastUpdated && (
          <Text style={styles.lastUpdated}>
            Last updated: {lastUpdated.toLocaleTimeString()}
          </Text>
        )}
      </View>

      <View style={styles.locationContainer}>
        <Text style={styles.sectionTitle}>📍 Bus Location</Text>
        {busLocation && (
          <View style={styles.locationDetails}>
            <Text style={styles.locationText}>
              📍 Latitude: {busLocation.latitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              📍 Longitude: {busLocation.longitude.toFixed(6)}
            </Text>
            <Text style={styles.locationText}>
              🎯 Accuracy: ±{busLocation.accuracy.toFixed(0)}m
            </Text>
            <Text style={styles.locationText}>
              📏 Distance to College: {distanceToCollege.toFixed(2)} km
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>🏫 CVR College</Text>
        <View style={styles.locationDetails}>
          <Text style={styles.locationText}>
            📍 Latitude: {collegeLocation.latitude.toFixed(6)}
          </Text>
          <Text style={styles.locationText}>
            📍 Longitude: {collegeLocation.longitude.toFixed(6)}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            🟢 Tracker is online and sharing location
          </Text>
          <Text style={styles.infoText}>
            💡 Note: Map view is disabled due to Google Maps API configuration.
            This simple view shows the location coordinates instead.
          </Text>
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          activeOpacity={0.8}
          disabled={isLoading}>
          <Text style={styles.refreshButtonText}>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.8}>
          <Text style={styles.homeButtonText}>Home</Text>
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
    marginBottom: 20,
  },
  header: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  locationContainer: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
    marginTop: 20,
  },
  locationDetails: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  statusContainer: {
    backgroundColor: '#d5f4e6',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  statusText: {
    fontSize: 16,
    color: '#27ae60',
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  noTrackerText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  subtitleText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  bottomContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 16,
  },
  refreshButton: {
    flex: 1,
    backgroundColor: '#3498db',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 16,
  },
  backButton: {
    backgroundColor: '#3498db',
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
  backButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default SimpleMapViewScreen;