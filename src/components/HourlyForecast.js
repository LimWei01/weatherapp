// components/HourlyForecast.js
import React from 'react';
import { useTemperature } from './TemperatureContext';

function HourlyForecast({ forecastData }) {
  const { isCelsius } = useTemperature();
  
  const kelvinToCelsius = (temp) => {
    return (temp - 273.15).toFixed(2);
  };

  const kelvinToFahrenheit = (temp) => {
    return ((temp - 273.15) * 9/5 + 32).toFixed(2);
  };

  // Get the first 8 forecast periods (24 hours)
  const hourlyForecast = forecastData.list.slice(0, 8);

  const formatHour = (dateTime) => {
    const date = new Date(dateTime);
    let hr = date.getHours();
    let a = 'PM';
    
    if (hr < 12) a = 'AM';
    if (hr === 0) hr = 12;
    if (hr > 12) hr = hr - 12;
    
    return `${hr}${a}`;
  };

  return (
    <div className="hourly-forecast">
      {hourlyForecast.map((forecast, index) => (
        <div className="card" key={index}>
          <p>{formatHour(forecast.dt_txt)}</p>
          <img 
            src={`https://openweathermap.org/img/wn/${forecast.weather[0].icon}.png`} 
            alt={forecast.weather[0].description} 
          />
          <span>
            {isCelsius 
              ? `${kelvinToCelsius(forecast.main.temp)}°C`
              : `${kelvinToFahrenheit(forecast.main.temp)}°F`
            }
          </span>
        </div>
      ))}
    </div>
  );
}

export default HourlyForecast;