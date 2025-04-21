import { initializeApp } from 'firebase/app';
import { initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBUJcVvL8Q8lmQVcCsHN6XWreo7vw9bhks",
  authDomain: "weatherapp-456015.firebaseapp.com",
  projectId: "weatherapp-456015",
  storageBucket: "weatherapp-456015.appspot.com",
  messagingSenderId: "453754021393",
  appId: "1:453754021393:web:92c34c1b9e826f1334b3b0",
  measurementId: "G-J2Q5P3W05B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings for better offline support
const firestoreSettings = {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true, // Prevents errors with undefined values
  experimentalForceLongPolling: true, // More reliable than WebSockets for some networks
};

// Initialize Firebase services with improved settings
export const db = initializeFirestore(app, firestoreSettings);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Connect to emulators in development if needed
/*
if (process.env.NODE_ENV === 'development') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
}
*/

// Add unhandled error handling
auth.onAuthStateChanged(user => {
  console.log('Auth state changed:', user ? `User ${user.uid} logged in` : 'User logged out');
}, error => {
  console.error('Auth error:', error);
});

export default app;