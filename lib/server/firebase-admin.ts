import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const APP_NAME = "plexonpanel-dashboard";

interface FirebaseAdminEnvironment {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function readFirebaseAdminEnvironment(): FirebaseAdminEnvironment {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ?? "";
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() ?? "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin is not configured on this server.");
  }

  if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
    throw new Error("Firebase Admin private key has an invalid format.");
  }

  return { projectId, clientEmail, privateKey };
}

export function hasFirebaseAdminEnvironment(): boolean {
  try {
    readFirebaseAdminEnvironment();
    return true;
  } catch {
    return false;
  }
}

export function getFirebaseAdminApp(): App {
  const existingApp = getApps().find((app) => app.name === APP_NAME);
  if (existingApp) return existingApp;

  const { projectId, clientEmail, privateKey } = readFirebaseAdminEnvironment();
  return initializeApp(
    {
      projectId,
      credential: cert({ projectId, clientEmail, privateKey }),
    },
    APP_NAME,
  );
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}
