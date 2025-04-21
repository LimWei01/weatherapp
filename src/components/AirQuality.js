import React from 'react';
import { FaWind, FaLeaf } from 'react-icons/fa';

const AirQuality = ({ airQualityData }) => {
  if (!airQualityData || !airQualityData.list || !airQualityData.list[0]) {
    return null;
  }

  const aqiData = airQualityData.list[0];
  const pollutants = aqiData.components;
  const aqiLevel = aqiData.main.aqi;

  // AQI level descriptions
  const aqiLevels = [
    { level: 1, name: 'Good', color: '#4CAF50' },
    { level: 2, name: 'Fair', color: '#FFC107' },
    { level: 3, name: 'Moderate', color: '#FF9800' },
    { level: 4, name: 'Poor', color: '#F44336' },
    { level: 5, name: 'Very Poor', color: '#9C27B0' }
  ];

  const currentAqi = aqiLevels[aqiLevel - 1];

  return (
    <div className="air-quality">
      <h3>Air Quality <FaLeaf /></h3>
      <div className="aqi-main">
        <div className="aqi-gauge">
          <div
            className="aqi-level"
            style={{
              backgroundColor: currentAqi.color,
              width: `${(aqiLevel / 5) * 100}%`
            }}
          ></div>
        </div>
        <div className="aqi-value" style={{ color: currentAqi.color }}>
          <span>{currentAqi.name}</span>
          <span className="aqi-number">AQI: {aqiLevel}</span>
        </div>
      </div>

      <div className="pollutants">
        <div className="pollutant-item">
          <div className="pollutant-name">CO</div>
          <div className="pollutant-value">{pollutants.co.toFixed(1)} μg/m³</div>
        </div>
        <div className="pollutant-item">
          <div className="pollutant-name">NO<sub>2</sub></div>
          <div className="pollutant-value">{pollutants.no2.toFixed(1)} μg/m³</div>
        </div>
        <div className="pollutant-item">
          <div className="pollutant-name">O<sub>3</sub></div>
          <div className="pollutant-value">{pollutants.o3.toFixed(1)} μg/m³</div>
        </div>
        <div className="pollutant-item">
          <div className="pollutant-name">PM2.5</div>
          <div className="pollutant-value">{pollutants.pm2_5.toFixed(1)} μg/m³</div>
        </div>
        <div className="pollutant-item">
          <div className="pollutant-name">PM10</div>
          <div className="pollutant-value">{pollutants.pm10.toFixed(1)} μg/m³</div>
        </div>
        <div className="pollutant-item">
          <div className="pollutant-name">SO<sub>2</sub></div>
          <div className="pollutant-value">{pollutants.so2.toFixed(1)} μg/m³</div>
        </div>
      </div>

      <div className="aqi-description">
        <p><strong>Note:</strong> AQI values are based on concentration of pollutants and their impact on health.</p>
      </div>
    </div>
  );
};

export default AirQuality; 