import React, { useState, useEffect } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';

function WeatherAlert({ lat, lon }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      if (!lat || !lon) return;

      try {
        setLoading(true);
        const response = await fetch(
          `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${process.env.REACT_APP_WEATHER_API_KEY}&exclude=minutely,hourly,daily`
        );
        
        if (!response.ok) throw new Error('Failed to fetch weather alerts');
        
        const data = await response.json();
        setAlerts(data.alerts || []);
      } catch (err) {
        console.error('Error fetching weather alerts:', err);
        setError('Unable to fetch weather alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 300000);
    return () => clearInterval(interval);
  }, [lat, lon]);

  if (!alerts.length) return null;

  return (
    <div className="weather-alerts card">
      {alerts.map((alert, index) => (
        <div key={index} className="alert-item">
          <FaExclamationTriangle className="alert-icon" />
          <div className="alert-content">
            <h4>{alert.event}</h4>
            <p>{alert.description}</p>
            {alert.start && (
              <p className="alert-time">
                From: {new Date(alert.start * 1000).toLocaleString()}
              </p>
            )}
            {alert.end && (
              <p className="alert-time">
                Until: {new Date(alert.end * 1000).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default WeatherAlert;