import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { FaStar, FaTrash } from 'react-icons/fa';

function SavedLocations({ onLocationSelect, currentLocation }) {
  const [savedLocations, setSavedLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    let mounted = true;
    
    if (currentUser) {
      setIsLoading(true);
      
      const userRef = doc(db, 'users', currentUser.uid);
      
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (!mounted) return;
        
        if (doc.exists()) {
          setSavedLocations(doc.data().savedLocations || []);
          // Reset saving state when database is updated
          setIsSaving(false);
        } else {
          setSavedLocations([]);
          setDoc(userRef, { savedLocations: [] }).catch(console.error);
        }
        setIsLoading(false);
      }, (error) => {
        if (!mounted) return;
        console.error('Error fetching locations:', error);
        setError('Failed to load saved locations');
        setIsLoading(false);
        setIsSaving(false); // Also reset saving state on error
      });

      return () => {
        mounted = false;
        unsubscribe();
      };
    } else {
      setSavedLocations([]);
      setIsLoading(false);
    }
  }, [currentUser]);

  const saveLocation = async () => {
    if (!currentUser || !currentLocation) {
      setError('Please login and select a location to save');
      return;
    }

    const locationData = {
      name: currentLocation.name,
      lat: currentLocation.lat,
      lon: currentLocation.lon,
      country: currentLocation.country,
      state: currentLocation.state || '',
      id: `${currentLocation.lat}-${currentLocation.lon}`
    };

    try {
      setIsSaving(true);
      setError(null);

      // More precise duplicate check
      const isDuplicate = savedLocations.some(loc => 
        loc.lat === locationData.lat && 
        loc.lon === locationData.lon &&
        loc.name === locationData.name &&
        loc.country === locationData.country
      );

      if (isDuplicate) {
        setError('Location already saved');
        setIsSaving(false);
        return;
      }

      const userRef = doc(db, 'users', currentUser.uid);
      
      // Only do the Firestore update, don't manually update local state
      await updateDoc(userRef, {
        savedLocations: arrayUnion(locationData)
      });
      
      // Remove the setIsSaving(false) from here as it will be handled by onSnapshot
      
    } catch (error) {
      console.error('Error details:', error);
      setError('Failed to save location. Please try again.');
      setIsSaving(false);
    }
  };

  const handleLocationSelect = (location) => {
    if (onLocationSelect) {
      onLocationSelect({
        name: location.name,
        lat: location.lat,
        lon: location.lon,
        country: location.country,
        state: location.state || ''
      });
    }
  };

  const removeLocation = async (locationToRemove) => {
    if (!currentUser) return;
    setError(null);

    try {
      setIsLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      const updatedLocations = savedLocations.filter(
        loc => loc.id !== locationToRemove.id
      );
      
      await setDoc(userRef, { savedLocations: updatedLocations }, { merge: true });
      setSavedLocations(updatedLocations);
      
    } catch (error) {
      console.error('Error removing location:', error);
      setError('Failed to remove location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="saved-locations">
      <div className="saved-locations-header">
        <h3>Saved Locations</h3>
        {currentLocation && (
          <button 
            onClick={saveLocation} 
            className="save-current-btn"
            disabled={isSaving}
          >
            <FaStar /> {isSaving ? 'Saving...' : 'Save Current'}
          </button>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="locations-list">
        {!currentUser ? (
          <div className="empty-message">Please login to save locations</div>
        ) : isLoading ? (
          <div className="loading-message">Loading saved locations...</div>
        ) : savedLocations.length > 0 ? (
          savedLocations.map((location, index) => (
            <div key={location.id || index} className="location-item">
              <button 
                className="location-btn"
                onClick={() => handleLocationSelect(location)}
              >
                {location.name}, {location.country}
              </button>
              <button 
                className="remove-btn"
                onClick={() => removeLocation(location)}
              >
                <FaTrash />
              </button>
            </div>
          ))
        ) : (
          <div className="empty-message">No saved locations yet</div>
        )}
      </div>
    </div>
  );
}

export default SavedLocations;