// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase } from 'firebase/database';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBVLs9aP79sEfYy9EjtUan6J5jOX21AoNU",
  authDomain: "iqos-d3074.firebaseapp.com",
  databaseURL: "https://iqos-d3074-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "iqos-d3074",
  storageBucket: "iqos-d3074.firebasestorage.app",
  messagingSenderId: "928334092425",
  appId: "1:928334092425:web:3b6d5898ab46d835854e58",
  measurementId: "G-JN7DT8HRGN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);
export default app;
