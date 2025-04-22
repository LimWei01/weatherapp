// components/CurrentWeather.js
import React from 'react';
import { useTemperature } from './TemperatureContext';

function CurrentWeather({ weather }) {
  const { isCelsius } = useTemperature();
  
  // Early return if weather data is not provided or incomplete
  if (!weather || !weather.main || !weather.weather || !weather.weather[0]) {
    return <div className="card">Loading weather data...</div>;
  }
  
  // Temperature is already in Celsius from the API (units=metric in the API call)
  const displayTemp = isCelsius 
    ? `${Math.round(weather.main.temp)}°C` 
    : `${Math.round((weather.main.temp * 9/5) + 32)}°F`;
    
  const feelsLike = isCelsius 
    ? `${Math.round(weather.main.feels_like)}°C`
    : `${Math.round((weather.main.feels_like * 9/5) + 32)}°F`;

  const date = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="card">
      <div className="current-weather">
        <div className="details">
          <p>Now</p>
          <h1>{displayTemp}</h1>
          <p>Feels like: {feelsLike}</p>
          <p>{weather.weather[0].description}</p>
        </div>
        <div className="weather-icon">
          <img
            src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
            alt={weather.weather[0].description}
          />
        </div>
      </div>
      <hr />
      <div className="card-footer">
        <p>
          <i className="fa-light fa-calendar"></i>
          {`${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`}
        </p>
        <p>
          <i className="fa-light fa-location-dot"></i>
          {`${weather.name}${weather.sys && weather.sys.country ? `, ${weather.sys.country}` : ''}`}
        </p>
      </div>
    </div>
  );
}

export default CurrentWeather;