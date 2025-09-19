import database from '@react-native-firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface TrackerInfo {
  userId: string;
  location: Location;
  lastUpdate: number;
  lastHeartbeat: number;
}

export interface BusData {
  tracker: TrackerInfo | null;
}

export class FirebaseService {
  private static instance: FirebaseService;
  private userId: string = '';

  private constructor() {
    this.initializeUserId();
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  private async initializeUserId() {
    try {
      let userId = await AsyncStorage.getItem('user_id');
      if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await AsyncStorage.setItem('user_id', userId);
      }
      this.userId = userId;
    } catch (error) {
      console.error('Error initializing user ID:', error);
      this.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  public getUserId(): string {
    return this.userId;
  }

  /**
   * Attempts to become tracker for a specific bus
   * Uses Firebase transaction for atomic operation to prevent race conditions
   */
  public async becomeTracker(busNumber: number, location: Location): Promise<{success: boolean, message: string}> {
    try {
      const busRef = database().ref(`buses/${busNumber}/tracker`);

      const result = await busRef.transaction((currentData) => {
        if (currentData === null || this.isTrackerExpired(currentData)) {
          // No tracker or expired tracker - we can become the tracker
          return {
            userId: this.userId,
            location: location,
            lastUpdate: database.ServerValue.TIMESTAMP,
            lastHeartbeat: database.ServerValue.TIMESTAMP,
          };
        }
        // Someone else is already tracking and they're still active
        return; // Abort the transaction
      });

      if (result.committed) {
        return { success: true, message: `You are now tracking Bus ${busNumber}` };
      } else {
        return { success: false, message: `Bus ${busNumber} is already being tracked` };
      }
    } catch (error) {
      console.error('Error becoming tracker:', error);
      return { success: false, message: 'Failed to start tracking. Please try again.' };
    }
  }

  /**
   * Updates tracker location and heartbeat
   */
  public async updateTrackerLocation(busNumber: number, location: Location): Promise<boolean> {
    try {
      const busRef = database().ref(`buses/${busNumber}/tracker`);

      // First check if we're still the active tracker
      const snapshot = await busRef.once('value');
      const currentTracker = snapshot.val();

      if (!currentTracker || currentTracker.userId !== this.userId) {
        console.log('We are no longer the tracker for this bus');
        return false;
      }

      // Validate location quality
      if (!this.isLocationValid(location, currentTracker.location)) {
        console.log('Location rejected due to validation');
        return false;
      }

      // Update location and heartbeat
      await busRef.update({
        location: location,
        lastUpdate: database.ServerValue.TIMESTAMP,
        lastHeartbeat: database.ServerValue.TIMESTAMP,
      });

      return true;
    } catch (error) {
      console.error('Error updating tracker location:', error);
      return false;
    }
  }

  /**
   * Sends heartbeat to keep tracker alive
   */
  public async sendHeartbeat(busNumber: number): Promise<boolean> {
    try {
      const busRef = database().ref(`buses/${busNumber}/tracker`);

      // Check if we're still the tracker
      const snapshot = await busRef.once('value');
      const currentTracker = snapshot.val();

      if (!currentTracker || currentTracker.userId !== this.userId) {
        return false;
      }

      await busRef.update({
        lastHeartbeat: database.ServerValue.TIMESTAMP,
      });

      return true;
    } catch (error) {
      console.error('Error sending heartbeat:', error);
      return false;
    }
  }

  /**
   * Stops tracking a bus (removes tracker data)
   */
  public async stopTracking(busNumber: number): Promise<boolean> {
    try {
      const busRef = database().ref(`buses/${busNumber}/tracker`);

      // Use transaction to ensure we only remove our own tracker data
      const result = await busRef.transaction((currentData) => {
        if (currentData && currentData.userId === this.userId) {
          return null; // Remove the tracker data
        }
        return currentData; // Leave other tracker's data unchanged
      });

      return result.committed;
    } catch (error) {
      console.error('Error stopping tracking:', error);
      return false;
    }
  }

  /**
   * Gets current bus tracking info
   */
  public async getBusInfo(busNumber: number): Promise<BusData | null> {
    try {
      const snapshot = await database().ref(`buses/${busNumber}`).once('value');
      const busData = snapshot.val();

      if (!busData || !busData.tracker) {
        return { tracker: null };
      }

      // Check if tracker has expired
      if (this.isTrackerExpired(busData.tracker)) {
        // Clean up expired tracker
        await this.cleanupExpiredTracker(busNumber);
        return { tracker: null };
      }

      return busData;
    } catch (error) {
      console.error('Error getting bus info:', error);
      return null;
    }
  }

  /**
   * Listens to real-time updates for a specific bus
   */
  public listenToBusUpdates(busNumber: number, callback: (busData: BusData | null) => void): () => void {
    const busRef = database().ref(`buses/${busNumber}`);

    const listener = busRef.on('value', (snapshot) => {
      const busData = snapshot.val();

      if (!busData || !busData.tracker) {
        callback({ tracker: null });
        return;
      }

      // Check if tracker has expired
      if (this.isTrackerExpired(busData.tracker)) {
        // Clean up expired tracker
        this.cleanupExpiredTracker(busNumber);
        callback({ tracker: null });
        return;
      }

      callback(busData);
    });

    // Return unsubscribe function
    return () => busRef.off('value', listener);
  }

  /**
   * Checks if a tracker has expired (no heartbeat for more than 90 seconds)
   */
  private isTrackerExpired(tracker: TrackerInfo): boolean {
    const now = Date.now();
    const lastHeartbeat = tracker.lastHeartbeat || tracker.lastUpdate;
    return (now - lastHeartbeat) > 90000; // 90 seconds
  }

  /**
   * Validates location quality and prevents unrealistic updates
   */
  private isLocationValid(newLocation: Location, previousLocation?: Location): boolean {
    // Check location accuracy
    if (newLocation.accuracy > 50) {
      console.log('Location accuracy too poor:', newLocation.accuracy);
      return false;
    }

    // If we have a previous location, check for unrealistic speed
    if (previousLocation) {
      const distance = this.calculateDistance(
        previousLocation.latitude,
        previousLocation.longitude,
        newLocation.latitude,
        newLocation.longitude
      );

      const timeDiff = (newLocation.timestamp - previousLocation.timestamp) / 1000; // seconds
      const speed = (distance / timeDiff) * 3.6; // km/h

      // Reject if speed is over 100 km/h (unrealistic for a bus)
      if (speed > 100) {
        console.log('Unrealistic speed detected:', speed, 'km/h');
        return false;
      }
    }

    return true;
  }

  /**
   * Calculates distance between two coordinates in meters
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Removes expired tracker from database
   */
  private async cleanupExpiredTracker(busNumber: number): Promise<void> {
    try {
      await database().ref(`buses/${busNumber}/tracker`).remove();
    } catch (error) {
      console.error('Error cleaning up expired tracker:', error);
    }
  }

  /**
   * Checks if location is within college geofence (500m radius)
   */
  public isWithinCollege(location: Location): boolean {
    const collegeLocation = {
      latitude: 17.19664395356277,
      longitude: 78.59606101533295,
    };

    const distance = this.calculateDistance(
      location.latitude,
      location.longitude,
      collegeLocation.latitude,
      collegeLocation.longitude
    );

    return distance <= 500; // 500 meters
  }

  /**
   * Gets connection status
   */
  public async isConnected(): Promise<boolean> {
    try {
      const connectedRef = database().ref('.info/connected');
      const snapshot = await connectedRef.once('value');
      return snapshot.val() === true;
    } catch (error) {
      return false;
    }
  }
}