import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "./config";

export type ComponentAtlasUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
  photoURL: string | null;
};

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const PENDING_DISPLAY_NAME_KEY = "component-atlas-pending-display-name";

function pendingDisplayName() {
  try {
    return window.sessionStorage.getItem(PENDING_DISPLAY_NAME_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function setPendingDisplayName(value: string | null) {
  try {
    if (value) window.sessionStorage.setItem(PENDING_DISPLAY_NAME_KEY, value);
    else window.sessionStorage.removeItem(PENDING_DISPLAY_NAME_KEY);
  } catch {
    /* Authentication still works when session storage is unavailable. */
  }
}

export function toComponentAtlasUser(user: User): ComponentAtlasUser {
  const displayName = user.displayName || user.email || "Component Atlas user";
  return {
    userId: user.uid,
    displayName,
    email: user.email || "",
    fullName: user.displayName,
    photoURL: user.photoURL,
  };
}

export function observeAuthState(callback: (user: ComponentAtlasUser | null) => void) {
  return onAuthStateChanged(firebaseAuth, async (user) => {
    const pendingName = user && !user.displayName ? pendingDisplayName() : "";
    if (user && pendingName) {
      try {
        await updateProfile(user, { displayName: pendingName });
        setPendingDisplayName(null);
      } catch {
        /* Keep the pending value so the next authenticated page can retry. */
      }
    }
    callback(user ? toComponentAtlasUser(user) : null);
  });
}

export async function signInWithGoogle() {
  await setPersistence(firebaseAuth, browserLocalPersistence);
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return toComponentAtlasUser(credential.user);
}

export async function signInWithEmail(email: string, password: string) {
  await setPersistence(firebaseAuth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
  return toComponentAtlasUser(credential.user);
}

export async function createEmailAccount(name: string, email: string, password: string) {
  await setPersistence(firebaseAuth, browserLocalPersistence);
  const normalizedName = name.trim();
  setPendingDisplayName(normalizedName || null);
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password).catch((error) => {
    setPendingDisplayName(null);
    throw error;
  });
  if (normalizedName) await updateProfile(credential.user, { displayName: normalizedName });
  setPendingDisplayName(null);
  await sendEmailVerification(credential.user);
  return toComponentAtlasUser(credential.user);
}

export function sendResetEmail(email: string) {
  return sendPasswordResetEmail(firebaseAuth, email.trim());
}

export function signOutFromFirebase() {
  return signOut(firebaseAuth);
}
