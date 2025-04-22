# Weather App

A modern weather application providing real-time weather data, forecasts, and personalized weather tracking.

## Project Structure

This project is organized into two main directories:

- **frontend**: React application for the user interface
- **backend**: Node.js/Express server for API requests and data handling

## Features

- Current weather conditions
- Hourly and 5-day forecasts
- Weather alerts and notifications
- Air quality information
- User authentication
- Save favorite locations
- Weather data visualization

## Setup Instructions

### Backend

```
cd backend
npm install
npm start
```

### Frontend

```
cd frontend
npm install
npm start
```

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```
OPENWEATHER_API_KEY=your_api_key
FIREBASE_API_KEY=your_firebase_key
PORT=3001
```

## Technologies

- React.js
- Node.js/Express
- Firebase (Authentication & Database)
- OpenWeather API
- Chart.js for data visualization
