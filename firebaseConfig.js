// firebaseConfig.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // Optional, if you want to use Firebase Auth

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCqPOgc9VQ_y-KUujFcyCZKDlylqWzqcQ0",
  authDomain: "as-earn-hub-e70f7.firebaseapp.com",
  projectId: "as-earn-hub-e70f7",
  storageBucket: "as-earn-hub-e70f7.firebasestorage.app",
  messagingSenderId: "880785939134",
  appId: "1:880785939134:web:7af830b581e3001c4e5cef",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Firebase Authentication (optional, but good for backend if needed)
const auth = getAuth(app); 

export { db, auth };
