import { db } from '../firebase';
import { 
  doc, getDoc, setDoc, updateDoc, 
  Timestamp, enableIndexedDbPersistence
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Maximum number of retries for operations
const MAX_RETRIES = 3;
// Delay between retries in ms (increases with each retry)
const BASE_RETRY_DELAY = 1000;

// Enable offline persistence with better error handling
try {
  enableIndexedDbPersistence(db)
    .then(() => {
      console.log("Firestore persistence enabled");
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Firestore persistence could not be enabled: multiple tabs open');
      } else if (err.code === 'unimplemented') {
        console.warn('Firestore persistence is not available in this browser');
      } else {
        console.error('Firestore persistence error:', err);
      }
    });
} catch (e) {
  console.warn('Firestore persistence already initialized or error:', e);
}

/**
 * Check if the device is online
 * @returns {boolean} Whether the device has network connectivity
 */
const isOnline = () => {
  return navigator.onLine;
};

/**
 * Check if user is authenticated and session is valid
 * @returns {Object|null} User object if authenticated, null otherwise
 */
const getAuthenticatedUser = () => {
  const auth = getAuth();
  const user = auth.currentUser;
  
  if (!user) {
    console.warn("No authenticated user found");
    return null;
  }
  
  // Check if token might be expired (this is a simplistic check)
  const lastLogin = user.metadata?.lastSignInTime 
    ? new Date(user.metadata.lastSignInTime).getTime() 
    : 0;
  
  const hoursSinceLogin = (Date.now() - lastLogin) / (1000 * 60 * 60);
  
  // If it's been more than 55 minutes (Firebase tokens expire after 1 hour)
  if (hoursSinceLogin > 55) {
    console.warn("User session may be expired, should refresh token");
    // Return user anyway - we'll let Firebase handle the error if token is invalid
  }
  
  return user;
};

/**
 * Retry a Firestore operation with exponential backoff
 * @param {Function} operation - The async operation to retry 
 * @param {number} maxRetries - Maximum number of retries
 * @returns {Promise<any>} Result of the operation
 */
const retryOperation = async (operation, maxRetries = MAX_RETRIES) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Verify user is authenticated before each attempt
      const user = getAuthenticatedUser();
      if (!user && attempt === 0) {
        throw new Error('User is not authenticated');
      }
      
      return await operation();
    } catch (error) {
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      lastError = error;
      
      // Special handling for auth errors
      if (error.code === 'permission-denied' || 
          error.code === 'unauthenticated' ||
          error.message?.includes('permission') ||
          error.message?.includes('auth')) {
        console.error('Authentication or permission error, not retrying:', error);
        throw error; // Don't retry auth errors
      }
      
      // If we've reached max retries, throw the error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Wait before retrying, with exponential backoff
      const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Get saved locations from Firestore
 * @param {string} userId - The user ID to get locations for
 * @returns {Promise<Array>} Promise resolving to array of saved location objects
 */
export const getLocationsFromFirestore = async (userId) => {
  try {
    if (!userId) {
      console.warn('No user ID provided to getLocationsFromFirestore');
      return [];
    }

    // Check if online before making the request
    if (!isOnline()) {
      console.warn('Device is offline, using cached Firestore data if available');
      // Firestore persistence will return cached data if available
    }
    
    // Verify user session is valid
    const user = getAuthenticatedUser();
    if (!user) {
      console.warn('User session appears to be invalid');
      return [];
    }
    
    // Verify the userId matches the current user
    if (user.uid !== userId) {
      console.error('User ID mismatch: current user does not match requested user ID');
      return [];
    }

    return await retryOperation(async () => {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return userData.savedLocations || [];
      } else {
        console.warn(`User document with ID ${userId} does not exist in Firestore`);
        return [];
      }
    });
  } catch (error) {
    console.error('Error getting locations from Firestore:', error);
    // If the error is due to offline status, return empty array with a friendly message
    if (error.code === 'unavailable' || error.message?.includes('offline')) {
      console.warn('Unable to fetch locations while offline');
    }
    return [];
  }
};

/**
 * Check if a location is a duplicate of any in the existing locations
 * @param {Object} location - Location to check
 * @param {Array} existingLocations - Array of existing locations
 * @returns {boolean} Whether the location is a duplicate
 */
const isLocationDuplicate = (location, existingLocations) => {
  return existingLocations.some(existingLoc => {
    // Check name (case insensitive)
    if (existingLoc.name.toLowerCase() === location.name.toLowerCase()) {
      return true;
    }
    
    // Check coordinates if they exist (within 0.01 degrees, roughly 1km)
    if (existingLoc.lat && existingLoc.lon && location.lat && location.lon) {
      const latDiff = Math.abs(existingLoc.lat - location.lat);
      const lonDiff = Math.abs(existingLoc.lon - location.lon);
      if (latDiff < 0.01 && lonDiff < 0.01) {
        return true;
      }
    }
    
    return false;
  });
};

/**
 * Save a location to Firestore
 * @param {string} userId - The user ID to save location for
 * @param {Object} location - Location object to save
 * @param {string} [originalSearchName] - Original search name used by the user (to preserve exact user input)
 * @returns {Promise<Array>} Promise resolving to updated array of saved locations
 */
export const saveLocationToFirestore = async (userId, location, originalSearchName = null) => {
  try {
    if (!userId) {
      console.warn('No user ID provided to saveLocationToFirestore');
      return [];
    }

    // Check if online before making the request
    if (!isOnline()) {
      throw new Error('Cannot save location while offline');
    }
    
    // Verify user session is valid
    const user = getAuthenticatedUser();
    if (!user) {
      throw new Error('User session appears to be invalid');
    }
    
    // Verify the userId matches the current user
    if (user.uid !== userId) {
      throw new Error('User ID mismatch: current user does not match requested user ID');
    }

    // Add timestamp to location
    const locationWithTimestamp = {
      ...location,
      saved_at: Timestamp.now()
    };
    
    // If original search name is provided and different from location name, store it
    if (originalSearchName && originalSearchName !== location.name) {
      locationWithTimestamp.originalName = originalSearchName;
    }

    return await retryOperation(async () => {
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedLocations = userData.savedLocations || [];
        
        // Check if location already exists using our helper function
        const isDuplicate = isLocationDuplicate(location, savedLocations);
        
        if (!isDuplicate) {
          // Location doesn't exist, add it
          // Create a new array to prevent potential mutation issues
          const updatedLocations = [...savedLocations, locationWithTimestamp];
          
          // Use a transaction or batch to ensure atomicity
          await updateDoc(userDocRef, {
            savedLocations: updatedLocations,
            lastUpdated: Timestamp.now()
          });
          
          return updatedLocations;
        } else {
          console.log('Location already exists, not saving duplicate');
          // Location already exists
          return savedLocations;
        }
      } else {
        // User document doesn't exist, create it
        await setDoc(userDocRef, {
          savedLocations: [locationWithTimestamp],
          lastUpdated: Timestamp.now()
        });
        
        return [locationWithTimestamp];
      }
    });
  } catch (error) {
    console.error('Error saving location to Firestore:', error);
    throw error; // Let the caller handle the error
  }
};

/**
 * Remove a location from Firestore
 * @param {string} userId - The user ID to remove location for
 * @param {string} locationName - Name of location to remove
 * @returns {Promise<Array>} Promise resolving to updated array of saved locations
 */
export const removeLocationFromFirestore = async (userId, locationName) => {
  try {
    if (!userId) {
      console.warn('No user ID provided to removeLocationFromFirestore');
      return [];
    }

    // Check if online before making the request
    if (!isOnline()) {
      throw new Error('Cannot remove location while offline');
    }
    
    // Verify user session is valid
    const user = getAuthenticatedUser();
    if (!user) {
      throw new Error('User session appears to be invalid');
    }
    
    // Verify the userId matches the current user
    if (user.uid !== userId) {
      throw new Error('User ID mismatch: current user does not match requested user ID');
    }

    return await retryOperation(async () => {
      console.log(`Attempting to remove location "${locationName}" for user ${userId}`);
      
      const userDocRef = doc(db, "users", userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedLocations = userData.savedLocations || [];
        
        console.log(`Found ${savedLocations.length} saved locations, looking for ${locationName}`);
        
        // Log each location for debugging
        savedLocations.forEach((loc, index) => {
          console.log(`Location ${index}: ${loc.name}`);
        });
        
        // Check all locations case insensitively
        const normalizedName = locationName.toLowerCase().trim();
        
        // Find all locations with matching name (case insensitive)
        const filteredLocations = savedLocations.filter(loc => {
          const locNameNormalized = loc.name.toLowerCase().trim();
          const keeps = locNameNormalized !== normalizedName;
          return keeps;
        });
        
        // If no locations were removed, return early
        if (filteredLocations.length === savedLocations.length) {
          console.warn(`No location with name "${locationName}" found`);
          return savedLocations;
        }
        
        // Update in Firestore
        await updateDoc(userDocRef, {
          savedLocations: filteredLocations,
          lastUpdated: Timestamp.now()
        });
        
        return filteredLocations;
      } else {
        console.warn(`User document with ID ${userId} does not exist`);
        return [];
      }
    });
  } catch (error) {
    console.error('Error removing location from Firestore:', error);
    throw error; // Let the caller handle the error
  }
};

/**
 * Export saved locations as a JSON string with metadata
 * @param {string} userId - The user ID to export locations for
 * @returns {Promise<Object>} Promise resolving to object containing exportData and filename
 */
export const exportLocationsAsJSON = async (userId) => {
  try {
    const locations = await getLocationsFromFirestore(userId);
    
    if (locations.length === 0) {
      return { 
        success: false,
        message: 'No saved locations to export' 
      };
    }
    
    // Convert Firestore Timestamps to ISO strings for export
    const locationsForExport = locations.map(loc => ({
      ...loc,
      saved_at: loc.saved_at instanceof Timestamp 
        ? loc.saved_at.toDate().toISOString() 
        : loc.saved_at
    }));
    
    const exportData = {
      data: locationsForExport,
      metadata: {
        exported_at: new Date().toISOString(),
        userId: userId,
        version: '1.0'
      }
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    const filename = `weather_locations_${new Date().toISOString().slice(0,10)}.json`;
    
    return {
      success: true,
      exportData: jsonString,
      filename: filename
    };
  } catch (error) {
    console.error('Error exporting locations:', error);
    return {
      success: false,
      message: 'Failed to export locations: ' + error.message
    };
  }
};

/**
 * Import locations from a JSON string to Firestore
 * @param {string} userId - The user ID to import locations for
 * @param {string} jsonString - JSON string to import
 * @returns {Promise<Object>} Promise resolving to result object with success status and message
 */
export const importLocationsFromJSON = async (userId, jsonString) => {
  try {
    if (!userId) {
      return { 
        success: false,
        message: 'User must be logged in to import locations' 
      };
    }

    const importedData = JSON.parse(jsonString);
    let locationsToImport = [];
    
    // Check if the JSON follows our export format with metadata
    if (importedData.data && Array.isArray(importedData.data)) {
      locationsToImport = importedData.data;
    } 
    // If it's just an array, use it directly
    else if (Array.isArray(importedData)) {
      locationsToImport = importedData;
    } else {
      return { 
        success: false,
        message: 'Invalid format: Expected an array of locations or proper export format'
      };
    }
    
    // Validate locations
    const validLocations = locationsToImport.filter(loc => 
      loc && typeof loc === 'object' && loc.name && typeof loc.name === 'string'
    );
    
    if (validLocations.length === 0) {
      return { 
        success: false,
        message: 'No valid locations found in the imported data'
      };
    }
    
    // Get existing locations
    const existingLocations = await getLocationsFromFirestore(userId);
    
    // Only add locations that don't already exist using our improved duplicate detection
    const newLocations = validLocations.filter(loc => !isLocationDuplicate(loc, existingLocations));
    
    if (newLocations.length === 0) {
      return {
        success: false,
        message: 'All locations already exist in your saved locations'
      };
    }
    
    // Convert ISO date strings to Firestore Timestamps
    const locationsWithTimestamps = newLocations.map(loc => ({
      ...loc,
      saved_at: loc.saved_at ? 
        (typeof loc.saved_at === 'string' ? Timestamp.fromDate(new Date(loc.saved_at)) : loc.saved_at) 
        : Timestamp.now()
    }));
    
    // Save to Firestore
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      // Add all new locations at once to the existing locations
      const updatedLocations = [...existingLocations, ...locationsWithTimestamps];
      
      // Update the entire array instead of using arrayUnion
      await updateDoc(userDocRef, {
        savedLocations: updatedLocations,
        lastUpdated: Timestamp.now()
      });
    } else {
      // Create new document
      await setDoc(userDocRef, {
        savedLocations: locationsWithTimestamps,
        lastUpdated: Timestamp.now()
      });
    }
    
    return {
      success: true,
      message: `Successfully imported ${newLocations.length} new locations`,
      totalLocations: existingLocations.length + newLocations.length
    };
  } catch (error) {
    console.error('Error importing locations:', error);
    return {
      success: false,
      message: 'Failed to import locations: ' + error.message
    };
  }
};
