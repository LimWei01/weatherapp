import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import CurrentWeather from './CurrentWeather';
import FiveDayForecast from './FiveDayForecast';
import Highlights from './Highlights';
import HourlyForecast from './HourlyForecast';
import Loading from './Loading';
import SavedLocations from './SavedLocations';
import WeatherAlert from './WeatherAlert';

function WeatherDashboard() {
  const [weatherData, setWeatherData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [airQualityData, setAirQualityData] = useState(null);
  const [location, setLocation] = useState({
    name: '',
    lat: null,
    lon: null,
    country: '',
    state: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_KEY = '581263763b8a617d8fec01441f571a23';
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleSavedLocationSelect = (location) => {
    setLocation(location);
    fetchWeatherData(location.name, location.lat, location.lon, location.country, location.state);
  };


  const fetchWeatherData = async (name, lat, lon, country, state) => {
    setLoading(true);
    setError(null);
    setLocation({ name, lat, lon, country, state });

    try {
      // Fetch current weather
      const weatherResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );
      if (!weatherResponse.ok) {
        throw new Error('Failed to fetch current weather');
      }
      const weatherData = await weatherResponse.json();
      setWeatherData(weatherData);

      // Fetch forecast
      const forecastResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );
      if (!forecastResponse.ok) {
        throw new Error('Failed to fetch forecast data');
      }
      const forecastData = await forecastResponse.json();
      setForecastData(forecastData);

      // Fetch air quality
      const airQualityResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`
      );
      if (!airQualityResponse.ok) {
        throw new Error('Failed to fetch air quality data');
      }
      const airQualityData = await airQualityResponse.json();
      setAirQualityData(airQualityData);
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching weather data:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleCitySearch = async (cityName) => {
    if (!cityName.trim()) return;

    setLoading(true);
    setError(null);
    
    try {
      const geocodingResponse = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${API_KEY}`
      );
      if (!geocodingResponse.ok) {
        throw new Error(`Failed to fetch coordinates for ${cityName}`);
      }
      const data = await geocodingResponse.json();

      if (data.length === 0) {
        throw new Error(`City "${cityName}" not found`);
      }

      const { name, lat, lon, country, state } = data[0];
      fetchWeatherData(name, lat, lon, country || '', state || '');
    } catch (error) {
      console.error("Error fetching city coordinates:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setLoading(true);
      setError(null);
      
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const reverseGeocodingResponse = await fetch(
              `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${API_KEY}`
            );
            if (!reverseGeocodingResponse.ok) {
              throw new Error('Failed to fetch location information');
            }
            const data = await reverseGeocodingResponse.json();

            if (data.length === 0) {
              throw new Error("Could not find location information");
            }

            const { name, country, state } = data[0];
            fetchWeatherData(name, latitude, longitude, country || '', state || '');
          } catch (error) {
            console.error("Error fetching reverse geocoding:", error);
            setError(error.message);
            setLoading(false);
          }
        },
        (error) => {
          setLoading(false);
          if (error.code === error.PERMISSION_DENIED) {
            setError('Geolocation permission denied. Please reset location permission to grant access again');
          } else {
            setError('Failed to get current location');
          }
        }
      );
    } else {
      setError("Geolocation is not supported by this browser");
    }
  };

  useEffect(() => {
    handleGetCurrentLocation();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setError('Failed to log out');
    }
  };

  return (
    <div className="container">
      <Header 
        onCitySearch={handleCitySearch}
        onGetCurrentLocation={handleGetCurrentLocation}
        onLogout={handleLogout}
      />
      <SavedLocations 
        onLocationSelect={handleSavedLocationSelect}
        currentLocation={location}
      />
      {weatherData && (
        <WeatherAlert 
          lat={weatherData.coord.lat} 
          lon={weatherData.coord.lon} 
        />
      )}
      
      {error && (
        <div style={{ 
          backgroundColor: '#ff5252', 
          color: 'white', 
          padding: '15px', 
          borderRadius: '5px',
          marginBottom: '15px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}
      
      {loading ? (
        <Loading />
      ) : (
        <div className="weather-data">
          <div className="weather-left">
            {weatherData && (
              <CurrentWeather 
                weatherData={weatherData} 
                location={location} 
              />
            )}
            
            {forecastData && (
              <FiveDayForecast forecastData={forecastData} />
            )}
          </div>
          
          <div className="weather-right">
            <h2>Today's Highlights</h2>
            {weatherData && airQualityData && (
              <Highlights 
                weatherData={weatherData} 
                airQualityData={airQualityData} 
              />
            )}
            
            <h2>Today at</h2>
            {forecastData && (
              <HourlyForecast forecastData={forecastData} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeatherDashboard;