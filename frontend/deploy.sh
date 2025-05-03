#!/bin/bash

# Build the React app
npm run build

# Deploy to App Engine
gcloud app deploy 