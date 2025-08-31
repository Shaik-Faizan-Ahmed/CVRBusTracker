/**
 * Location Calculator Service
 * Handles distance calculations and ETA estimations
 */

class LocationCalculator {
  
  /**
   * Calculate distance between two coordinates using Haversine formula
   * @param {Object} point1 - {latitude, longitude}
   * @param {Object} point2 - {latitude, longitude}
   * @returns {Number} Distance in kilometers
   */
  static calculateDistance(point1, point2) {
    const R = 6371; // Radius of Earth in kilometers
    const lat1Rad = this.toRadians(point1.latitude);
    const lat2Rad = this.toRadians(point2.latitude);
    const deltaLatRad = this.toRadians(point2.latitude - point1.latitude);
    const deltaLngRad = this.toRadians(point2.longitude - point1.longitude);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert degrees to radians
   * @param {Number} degrees 
   * @returns {Number} Radians
   */
  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate ETA from current location to destination
   * @param {Object} currentLocation - {latitude, longitude, speed, timestamp}
   * @param {Object} destination - {latitude, longitude}
   * @param {Number} averageSpeed - Average speed in km/h (default: 25)
   * @returns {Object} {minutes, distance, confidence}
   */
  static calculateETA(currentLocation, destination, averageSpeed = 25) {
    const distance = this.calculateDistance(currentLocation, destination);
    
    // If distance is very small (less than 50 meters), bus has likely arrived
    if (distance < 0.05) {
      return {
        minutes: 0,
        distance: distance,
        confidence: 'high'
      };
    }

    // Use current speed if available and reasonable, otherwise use average speed
    let speed = averageSpeed;
    if (currentLocation.speed && currentLocation.speed > 5 && currentLocation.speed < 80) {
      // Weight current speed with average speed for better accuracy
      speed = (currentLocation.speed * 0.7) + (averageSpeed * 0.3);
    }

    // Calculate time in hours, then convert to minutes
    const timeHours = distance / speed;
    const timeMinutes = Math.round(timeHours * 60);

    // Determine confidence based on data freshness and speed availability
    let confidence = 'medium';
    const locationAge = Date.now() - new Date(currentLocation.timestamp).getTime();
    
    if (locationAge < 2 * 60 * 1000 && currentLocation.speed) { // Less than 2 minutes old with speed
      confidence = 'high';
    } else if (locationAge > 5 * 60 * 1000) { // More than 5 minutes old
      confidence = 'low';
    }

    // Add buffer time for city traffic (10-30% depending on distance)
    const bufferMultiplier = distance < 2 ? 1.1 : distance < 5 ? 1.2 : 1.3;
    const adjustedMinutes = Math.round(timeMinutes * bufferMultiplier);

    return {
      minutes: Math.max(1, adjustedMinutes), // Minimum 1 minute
      distance: distance,
      confidence: confidence
    };
  }

  /**
   * Find the next stop in route based on current location
   * @param {Object} currentLocation - {latitude, longitude}
   * @param {Array} stops - Array of stops with coordinates
   * @returns {Object} Next stop or null
   */
  static findNextStop(currentLocation, stops) {
    if (!stops || stops.length === 0) return null;

    let closestStop = null;
    let minDistance = Infinity;

    stops.forEach(stop => {
      const distance = this.calculateDistance(currentLocation, stop);
      if (distance < minDistance) {
        minDistance = distance;
        closestStop = stop;
      }
    });

    return {
      stop: closestStop,
      distance: minDistance
    };
  }

  /**
   * Calculate if bus is within notification radius of a stop
   * @param {Object} currentLocation - {latitude, longitude}
   * @param {Object} stop - {latitude, longitude}
   * @param {Number} radiusKm - Notification radius in kilometers (default: 1km)
   * @returns {Boolean}
   */
  static isWithinNotificationRadius(currentLocation, stop, radiusKm = 1) {
    const distance = this.calculateDistance(currentLocation, stop);
    return distance <= radiusKm;
  }

  /**
   * Get all stops within notification radius
   * @param {Object} currentLocation - {latitude, longitude}
   * @param {Array} stops - Array of stops
   * @param {Number} radiusKm - Radius in kilometers
   * @returns {Array} Stops within radius with distances
   */
  static getStopsInRadius(currentLocation, stops, radiusKm = 1) {
    return stops
      .map(stop => ({
        stop,
        distance: this.calculateDistance(currentLocation, stop)
      }))
      .filter(item => item.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate route progress percentage
   * @param {Object} currentLocation - {latitude, longitude}
   * @param {Array} stops - Array of route stops in order
   * @returns {Number} Progress percentage (0-100)
   */
  static calculateRouteProgress(currentLocation, stops) {
    if (!stops || stops.length < 2) return 0;

    let totalDistance = 0;
    let completedDistance = 0;
    let found = false;

    // Calculate total route distance
    for (let i = 0; i < stops.length - 1; i++) {
      totalDistance += this.calculateDistance(stops[i], stops[i + 1]);
    }

    // Find position along route
    for (let i = 0; i < stops.length - 1; i++) {
      const segmentDistance = this.calculateDistance(stops[i], stops[i + 1]);
      
      if (!found) {
        const distanceToStart = this.calculateDistance(currentLocation, stops[i]);
        const distanceToEnd = this.calculateDistance(currentLocation, stops[i + 1]);
        
        // Check if current location is on this segment
        if (distanceToStart + distanceToEnd <= segmentDistance * 1.2) { // 20% tolerance
          completedDistance += distanceToStart;
          found = true;
          break;
        } else {
          completedDistance += segmentDistance;
        }
      }
    }

    if (!found) {
      // If not found on route, assume at the end
      completedDistance = totalDistance;
    }

    return Math.min(100, Math.round((completedDistance / totalDistance) * 100));
  }

  /**
   * Validate coordinate data
   * @param {Number} latitude 
   * @param {Number} longitude 
   * @returns {Boolean}
   */
  static isValidCoordinate(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 && latitude <= 90 &&
      longitude >= -180 && longitude <= 180
    );
  }

  /**
   * Check if location is within Hyderabad bounds (rough estimate)
   * @param {Number} latitude 
   * @param {Number} longitude 
   * @returns {Boolean}
   */
  static isWithinHyderabadBounds(latitude, longitude) {
    // Approximate bounds for Greater Hyderabad
    const bounds = {
      north: 17.6,
      south: 17.2,
      east: 78.7,
      west: 78.1
    };

    return (
      latitude >= bounds.south && latitude <= bounds.north &&
      longitude >= bounds.west && longitude <= bounds.east
    );
  }

  /**
   * Format distance for display
   * @param {Number} distanceKm - Distance in kilometers
   * @returns {String} Formatted distance
   */
  static formatDistance(distanceKm) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)}m`;
    }
    return `${distanceKm.toFixed(1)}km`;
  }

  /**
   * Format ETA for display
   * @param {Number} minutes - ETA in minutes
   * @returns {String} Formatted ETA
   */
  static formatETA(minutes) {
    if (minutes < 1) {
      return 'Arriving now';
    } else if (minutes === 1) {
      return '1 minute';
    } else if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    }
  }
}

module.exports = LocationCalculator;