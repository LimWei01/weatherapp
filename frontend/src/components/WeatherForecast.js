import React from 'react';
import { FaCloud, FaSun, FaCloudRain, FaSnowflake, FaCloudSun } from 'react-icons/fa';

const WeatherForecast = ({ forecast }) => {
  // Helper function to get the appropriate weather icon
  const getWeatherIcon = (weatherCode) => {
    const code = weatherCode.toLowerCase();
    if (code.includes('clear')) return <FaSun />;
    if (code.includes('cloud') && code.includes('sun')) return <FaCloudSun />;
    if (code.includes('cloud')) return <FaCloud />;
    if (code.includes('rain') || code.includes('drizzle')) return <FaCloudRain />;
    if (code.includes('snow')) return <FaSnowflake />;
    return <FaCloud />;
  };

  // Group forecast data by day
  const groupByDay = () => {
    const days = {};
    
    if (!forecast || !forecast.list) return [];

    forecast.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const day = date.toLocaleDateString(undefined, { weekday: 'short' });
      
      if (!days[day]) {
        days[day] = {
          date: date,
          temps: [],
          weather: []
        };
      }
      
      days[day].temps.push(item.main.temp);
      days[day].weather.push(item.weather[0].main);
    });
    
    return Object.entries(days).slice(0, 5);
  };

  const dayForecasts = groupByDay();

  return (
    <div className="weather-forecast">
      <h3>5-Day Forecast</h3>
      <div className="forecast-scroll-container">
        <div className="forecast-container">
          {dayForecasts.map(([day, data], index) => {
            // Calculate the average temperature for the day
            const avgTemp = data.temps.reduce((sum, temp) => sum + temp, 0) / data.temps.length;
            // Get the most frequent weather condition
            const weatherCounts = data.weather.reduce((acc, weather) => {
              acc[weather] = (acc[weather] || 0) + 1;
              return acc;
            }, {});
            const mainWeather = Object.entries(weatherCounts).sort((a, b) => b[1] - a[1])[0][0];
            
            return (
              <div key={index} className="forecast-day">
                <div className="forecast-day-name">{day}</div>
                <div className="forecast-icon">{getWeatherIcon(mainWeather)}</div>
                <div className="forecast-temp">{Math.round(avgTemp)}°C</div>
                <div className="forecast-condition">{mainWeather}</div>
              </div>
            );
          })}
        </div>
      </div>
      {dayForecasts.length > 3 && <div className="scroll-indicator">Scroll horizontally to see more days →</div>}
    </div>
  );
};

export default WeatherForecast; 