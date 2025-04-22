// components/Loading.js
import React from 'react';
import '../styles/Loading.css';

function Loading() {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="loading-spinner"></div>
        <p>Loading weather data...</p>
      </div>
    </div>
  );
}

export default Loading;