import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FaTrash, FaSyncAlt, FaFileDownload, FaFileUpload, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import { 
  getLocationsFromFirestore, 
  removeLocationFromFirestore,
  exportLocationsAsJSON,
  importLocationsFromJSON
} from '../utilities/firestoreUtils';
import '../App.css';

const SavedLocations = ({ onSelectLocation, locationSaved }) => {
  const [savedLocations, setSavedLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastLoadTime, setLastLoadTime] = useState(null);
  const [removedCount, setRemovedCount] = useState(0); // To trigger re-renders after removal
  
  // File input ref
  const fileInputRef = useRef(null);
  
  // Get auth context
  const { currentUser, refreshAuthToken } = useAuth();

  // Handle authentication errors
  const handleAuthError = async (error) => {
    console.error('Authentication error:', error);
    
    // Try to refresh the token
    try {
      await refreshAuthToken();
      return true; // Token refreshed successfully
    } catch (refreshError) {
      console.error('Failed to refresh token:', refreshError);
      showMessage('Authentication error. Please try logging out and logging back in.', 'error');
      return false;
    }
  };

  // Memoize the loadLocations function to avoid unnecessary re-renders
  const loadSavedLocations = useCallback(async () => {
    if (!currentUser) {
      setSavedLocations([]);
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Loading saved locations from Firestore');
      const locations = await getLocationsFromFirestore(currentUser.uid);
      console.log(`Loaded ${locations.length} locations`);
      setSavedLocations(locations);
      setLastLoadTime(Date.now());
    } catch (error) {
      console.error("Error loading saved locations from Firestore:", error);
      
      // Handle different error types
      if (error.code === 'permission-denied' || error.code === 'unauthenticated' || 
          error.message?.includes('authentication') || error.message?.includes('session')) {
        // Auth error - try to refresh token
        const refreshed = await handleAuthError(error);
        if (refreshed) {
          // Try loading again after token refresh
          try {
            const locations = await getLocationsFromFirestore(currentUser.uid);
            setSavedLocations(locations);
            setLastLoadTime(Date.now());
            return;
          } catch (retryError) {
            console.error("Failed to load locations after token refresh:", retryError);
          }
        }
        
        // If we get here, the token refresh didn't help
        showMessage('Authentication error. Please try logging out and logging back in.', 'error');
        setSavedLocations([]);
      } else if (!navigator.onLine) {
        showMessage('Cannot load locations while offline', 'warning');
      } else {
        showMessage('Failed to load saved locations', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, refreshAuthToken]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (currentUser && lastLoadTime && Date.now() - lastLoadTime > 300000) { // 5 minutes
        loadSavedLocations(); // Refresh data when coming back online after 5 minutes
      }
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser, lastLoadTime, loadSavedLocations]);

  // Only load saved locations on:
  // 1. Initial mount
  // 2. When user changes
  // 3. When a new location is saved (locationSaved prop changes)
  // 4. When a location is removed (removedCount changes)
  useEffect(() => {
    loadSavedLocations();
  }, [currentUser, locationSaved, removedCount, loadSavedLocations]);

  const removeLocation = async (locationName) => {
    try {
      if (!currentUser) {
        showMessage('Please log in to remove locations', 'error');
        return;
      }
      
      if (!isOnline) {
        showMessage('Cannot remove location while offline', 'error');
        return;
      }
      
      setLoading(true);
      
      console.log(`Removing location: ${locationName}`);
      const updatedLocations = await removeLocationFromFirestore(currentUser.uid, locationName);
      
      // Update the local state
      setSavedLocations(updatedLocations);
      
      // Increment removedCount to force a re-render
      setRemovedCount(prev => prev + 1);
      
      showMessage('Location removed successfully', 'success');
    } catch (error) {
      console.error("Error removing location:", error);
      
      // Handle different error types
      if (error.code === 'permission-denied' || error.code === 'unauthenticated' || 
          error.message?.includes('authentication') || error.message?.includes('session')) {
        // Auth error - try to refresh token
        const refreshed = await handleAuthError(error);
        if (refreshed) {
          // Try removing again after token refresh
          try {
            const updatedLocations = await removeLocationFromFirestore(currentUser.uid, locationName);
            setSavedLocations(updatedLocations);
            setRemovedCount(prev => prev + 1);
            showMessage('Location removed successfully', 'success');
            return;
          } catch (retryError) {
            console.error("Failed to remove location after token refresh:", retryError);
          }
        }
        
        // If we get here, the token refresh didn't help
        showMessage('Authentication error. Please try logging out and logging back in.', 'error');
      } else {
        showMessage('Failed to remove location: ' + error.message, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshLocations = () => {
    setIsRefreshing(true);
    loadSavedLocations();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleExportLocations = async () => {
    try {
      if (!currentUser) {
        showMessage('Please log in to export locations', 'error');
        return;
      }
      
      if (!isOnline) {
        showMessage('Cannot export locations while offline', 'error');
        return;
      }
      
      const result = await exportLocationsAsJSON(currentUser.uid);
      
      if (!result.success) {
        // Try refreshing token if it's an auth error
        if (result.message?.includes('auth') || result.message?.includes('permission')) {
          const refreshed = await handleAuthError(new Error(result.message));
          if (refreshed) {
            // Try exporting again after token refresh
            const retryResult = await exportLocationsAsJSON(currentUser.uid);
            if (retryResult.success) {
              // Create and download the file
              const blob = new Blob([retryResult.exportData], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.style.display = 'none';
              a.href = url;
              a.download = retryResult.filename;
              document.body.appendChild(a);
              a.click();
              
              // Clean up
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
              
              showMessage('Locations exported successfully', 'success');
              return;
            }
          }
        }
        
        showMessage(result.message, 'error');
        return;
      }
      
      // Create and download the file
      const blob = new Blob([result.exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      showMessage('Locations exported successfully', 'success');
    } catch (error) {
      console.error("Error exporting locations:", error);
      showMessage('Failed to export locations', 'error');
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImportLocations = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!currentUser) {
      showMessage('Please log in to import locations', 'error');
      event.target.value = '';
      return;
    }
    
    if (!isOnline) {
      showMessage('Cannot import locations while offline', 'error');
      event.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonString = e.target.result;
        const result = await importLocationsFromJSON(currentUser.uid, jsonString);
        
        if (result.success) {
          showMessage(result.message, 'success');
          await loadSavedLocations();
        } else {
          // Try refreshing token if it's an auth error
          if (result.message?.includes('auth') || result.message?.includes('permission')) {
            const refreshed = await handleAuthError(new Error(result.message));
            if (refreshed) {
              // Try importing again after token refresh
              const retryResult = await importLocationsFromJSON(currentUser.uid, jsonString);
              if (retryResult.success) {
                showMessage(retryResult.message, 'success');
                await loadSavedLocations();
                return;
              }
            }
          }
          showMessage(result.message, 'error');
        }
      } catch (error) {
        console.error("Error importing locations:", error);
        
        // Handle authentication errors
        if (error.code === 'permission-denied' || error.code === 'unauthenticated' || 
            error.message?.includes('authentication') || error.message?.includes('session')) {
          const refreshed = await handleAuthError(error);
          if (!refreshed) {
            showMessage('Authentication error. Please try logging out and logging back in.', 'error');
          }
        } else {
          showMessage('Failed to import locations: ' + error.message, 'error');
        }
      }
    };
    
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };

  const dismissMessage = () => {
    setMessage({ text: '', type: '' });
  };

  // Get display name for a location (original search term if available, otherwise API name)
  const getLocationDisplayName = (location) => {
    return location.originalName || location.name;
  };

  return (
    <div className="saved-locations">
      <h2>Saved Locations</h2>
      
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button className="dismiss-btn" onClick={dismissMessage}>×</button>
        </div>
      )}
      
      {!isOnline && (
        <div className="storage-mode">
          <FaExclamationTriangle className="icon" />
          You are currently offline. Cannot access saved locations.
        </div>
      )}
      
      {!currentUser && (
        <div className="storage-mode">
          <FaExclamationTriangle className="icon" />
          Please log in to save and view locations.
        </div>
      )}
      
      <div className="locations-actions">
        <button 
          className={`refresh-btn ${isRefreshing ? 'refreshing' : ''}`} 
          onClick={refreshLocations}
          disabled={loading || !currentUser || !isOnline}
        >
          <FaSyncAlt />
        </button>
        
        <button 
          className="export-btn" 
          onClick={handleExportLocations}
          disabled={loading || savedLocations.length === 0 || !currentUser || !isOnline}
        >
          <FaFileDownload /> Export
        </button>
        
        <button 
          className="import-btn" 
          onClick={handleImportClick}
          disabled={loading || !currentUser || !isOnline}
        >
          <FaFileUpload /> Import
        </button>
        
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".json"
          style={{ display: 'none' }} 
          onChange={handleImportLocations}
        />
      </div>
      
      {loading ? (
        <p>Loading saved locations...</p>
      ) : savedLocations.length > 0 ? (
        <ul className="saved-locations-list">
          {savedLocations.map((location, index) => (
            <li key={index} className="saved-location-item">
              <button 
                className="location-btn" 
                onClick={() => onSelectLocation(location.name)}
                title={location.originalName ? `API location: ${location.name}` : ''}
              >
                {getLocationDisplayName(location)}
              </button>
              <button 
                className="remove-btn" 
                onClick={() => removeLocation(location.name)}
              >
                <FaTrash />
              </button>
            </li>
          ))}
        </ul>
      ) : currentUser && isOnline ? (
        <p className="no-locations">No saved locations yet</p>
      ) : null}
      
      {!loading && !message.text && savedLocations.length === 0 && currentUser && isOnline && (
        <p className="import-prompt">
          Use the Import button to restore your previously exported locations
        </p>
      )}
    </div>
  );
};

export default SavedLocations;