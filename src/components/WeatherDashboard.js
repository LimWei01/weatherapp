import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  FaSearch,
  FaLocationArrow,
  FaStar,
  FaRegStar,
  FaExclamationTriangle,
  FaSave
} from 'react-icons/fa';
import CurrentWeather from './CurrentWeather';
import WeatherForecast from './WeatherForecast';
import Loading from './Loading';
import WeatherAlert from './WeatherAlert';
import SavedLocations from './SavedLocations';
import AirQuality from './AirQuality';
import TemperatureChart from './TemperatureChart';
import HumidityChart from './HumidityChart';
import WindSpeedChart from './WindSpeedChart';
import '../styles/WeatherDashboard.css';
import '../styles/WeatherAlert.css';

// Import Firestore utilities directly
import { saveLocationToFirestore } from '../utilities/firestoreUtils';
import { useAuth } from './AuthContext';

// Get API key from environment variables and ensure it's clean (no quotes)
const API_KEY = process.env.REACT_APP_WEATHER_API_KEY?.replace(/"/g, '');

const WeatherDashboard = () => {
  const [location, setLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [airQualityData, setAirQualityData] = useState(null);
  const [showSavedLocations, setShowSavedLocations] = useState(false);
  // Add state for current location weather data
  const [currentLocationWeatherData, setCurrentLocationWeatherData] = useState(null);
  const [currentLocationAirQualityData, setCurrentLocationAirQualityData] = useState(null);
  const [isCurrentLocationActive, setIsCurrentLocationActive] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [originalSearchTerm, setOriginalSearchTerm] = useState('');
  const [locationSaved, setLocationSaved] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Get current user from AuthContext
  const { currentUser, refreshAuthToken } = useAuth();

  // Function to get current location
  const handleGetCurrentLocation = useCallback(() => {
    setLoading(true);
    setIsCurrentLocationActive(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchWeatherData(latitude, longitude, true);
          setCurrentLocation({ latitude, longitude });
        },
        (err) => {
          setError(`Error getting location: ${err.message}`);
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
    }
  }, []);

  // Modified to handle current location vs searched location
  const fetchWeatherData = async (lat, lon, isCurrentLocation = false) => {
    setLoading(true);
    setError(null);

    try {
      // Current weather
      const weatherResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );

      // 5-day forecast
      const forecastResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
      );

      // Air quality data
      const airQualityResponse = await axios.get(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );

      if (isCurrentLocation) {
        setCurrentLocationWeatherData(weatherResponse.data);
        setCurrentLocationAirQualityData(airQualityResponse.data);
        // If this is the first load or if we're explicitly loading current location
        if (isCurrentLocationActive) {
          setWeatherData(weatherResponse.data);
          setForecast(forecastResponse.data);
          setAirQualityData(airQualityResponse.data);
          setLocation(weatherResponse.data.name);
        }
      } else {
        // For searched location
        setIsCurrentLocationActive(false);
        setWeatherData(weatherResponse.data);
        setForecast(forecastResponse.data);
        setAirQualityData(airQualityResponse.data);
        setLocation(weatherResponse.data.name);
      }
      
      setLoading(false);
    } catch (err) {
      setError(`Error fetching weather data: ${err.message}`);
      setLoading(false);
    }
  };

  // Search for location
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setError(null);
    
    // Store original search term
    const originalSearchTerm = location.trim();

    try {
      const locationResponse = await axios.get(
        `https://api.openweathermap.org/geo/1.0/direct?q=${originalSearchTerm}&limit=1&appid=${API_KEY}`
      );

      if (locationResponse.data.length === 0) {
        setError('Location not found. Please try another search term.');
        setLoading(false);
        return;
      }

      const { lat, lon, name } = locationResponse.data[0];
      // Store both the API-returned name and the original search term
      setLocation(name);
      // Store the original search term in state for later use
      setOriginalSearchTerm(originalSearchTerm);
      fetchWeatherData(lat, lon, false);
    } catch (err) {
      setError(`Error searching for location: ${err.message}`);
      setLoading(false);
    }
  };

  // Save current displayed location
  const handleSaveLocation = async () => {
    if (!weatherData) return;
    
    const locationToSave = {
      name: weatherData.name,
      country: weatherData.sys?.country || '',
      lat: weatherData.coord.lat,
      lon: weatherData.coord.lon,
      saved_at: new Date().toISOString()
    };
    
    try {
      // Only save to Firestore if user is logged in
      if (!currentUser) {
        setSaveMessage('Please log in to save locations');
        setTimeout(() => {
          setSaveMessage('');
        }, 3000);
        return;
      }
      
      setIsSavingLocation(true);
      
      // Save to Firestore directly
      try {
        await saveLocationToFirestore(
          currentUser.uid, 
          locationToSave, 
          originalSearchTerm !== weatherData.name ? originalSearchTerm : null
        );
        
        setSaveMessage(`${weatherData.name} saved to locations`);
        // Toggle to trigger update in SavedLocations, using function form to ensure we get the latest state
        setLocationSaved(prev => !prev);
        setTimeout(() => {
          setSaveMessage('');
        }, 3000);
      } catch (error) {
        console.error("Error saving location to Firestore:", error);
        
        // Check if it's an authentication error
        if (error.code === 'permission-denied' || error.code === 'unauthenticated' || 
            error.message?.includes('authentication') || error.message?.includes('session')) {
          console.log('Attempting to refresh auth token');
          
          try {
            // Try to refresh the token
            await refreshAuthToken();
            
            // Try saving again
            await saveLocationToFirestore(
              currentUser.uid, 
              locationToSave, 
              originalSearchTerm !== weatherData.name ? originalSearchTerm : null
            );
            
            setSaveMessage(`${weatherData.name} saved to locations`);
            setLocationSaved(prev => !prev);
            setTimeout(() => {
              setSaveMessage('');
            }, 3000);
          } catch (refreshError) {
            console.error("Error after token refresh:", refreshError);
            setSaveMessage('Authentication error. Please try logging out and logging back in.');
            setTimeout(() => {
              setSaveMessage('');
            }, 5000);
          }
        } else {
          setSaveMessage(`Failed to save location: ${error.message}`);
          setTimeout(() => {
            setSaveMessage('');
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Error saving location:", error);
      setSaveMessage(`Failed to save location: ${error.message}`);
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Initial load - get current location
  useEffect(() => {
    handleGetCurrentLocation();
  }, [handleGetCurrentLocation]);
  
  // Clear searched location data if the user views only current data
  useEffect(() => {
    if (isCurrentLocationActive && weatherData !== currentLocationWeatherData) {
      setWeatherData(currentLocationWeatherData);
      setAirQualityData(currentLocationAirQualityData);
    }
  }, [isCurrentLocationActive, currentLocationWeatherData, currentLocationAirQualityData, weatherData]);

  // Handler for dismissing an alert
  const handleDismissAlert = (alertId) => {
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
  };

  // Toggle saved locations panel
  const toggleSavedLocations = () => {
    setShowSavedLocations(!showSavedLocations);
  };

  // Select a saved location
  const handleSelectLocation = (locationName) => {
    setLocation(locationName);
    // Create a proper search rather than an empty form event
    setLoading(true);
    setError(null);
    
    // Store the original search term
    const originalSearchTerm = locationName.trim();
    setOriginalSearchTerm(originalSearchTerm);
    
    // Directly search for the location
    axios.get(`https://api.openweathermap.org/geo/1.0/direct?q=${originalSearchTerm}&limit=1&appid=${API_KEY}`)
      .then(locationResponse => {
        if (locationResponse.data.length === 0) {
          setError('Location not found. Please try another search term.');
          setLoading(false);
          return;
        }

        const { lat, lon, name } = locationResponse.data[0];
        // Fetch weather data for the selected location
        fetchWeatherData(lat, lon, false);
      })
      .catch(err => {
        setError(`Error searching for location: ${err.message}`);
        setLoading(false);
      });
    
    // Close the saved locations panel
    setShowSavedLocations(false);
  };

  // Modified to only show saved locations when a location is saved
  return (
    <div className="weather-dashboard">
      {/* Search and controls */}
      <div className="weather-controls">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Search for a location..."
            className="search-input"
          />
          <button type="submit" className="search-button">
            <FaSearch />
          </button>
        </form>
        
        <div className="control-buttons">
          <button onClick={handleGetCurrentLocation} className="location-button" title="Get current location">
            <FaLocationArrow />
          </button>
          <button 
            onClick={handleSaveLocation} 
            className="save-button" 
            title="Save current location"
            disabled={isSavingLocation}
          >
            {isSavingLocation ? '...' : <FaSave />}
          </button>
          <button onClick={toggleSavedLocations} className="saved-locations-button">
            Saved Locations
          </button>
        </div>
      </div>

      {/* Save message */}
      {saveMessage && (
        <div className="save-message">
          {saveMessage}
        </div>
      )}

      {/* Error message */}
      {error && <div className="error-message">{error}</div>}

      {/* Weather alerts */}
      {(weatherData || currentLocationWeatherData) && (
        <WeatherAlert 
          weatherData={weatherData}
          airQualityData={airQualityData}
          currentLocationWeatherData={currentLocationWeatherData}
          currentLocationAirQualityData={currentLocationAirQualityData}
          onDismiss={handleDismissAlert}
        />
      )}

      {/* Saved locations panel - only show when toggled AND either when showing saved locations or when a location was just saved */}
      {showSavedLocations && (
        <SavedLocations 
          onSelectLocation={handleSelectLocation} 
          locationSaved={locationSaved} 
          currentLocation={weatherData ? {
            name: weatherData.name,
            lat: weatherData.coord.lat,
            lon: weatherData.coord.lon,
            country: weatherData.sys?.country || ''
          } : null}
        />
      )}

      {/* Weather data display */}
      {weatherData && (
        <div className="weather-content">
          {/* Current weather */}
          <CurrentWeather weather={weatherData} />

          {/* Air quality */}
          {airQualityData && <AirQuality airQualityData={airQualityData} />}

          {/* Temperature Chart */}
          {forecast && <TemperatureChart forecastData={forecast} />}
          
          {/* Humidity Chart */}
          {forecast && <HumidityChart forecastData={forecast} />}
          
          {/* Wind Speed Chart */}
          {forecast && <WindSpeedChart forecastData={forecast} />}

          {/* Forecast */}
          {forecast && <WeatherForecast forecast={forecast} />}
        </div>
      )}
    </div>
  );
};

export default WeatherDashboard;