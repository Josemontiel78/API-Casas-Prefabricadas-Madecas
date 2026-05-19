import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, setDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Using initializeFirestore with settings to enable long polling
// This is often more reliable in proxy/iframe environments where WebSockets might be blocked
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // Using the databaseId from config if present
  // @ts-ignore - firestoreDatabaseId is a custom property in our config
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
  console.log(`Debug Info - Project: ${firebaseConfig.projectId}, DB: ${firebaseConfig.firestoreDatabaseId}`);
  
  window.dispatchEvent(new CustomEvent('app-notification', { 
    detail: { 
      message: `Error de base de datos (${operationType}): ${message.includes('permission') ? 'Permisos insuficientes' : 'Error de sincronización'}`, 
      type: 'error' 
    } 
  }));
}

// Validation connection as per instructions
async function testConnection() {
  try {
    console.log("-----------------------------------------");
    console.log("FIRESTORE CONNECTION TEST");
    console.log("Project:", firebaseConfig.projectId);
    console.log("Database:", firebaseConfig.firestoreDatabaseId || '(default)');
    
    // Attempt a direct read from a special test doc to verify server reachability
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    
    console.log("SUCCESS: Connected to Firestore.");
    console.log("-----------------------------------------");
  } catch (error: any) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable'))) {
      console.error("Please check your Firebase configuration or network. Firestore backend is currently unreachable.");
    }
    console.error("Firestore test failed:", error?.message);
    console.log("-----------------------------------------");
  }
}
testConnection();
