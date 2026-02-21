import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔥 Firebase module loading...');
console.log('Current directory:', process.cwd());
console.log('__dirname:', __dirname);
console.log('admin.apps.length before init:', admin.apps.length);

// Check if Firebase Admin is already initialized
if (!admin.apps.length) {
  console.log('📢 Firebase Admin not initialized, starting initialization...');

  try {
    // Try to load service account from different possible locations
    let serviceAccount;
    const possiblePaths = [
      path.join(__dirname, '../../serviceAccountKey.json'),
      path.join(process.cwd(), 'serviceAccountKey.json'),
      path.join(__dirname, '../serviceAccountKey.json'),
      '/var/www/sportsfolio/serviceAccountKey.json'
    ];

    console.log('🔍 Searching for service account in:');
    for (const filePath of possiblePaths) {
      try {
        console.log(`  Checking: ${filePath}`);
        serviceAccount = JSON.parse(readFileSync(filePath, 'utf8'));
        console.log(`✅ Found service account at: ${filePath}`);
        break;
      } catch (err) {
        console.log(`  ❌ Not found at: ${filePath}`);
      }
    }

    if (serviceAccount) {
      console.log('📦 Service account loaded, initializing app...');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin initialized successfully with service account');
      console.log('Project ID:', serviceAccount.project_id);
    }
    // Fallback to environment variables
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('📦 Using environment variables for Firebase init...');
      console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('✅ Firebase Admin initialized successfully with environment variables');
    }
    else {
      console.error('❌ No Firebase credentials found!');
      console.log('Environment variables present:', {
        FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
        FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
        FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
        FIREBASE_API_KEY: !!process.env.FIREBASE_API_KEY
      });
    }
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
  }
} else {
  console.log('✅ Firebase Admin already initialized, apps count:', admin.apps.length);
}

// console.log('🔥 Firebase module loaded, admin.apps.length:', admin.apps.length);

// Export the admin instance
export default admin;

// Firebase Auth REST API key
export const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Function to verify Firebase ID token with better error handling
export const verifyIdToken = async (idToken) => {
  console.log('🔐 verifyIdToken called, admin.apps.length:', admin.apps.length);

  try {
    // Check if Firebase is initialized
    if (!admin.apps.length) {
      console.error('❌ Firebase Admin not initialized when verifyIdToken called');
      throw new Error('Firebase Admin SDK not initialized');
    }

    console.log('✅ Firebase Admin is initialized, verifying token...');
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('✅ Token verified successfully for UID:', decodedToken.uid);
    return decodedToken;
  } catch (error) {
    console.error('❌ Error verifying Firebase ID token:', error);
    throw error;
  }
};