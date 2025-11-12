// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCZbv44g5H2H_so3lv1vJmBhefxDsBmsc4",
  authDomain: "ramezsaafiwhatsapp.firebaseapp.com",
  projectId: "ramezsaafiwhatsapp",
  storageBucket: "ramezsaafiwhatsapp.firebasestorage.app",
  messagingSenderId: "143555175811",
  appId: "1:143555175811:web:281b94f482d4dc00adc2b6",
  measurementId: "G-R58JD5QN5Y"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
