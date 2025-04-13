import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBUJcVvL8Q8lmQVcCsHN6XWreo7vw9bhks",
    authDomain: "weatherapp-456015.firebaseapp.com",
    projectId: "weatherapp-456015",
    storageBucket: "weatherapp-456015.firebasestorage.app",
    messagingSenderId: "453754021393",
    appId: "1:453754021393:web:92c34c1b9e826f1334b3b0",
    measurementId: "G-J2Q5P3W05B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.warn('The current browser doesn\'t support offline persistence');
        }
    });
} catch (error) {
    console.warn('Error enabling offline persistence:', error);
}

export { auth, db };