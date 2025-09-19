# API Documentation

## Firebase Realtime Database Structure

### Bus Data Schema

```json
{
  "buses": {
    "1": {
      "tracker": {
        "userId": "string",
        "location": {
          "latitude": "number",
          "longitude": "number",
          "accuracy": "number",
          "timestamp": "number"
        },
        "lastUpdate": "number",
        "lastHeartbeat": "number"
      }
    }
  }
}
```

## Core Services

### FirebaseService

#### `becomeTracker(busNumber: number, location: Location): Promise<boolean>`
Atomically assigns current user as tracker for specified bus.

**Parameters:**
- `busNumber`: Bus route number (1-52)
- `location`: Current GPS location

**Returns:** Promise resolving to success boolean

**Example:**
```typescript
const success = await firebaseService.becomeTracker(1, {
  latitude: 17.196644,
  longitude: 78.596061,
  accuracy: 15,
  timestamp: Date.now()
});
```

#### `updateTrackerLocation(busNumber: number, location: Location): Promise<void>`
Updates tracker's current location.

**Parameters:**
- `busNumber`: Bus route number
- `location`: Updated GPS location

#### `listenToBusUpdates(busNumber: number, callback: Function): Function`
Subscribes to real-time bus location updates.

**Parameters:**
- `busNumber`: Bus route number to monitor
- `callback`: Function called on location updates

**Returns:** Unsubscribe function

**Example:**
```typescript
const unsubscribe = firebaseService.listenToBusUpdates(1, (busData) => {
  if (busData?.tracker) {
    console.log('Bus location:', busData.tracker.location);
  }
});

// Later...
unsubscribe();
```

#### `stopTracking(busNumber: number): Promise<void>`
Stops tracking for specified bus.

### LocationService

#### `startTracking(busNumber: number): Promise<TrackingResult>`
Begins location tracking and sharing.

**Features:**
- GPS location monitoring every 10 seconds
- Automatic geofence detection (CVR College)
- Background location tracking
- Network failure recovery with location queue
- Heartbeat system for connection monitoring

#### `stopTracking(): Promise<void>`
Stops all location tracking and cleanup.

#### `isWithinCollege(location: Location): boolean`
Checks if location is within CVR College geofence (500m radius).

## Location Data Types

### Location Interface
```typescript
interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}
```

### BusData Interface
```typescript
interface BusData {
  tracker: {
    userId: string;
    location: Location;
    lastUpdate: number;
    lastHeartbeat: number;
  } | null;
}
```

## Error Handling

### Common Error Types

#### `TRACKER_ALREADY_EXISTS`
Another user is currently tracking this bus.

#### `LOCATION_PERMISSION_DENIED`
User denied location permissions.

#### `NETWORK_ERROR`
Firebase connection or network issues.

#### `INVALID_BUS_NUMBER`
Bus number outside valid range (1-52).

### Error Response Format
```typescript
interface ApiError {
  code: string;
  message: string;
  details?: any;
}
```

## Rate Limiting

- Location updates: Maximum every 10 seconds
- Heartbeats: Every 30 seconds
- Tracker assignment: No limit (atomic operations)

## Security Rules

Production Firebase Security Rules:
```javascript
{
  "rules": {
    "buses": {
      "$busNumber": {
        ".read": true,
        ".write": "auth == null",
        ".validate": "newData.hasChildren(['tracker'])",
        "tracker": {
          ".validate": "newData.hasChildren(['userId', 'location', 'lastUpdate'])"
        }
      }
    }
  }
}
```

## Constants

### CVR College Location
```typescript
const COLLEGE_LOCATION = {
  latitude: 17.19664395356277,
  longitude: 78.59606101533295
};

const GEOFENCE_RADIUS = 500; // meters
```

### Timing Constants
```typescript
const LOCATION_UPDATE_INTERVAL = 10000; // 10 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const TRACKER_TIMEOUT = 90000; // 90 seconds
```