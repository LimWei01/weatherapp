import React from 'react';
import { FaThermometerHalf } from 'react-icons/fa';

const TemperatureChart = ({ forecastData }) => {
  const getNextHourlyForecasts = () => {
    if (!forecastData || !forecastData.list) {
      return [];
    }
    
    // Get the next 24 hours of forecasts (8 data points, 3-hour intervals)
    return forecastData.list.slice(0, 8).map(item => {
      const date = new Date(item.dt * 1000);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', hour12: true }),
        temp: Math.round(item.main.temp),
        feelsLike: Math.round(item.main.feels_like),
        icon: item.weather[0].icon
      };
    });
  };

  const hourlyData = getNextHourlyForecasts();

  // Find min and max temperatures for scaling
  const temperatures = hourlyData.map(hour => hour.temp);
  const minTemp = Math.min(...temperatures);
  const maxTemp = Math.max(...temperatures);
  const range = maxTemp - minTemp || 1; // Prevent division by zero

  const getTemperatureBarHeight = (temp) => {
    // Scale the height between 20% and 100%
    return 20 + ((temp - minTemp) / range) * 80;
  };

  return (
    <div className="temperature-chart">
      <div className="chart-header">
        <h3><FaThermometerHalf /> Temperature (24h)</h3>
      </div>
      <div className="chart-container">
        {hourlyData.map((hour, index) => (
          <div key={index} className="hour-column">
            <div className="temp-value">{hour.temp}°C</div>
            <div 
              className="temp-bar"
              style={{
                height: `${getTemperatureBarHeight(hour.temp)}%`,
                backgroundColor: hour.temp > 25 ? '#FF5722' : 
                                hour.temp > 15 ? '#FF9800' : 
                                hour.temp > 5 ? '#2196F3' : '#64B5F6'
              }}
            ></div>
            <div className="hour-time">{hour.time}</div>
            <div className="weather-icon">
              <img 
                src={`http://openweathermap.org/img/wn/${hour.icon}.png`} 
                alt="Weather icon" 
              />
            </div>
          </div>
        ))}
      </div>
      {hourlyData.length > 4 && <div className="scroll-indicator">Scroll horizontally to see more data →</div>}
      <div className="feels-like-note">
        <small>Feels like temperatures may vary due to wind and humidity factors.</small>
      </div>
    </div>
  );
};

export default TemperatureChart; 