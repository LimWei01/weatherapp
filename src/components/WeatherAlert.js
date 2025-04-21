import React, { useState, useEffect, useRef } from 'react';
import { FaBell, FaTimes, FaChevronDown, FaChevronUp, FaTrash } from 'react-icons/fa';
import '../styles/WeatherAlert.css';
import { useAuth } from './AuthContext';
import { getLocationsFromStorage } from '../utilities/storageUtils';

const WeatherAlert = ({ 
  weatherData, 
  airQualityData, 
  currentLocationWeatherData, 
  currentLocationAirQualityData,
  onDismiss 
}) => {
  const [alerts, setAlerts] = useState([]);
  const [alertCount, setAlertCount] = useState(0);
  const [showAlerts, setShowAlerts] = useState(false);
  const [savedLocations, setSavedLocations] = useState([]);
  
  // Track processed locations to prevent duplicate processing
  const processedLocations = useRef(new Set());
  const previousUserRef = useRef(null);
  
  // Get current user from auth context
  const { currentUser } = useAuth();
  
  // Load saved locations
  useEffect(() => {
    setSavedLocations(getLocationsFromStorage());
  }, []);
  
  // Handle user login/logout
  useEffect(() => {
    // Skip on initial render
    if (!previousUserRef.current && currentUser) {
      previousUserRef.current = currentUser;
      return;
    }
    
    // Check if this is a new login
    if (currentUser && previousUserRef.current !== currentUser) {
      console.log('New user logged in, cleaning up searched location alerts');
      
      // Clear searched location alerts, but keep current location and saved locations
      clearSearchedLocationAlerts();
      
      // Update previous user reference
      previousUserRef.current = currentUser;
    }
  }, [currentUser]);
  
  // Function to clear searched location alerts but keep current location and saved locations
  const clearSearchedLocationAlerts = () => {
    setAlerts(prevAlerts => {
      // Keep alerts for current location
      const currentLocationAlerts = prevAlerts.filter(alert => alert.isCurrentLocation);
      
      // Get saved location names
      const savedLocationNames = savedLocations.map(loc => loc.name.toLowerCase());
      
      // Keep alerts for saved locations
      const savedLocationAlerts = prevAlerts.filter(alert => {
        if (alert.isCurrentLocation) return false; // Skip current location alerts (already handled)
        
        // Extract location name without the "(Current Location)" suffix if present
        const locationName = alert.location.replace(/ \(Current Location\)$/, '').toLowerCase();
        
        // Keep if it's a saved location
        return savedLocationNames.includes(locationName);
      });
      
      // Combine alerts
      const keptAlerts = [...currentLocationAlerts, ...savedLocationAlerts];
      
      // Update localStorage
      localStorage.setItem('weatherAlerts', JSON.stringify(keptAlerts));
      
      return keptAlerts;
    });
    
    // Reset processed locations except for current location
    const newProcessedLocations = new Set();
    if (currentLocationWeatherData) {
      newProcessedLocations.add(`current-${currentLocationWeatherData.name}`);
    }
    processedLocations.current = newProcessedLocations;
  };
  
  // Load saved alerts on mount
  useEffect(() => {
    const savedAlerts = localStorage.getItem('weatherAlerts');
    
    if (savedAlerts) {
      try {
        // Parse saved alerts
        const parsedAlerts = JSON.parse(savedAlerts);
        
        // Filter out alerts older than 24 hours
        const now = new Date();
        const filteredAlerts = parsedAlerts.filter(alert => {
          const alertTime = new Date(alert.timestamp);
          const hoursDiff = (now - alertTime) / (1000 * 60 * 60); // Convert to hours
          return hoursDiff < 24; // Keep alerts less than 24 hours old
        });
        
        // On first load, remove any searched location alerts that aren't saved
        if (currentUser) {
          // Get saved location names
          const savedLocNames = getLocationsFromStorage().map(loc => loc.name.toLowerCase());
          
          // Filter alerts to keep only current location and saved locations
          const keptAlerts = filteredAlerts.filter(alert => {
            // Always keep current location alerts
            if (alert.isCurrentLocation) return true;
            
            // Extract location name without the "(Current Location)" suffix if present
            const locationName = alert.location.replace(/ \(Current Location\)$/, '').toLowerCase();
            
            // Keep if it's a saved location
            return savedLocNames.includes(locationName);
          });
          
          setAlerts(keptAlerts);
          setAlertCount(keptAlerts.length);
          
          // Update localStorage if we removed any alerts
          if (keptAlerts.length !== filteredAlerts.length) {
            localStorage.setItem('weatherAlerts', JSON.stringify(keptAlerts));
          }
        } else {
          // If no user, just use the filtered alerts
          setAlerts(filteredAlerts);
          setAlertCount(filteredAlerts.length);
          
          // Save the filtered alerts back to localStorage
          if (filteredAlerts.length !== parsedAlerts.length) {
            localStorage.setItem('weatherAlerts', JSON.stringify(filteredAlerts));
          }
        }
      } catch (error) {
        console.error('Error parsing saved alerts:', error);
        // Reset if there's an error
        localStorage.removeItem('weatherAlerts');
        setAlerts([]);
        setAlertCount(0);
      }
    }
    
    // Clear the processed locations on mount
    processedLocations.current = new Set();
  }, [currentUser]);

  // Process current location weather data
  useEffect(() => {
    if (!currentLocationWeatherData) return;
    
    const locationId = `current-${currentLocationWeatherData.name}`;
    
    // Check if we've already processed this location data (prevent duplicate alerts)
    // We'll reset this flag each time we get new data for the location
    if (processedLocations.current.has(locationId)) {
      return;
    }
    
    // Generate alerts for current location
    const newAlerts = generateLocationAlerts(
      currentLocationWeatherData, 
      currentLocationAirQualityData, 
      true
    );
    
    if (newAlerts.length > 0) {
      updateAlerts(newAlerts, true);
    }
    
    // Mark this location as processed
    processedLocations.current.add(locationId);
    
    // This will remove the flag when the component unmounts or when the dependencies change
    return () => {
      processedLocations.current.delete(locationId);
    };
  }, [currentLocationWeatherData, currentLocationAirQualityData]);
  
  // Process searched location weather data
  useEffect(() => {
    if (!weatherData || weatherData === currentLocationWeatherData) return;
    
    const locationId = `search-${weatherData.name}`;
    
    // Check if we've already processed this location data
    if (processedLocations.current.has(locationId)) {
      return;
    }
    
    // Generate alerts for searched location
    const newAlerts = generateLocationAlerts(
      weatherData, 
      airQualityData, 
      false
    );
    
    if (newAlerts.length > 0) {
      updateAlerts(newAlerts, false);
    }
    
    // Mark this location as processed
    processedLocations.current.add(locationId);
    
    // Cleanup
    return () => {
      processedLocations.current.delete(locationId);
    };
  }, [weatherData, airQualityData, currentLocationWeatherData]);

  // Function to generate alerts for a location
  const generateLocationAlerts = (data, aqData, isCurrentLocation) => {
    if (!data) return [];
    
    const newAlerts = [];
    const locationName = isCurrentLocation 
      ? `${data.name || 'Current Location'} (Current Location)` 
      : data.name || 'Searched Location';
    
    // Temperature alerts from main.temp
    const temp = data.main.temp;
    if (temp > 35) {
      newAlerts.push({
        id: `temp-high-${Date.now()}-${locationName}`,
        message: 'Extreme heat warning',
        details: `Temperature is ${Math.round(temp)}°C. Stay hydrated and avoid prolonged sun exposure.`,
        location: locationName,
        severity: 'high',
        timestamp: new Date().toISOString(),
        isCurrentLocation: isCurrentLocation
      });
    } else if (temp > 30) {
      newAlerts.push({
        id: `temp-warm-${Date.now()}-${locationName}`,
        message: 'High temperature alert',
        details: `Temperature is ${Math.round(temp)}°C. Stay hydrated.`,
        location: locationName,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        isCurrentLocation: isCurrentLocation
      });
    } else if (temp < 0) {
      newAlerts.push({
        id: `temp-freezing-${Date.now()}-${locationName}`,
        message: 'Freezing temperature alert',
        details: `Temperature is ${Math.round(temp)}°C. Risk of ice and frost.`,
        location: locationName,
        severity: 'high',
        timestamp: new Date().toISOString(),
        isCurrentLocation: isCurrentLocation
      });
    } else if (temp < 5) {
      newAlerts.push({
        id: `temp-cold-${Date.now()}-${locationName}`,
        message: 'Cold temperature alert',
        details: `Temperature is ${Math.round(temp)}°C. Bundle up.`,
        location: locationName,
        severity: 'medium',
        timestamp: new Date().toISOString(),
        isCurrentLocation: isCurrentLocation
      });
    }

    // Weather condition alerts
    if (data.weather && data.weather[0]) {
      const weatherId = data.weather[0].id;
      const weatherMain = data.weather[0].main;
      
      // Thunderstorm
      if (weatherId >= 200 && weatherId < 300) {
        newAlerts.push({
          id: `weather-thunder-${Date.now()}-${locationName}`,
          message: 'Thunderstorm warning',
          details: 'Lightning and heavy rain possible. Seek shelter indoors.',
          location: locationName,
          severity: 'high',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
      
      // Heavy rain
      if ((weatherId >= 500 && weatherId < 600) && (weatherId % 100) >= 2) {
        newAlerts.push({
          id: `weather-rain-${Date.now()}-${locationName}`,
          message: 'Heavy rain alert',
          details: 'Intense rainfall may cause flooding in low-lying areas.',
          location: locationName,
          severity: weatherId % 100 >= 4 ? 'high' : 'medium',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
      
      // Snow
      if (weatherId >= 600 && weatherId < 700) {
        newAlerts.push({
          id: `weather-snow-${Date.now()}-${locationName}`,
          message: 'Snow alert',
          details: 'Snowy conditions may affect visibility and road conditions.',
          location: locationName,
          severity: (weatherId % 100) >= 2 ? 'medium' : 'low',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
      
      // Fog
      if (weatherId >= 700 && weatherId < 800 && weatherId !== 781) {
        newAlerts.push({
          id: `weather-fog-${Date.now()}-${locationName}`,
          message: 'Reduced visibility alert',
          details: `${weatherMain} may reduce visibility. Drive with caution.`,
          location: locationName,
          severity: 'medium',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
      
      // Tornado
      if (weatherId === 781) {
        newAlerts.push({
          id: `weather-tornado-${Date.now()}-${locationName}`,
          message: 'Tornado warning',
          details: 'Tornado conditions detected. Seek shelter immediately.',
          location: locationName,
          severity: 'high',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
    }

    // Wind alerts
    if (data.wind && data.wind.speed) {
      const windSpeed = data.wind.speed;
      if (windSpeed > 20) {
        newAlerts.push({
          id: `wind-vstrong-${Date.now()}-${locationName}`,
          message: 'Very strong wind warning',
          details: `Wind speed of ${Math.round(windSpeed)} m/s. Secure loose items outdoors.`,
          location: locationName,
          severity: 'high',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      } else if (windSpeed > 10) {
        newAlerts.push({
          id: `wind-strong-${Date.now()}-${locationName}`,
          message: 'Strong wind alert',
          details: `Wind speed of ${Math.round(windSpeed)} m/s.`,
          location: locationName,
          severity: 'medium',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
    }

    // Air quality alerts
    if (aqData && aqData.list && aqData.list[0]) {
      const aqi = aqData.list[0].main.aqi;
      
      if (aqi > 4) {
        newAlerts.push({
          id: `aqi-vhigh-${Date.now()}-${locationName}`,
          message: 'Very poor air quality',
          details: 'Air quality is very poor. Avoid outdoor activities.',
          location: locationName,
          severity: 'high',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      } else if (aqi > 3) {
        newAlerts.push({
          id: `aqi-high-${Date.now()}-${locationName}`,
          message: 'Poor air quality',
          details: 'Air quality is poor. Limit time outdoors if sensitive.',
          location: locationName,
          severity: 'medium',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      } else if (aqi > 2) {
        newAlerts.push({
          id: `aqi-moderate-${Date.now()}-${locationName}`,
          message: 'Moderate air quality',
          details: 'Air quality is moderate. Sensitive groups should reduce prolonged outdoor exertion.',
          location: locationName,
          severity: 'low',
          timestamp: new Date().toISOString(),
          isCurrentLocation: isCurrentLocation
        });
      }
    }
    
    return newAlerts;
  };

  // Update alerts with new ones, removing old ones for the same location
  const updateAlerts = (newAlerts, isCurrentLocation) => {
    if (newAlerts.length === 0) return;
    
    setAlerts(prevAlerts => {
      // Get location name from first alert
      const locationName = newAlerts[0].location;
      
      // Remove old alerts for this specific location
      const filteredAlerts = prevAlerts.filter(alert => {
        if (isCurrentLocation && alert.isCurrentLocation) {
          return false; // Remove old current location alerts
        }
        
        if (!isCurrentLocation && !alert.isCurrentLocation && alert.location === locationName) {
          return false; // Remove old alerts for this specific searched location
        }
        
        return true; // Keep all other alerts
      });
      
      // Add new alerts
      const updatedAlerts = [...filteredAlerts, ...newAlerts];
      
      // Update localStorage
      localStorage.setItem('weatherAlerts', JSON.stringify(updatedAlerts));
      
      return updatedAlerts;
    });
    
    // Update alert count
    setAlertCount(prevCount => prevCount - 1 + newAlerts.length); // -1 to account for potential duplicates
  };

  // Check if a location is saved
  const isLocationSaved = (locationName) => {
    // Extract the location name without the "(Current Location)" suffix if present
    const cleanName = locationName.replace(/ \(Current Location\)$/, '').toLowerCase();
    
    // Check if it's in the saved locations
    return savedLocations.some(loc => loc.name.toLowerCase() === cleanName);
  };

  const handleDismissAlert = (alertId, e) => {
    // Stop event propagation if event is provided
    if (e) {
      e.stopPropagation();
    }
    
    setAlerts(prevAlerts => {
      const updatedAlerts = prevAlerts.filter(alert => alert.id !== alertId);
      localStorage.setItem('weatherAlerts', JSON.stringify(updatedAlerts));
      return updatedAlerts;
    });
    
    setAlertCount(prevCount => prevCount - 1);
    
    // Call the onDismiss prop if provided
    if (onDismiss) {
      onDismiss(alertId);
    }
  };

  const toggleAlerts = (e) => {
    // Stop event propagation if event is provided
    if (e) {
      e.stopPropagation();
    }
    setShowAlerts(!showAlerts);
  };

  const clearAllAlerts = (e) => {
    // Stop event propagation if event is provided
    if (e) {
      e.stopPropagation();
    }
    setAlerts([]);
    setAlertCount(0);
    localStorage.removeItem('weatherAlerts');
    
    // Reset processed locations
    processedLocations.current = new Set();
  };

  // Sort alerts by location (current first), then severity (high first) and then by timestamp (newest first)
  const sortedAlerts = [...alerts].sort((a, b) => {
    // First by current location flag (current location alerts first)
    if (a.isCurrentLocation !== b.isCurrentLocation) {
      return a.isCurrentLocation ? -1 : 1;
    }
    
    // Then by whether location is saved (saved locations have priority)
    const aIsSaved = isLocationSaved(a.location);
    const bIsSaved = isLocationSaved(b.location);
    
    if (aIsSaved !== bIsSaved) {
      return aIsSaved ? -1 : 1;
    }
    
    // Then by location name for organization
    if (a.location !== b.location) {
      return a.location.localeCompare(b.location);
    }
    
    // Then by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    
    // Finally by timestamp
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Get formatted time for display
  const formatAlertTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Update the alert count whenever alerts change
  useEffect(() => {
    setAlertCount(alerts.length);
  }, [alerts]);

  // Listen for saved locations changes
  useEffect(() => {
    const handleStorageChange = () => {
      setSavedLocations(getLocationsFromStorage());
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <div className="weather-alert-container">
      <div className="weather-alert-header" onClick={toggleAlerts}>
        <div className="alert-title">
          <FaBell className="alert-icon" />
          <span>{alertCount > 0 ? `${alertCount} Weather Alert${alertCount !== 1 ? 's' : ''}` : 'Weather Alerts'}</span>
        </div>
        <div className="alert-actions">
          {alertCount > 0 && (
            <button 
              className="clear-all-button" 
              onClick={(e) => clearAllAlerts(e)}
              aria-label="Clear all alerts"
            >
              <FaTrash />
            </button>
          )}
          <button 
            className="collapse-button" 
            onClick={(e) => toggleAlerts(e)}
            aria-label={showAlerts ? "Collapse alerts" : "Expand alerts"}
          >
            {showAlerts ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
      </div>
      
      {showAlerts && (
        <div className="weather-alert-list">
          {alertCount > 0 ? (
            <>
              {/* Group alerts by location */}
              {(() => {
                const alertsByLocation = {};
                
                // Group alerts by location
                sortedAlerts.forEach(alert => {
                  if (!alertsByLocation[alert.location]) {
                    alertsByLocation[alert.location] = [];
                  }
                  alertsByLocation[alert.location].push(alert);
                });
                
                // Render alerts by location groups
                return Object.entries(alertsByLocation).map(([location, locationAlerts]) => {
                  // Check if this is a saved location
                  const isSaved = isLocationSaved(location);
                  
                  return (
                    <div key={location} className="location-alerts-group">
                      <div className={`location-header ${locationAlerts[0].isCurrentLocation ? 'current-location' : isSaved ? 'saved-location' : ''}`}>
                        {location}
                        {isSaved && !location.includes('Current Location') && (
                          <span className="saved-location-indicator"> (Saved)</span>
            )}
          </div>
                      
                      {locationAlerts.map(alert => (
                        <div 
                          key={alert.id} 
                          className={`weather-alert-item severity-${alert.severity}`}
                        >
                          <div className="alert-content">
                            <div className="alert-message">{alert.message}</div>
                            <div className="alert-details">{alert.details}</div>
                            <div className="alert-severity">Severity: {alert.severity}</div>
                            <div className="alert-time">Time: {formatAlertTime(alert.timestamp)}</div>
                          </div>
                          <button 
                            className="close-alert-button" 
                            onClick={(e) => handleDismissAlert(alert.id, e)}
                            aria-label="Dismiss alert"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </>
          ) : (
            <div className="no-alerts-message">
              No active weather alerts at this time
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeatherAlert;