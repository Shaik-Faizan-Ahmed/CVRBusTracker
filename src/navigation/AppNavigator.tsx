import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import BusInputScreen from '../screens/BusInputScreen';
import TrackerConfirmScreen from '../screens/TrackerConfirmScreen';
import MapViewScreen from '../screens/MapViewScreen';

export type RootStackParamList = {
  Home: undefined;
  BusInput: {mode: 'track' | 'tracker'};
  TrackerConfirm: {busNumber: number};
  MapView: {busNumber: number};
};

const Stack = createStackNavigator<RootStackParamList>();

const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#2c3e50',
          },
          headerTintColor: '#ffffff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'CVR Bus Tracker',
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="BusInput"
          component={BusInputScreen}
          options={{
            title: 'Select Bus',
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="TrackerConfirm"
          component={TrackerConfirmScreen}
          options={{
            title: 'Tracker',
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="MapView"
          component={MapViewScreen}
          options={{
            title: 'Bus Location',
            headerTitleAlign: 'center',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;