// frontend/src/services/api.js
import { auth } from '../firebase';

// Updated to match both development ports (5000 and 8000)
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// Helper to get auth token
const getAuthToken = async () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  return currentUser.getIdToken();
};

// Helper to make authenticated requests
const authenticatedRequest = async (endpoint, options = {}) => {
  try {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include', // Include cookies for CORS requests
      mode: 'cors'           // Explicitly set CORS mode
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'API request failed');
    }
    
    return response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// User services
export const getUserProfile = (userId) => {
  return authenticatedRequest(`/users/${userId}`);
};

export const updateUserProfile = (userId, data) => {
  return authenticatedRequest(`/users/${userId}`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

// Weather services
export const getSavedLocations = () => {
  return authenticatedRequest('/weather/locations');
};

export const addSavedLocation = (locationData) => {
  return authenticatedRequest('/weather/locations', {
    method: 'POST',
    body: JSON.stringify(locationData)
  });
};

export const deleteSavedLocation = (locationId) => {
  return authenticatedRequest(`/weather/locations/${locationId}`, {
    method: 'DELETE'
  }).then(response => {
    // Return the updated locations list that's included in the response
    return response.locations || [];
  });
};