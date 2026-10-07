import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { auth } from "../firebase/config";
import { docRef } from "../firebase/collections";
import { PREVIEW } from "../lib/preview";

const AuthContext = createContext(null);

const PREVIEW_USER = { uid: "preview", email: "preview@example.com", displayName: "Preview Manager" };

// Signing in is not enough to use PF Management: this Firebase project also holds
// every public PF Audio App account. A user gets in only if they are an audio
// app admin (users/{uid}.role, which users cannot change on their own doc) or
// have a leaders/{uid} doc. If either lookup is denied, access is denied.
async function loadLeaderAccess(firebaseUser) {
  let name = firebaseUser.displayName || "";
  let role = null;

  try {
    const snap = await getDoc(docRef("users", firebaseUser.uid));
    if (snap.exists()) {
      name = snap.data().fullName || name;
      if (snap.data().role === "admin") role = "main_admin";
    }
  } catch {
    // No profile access — fall through to the leaders check.
  }

  // Always read the manager record: it grants access to invited managers, and
  // it holds the name anyone edits in Settings (which wins over the audio app's).
  try {
    const snap = await getDoc(docRef("leaders", firebaseUser.uid));
    if (snap.exists()) {
      name = snap.data().name || name;
      if (!role) role = snap.data().role === "main_admin" ? "main_admin" : "leader";
    }
  } catch {
    // Not a manager, or rules for `leaders` are not deployed yet.
  }

  return { name: name || firebaseUser.email?.split("@")[0] || "Manager", role };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(PREVIEW ? PREVIEW_USER : null);
  const [profile, setProfile] = useState(
    PREVIEW ? { name: PREVIEW_USER.displayName, role: "main_admin" } : null
  );
  const [loading, setLoading] = useState(!PREVIEW);

  // Each access lookup gets a number; only the newest one may update state.
  // Accepting an invitation triggers two lookups close together (sign-in, then
  // refreshAccess once the leader doc exists) and the older must not win.
  const lookup = useRef(0);

  const applyUser = useCallback(async (firebaseUser) => {
    const id = ++lookup.current;
    if (!firebaseUser) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const access = await loadLeaderAccess(firebaseUser);
    if (id !== lookup.current) return;
    setUser(firebaseUser);
    setProfile(access);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (PREVIEW) return;
    return onAuthStateChanged(auth, applyUser);
  }, [applyUser]);

  // Re-check leader access for the signed-in user (after accepting an invitation).
  const refreshAccess = useCallback(() => applyUser(auth.currentUser), [applyUser]);

  const signIn = (email, password) => signInWithEmailAndPassword(auth, email, password);

  // Only the invitation page calls this — there is no public sign-up. An
  // account without a leaders/{uid} doc still can't get past ProtectedRoute.
  const createAccount = (email, password) => createUserWithEmailAndPassword(auth, email, password);

  // True after someone chooses Sign out, so the next person to sign in starts
  // on the Dashboard instead of the page the last person was on.
  const [signedOut, setSignedOut] = useState(false);

  const signOut = async () => {
    setSignedOut(true);
    if (PREVIEW) {
      setUser(null);
      setProfile(null);
      return;
    }
    await firebaseSignOut(auth);
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);

  const value = {
    user,
    name: profile?.name || "",
    role: profile?.role || null,
    hasAccess: Boolean(user && profile?.role),
    loading,
    isPreview: PREVIEW,
    signedOut,
    signIn,
    createAccount,
    refreshAccess,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
