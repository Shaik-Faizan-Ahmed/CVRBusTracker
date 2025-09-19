import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';

interface BusInputScreenProps {
  navigation: any;
  route: {
    params: {
      mode: 'track' | 'tracker';
    };
  };
}

const BusInputScreen: React.FC<BusInputScreenProps> = ({navigation, route}) => {
  const [busNumber, setBusNumber] = useState('');
  const {mode} = route.params;

  const validateBusNumber = (number: string): boolean => {
    const num = parseInt(number, 10);
    return !isNaN(num) && num >= 1 && num <= 52;
  };

  const handleSubmit = () => {
    if (!busNumber.trim()) {
      Alert.alert('Error', 'Please enter a bus number');
      return;
    }

    if (!validateBusNumber(busNumber)) {
      Alert.alert('Error', 'Invalid bus number. Please enter a number between 1-52');
      return;
    }

    if (mode === 'track') {
      navigation.navigate('MapView', {busNumber: parseInt(busNumber, 10)});
    } else {
      navigation.navigate('TrackerConfirm', {busNumber: parseInt(busNumber, 10)});
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {mode === 'track' ? 'Track Bus' : 'Become Tracker'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'track'
            ? 'Enter the bus number you want to track'
            : 'Enter your bus number to start sharing location'
          }
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Bus Number (1-52)</Text>
          <TextInput
            style={styles.input}
            value={busNumber}
            onChangeText={setBusNumber}
            placeholder="Enter bus number"
            keyboardType="numeric"
            maxLength={2}
            placeholderTextColor="#95a5a6"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            mode === 'track' ? styles.trackButton : styles.trackerButton,
          ]}
          onPress={handleSubmit}
          activeOpacity={0.8}>
          <Text style={styles.buttonText}>
            {mode === 'track' ? 'Track This Bus' : 'Start Tracking'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 40,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 18,
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
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
  trackButton: {
    backgroundColor: '#3498db',
  },
  trackerButton: {
    backgroundColor: '#e74c3c',
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
});

export default BusInputScreen;