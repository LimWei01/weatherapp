import React, { createContext, useContext, useState } from 'react';

const TemperatureContext = createContext();

export function useTemperature() {
  return useContext(TemperatureContext);
}

export function TemperatureProvider({ children }) {
  const [isCelsius, setIsCelsius] = useState(true);

  const toggleUnit = () => {
    setIsCelsius(!isCelsius);
  };
  
  const kelvinToCelsius = (kelvin) => {
    return (kelvin - 273.15).toFixed(1);
  };

  const kelvinToFahrenheit = (kelvin) => {
    return ((kelvin - 273.15) * 9/5 + 32).toFixed(1);
  };

  const getTemperature = (kelvin) => {
    return isCelsius ? kelvinToCelsius(kelvin) : kelvinToFahrenheit(kelvin);
  };

  const value = {
    isCelsius,
    toggleUnit,
    getTemperature
  };

  return (
    <TemperatureContext.Provider value={value}>
      {children}
    </TemperatureContext.Provider>
  );
}