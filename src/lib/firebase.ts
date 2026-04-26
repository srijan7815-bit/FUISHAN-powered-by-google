import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// You will eventually replace these placeholders with your actual keys from Firebase!
const firebaseConfig = {
  apiKey: "AIzaSyDvjesGoeUPGPk78QXxZcYZ8BGBaPkMzvg",
  authDomain: "fuishan.firebaseapp.com",
  projectId: "fuishan",
  storageBucket: "fuishan.firebasestorage.app",
  messagingSenderId: "563936759810",
  appId: "1:563936759810:web:707a076a31f839ba8e571b"
};

// Initialize Firebase safely for Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
