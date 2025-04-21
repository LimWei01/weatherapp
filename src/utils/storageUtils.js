/**
 * Utility functions for handling location storage in localStorage
 */

import { v4 as uuidv4 } from 'uuid';

// Constants
const STORAGE_KEY = 'weatherApp_savedLocations';

/**
 * Gets all saved locations from localStorage
 * @returns {Array} Array of saved locations
 */
export const getLocationsFromStorage = () => {
  try {
    const locations = localStorage.getItem(STORAGE_KEY);
    return locations ? JSON.parse(locations) : [];
  } catch (error) {
    console.error('Error getting locations from localStorage:', error);
    return [];
  }
};

/**
 * Checks if a location exists in localStorage
 * @param {Object} location - Location to check
 * @returns {boolean} True if location exists
 */
export const locationExistsInStorage = (location) => {
  if (!location || !location.name) return false;
  
  try {
    const savedLocations = getLocationsFromStorage();
    return savedLocations.some(
      saved => 
        saved.name === location.name || 
        (Math.abs(saved.lat - location.lat) < 0.01 && Math.abs(saved.lon - location.lon) < 0.01)
    );
  } catch (error) {
    console.error('Error checking if location exists in storage:', error);
    return false;
  }
};

/**
 * Adds a location to localStorage
 * @param {Object} location - Location object to save
 * @param {string} [originalSearchTerm] - Original search term used by the user
 * @returns {boolean} Success status
 */
export const addLocationToStorage = (location, originalSearchTerm = null) => {
  if (!location || !location.name) return false;
  
  try {
    // Don't add if already exists
    if (locationExistsInStorage(location)) {
      return false;
    }
    
    const locationToSave = { ...location };
    
    // Add originalName field if provided and different from API name
    if (originalSearchTerm && originalSearchTerm !== location.name) {
      locationToSave.originalName = originalSearchTerm;
    }
    
    const savedLocations = getLocationsFromStorage();
    savedLocations.push(locationToSave);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLocations));
    return true;
  } catch (error) {
    console.error('Error adding location to localStorage:', error);
    return false;
  }
};

/**
 * Removes a location from localStorage
 * @param {Object} location - Location object to remove
 * @returns {boolean} Success status
 */
export const removeLocationFromStorage = (location) => {
  if (!location || !location.name) return false;
  
  try {
    const savedLocations = getLocationsFromStorage();
    const updatedLocations = savedLocations.filter(
      saved => 
        saved.name !== location.name && 
        !(Math.abs(saved.lat - location.lat) < 0.01 && Math.abs(saved.lon - location.lon) < 0.01)
    );
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLocations));
    return savedLocations.length !== updatedLocations.length;
  } catch (error) {
    console.error('Error removing location from localStorage:', error);
    return false;
  }
};

/**
 * Exports all saved locations as a JSON file
 * @returns {boolean} Success status
 */
export const exportLocationsAsJSON = () => {
  const locations = getLocationsFromStorage();
  return JSON.stringify(locations, null, 2);
};

/**
 * Imports locations from a JSON file
 * @param {string} jsonString - JSON string to import
 * @returns {Object} Result object with success and message
 */
export const importLocationsFromJSON = (jsonString) => {
  try {
    const locations = JSON.parse(jsonString);
    
    if (!Array.isArray(locations)) {
      return { success: false, message: 'Invalid format: Expected an array of locations' };
    }
    
    // Validate each location has required fields
    const validLocations = locations.filter(loc => 
      loc && loc.name && typeof loc.lat === 'number' && typeof loc.lon === 'number'
    );
    
    if (validLocations.length === 0) {
      return { success: false, message: 'No valid locations found in import data' };
    }
    
    // Save valid locations
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validLocations));
    
    return { 
      success: true, 
      message: `Successfully imported ${validLocations.length} locations` 
    };
  } catch (error) {
    return { success: false, message: 'Failed to parse JSON data' };
  }
}; 