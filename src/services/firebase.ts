import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, onSnapshot, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
    console.log("Timestamp:", new Date().toISOString());
    
    // Attempt a direct read from a special test doc
    const testDoc = doc(db, 'test', 'connection');
    await getDocFromServer(testDoc);
    
    // Attempt a write to "force" activation if it's the first time
    await setDoc(testDoc, { connected: true, lastUpdate: new Date().toISOString() }, { merge: true });
    
    console.log("SUCCESS: Connected to Firestore and verified write access.");
    console.log("-----------------------------------------");
  } catch (error: any) {
    console.error("-----------------------------------------");
    console.error("FIRESTORE CONNECTION FAILED!");
    console.error("Error Code:", error?.code);
    console.error("Error Message:", error?.message);
    
    if (error?.message?.includes('permission')) {
      console.error("DIAGNOSIS: The security rules for this database might be denying access.");
    } else if (error?.code === 'not-found' || error?.message?.includes('not found')) {
      console.error("DIAGNOSIS: The database ID provided might not exist in this project.");
    }
    
    console.log("-----------------------------------------");
  }
}
testConnection();
