// components/FiveDayForecast.js
import React from 'react';
import { useTemperature } from './TemperatureContext';

function FiveDayForecast({ forecastData }) {
  const kelvinToCelsius = (temp) => {
    return (temp - 273.15).toFixed(2);
  };

  const kelvinToFahrenheit = (temp) => {
    return ((temp - 273.15) * 9/5 + 32).toFixed(2);
  };

  const { isCelsius } = useTemperature();

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get unique forecast days
  const uniqueForecastDays = [];
  const fiveDaysForecast = forecastData.list.filter(forecast => {
    const forecastDate = new Date(forecast.dt_txt).getDate();
    if (!uniqueForecastDays.includes(forecastDate)) {
      uniqueForecastDays.push(forecastDate);
      return true;
    }
    return false;
  });

  // Remove today's forecast
  const futureForecast = fiveDaysForecast.slice(1, 6);

  return (
    <div className="card">
      <h2>5 days Forecast</h2>
      <div className="day-forecast">
        {futureForecast.map((forecast, index) => {
          const date = new Date(forecast.dt_txt);
          return (
            <div className="forecast-item" key={index}>
              <div className="icon-wrapper">
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
              <p>{`${date.getDate()} ${months[date.getMonth()]}`}</p>
              <p>{days[date.getDay()]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default FiveDayForecast;