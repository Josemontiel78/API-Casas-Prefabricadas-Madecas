import { Client, Project, Budget, Contract, Vendor, ContractStatus, HouseModel } from '@/types';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { 
  collection, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';

// --- Helpers ---
const COLLECTIONS = {
  CLIENTS: 'clients',
  PROJECTS: 'projects',
  BUDGETS: 'budgets',
  CONTRACTS: 'contracts',
  VENDORS: 'vendors',
  ADMINS: 'admins',
  HOUSE_MODELS: 'house_models'
};

// Admin identifiers
const ADMIN_EMAILS = [
  'montielmarquezjoseeduardo@gmail.com',
  'admin@madecas.cl',
  'jose.montiel@madecas.cl',
  'jmontiel@madecas.cl'
];
const ADMIN_UIDS = ['Marw4dikt6awETf5XuB7C4aaqnk1'];

// Check if current user is admin (Now returns true for all as per request to remove auth restrictions)
function isUserAdmin(): boolean {
  return true; 
}

// --- Clients ---
export const getClients = async (): Promise<Client[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.CLIENTS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Client));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CLIENTS);
    return [];
  }
};

export const saveClient = async (client: Client): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CLIENTS, client.id);
    const sanitizedData = Object.fromEntries(
      Object.entries(client).filter(([_, v]) => v !== undefined)
    );
    const data = {
      ...sanitizedData,
      vendedor_id: client.vendedor_id || 'system'
    };
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.CLIENTS);
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.CLIENTS);
  }
};

// --- Projects ---
export const getProjects = async (): Promise<Project[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.PROJECTS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Project));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PROJECTS);
    return [];
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.PROJECTS, project.id);
    const sanitizedData = Object.fromEntries(
      Object.entries(project).filter(([_, v]) => v !== undefined)
    );
    const data = {
      ...sanitizedData,
      vendedor_id: project.vendedor_id || 'system'
    };
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.PROJECTS);
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.PROJECTS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.PROJECTS);
  }
};

// --- Budgets ---
export const getBudgets = async (): Promise<Budget[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.BUDGETS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Budget));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.BUDGETS);
    return [];
  }
};

export const saveBudget = async (budget: Budget): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.BUDGETS, budget.id);
    const sanitizedData = Object.fromEntries(
      Object.entries(budget).filter(([_, v]) => v !== undefined)
    );
    const data = {
      ...sanitizedData,
      vendedor_id: budget.vendedor_id || 'system'
    };
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.BUDGETS);
  }
};

export const deleteBudget = async (id: string): Promise<void> => {
  try {
    console.log(`[Database] Attempting to delete budget: ${id}`);
    await deleteDoc(doc(db, COLLECTIONS.BUDGETS, id));
    console.log(`[Database] Successfully deleted budget: ${id}`);
  } catch (err) {
    console.error(`[Database] Failed to delete budget ${id}:`, err);
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.BUDGETS);
    throw err;
  }
};

// --- Contracts ---
export const getContracts = async (): Promise<Contract[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.CONTRACTS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Contract));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CONTRACTS);
    return [];
  }
};

export const saveContract = async (contract: Contract): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.CONTRACTS, contract.id);
    
    // Remove undefined fields to prevent Firestore errors
    const sanitizedData = Object.fromEntries(
      Object.entries(contract).filter(([_, v]) => v !== undefined)
    );

    const data = {
      ...sanitizedData,
      vendedor_id: contract.vendedor_id || 'system'
    };
    await setDoc(docRef, data, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.CONTRACTS);
  }
};

export const deleteContract = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.CONTRACTS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.CONTRACTS);
  }
};

// --- House Models ---
export const getHouseModels = async (): Promise<HouseModel[]> => {
  try {
    // Models are public for all users to see, but only admins can write
    const q = query(collection(db, COLLECTIONS.HOUSE_MODELS));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as HouseModel));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.HOUSE_MODELS);
    return [];
  }
};

export const saveHouseModel = async (model: HouseModel): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.HOUSE_MODELS, model.id);
    const sanitizedData = Object.fromEntries(
      Object.entries(model).filter(([_, v]) => v !== undefined)
    );
    await setDoc(docRef, sanitizedData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.HOUSE_MODELS);
  }
};

export const deleteHouseModel = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.HOUSE_MODELS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.HOUSE_MODELS);
  }
};

// --- Vendor ---
export const getVendor = async (): Promise<Vendor> => {
  try {
    const docRef = doc(db, COLLECTIONS.VENDORS, 'main_vendor');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Vendor;
    }
    const defaultVendor = {
      id: 'main_vendor',
      nombre: 'COMERCIALIZADORA MADECAS SPA',
      rut: '77.300.759-4',
      domicilio: 'RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Osorno, X REGION',
      telefono: '+569 7777 00 22',
      correo: 'obras@madecas.cl',
      banco_nombre: 'BANCO ESTADO',
      banco_tipo_cuenta: 'CUENTA CORRIENTE',
      banco_numero_cuenta: '81500255536'
    };
    await setDoc(docRef, defaultVendor);
    return defaultVendor;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, COLLECTIONS.VENDORS);
    throw err;
  }
};

export const saveVendor = async (vendor: Vendor): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTIONS.VENDORS, 'main_vendor');
    await setDoc(docRef, vendor, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.VENDORS);
  }
};

// --- IA Assistant ---
export const generateCommercialAnalysis = async (clientId: string) => {
    // This would ideally call Gemini, but for now we'll simulate the "IA Comercial Pro"
    // providing a summary based on client history.
    const history = await getClientCommercialHistoryById(clientId);
    if (!history) return "No hay datos suficientes para el análisis.";
    
    // In a real app, I'd use the gemini-api skill here.
    return `Análisis Comercial para ${history.client.nombre}: 
    El cliente tiene ${history.budgets.length} cotizaciones y ${history.contracts.length} contratos. 
    Interés principal en modelos de ${history.projects[0]?.modelo || 'N/A'}. 
    Recomendación: Ofrecer paquete de terminaciones avanzadas.`;
};

const getClientCommercialHistoryById = async (clientId: string) => {
    try {
      const clientDoc = await getDoc(doc(db, COLLECTIONS.CLIENTS, clientId));
      if (!clientDoc.exists()) return null;
      
      const client = { id: clientDoc.id, ...clientDoc.data() } as Client;
  
      const qProj = query(collection(db, COLLECTIONS.PROJECTS), where('cliente_id', '==', client.id));
      const qBudg = query(collection(db, COLLECTIONS.BUDGETS), where('cliente_id', '==', client.id));
      const qCont = query(collection(db, COLLECTIONS.CONTRACTS), where('cliente_id', '==', client.id));

      const [projects, budgets, contracts] = await Promise.all([
        getDocs(qProj),
        getDocs(qBudg),
        getDocs(qCont)
      ]);
  
      return {
        client,
        projects: projects.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Project)),
        budgets: budgets.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Budget)),
        contracts: contracts.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Contract))
      };
    } catch (err) {
      console.error("Error fetching commercial history", err);
      return null;
    }
};

// --- Cross-Referencing ---
export const getClientCommercialHistory = async (rut: string) => {
  try {
    const clientQ = query(collection(db, COLLECTIONS.CLIENTS), where('rut', '==', rut));

    const clientSnap = await getDocs(clientQ);
    if (clientSnap.empty) return null;
    
    const client = { id: clientSnap.docs[0].id, ...(clientSnap.docs[0].data() as object) } as Client;

    const qProj = query(collection(db, COLLECTIONS.PROJECTS), where('cliente_id', '==', client.id));
    const qBudg = query(collection(db, COLLECTIONS.BUDGETS), where('cliente_id', '==', client.id));
    const qCont = query(collection(db, COLLECTIONS.CONTRACTS), where('cliente_id', '==', client.id));

    const [projects, budgets, contracts] = await Promise.all([
      getDocs(qProj),
      getDocs(qBudg),
      getDocs(qCont)
    ]);

    return {
      client,
      projects: projects.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Project)),
      budgets: budgets.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Budget)),
      contracts: contracts.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Contract))
    };
  } catch (err) {
    console.error("Error fetching commercial history", err);
    return null;
  }
};

export const subscribeToClients = (callback: (clients: Client[]) => void) => {
  const q = query(collection(db, COLLECTIONS.CLIENTS));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Client)));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CLIENTS);
  });
};

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  const q = query(collection(db, COLLECTIONS.PROJECTS));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Project)));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.PROJECTS);
  });
};

export const subscribeToBudgets = (callback: (budgets: Budget[]) => void) => {
  const q = query(collection(db, COLLECTIONS.BUDGETS));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Budget)));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.BUDGETS);
  });
};

export const subscribeToContracts = (callback: (contracts: Contract[]) => void) => {
  const q = query(collection(db, COLLECTIONS.CONTRACTS));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as Contract)));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CONTRACTS);
  });
};

export const subscribeToHouseModels = (callback: (models: HouseModel[]) => void) => {
  const q = query(collection(db, COLLECTIONS.HOUSE_MODELS));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as HouseModel)));
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.HOUSE_MODELS);
  });
};
