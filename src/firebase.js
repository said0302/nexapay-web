// 1. IMPORT INTI FIREBASE
import { initializeApp } from "firebase/app";

// 2. IMPORT DATABASE (FIRESTORE)
import { getFirestore } from "firebase/firestore";

// 3. IMPORT AUTHENTICATION (LOGIN) - Ini yang tadi terlewat!
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// --- GANTI KODE DI BAWAH INI DENGAN MILIKMU ---
const firebaseConfig = {
  apiKey: "AIzaSyDbN4sJLGyYTb49nljeb3T_CvA1gfor7K0",
  authDomain: "catatan-keuangan-dc804.firebaseapp.com",
  projectId: "catatan-keuangan-dc804",
  storageBucket: "catatan-keuangan-dc804.firebasestorage.app",
  messagingSenderId: "465764601121",
  appId: "1:465764601121:web:2318f385166660a29e8260",
};
// ----------------------------------------------

// Menyalakan Mesin Firebase
const app = initializeApp(firebaseConfig);

// Menyalakan Fitur Database
export const db = getFirestore(app);

// Menyalakan Fitur Login Google
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
