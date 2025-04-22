// frontend/src/utilities/apiService.js
import { getSavedLocations, addSavedLocation, deleteSavedLocation } from '../services/api';
import { openDB } from 'idb';

// Initialize IndexedDB for offline requests
const initOfflineDB = async () => {
  return openDB('weather-app-offline-requests', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('requests')) {
        db.createObjectStore('requests', { keyPath: 'id', autoIncrement: true });
      }
    }
  });
};

// Save a request to offline queue
const saveOfflineRequest = async (type, data) => {
  try {
    const db = await initOfflineDB();
    await db.add('requests', {
      type,
      data,
      timestamp: Date.now()
    });
    console.log('Request saved to offline queue:', { type, data });
    return true;
  } catch (error) {
    console.error('Error saving request to offline queue:', error);
    return false;
  }
};

// Process offline requests when online
export const processOfflineRequests = async () => {
  if (!navigator.onLine) return false;
  
  try {
    const db = await initOfflineDB();
    const requests = await db.getAll('requests');
    
    if (requests.length === 0) return true;
    
    console.log(`Processing ${requests.length} offline requests...`);
    
    for (const request of requests) {
      try {
        if (request.type === 'save') {
          await addSavedLocation(request.data);
        } else if (request.type === 'delete') {
          await deleteSavedLocation(request.data);
        }
        
        // Delete the request after successful processing
        await db.delete('requests', request.id);
        console.log('Processed offline request:', request);
      } catch (error) {
        console.error('Error processing offline request:', error);
        // Keep the request in the queue to retry later
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error processing offline requests:', error);
    return false;
  }
};

// Set up online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Application is back online');
    processOfflineRequests();
  });
}

// Get saved locations from backend API
export const getLocationsFromAPI = async () => {
  try {
    return await getSavedLocations();
  } catch (error) {
    console.error('Error getting locations from API:', error);
    return [];
  }
};

// Save a location to backend API with offline support
export const saveLocationToAPI = async (location) => {
  try {
    // If offline, save request to queue
    if (!navigator.onLine) {
      const saved = await saveOfflineRequest('save', location);
      if (saved) {
        console.log('Location saved to offline queue');
        return { ...location, offlineQueued: true };
      }
      throw new Error('Failed to save location to offline queue');
    }
    
    // Process any pending offline requests first
    await processOfflineRequests();
    
    // Then attempt the current request
    try {
      return await addSavedLocation(location);
    } catch (error) {
      // Check if this is a duplicate location error
      if (error.message && error.message.includes('already exists')) {
        throw new Error('This location is already saved');
      }
      throw error;
    }
  } catch (error) {
    // If the error is connectivity-related, try saving to offline queue
    if (error.message?.includes('offline') || !navigator.onLine) {
      console.log('Connectivity issue detected, saving to offline queue');
      const saved = await saveOfflineRequest('save', location);
      if (saved) {
        console.log('Location saved to offline queue after API error');
        return { ...location, offlineQueued: true };
      }
    }
    
    console.error('Error saving location to API:', error);
    throw error;
  }
};

// Remove a location from backend API with offline support
export const removeLocationFromAPI = async (locationId) => {
  try {
    // If offline, save request to queue
    if (!navigator.onLine) {
      const saved = await saveOfflineRequest('delete', locationId);
      if (saved) {
        console.log('Delete request saved to offline queue');
        // Return locally updated locations (filtered)
        const currentLocations = await getLocationsFromAPI();
        return currentLocations.filter(loc => loc.id !== locationId);
      }
      throw new Error('Failed to save delete request to offline queue');
    }
    
    // Process any pending offline requests first
    await processOfflineRequests();
    
    // Then attempt the current request
    const updatedLocations = await deleteSavedLocation(locationId);
    console.log('Successfully deleted location, updated locations:', updatedLocations);
    return updatedLocations;
  } catch (error) {
    // If the error is connectivity-related, try saving to offline queue
    if (error.message?.includes('offline') || !navigator.onLine) {
      console.log('Connectivity issue detected, saving delete request to offline queue');
      const saved = await saveOfflineRequest('delete', locationId);
      if (saved) {
        console.log('Delete request saved to offline queue after API error');
        // Return locally updated locations (filtered)
        const currentLocations = await getLocationsFromAPI();
        return currentLocations.filter(loc => loc.id !== locationId);
      }
    }
    
    console.error('Error removing location from API:', error);
    throw error;
  }
};