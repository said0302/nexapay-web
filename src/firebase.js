import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: GANTI KODE DI BAWAH INI DENGAN MILIKMU DARI HALAMAN FIREBASE TADI!
const firebaseConfig = {
  apiKey: "AIzaSyDbN4sJLGyYTb49nljeb3T_CvA1gfor7K0",
  authDomain: "catatan-keuangan-dc804.firebaseapp.com",
  projectId: "catatan-keuangan-dc804",
  storageBucket: "catatan-keuangan-dc804.firebasestorage.app",
  messagingSenderId: "465764601121",
  appId: "1:465764601121:web:2318f385166660a29e8260",
};

// Menyalakan Firebase
const app = initializeApp(firebaseConfig);

// Menyalakan fitur Database (Firestore)
export const db = getFirestore(app);

// --- TAMBAHKAN 2 BARIS INI DI PALING BAWAH ---
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
