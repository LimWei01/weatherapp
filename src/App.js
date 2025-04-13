import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './components/Login';
import Signup from './components/SignUp';
import { TemperatureProvider } from './components/TemperatureContext';
import WeatherDashboard from './components/WeatherDashboard';
import './App.css';

function App() {
  return (
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
  );
}

export default App;