/**
 * Firebase Web (client) configuration for the cloud dashboard sync.
 *
 * IMPORTANT — these values are SAFE to ship inside the .exe.
 * They are public identifiers, NOT secrets. Access to data is controlled by
 * Firebase Auth + Firestore Security Rules (see `firestore.rules` at the repo
 * root), not by hiding this config. Never put the Firebase *Admin* SDK service
 * account key in the client — that one is a real secret and must stay server-side.
 *
 * How to set up:
 *  1. Go to https://console.firebase.google.com/ and create a project.
 *  2. Build → Firestore Database → Create database (production mode).
 *  3. Build → Authentication → Sign-in method → enable "Email/Password".
 *  4. Project settings → General → "Your apps" → add a Web app (</>).
 *  5. Copy the `firebaseConfig` values it shows you into the object below.
 *  6. Deploy the security rules from `firestore.rules` (Firestore → Rules → paste → Publish).
 *  7. (Recommended) Build → App Check → register the app to block use of this
 *     config outside the real POS/dashboard.
 */

export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDEsgbZY1q50Y4NTmkbYrFmeB3_3-7v2Lw',
  authDomain: 'molecule-e2e95.firebaseapp.com',
  projectId: 'molecule-e2e95',
  storageBucket: 'molecule-e2e95.firebasestorage.app',
  messagingSenderId: '297835941121',
  appId: '1:297835941121:web:da4ca719e39fde27ad9f00',
  measurementId: 'G-XVD2WKKNEK',
} as const;

/** True once real (non-placeholder) values are present. */
export function isFirebaseConfigured(): boolean {
  const apiKey = FIREBASE_CONFIG.apiKey as string;
  const projectId = FIREBASE_CONFIG.projectId as string;
  return !!apiKey && !apiKey.startsWith('REPLACE_WITH') && !!projectId && projectId !== 'your-project';
}
