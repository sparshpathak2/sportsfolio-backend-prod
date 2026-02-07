import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
// You need to download the service account key from Firebase Console
// and place it in the project root or src/lib as serviceAccountKey.json
let serviceAccount;
try {
      console.warn(path.join(__dirname, '../../serviceAccountKey.json'), 'Looking for serviceAccountKey.json');

  serviceAccount = JSON.parse(readFileSync(path.join(__dirname, '../../serviceAccountKey.json')));
} catch (error) {
  console.warn('Firebase service account key not found. Make sure to add serviceAccountKey.json');
  serviceAccount = null;
}

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

export default admin;

// Firebase Auth REST API key (from Firebase Console -> Project Settings -> General -> Web API Key)
export const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'your-api-key-here';

// Function to verify Firebase ID token
export const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    throw error;
  }
};