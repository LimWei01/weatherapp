# Weather App Deployment Guide

Lim Wei 33296987  
Cloud Application Task 3  
Github

## Prerequisites

- A Google account
- Node.js and npm installed locally
- Git installed (for version control)
- Your OpenWeatherMap API key

## 1. Set Up Firebase Project

### Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter a project name (e.g., "weather-app")
4. Enable Google Analytics if desired
5. Click "Create project"

### Set Up Authentication

1. In the Firebase Console, navigate to "Build > Authentication"
2. Click "Get started"
3. Enable desired authentication methods (Email/Password, Google, etc.)
4. Configure each method according to your app requirements

## 2. Configure App for Firebase

1. Install Firebase tools:

   ```
   npm install -g firebase-tools
   ```

2. Login to Firebase:

   ```
   firebase login
   ```

3. Initialize Firebase in your project:
   ```
   firebase init
   ```
   - Select Firebase features (Hosting, Firestore, etc.)
   - Select your Firebase project
   - Configure as prompted

## 3. Deploy to Google Cloud App Engine

### Configure App Engine

1. Create an `app.yaml` file in your project root:

   ```yaml
   runtime: nodejs18
   service: default

   handlers:
     - url: /static
       static_dir: build/static
       secure: always

     - url: /(.*\.(json|ico|js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot))
       static_files: build/\1
       upload: build/.*\.(json|ico|js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)
       secure: always

     - url: /.*
       static_files: build/index.html
       upload: build/index.html
       secure: always

   env_variables:
     NODE_ENV: "production"
   ```

### Install Google Cloud SDK

1. Download and install the [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
2. Initialize the SDK:
   ```
   gcloud init
   ```
3. Log in and select your project

### Create a GCP Project

1. Create a new GCP project (or use your Firebase project):

   ```
   gcloud projects create [PROJECT_ID] --name="Weather App"
   gcloud config set project [PROJECT_ID]
   ```

2. Enable billing for your project through the [GCP Console](https://console.cloud.google.com/billing)

3. Enable the App Engine API:
   ```
   gcloud services enable appengine.googleapis.com
   ```

### Deploy the Application

1. Build your React application:

   ```
   npm run build
   ```

2. Deploy to App Engine:

   ```
   gcloud app deploy app.yaml
   ```

3. Access your application at the URL displayed after deployment (usually `https://[PROJECT_ID].appspot.com`)

### Automate Deployment (Optional)

Create a deployment script `gcp-deploy.sh`:

```bash
#!/bin/bash

# Build the React app
echo "Building the React app..."
npm run build

# Deploy to App Engine
echo "Deploying to App Engine..."
gcloud app deploy app.yaml --quiet

echo "Deployment complete! Your app should be available soon."
```

Make it executable:

```
chmod +x gcp-deploy.sh
```

Run it to deploy:

```
./gcp-deploy.sh
```

## 4. Troubleshooting

- If you encounter dependency issues during build, install the missing packages:

  ```
  npm install --save [package-name]
  ```

- View application logs:

  ```
  gcloud app logs tail -s default
  ```

- Open your application in the browser:
  ```
  gcloud app browse
  ```
