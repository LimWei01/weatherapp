import React from 'react';
import { FaWind } from 'react-icons/fa';

const WindSpeedChart = ({ forecastData }) => {
  const getWindData = () => {
    if (!forecastData || !forecastData.list) {
      return [];
    }
    
    // Get the next 24 hours of forecasts (8 data points, 3-hour intervals)
    return forecastData.list.slice(0, 8).map(item => {
      const date = new Date(item.dt * 1000);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', hour12: true }),
        windSpeed: Math.round(item.wind.speed),
        windDeg: item.wind.deg
      };
    });
  };

  const windData = getWindData();
  
  // Find max wind speed for scaling
  const windSpeeds = windData.map(hour => hour.windSpeed);
  const maxWindSpeed = Math.max(...windSpeeds) || 1; // Prevent division by zero

  const getWindBarHeight = (speed) => {
    // Scale the height between 10% and 90% based on max wind speed
    return 10 + (speed / maxWindSpeed) * 80;
  };

  const getWindDirectionArrow = (degrees) => {
    // Convert degrees to arrow direction
    return String.fromCharCode(8593) + ' ' + getWindDirection(degrees);
  };

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
  };

  const getWindSpeedCategory = (speed) => {
    if (speed < 2) return 'Calm';
    if (speed < 6) return 'Light';
    if (speed < 12) return 'Moderate';
    if (speed < 20) return 'Strong';
    if (speed < 30) return 'Very Strong';
    return 'Storm';
  };

  const getWindColor = (speed) => {
    if (speed < 2) return '#64B5F6'; // Calm - light blue
    if (speed < 6) return '#4CAF50'; // Light - green
    if (speed < 12) return '#FFC107'; // Moderate - amber
    if (speed < 20) return '#FF9800'; // Strong - orange
    if (speed < 30) return '#F44336'; // Very Strong - red
    return '#9C27B0'; // Storm - purple
  };

  return (
    <div className="wind-chart">
      <div className="chart-header">
        <h3><FaWind /> Wind Speed (24h)</h3>
      </div>
      <div className="chart-container">
        {windData.map((hour, index) => (
          <div key={index} className="hour-column">
            <div className="wind-value">{hour.windSpeed} m/s</div>
            <div className="wind-direction">{getWindDirectionArrow(hour.windDeg)}</div>
            <div 
              className="wind-bar"
              style={{
                height: `${getWindBarHeight(hour.windSpeed)}%`,
                backgroundColor: getWindColor(hour.windSpeed)
              }}
            ></div>
            <div className="hour-time">{hour.time}</div>
            <div className="wind-category">{getWindSpeedCategory(hour.windSpeed)}</div>
          </div>
        ))}
      </div>
      {windData.length > 4 && <div className="scroll-indicator">Scroll horizontally to see more data →</div>}
      
      <div className="wind-scale-note">
        <small>Wind speeds are displayed in meters per second (m/s)</small>
      </div>
    </div>
  );
};

export default WindSpeedChart; 