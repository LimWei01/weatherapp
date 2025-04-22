import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Signup from './components/SignUp';
import { TemperatureProvider } from './components/TemperatureContext';
import WeatherDashboard from './components/WeatherDashboard';
import './App.css';
import './styles/Loading.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  
  useEffect(() => {
    // Simple initialization delay
    const timer = setTimeout(() => {
      setFadeOut(true);
      
      // Give time for the fade-out animation to complete
      setTimeout(() => {
        setIsLoading(false);
      }, 300);
    }, 600);
    
    return () => {
      clearTimeout(timer);
    };
  }, []);
  
  if (isLoading) {
    return (
      <div className={`loading-container ${fadeOut ? 'fade-out' : ''}`}>
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Loading weather app...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="app-content">
      <AuthProvider>
        <TemperatureProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/" 
                element={
                  <PrivateRoute>
                    <WeatherDashboard />
                  </PrivateRoute>
                } 
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </BrowserRouter>
        </TemperatureProvider>
      </AuthProvider>
    </div>
  );
}

export default App;