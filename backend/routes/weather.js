// routes/weather.js
const express = require('express');
const admin = require('firebase-admin');
const router = express.Router();

// Helper function to create a complete key for locations
const createLocationKey = (userId, locationId = null) => {
  const datastore = global.datastore;
  
  if (locationId) {
    // For deletion, convert string ID to numeric if it's a numeric string
    const parsedId = /^\d+$/.test(locationId) ? parseInt(locationId, 10) : locationId;
    console.log(`Creating location key with parsed ID: ${parsedId}, type: ${typeof parsedId}`);
    return datastore.key(['User', userId, 'Location', parsedId]);
  } else {
    return datastore.key(['User', userId, 'Location']);
  }
};

// Helper function to format entity for client
const formatLocation = (entity) => {
  const key = entity[global.datastore.KEY];
  const id = key.id || key.name;
  
  console.log(`Formatting location with key:`, key);
  console.log(`Location ID: ${id}, type: ${typeof id}`);
  
  const formattedLocation = {
    id: id.toString(), // Always convert ID to string for consistent frontend handling
    ...entity
  };
  
  // Remove datastore KEY from returned object
  delete formattedLocation[global.datastore.KEY];
  
  return formattedLocation;
};

// Get user's saved locations
router.get('/locations', async (req, res) => {
  try {
    const userId = req.user.uid;
    const datastore = global.datastore;
    
    // Create ancestor query to get all locations for user
    const ancestorKey = datastore.key(['User', userId]);
    const query = datastore
      .createQuery('Location')
      .hasAncestor(ancestorKey);
    
    const [locations] = await datastore.runQuery(query);
    console.log(`Retrieved ${locations.length} locations for user ${userId}`);
    
    // Format locations for client
    const formattedLocations = locations.map(location => formatLocation(location));
    
    res.status(200).json(formattedLocations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a new saved location
router.post('/locations', async (req, res) => {
  try {
    const userId = req.user.uid;
    const locationData = req.body;
    const datastore = global.datastore;
    
    // Check if location with same name already exists
    const ancestorKey = datastore.key(['User', userId]);
    const query = datastore
      .createQuery('Location')
      .hasAncestor(ancestorKey)
      .filter('name', '=', locationData.name);
    
    const [existingLocations] = await datastore.runQuery(query);
    
    if (existingLocations.length > 0) {
      return res.status(409).json({ error: 'Location already exists' });
    }
    
    // Prepare entity for Datastore
    const locationKey = createLocationKey(userId);
    const locationEntity = {
      key: locationKey,
      data: {
        ...locationData,
        createdAt: new Date()
      }
    };
    
    // Save to Datastore
    await datastore.save(locationEntity);
    console.log('Saved location with key:', locationKey);
    
    // Get the newly created location data with ID
    const id = locationKey.id || locationKey.name;
    console.log(`New location ID: ${id}, type: ${typeof id}`);
    
    const newLocation = {
      id: id.toString(), // Convert to string for consistent frontend handling
      ...locationData
    };
    
    res.status(201).json(newLocation);
  } catch (error) {
    console.error('Error adding location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a saved location
router.delete('/locations/:locationId', async (req, res) => {
  try {
    const userId = req.user.uid;
    const { locationId } = req.params;
    const datastore = global.datastore;
    
    console.log(`Attempting to delete location with ID: ${locationId}, type: ${typeof locationId}`);
    
    // Create key for the location to delete
    const locationKey = createLocationKey(userId, locationId);
    console.log('Generated location key for deletion:', locationKey);
    
    // Delete the entity
    await datastore.delete(locationKey);
    console.log('Deleted location with key:', locationKey);
    
    // Get updated locations
    const ancestorKey = datastore.key(['User', userId]);
    const query = datastore
      .createQuery('Location')
      .hasAncestor(ancestorKey);
    
    const [locations] = await datastore.runQuery(query);
    console.log(`Retrieved ${locations.length} locations after deletion`);
    
    const formattedLocations = locations.map(location => formatLocation(location));
    
    // Return the updated locations list
    res.status(200).json({
      message: 'Location deleted successfully',
      locations: formattedLocations
    });
  } catch (error) {
    console.error('Error deleting location:', error, error.stack);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
});

module.exports = router;