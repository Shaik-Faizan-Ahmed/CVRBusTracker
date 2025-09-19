import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface HomeScreenProps {
  navigation: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const handleTrackBus = () => {
    navigation.navigate('BusInput', {mode: 'track'});
  };

  const handleBecomeTracker = () => {
    navigation.navigate('BusInput', {mode: 'tracker'});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>CVR Bus Tracker</Text>
        <Text style={styles.subtitle}>Track your college bus in real-time</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.trackButton]}
            onPress={handleTrackBus}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>Track Bus</Text>
            <Text style={styles.buttonSubtext}>See where a bus is located</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.trackerButton]}
            onPress={handleBecomeTracker}
            activeOpacity={0.8}>
            <Text style={styles.buttonText}>Become Tracker</Text>
            <Text style={styles.buttonSubtext}>Share your bus location</Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 60,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 20,
  },
  button: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  trackButton: {
    backgroundColor: '#3498db',
  },
  trackerButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 14,
    color: '#ecf0f1',
    textAlign: 'center',
  },
});

export default HomeScreen;