"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { firebaseClientConfig, hasFirebaseClientConfig } from "../runtime-config";

const APP_NAME = "plexonpanel-dashboard-client";

function requireFirebaseClientConfig() {
  if (!hasFirebaseClientConfig()) {
    throw new Error("Firebase Web App configuration is missing.");
  }

  return firebaseClientConfig;
}

export function getFirebaseClientApp(): FirebaseApp {
  const existingApp = getApps().find((app) => app.name === APP_NAME);
  if (existingApp) return getApp(APP_NAME);

  return initializeApp(requireFirebaseClientConfig(), APP_NAME);
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}
