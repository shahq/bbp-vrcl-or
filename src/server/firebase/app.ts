import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function getServiceAccountConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function getFirebaseApp() {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = getServiceAccountConfig();
  return initializeApp(
    serviceAccount
      ? {
          credential: cert(serviceAccount),
          projectId: serviceAccount.projectId,
          storageBucket:
            process.env.FIREBASE_STORAGE_BUCKET ||
            `${serviceAccount.projectId}.firebasestorage.app`,
        }
      : {
          credential: applicationDefault(),
          storageBucket:
            process.env.FIREBASE_STORAGE_BUCKET ||
            (process.env.FIREBASE_PROJECT_ID
              ? `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`
              : undefined),
        }
  );
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseApp());
}

export function getStorageBucket() {
  return getStorage(getFirebaseApp()).bucket();
}
