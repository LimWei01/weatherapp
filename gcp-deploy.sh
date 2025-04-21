#!/bin/bash

# Build the React app
echo "Building the React app..."
npm run build

# Deploy to App Engine
echo "Deploying to App Engine..."
gcloud app deploy app.yaml --quiet

echo "Deployment complete! Your app should be available soon." 