// components/Header.js
import React, { useState } from 'react';
import { useTemperature } from './TemperatureContext';
function Header({ onCitySearch, onGetCurrentLocation, onLogout }) {
  const [cityInput, setCityInput] = useState('');
  const { isCelsius, toggleUnit } = useTemperature();

  const handleSearch = () => {
    onCitySearch(cityInput);
    setCityInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="header">
      <h2>Weather</h2>
      <div className="weather-input">
        <input
          type="text"
          name="city"
          id="city_input"
          placeholder="Enter city name"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          onKeyUp={handleKeyPress}
        />
        <button onClick={toggleUnit} className="unit-toggle">
        {isCelsius ? '°C to °F' : '°F to °C'}
      </button>
        <button type="button" id="searchBtn" onClick={handleSearch}>
          <i className="fa-regular fa-search"></i>Search
        </button>
        <button type="button" id="locationBtn" onClick={onGetCurrentLocation}>
          <i className="bx bx-target-lock"></i>Current Location
        </button>
        <button type="button" id="logoutBtn" onClick={onLogout}>
          <i className="bx bx-log-out-circle"></i>Log Out
        </button>
      </div>
    </div>
  );
}

export default Header;