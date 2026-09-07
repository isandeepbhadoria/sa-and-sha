import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import fs from 'fs';
import path from 'path';

let adminDbInstance: Firestore | null = null;
let adminAuthInstance: Auth | null = null;

/**
 * Normalizes and validates the Firebase Admin Private Key from environment variables.
 * Handles literal \n sequences, surrounding quotes, CRLF, and leading/trailing whitespace.
 */
function normalizePrivateKey(rawKey: string | undefined): string | null {
  if (!rawKey) return null;

  let key = rawKey.trim();

  // Remove one matching pair of surrounding single or double quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  // Convert literal \n sequences into real newline characters
  key = key.replace(/\\n/g, '\n');

  // Normalize \r\n to \n
  key = key.replace(/\r\n/g, '\n');

  // Trim whitespace/newlines
  key = key.trim();

  if (!key) return null;

  // Validate structural integrity without logging sensitive data
  if (!key.startsWith('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
    console.warn('[FIREBASE ADMIN] Firebase Admin private key format is invalid. Falling back to unauthenticated default initialization.');
    return null;
  }

  return key;
}

export function getAdminDb(): Firestore {
  if (adminDbInstance) {
    return adminDbInstance;
  }

  if (!getApps().length) {
    let initialized = false;

    // 1. Primary Method: Base64 Encoded Service Account JSON
    const base64ServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64?.trim();
    if (base64ServiceAccount) {
      try {
        const decodedJson = Buffer.from(base64ServiceAccount, 'base64').toString('utf8');
        const credentials = JSON.parse(decodedJson);

        if (credentials && credentials.project_id && credentials.client_email && credentials.private_key) {
          initializeApp({
            credential: cert({
              projectId: credentials.project_id,
              clientEmail: credentials.client_email,
              privateKey: credentials.private_key,
            }),
          });
          initialized = true;
          console.log(`[FIREBASE ADMIN] Initialized Admin SDK using FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 for project: ${credentials.project_id}`);
        } else {
          console.warn(`[FIREBASE ADMIN] FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 missing required fields (project_id, client_email, private_key). Falling back to individual environment variables.`);
        }
      } catch (err) {
        console.warn(`[FIREBASE ADMIN] Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64. Falling back to individual environment variables.`);
      }
    }

    // 2. Fallback Method: Individual Environment Variables
    if (!initialized) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || "";
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
      const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      const privateKey = normalizePrivateKey(rawPrivateKey);

      if (clientEmail && privateKey) {
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        console.log(`[FIREBASE ADMIN] Initialized Admin SDK with Service Account cert for project: ${projectId}`);
      } else {
        let fallbackProjectId = projectId;
        try {
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (cfg && cfg.projectId) fallbackProjectId = cfg.projectId;
          }
        } catch (err) {
          // ignore
        }
        initializeApp({ projectId: fallbackProjectId });
        console.warn(`[FIREBASE ADMIN] Initialized Admin SDK without cert (missing credentials). Ensure environment variables are configured on host.`);
      }
    }
  }

  const databaseId = process.env.FIREBASE_ADMIN_DATABASE_ID || "(default)";
  adminDbInstance = getFirestore(databaseId);
  return adminDbInstance;
}

export function getAdminAuth(): Auth {
  getAdminDb(); // Ensure Firebase app is initialized
  if (!adminAuthInstance) {
    adminAuthInstance = getAuth();
  }
  return adminAuthInstance;
}

export function getAdminStorageBucket() {
  getAdminDb(); // Ensure Firebase app is initialized
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "";
  return getStorage().bucket(bucketName);
}

