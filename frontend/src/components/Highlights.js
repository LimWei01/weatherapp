// components/Highlights.js
import React from 'react';

function Highlights({ weatherData, airQualityData }) {
  const kelvinToCelsius = (temp) => {
    return (temp - 273.15).toFixed(2);
  };

  const aqiList = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
  const aqiIndex = airQualityData.list[0].main.aqi;
  const { co, no, no2, o3, so2, pm2_5, pm10, nh3 } = airQualityData.list[0].components;
  
  const { sunrise, sunset } = weatherData.sys;
  const { visibility } = weatherData;
  const { humidity, pressure, feels_like } = weatherData.main;
  const { speed } = weatherData.wind;

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const sRiseTime = formatTime(sunrise);
  const sSetTime = formatTime(sunset);

  return (
    <div className="highlights">
      {/* Air Quality Index */}
      <div className="card">
        <div className="card-head">
          <p>Air Quality Index</p>
          <p className={`air-index aqi-${aqiIndex}`}>{aqiList[aqiIndex - 1]}</p>
        </div>
        <div className="air-indices">
          <i className="fa-regular fa-wind fa-3x"></i>
          <div className="item">
            <p>PM2.5</p>
            <h2>{pm2_5}</h2>
          </div>
          <div className="item">
            <p>PM10</p>
            <h2>{pm10}</h2>
          </div>
          <div className="item">
            <p>SO2</p>
            <h2>{so2}</h2>
          </div>
          <div className="item">
            <p>CO</p>
            <h2>{co}</h2>
          </div>
          <div className="item">
            <p>NO</p>
            <h2>{no}</h2>
          </div>
          <div className="item">
            <p>NO2</p>
            <h2>{no2}</h2>
          </div>
          <div className="item">
            <p>NH3</p>
            <h2>{nh3}</h2>
          </div>
          <div className="item">
            <p>O3</p>
            <h2>{o3}</h2>
          </div>
        </div>
      </div>

      {/* Sunrise & Sunset */}
      <div className="card">
        <div className="card-head">
          <p>Sunrise & Sunset</p>
        </div>
        <div className="sunrise-sunset">
          <div className="item">
            <div className="icon">
              <i className="fa-light fa-sunrise fa-4x"></i>
            </div>
            <div>
              <p>Sunrise</p>
              <h2>{sRiseTime}</h2>
            </div>
          </div>
          <div className="item">
            <div className="icon">
              <i className="fa-light fa-sunset fa-4x"></i>
            </div>
            <div>
              <p>Sunset</p>
              <h2>{sSetTime}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Humidity */}
      <div className="card">
        <div className="card-head">
          <p>Humidity</p>
        </div>
        <div className="card-item">
          <i className="fa-light fa-droplet fa-2x"></i>
          <h2 id="humidityVal">{humidity}%</h2>
        </div>
      </div>

      {/* Pressure */}
      <div className="card">
        <div className="card-head">
          <p>Pressure</p>
        </div>
        <div className="card-item">
          <i className="fa-light fa-compass fa-2x"></i>
          <h2 id="pressureVal">{pressure}hPa</h2>
        </div>
      </div>

      {/* Visibility */}
      <div className="card">
        <div className="card-head">
          <p>Visibility</p>
        </div>
        <div className="card-item">
          <i className="fa-light fa-eye fa-2x"></i>
          <h2 id="visibilityVal">{visibility / 1000}km</h2>
        </div>
      </div>

      {/* Wind Speed */}
      <div className="card">
        <div className="card-head">
          <p>Wind Speed</p>
        </div>
        <div className="card-item">
          <i className="fa-light fa-location-arrow fa-2x"></i>
          <h2 id="windSpeedVal">{speed}m/s</h2>
        </div>
      </div>

      {/* Feels Like */}
      <div className="card">
        <div className="card-head">
          <p>Feels Like</p>
        </div>
        <div className="card-item">
          <i className="fa-light fa-temperature-list fa-2x"></i>
          <h2 id="feelsVal">{kelvinToCelsius(feels_like)}&deg;C</h2>
        </div>
      </div>
    </div>
  );
}

export default Highlights;