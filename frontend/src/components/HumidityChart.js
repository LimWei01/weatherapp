import React from 'react';
import { FaTint } from 'react-icons/fa';

const HumidityChart = ({ forecastData }) => {
  const getHumidityData = () => {
    if (!forecastData || !forecastData.list) {
      return [];
    }
    
    // Get the next 24 hours of forecasts (8 data points, 3-hour intervals)
    return forecastData.list.slice(0, 8).map(item => {
      const date = new Date(item.dt * 1000);
      return {
        time: date.toLocaleTimeString([], { hour: '2-digit', hour12: true }),
        humidity: item.main.humidity
      };
    });
  };

  const humidityData = getHumidityData();

  const getHumidityColor = (humidity) => {
    if (humidity < 30) return '#64B5F6'; // Low - light blue
    if (humidity < 60) return '#4CAF50'; // Medium - green
    if (humidity < 80) return '#FFC107'; // High - amber
    return '#F44336'; // Very high - red
  };

  return (
    <div className="humidity-chart">
      <div className="chart-header">
        <h3><FaTint /> Humidity (24h)</h3>
      </div>
      <div className="chart-container">
        {humidityData.map((hour, index) => (
          <div key={index} className="hour-column">
            <div className="humidity-value">{hour.humidity}%</div>
            <div 
              className="humidity-bar"
              style={{
                height: `${hour.humidity}%`,
                backgroundColor: getHumidityColor(hour.humidity)
              }}
            ></div>
            <div className="hour-time">{hour.time}</div>
          </div>
        ))}
      </div>
      {humidityData.length > 4 && <div className="scroll-indicator">Scroll horizontally to see more data →</div>}

      <div className="humidity-legend">
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#64B5F6'}}></span>
          <span>Low</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#4CAF50'}}></span>
          <span>Medium</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#FFC107'}}></span>
          <span>High</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{backgroundColor: '#F44336'}}></span>
          <span>Very High</span>
        </div>
      </div>
    </div>
  );
};

export default HumidityChart; 