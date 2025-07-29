import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode  } from 'firebase/auth';
import { getFirestore, Firestore, setLogLevel } from 'firebase/firestore';
import { getAnalytics, Analytics } from "firebase/analytics";

// Attempt to use __firebase_config from Canvas environment
let firebaseConfigJson: string | undefined = undefined;
if (typeof window !== 'undefined' && typeof (window as any).__firebase_config !== 'undefined') {
    firebaseConfigJson = (window as any).__firebase_config;
}

let firebaseConfig: Record<string, string | undefined> = {}; // Allow undefined for measurementId initially

try {
    if (firebaseConfigJson) {
        firebaseConfig = JSON.parse(firebaseConfigJson);
    }
} catch (e) {
    console.error("Error parsing __firebase_config:", e);
}

// Fallback to Vite environment variables if __firebase_config is not available or empty
if (Object.keys(firebaseConfig).length === 0) {
    console.warn("Firebase config not found via __firebase_config. Using Vite environment variables as fallback.");
    firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID // Optional
    };
}

// Filter out undefined values before initializing, especially for measurementId
const validFirebaseConfig = Object.fromEntries(
  Object.entries(firebaseConfig).filter(([_, value]) => value !== undefined)
);


// Initialize Firebase
const app: FirebaseApp = initializeApp(validFirebaseConfig as Record<string, string>); // Cast after filtering
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const analytics: Analytics = getAnalytics(app);

// Set Firestore log level (optional, useful for debugging)
// setLogLevel('debug'); // Use 'error' or 'silent' in production

// Function to handle authentication initialization
// In firebaseConfig.ts - if you DON'T want anonymous login as a fallback
const initializeAuthListener = (): Promise<User | null> => {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe(); // Still unsubscribe for initial check only
            if (user) {
                console.log("FirebaseConfig: User session found:", user.uid);
                resolve(user);
            } else {
                console.log("FirebaseConfig: No active user session, no custom token, not attempting anonymous.");
                resolve(null); // No user, and don't try anonymous
            }
        });
    });
}; 

// App ID for Firestore paths (Canvas environment)
const appId: string = (typeof window !== 'undefined' && typeof (window as any).__app_id !== 'undefined')
    ? (window as any).__app_id
    : 'default-app-id'; // Fallback if not in Canvas or __app_id isn't set

export { app, auth, db, analytics, initializeAuthListener, appId, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, confirmPasswordReset, verifyPasswordResetCode  };
