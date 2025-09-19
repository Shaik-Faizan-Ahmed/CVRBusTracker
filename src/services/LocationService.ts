import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseService, Location } from './FirebaseService';
import { AppState } from 'react-native';

interface QueuedLocation {
  location: Location;
  busNumber: number;
  timestamp: number;
}

export class LocationService {
  private static instance: LocationService;
  private firebaseService: FirebaseService;
  private watchId: number | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private currentBusNumber: number | null = null;
  private isTracking = false;
  private locationQueue: QueuedLocation[] = [];
  private retryAttempts = 0;
  private maxRetryAttempts = 3;
  private geofenceCheckCount = 0; // Counter for geofence stability
  private readonly GEOFENCE_STABLE_COUNT = 3; // Need 3 consecutive readings inside geofence
  private onTrackerDisconnected?: (busNumber: number) => void;

  private constructor() {
    this.firebaseService = FirebaseService.getInstance();
    this.setupAppStateListener();
    this.loadQueuedLocations();
  }

  public static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  public setOnTrackerDisconnected(callback: (busNumber: number) => void) {
    this.onTrackerDisconnected = callback;
  }

  /**
   * Starts location tracking for a specific bus
   */
  public async startTracking(busNumber: number): Promise<{success: boolean, message: string}> {
    if (this.isTracking) {
      return { success: false, message: 'Already tracking a bus' };
    }

    try {
      // Get initial location
      const location = await this.getCurrentLocation();

      // Try to become tracker
      const result = await this.firebaseService.becomeTracker(busNumber, location);

      if (!result.success) {
        return result;
      }

      // Start tracking
      this.currentBusNumber = busNumber;
      this.isTracking = true;
      this.geofenceCheckCount = 0;

      this.startLocationWatcher();
      this.startHeartbeat();
      this.processQueuedLocations();

      return result;
    } catch (error) {
      console.error('Error starting tracking:', error);
      return { success: false, message: 'Failed to start tracking' };
    }
  }

  /**
   * Stops location tracking
   */
  public async stopTracking(): Promise<boolean> {
    if (!this.isTracking || this.currentBusNumber === null) {
      return false;
    }

    try {
      // Stop all intervals and watchers
      this.stopLocationWatcher();
      this.stopHeartbeat();
      this.stopRetryInterval();

      // Remove tracker from Firebase
      const success = await this.firebaseService.stopTracking(this.currentBusNumber);

      this.isTracking = false;
      this.currentBusNumber = null;
      this.geofenceCheckCount = 0;
      this.clearLocationQueue();

      return success;
    } catch (error) {
      console.error('Error stopping tracking:', error);
      return false;
    }
  }

  /**
   * Gets current location using Geolocation API
   */
  private getCurrentLocation(): Promise<Location> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          const location: Location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: Date.now(),
          };
          resolve(location);
        },
        (error) => {
          console.error('Error getting current location:', error);
          reject(error);
        },
        {
          enableHighAccuracy: false,
          timeout: 30000,
          maximumAge: 60000,
        }
      );
    });
  }

  /**
   * Starts watching location changes
   */
  private startLocationWatcher() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
    }

    this.watchId = Geolocation.watchPosition(
      (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy || 0,
          timestamp: Date.now(),
        };

        this.handleLocationUpdate(location);
      },
      (error) => {
        console.error('Location watch error:', error);
        this.handleLocationError();
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 60000,
        distanceFilter: 10, // Update only if moved 10 meters
      }
    );
  }

  /**
   * Handles new location updates
   */
  private async handleLocationUpdate(location: Location) {
    if (!this.isTracking || this.currentBusNumber === null) {
      return;
    }

    try {
      // Check if we're within college geofence
      if (this.firebaseService.isWithinCollege(location)) {
        this.geofenceCheckCount++;

        // If we've been inside geofence for 3 consecutive readings (30 seconds)
        if (this.geofenceCheckCount >= this.GEOFENCE_STABLE_COUNT) {
          console.log('Arrived at college, stopping tracking');
          await this.stopTracking();
          // Notify about arrival
          if (this.onTrackerDisconnected) {
            this.onTrackerDisconnected(this.currentBusNumber);
          }
          return;
        }
      } else {
        this.geofenceCheckCount = 0; // Reset counter if outside geofence
      }

      // Try to update location in Firebase
      const success = await this.firebaseService.updateTrackerLocation(this.currentBusNumber, location);

      if (success) {
        this.retryAttempts = 0; // Reset retry attempts on success
      } else {
        // Queue location for retry
        this.queueLocation(location, this.currentBusNumber);
      }
    } catch (error) {
      console.error('Error handling location update:', error);
      this.queueLocation(location, this.currentBusNumber);
    }
  }

  /**
   * Handles location errors
   */
  private handleLocationError() {
    console.error('Location error occurred');
    // Continue trying to get location updates
  }

  /**
   * Starts heartbeat to keep tracker alive
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      if (this.currentBusNumber && this.isTracking) {
        const success = await this.firebaseService.sendHeartbeat(this.currentBusNumber);

        if (!success) {
          console.log('Failed to send heartbeat - we may no longer be the tracker');
          this.handleTrackerLost();
        }
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Handles when we lose tracker status
   */
  private async handleTrackerLost() {
    if (this.currentBusNumber && this.onTrackerDisconnected) {
      const busNumber = this.currentBusNumber;
      await this.stopTracking();
      this.onTrackerDisconnected(busNumber);
    }
  }

  /**
   * Stops heartbeat
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Stops location watcher
   */
  private stopLocationWatcher() {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Queues location for retry when network is available
   */
  private async queueLocation(location: Location, busNumber: number) {
    const queuedLocation: QueuedLocation = {
      location,
      busNumber,
      timestamp: Date.now(),
    };

    this.locationQueue.push(queuedLocation);

    // Keep only last 10 locations to prevent memory issues
    if (this.locationQueue.length > 10) {
      this.locationQueue = this.locationQueue.slice(-10);
    }

    await this.saveQueuedLocations();
    this.startRetryInterval();
  }

  /**
   * Processes queued locations when network is available
   */
  private async processQueuedLocations() {
    if (this.locationQueue.length === 0) {
      return;
    }

    const isConnected = await this.firebaseService.isConnected();
    if (!isConnected) {
      return;
    }

    const locationsToProcess = [...this.locationQueue];
    this.locationQueue = [];

    for (const queuedLocation of locationsToProcess) {
      if (queuedLocation.busNumber === this.currentBusNumber) {
        try {
          await this.firebaseService.updateTrackerLocation(
            queuedLocation.busNumber,
            queuedLocation.location
          );
        } catch (error) {
          console.error('Error processing queued location:', error);
          // Re-queue if failed
          this.locationQueue.push(queuedLocation);
        }
      }
    }

    await this.saveQueuedLocations();
  }

  /**
   * Starts retry interval for queued locations
   */
  private startRetryInterval() {
    if (this.retryInterval) {
      return; // Already running
    }

    this.retryInterval = setInterval(() => {
      this.processQueuedLocations();
    }, 30000); // Retry every 30 seconds
  }

  /**
   * Stops retry interval
   */
  private stopRetryInterval() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * Saves queued locations to AsyncStorage
   */
  private async saveQueuedLocations() {
    try {
      await AsyncStorage.setItem('queued_locations', JSON.stringify(this.locationQueue));
    } catch (error) {
      console.error('Error saving queued locations:', error);
    }
  }

  /**
   * Loads queued locations from AsyncStorage
   */
  private async loadQueuedLocations() {
    try {
      const saved = await AsyncStorage.getItem('queued_locations');
      if (saved) {
        this.locationQueue = JSON.parse(saved);
        // Remove old queued locations (older than 1 hour)
        const oneHourAgo = Date.now() - 3600000;
        this.locationQueue = this.locationQueue.filter(q => q.timestamp > oneHourAgo);
        await this.saveQueuedLocations();
      }
    } catch (error) {
      console.error('Error loading queued locations:', error);
    }
  }

  /**
   * Clears all queued locations
   */
  private async clearLocationQueue() {
    this.locationQueue = [];
    await this.saveQueuedLocations();
  }

  /**
   * Sets up app state listener to handle app going to background/foreground
   */
  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && this.isTracking) {
        console.log('App went to background, tracking continues');
      } else if (nextAppState === 'active' && this.isTracking) {
        console.log('App came to foreground, processing queued locations');
        this.processQueuedLocations();
      }
    });
  }

  /**
   * Gets current tracking status
   */
  public isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Gets current bus number being tracked
   */
  public getCurrentBusNumber(): number | null {
    return this.currentBusNumber;
  }

  /**
   * Cleanup method - call when app is closing
   */
  public cleanup() {
    this.stopLocationWatcher();
    this.stopHeartbeat();
    this.stopRetryInterval();
  }
}