// components/CurrentWeather.js
import React from 'react';
import { useTemperature } from './TemperatureContext';

function CurrentWeather({ weatherData, location }) {
  const { isCelsius } = useTemperature();
  
  const kelvinToCelsius = (temp) => {
    return (temp - 273.15).toFixed(2);
  };

  const kelvinToFahrenheit = (temp) => {
    return ((temp - 273.15) * 9/5 + 32).toFixed(2);
  };


  const date = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="card">
      <div className="current-weather">
        <div className="details">
          <p>Now</p>
          <h1>
          {isCelsius 
            ? `${kelvinToCelsius(weatherData.main.temp)}°C` 
            : `${kelvinToFahrenheit(weatherData.main.temp)}°F`
          }
        </h1>
        <p>Feels like: {isCelsius 
          ? `${kelvinToCelsius(weatherData.main.feels_like)}°C`
          : `${kelvinToFahrenheit(weatherData.main.feels_like)}°F`
        }</p>
          <p>{weatherData.weather[0].description}</p>
        </div>
        <div className="weather-icon">
          <img
            src={`https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`}
            alt={weatherData.weather[0].description}
          />
        </div>
      </div>
      <hr />
      <div className="card-footer">
        <p>
          <i className="fa-light fa-calendar"></i>
          {`${days[date.getDay()]}, ${date.getDate()}, ${months[date.getMonth()]} ${date.getFullYear()}`}
        </p>
        <p>
          <i className="fa-light fa-location-dot"></i>
          {`${location.name}, ${location.country}`}
        </p>
      </div>
    </div>
  );
}

export default CurrentWeather;