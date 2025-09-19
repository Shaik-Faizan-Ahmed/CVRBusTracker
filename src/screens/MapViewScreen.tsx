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
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import {FirebaseService, BusData, Location} from '../services/FirebaseService';

interface MapViewScreenProps {
  navigation: any;
  route: {
    params: {
      busNumber: number;
    };
  };
}

const MapViewScreen: React.FC<MapViewScreenProps> = ({navigation, route}) => {
  const [busLocation, setBusLocation] = useState<Location | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isTrackerOnline, setIsTrackerOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionLost, setConnectionLost] = useState(false);

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
        setConnectionLost(false);

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
      setConnectionLost(false);

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
      setConnectionLost(true);
      Alert.alert('Connection Error', 'Unable to refresh bus location. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Bus {busNumber}</Text>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.loadingText}>
            {connectionLost ? 'Connection lost, retrying...' : 'Loading bus location...'}
          </Text>
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

      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: busLocation?.latitude || collegeLocation.latitude,
          longitude: busLocation?.longitude || collegeLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        >

        {/* College Marker */}
        <Marker
          coordinate={collegeLocation}
          title="CVR College"
          description="Destination"
          pinColor="green"
        />

        {/* Bus Marker */}
        {busLocation && (
          <Marker
            coordinate={busLocation}
            title={`Bus ${busNumber}`}
            description="Current Location"
            pinColor="blue"
          />
        )}
      </MapView>

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
  map: {
    flex: 1,
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

export default MapViewScreen;