import { getAuth } from 'firebase/auth';
import { saveLocationToAPI, getLocationsFromAPI } from './apiService';

/**
 * Get user-specific localStorage key
 * @returns {string} The key to use for localStorage
 */
export const getStorageKey = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  return user ? `savedLocations_${user.uid}` : 'savedLocations_guest';
};

/**
 * Get saved locations from localStorage
 * @returns {Array} Array of saved location objects
 */
export const getLocationsFromStorage = () => {
  try {
    const storageKey = getStorageKey();
    const savedLocations = localStorage.getItem(storageKey);
    return savedLocations ? JSON.parse(savedLocations) : [];
  } catch (error) {
    console.error('Error getting locations from localStorage', error);
    return [];
  }
};

/**
 * Synchronize localStorage with Firestore
 * Call this when user logs in to ensure data consistency
 * @param {string} userId - User ID to sync with
 * @returns {Promise<Array>} Updated array of merged locations
 */
export const synchronizeStorage = async (userId) => {
  try {
    if (!userId) return getLocationsFromStorage();
    
    // Get locations from both sources
    const firestoreLocations = await getLocationsFromAPI();
    const localLocations = getLocationsFromStorage();
    
    // Create maps for easier lookup
    const firestoreLocationMap = new Map(
      firestoreLocations.map(loc => [loc.name.toLowerCase(), loc])
    );
    const localLocationMap = new Map(
      localLocations.map(loc => [loc.name.toLowerCase(), loc])
    );
    
    // Merge locations (firestore takes precedence but we'll keep local ones not in firestore)
    const mergedLocations = [...firestoreLocations];
    
    // Add local locations that don't exist in firestore
    for (const [name, location] of localLocationMap.entries()) {
      if (!firestoreLocationMap.has(name)) {
        // Add to merged list
        mergedLocations.push(location);
        
        // Also save to firestore
        try {
          await saveLocationToAPI(location);
        } catch (e) {
          console.error('Error syncing local location to Firestore:', e);
        }
      }
    }
    
    // Update localStorage with merged data
    const storageKey = getStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(mergedLocations));
    
    return mergedLocations;
  } catch (error) {
    console.error('Error synchronizing storage:', error);
    return getLocationsFromStorage();
  }
};

/**
 * Check if a location exists in storage
 * @param {Object} location - Location to check
 * @returns {boolean} Whether the location exists
 */
export const locationExistsInStorage = (location) => {
  try {
    const savedLocations = getLocationsFromStorage();
    
    // Check by name (case insensitive)
    return savedLocations.some(loc => 
      loc.name.toLowerCase() === location.name.toLowerCase()
    );
  } catch (error) {
    console.error('Error checking if location exists', error);
    return false;
  }
};

/**
 * Save a location to localStorage and Firestore if user is logged in
 * @param {Object} location - Location object to save
 * @param {string} [originalName] - Original search name (optional)
 * @returns {Promise<Array>} Updated array of saved locations
 */
export const saveLocationToStorage = async (location, originalName = null) => {
  try {
    // Get the correct storage key
    const storageKey = getStorageKey();
    
    // First save to localStorage as a fallback
    const savedLocations = getLocationsFromStorage();
    
    // Check if location already exists in localStorage
    const existingLocationIndex = savedLocations.findIndex(
      loc => loc.name.toLowerCase() === location.name.toLowerCase()
    );
    
    if (existingLocationIndex === -1) {
      // Add timestamp and original name if provided
      const locationWithMeta = {
        ...location,
        saved_at: new Date().toISOString(),
        originalName: originalName || null
      };
      
      // Add new location to localStorage
      const updatedLocations = [...savedLocations, locationWithMeta];
      localStorage.setItem(storageKey, JSON.stringify(updatedLocations));
      
      // Try to save to Firestore if user is logged in
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (user) {
        try {
          await saveLocationToAPI(location);
        } catch (firestoreError) {
          console.error('Error saving to Firestore, but saved to localStorage', firestoreError);
          // We still return success since we saved to localStorage
        }
      }
      
      return updatedLocations;
    }
    
    return savedLocations;
  } catch (error) {
    console.error('Error saving location', error);
    return getLocationsFromStorage();
  }
};

/**
 * Remove a location from localStorage
 * @param {string} locationName - Name of location to remove
 * @returns {Array} Updated array of saved locations
 */
export const removeLocationFromStorage = (locationName) => {
  try {
    const storageKey = getStorageKey();
    const savedLocations = getLocationsFromStorage();
    const updatedLocations = savedLocations.filter(
      location => location.name.toLowerCase() !== locationName.toLowerCase()
    );
    localStorage.setItem(storageKey, JSON.stringify(updatedLocations));
    return updatedLocations;
  } catch (error) {
    console.error('Error removing location from localStorage', error);
    return getLocationsFromStorage();
  }
};