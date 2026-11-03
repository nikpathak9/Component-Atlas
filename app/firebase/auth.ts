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
  return onAuthStateChanged(firebaseAuth, (user) => callback(user ? toComponentAtlasUser(user) : null));
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
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
  if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
  await sendEmailVerification(credential.user);
  return toComponentAtlasUser(credential.user);
}

export function sendResetEmail(email: string) {
  return sendPasswordResetEmail(firebaseAuth, email.trim());
}

export function signOutFromFirebase() {
  return signOut(firebaseAuth);
}
