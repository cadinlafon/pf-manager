import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

// Same Firebase project as the PF Audio App (sermon-audio-app/src/firebase.js),
// so leaders sign in with the account they already have. These are the
// project's public web identifiers, not secrets — access is controlled by
// Firebase Auth and Firestore security rules.
const firebaseConfig = {
  apiKey: "AIzaSyBhhdR6mms3JdLhXkl283k9yjm7zyLafpk",
  authDomain: "palousefellowshipsermonapp.firebaseapp.com",
  projectId: "palousefellowshipsermonapp",
  storageBucket: "palousefellowshipsermonapp.firebasestorage.app",
  messagingSenderId: "591678059434",
  appId: "1:591678059434:web:dfa8631fab9a2295f831d3",
};

// Development-only: `npm run dev:emulators` points the app at local Firebase
// emulators (see "Testing locally" in the README) instead of the real
// project, so features can be tested with the security rules enforced and
// without touching church data. import.meta.env.DEV is false in production
// builds, so a deployed app can never be switched to the emulators.
export const USE_EMULATORS = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "1";

const app = initializeApp(USE_EMULATORS ? { ...firebaseConfig, projectId: "demo-pf-management" } : firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9199", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8787);
  connectStorageEmulator(storage, "127.0.0.1", 9299);
}
