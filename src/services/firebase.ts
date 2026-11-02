import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with long polling enabled for proxy/iframe compatibility
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore Error] ${operationType} on ${path}:`, message);
  
  // Ignore transient network connection messages from showing blocking popups
  if (message.includes('unavailable') || message.includes('offline') || message.includes('Could not reach Cloud Firestore backend')) {
    console.warn(`[Firestore Status] Offline or temporary connection issue during ${operationType} on ${path}. Firestore will sync automatically when reconnected.`);
    return;
  }

  window.dispatchEvent(new CustomEvent('app-notification', { 
    detail: { 
      message: `Error de base de datos (${operationType}): ${message.includes('permission') ? 'Permisos insuficientes' : 'Error de sincronización'}`, 
      type: 'error' 
    } 
  }));
}

