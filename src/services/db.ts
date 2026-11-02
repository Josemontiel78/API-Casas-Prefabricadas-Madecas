import { Client, Project, Budget, Contract, Vendor, ContractStatus, HouseModel, SystemUser, AuditLog, AuditAction } from '@/types';
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
  orderBy,
  limit,
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
  HOUSE_MODELS: 'house_models',
  USERS: 'users',
  AUDIT_LOGS: 'audit_logs'
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

export const saveClient = async (client: Client, actor?: { id: string; nombre: string }): Promise<void> => {
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

    // Non-blocking audit log
    logAuditEvent({
      usuario_id: actor?.id || client.vendedor_id || 'system',
      usuario_nombre: actor?.nombre || client.vendedor_nombre || 'Sistema',
      accion: 'CLIENTE_MODIFICADO',
      entidad: 'clients',
      entidad_id: client.id,
      detalles: {
        nombre: client.nombre,
        rut: client.rut,
        correo: client.correo,
        vendedor_id: data.vendedor_id,
        etapa_venta: client.etapa_venta || 'Registro'
      }
    }).catch(e => console.warn("Audit log for client failed:", e));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.CLIENTS);
  }
};

export const deleteClient = async (id: string, actor?: { id: string; nombre: string }): Promise<void> => {
  try {
    await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id));

    logAuditEvent({
      usuario_id: actor?.id || 'admin',
      usuario_nombre: actor?.nombre || 'Administrador',
      accion: 'CLIENTE_ELIMINADO',
      entidad: 'clients',
      entidad_id: id,
      detalles: { cliente_id: id, motivo: 'Eliminación manual desde módulo de clientes' }
    }).catch(e => console.warn("Audit log for delete client failed:", e));
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

// --- System Users ---
const DEFAULT_USERS: SystemUser[] = [
  {
    id: 'user_admin_1',
    nombre: 'José Eduardo Montiel',
    correo: 'montielmarquezjoseeduardo@gmail.com',
    telefono: '+569 7777 0022',
    rut: '16.890.123-K',
    rol: 'admin',
    cargo: 'Gerente General & Ventas',
    activo: true,
    fecha_creacion: new Date().toISOString(),
    comision_porcentaje: 3.5,
    meta_mensual_pesos: 80000000
  },
  {
    id: 'user_vend_1',
    nombre: 'Carlos Valenzuela',
    correo: 'carlos.valenzuela@madecas.cl',
    telefono: '+569 8812 3456',
    rut: '17.456.789-2',
    rol: 'vendedor',
    cargo: 'Ejecutivo Comercial Senior',
    activo: true,
    fecha_creacion: new Date().toISOString(),
    comision_porcentaje: 3.0,
    meta_mensual_pesos: 50000000
  },
  {
    id: 'user_vend_2',
    nombre: 'Camila Silva',
    correo: 'camila.silva@madecas.cl',
    telefono: '+569 9123 4567',
    rut: '18.234.567-8',
    rol: 'vendedor',
    cargo: 'Ejecutiva Ventas Prefabricadas',
    activo: true,
    fecha_creacion: new Date().toISOString(),
    comision_porcentaje: 3.0,
    meta_mensual_pesos: 45000000
  },
  {
    id: 'user_sup_1',
    nombre: 'Roberto Muñoz',
    correo: 'roberto.munoz@madecas.cl',
    telefono: '+569 7654 3210',
    rut: '15.678.901-3',
    rol: 'supervisor',
    cargo: 'Supervisor Técnico de Obra',
    activo: true,
    fecha_creacion: new Date().toISOString(),
    comision_porcentaje: 1.5,
    meta_mensual_pesos: 0
  }
];

const USERS_CACHE_KEY = 'madecas_cached_system_users_v1';
const USERS_SEEDED_KEY = 'madecas_users_seeded_v1';

const getCachedUsers = (): SystemUser[] => {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
};

const setCachedUsers = (users: SystemUser[]) => {
  try {
    localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("Could not cache users in localStorage", e);
  }
};

let isSeedingUsers = false;
async function seedDefaultUsersToFirestore(): Promise<void> {
  if (isSeedingUsers) return;
  isSeedingUsers = true;
  try {
    for (const u of DEFAULT_USERS) {
      const docRef = doc(db, COLLECTIONS.USERS, u.id);
      await setDoc(docRef, u, { merge: true });
    }
    localStorage.setItem(USERS_SEEDED_KEY, 'true');
    setCachedUsers(DEFAULT_USERS);
  } catch (err) {
    console.warn("Could not write default users to Firestore (might be offline):", err);
  } finally {
    isSeedingUsers = false;
  }
}

export const getUsers = async (): Promise<SystemUser[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.USERS));
    const snap = await getDocs(q);
    const hasSeeded = localStorage.getItem(USERS_SEEDED_KEY) === 'true';

    if (snap.empty) {
      if (!hasSeeded) {
        await seedDefaultUsersToFirestore();
        return DEFAULT_USERS;
      }
      return getCachedUsers();
    }
    const loaded = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as SystemUser));
    setCachedUsers(loaded);
    return loaded;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.USERS);
    return getCachedUsers();
  }
};

// --- Audit Logs ---
const AUDIT_CACHE_KEY = 'madecas_cached_audit_logs_v1';

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log_init_1',
    usuario_id: 'user_admin_1',
    usuario_nombre: 'José Eduardo Montiel',
    accion: 'USUARIO_CREADO',
    entidad: 'users',
    entidad_id: 'user_vend_1',
    detalles: { nombre: 'Carlos Valenzuela', rol: 'vendedor', correo: 'carlos.valenzuela@madecas.cl' },
    timestamp: new Date(Date.now() - 3600000 * 24 * 3).toISOString()
  },
  {
    id: 'log_init_2',
    usuario_id: 'user_admin_1',
    usuario_nombre: 'José Eduardo Montiel',
    accion: 'CLIENTE_CREADO',
    entidad: 'clients',
    entidad_id: 'cli_seed_1',
    detalles: { cliente: 'Inversiones y Proyectos Sur Ltda', rut: '76.123.456-7' },
    timestamp: new Date(Date.now() - 3600000 * 24 * 2).toISOString()
  },
  {
    id: 'log_init_3',
    usuario_id: 'user_admin_1',
    usuario_nombre: 'José Eduardo Montiel',
    accion: 'USUARIO_MODIFICADO',
    entidad: 'users',
    entidad_id: 'user_vend_2',
    detalles: { campo_modificado: 'meta_mensual_pesos', nuevo_valor: 45000000 },
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
  }
];

const getCachedAuditLogs = (): AuditLog[] => {
  try {
    const raw = localStorage.getItem(AUDIT_CACHE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_AUDIT_LOGS;
  } catch {
    return DEFAULT_AUDIT_LOGS;
  }
};

const setCachedAuditLogs = (logs: AuditLog[]) => {
  try {
    localStorage.setItem(AUDIT_CACHE_KEY, JSON.stringify(logs.slice(0, 150)));
  } catch (e) {
    console.warn("Could not cache audit logs in localStorage", e);
  }
};

export const logAuditEvent = async (event: {
  usuario_id?: string;
  usuario_nombre?: string;
  accion: AuditAction;
  entidad: 'users' | 'clients' | 'budgets' | 'contracts' | 'settings';
  entidad_id: string;
  detalles: Record<string, any>;
}): Promise<AuditLog> => {
  const newLog: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    usuario_id: event.usuario_id || 'user_admin_1',
    usuario_nombre: event.usuario_nombre || 'Administrador',
    accion: event.accion,
    entidad: event.entidad,
    entidad_id: event.entidad_id,
    detalles: event.detalles,
    timestamp: new Date().toISOString()
  };

  // Update local cache immediately
  const cached = getCachedAuditLogs();
  const updatedCache = [newLog, ...cached].slice(0, 150);
  setCachedAuditLogs(updatedCache);

  // Notify listeners across app
  window.dispatchEvent(new CustomEvent('app-audit-event', { detail: newLog }));

  try {
    const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, newLog.id);
    await setDoc(docRef, newLog);
  } catch (err) {
    console.warn("Could not write audit log to Firestore (offline/permission fallback):", err);
  }

  return newLog;
};

export const getAuditLogs = async (limitCount = 50): Promise<AuditLog[]> => {
  try {
    const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    if (snap.empty) {
      return getCachedAuditLogs();
    }
    const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as AuditLog));
    setCachedAuditLogs(logs);
    return logs;
  } catch (err) {
    console.warn("Falling back to cached audit logs:", err);
    return getCachedAuditLogs();
  }
};

export const subscribeToAuditLogs = (callback: (logs: AuditLog[]) => void) => {
  callback(getCachedAuditLogs());

  try {
    const q = query(collection(db, COLLECTIONS.AUDIT_LOGS), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as AuditLog));
        setCachedAuditLogs(logs);
        callback(logs);
      }
    }, (err) => {
      console.warn("Audit logs subscription error:", err);
      callback(getCachedAuditLogs());
    });
  } catch (err) {
    console.warn("Could not setup Firestore audit logs subscription:", err);
    return () => {};
  }
};

// --- User Management with Audit & Soft-Delete ---

export const saveUser = async (user: SystemUser, actor?: { id: string; nombre: string }): Promise<void> => {
  // Update local cache immediately
  const cached = getCachedUsers();
  const existingUser = cached.find(u => u.id === user.id);
  const updatedCache = existingUser 
    ? cached.map(u => u.id === user.id ? { ...u, ...user } : u)
    : [user, ...cached];
  setCachedUsers(updatedCache);

  try {
    const docRef = doc(db, COLLECTIONS.USERS, user.id);
    const sanitizedData = Object.fromEntries(
      Object.entries(user).filter(([_, v]) => v !== undefined)
    );
    await setDoc(docRef, sanitizedData, { merge: true });

    // Log audit event
    await logAuditEvent({
      usuario_id: actor?.id || 'admin',
      usuario_nombre: actor?.nombre || 'Administrador',
      accion: existingUser ? 'USUARIO_MODIFICADO' : 'USUARIO_CREADO',
      entidad: 'users',
      entidad_id: user.id,
      detalles: {
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
        activo: user.activo,
        comision_porcentaje: user.comision_porcentaje,
        meta_mensual_pesos: user.meta_mensual_pesos,
        cambios: existingUser ? 'Actualización de ficha de usuario' : 'Nuevo registro de usuario'
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.USERS);
    throw err;
  }
};

export const softDeleteUser = async (userId: string, actor?: { id: string; nombre: string }): Promise<void> => {
  const cached = getCachedUsers();
  const user = cached.find(u => u.id === userId);
  const now = new Date().toISOString();

  // Mark as eliminated and inactive in local cache
  const updatedUsers = cached.map(u => 
    u.id === userId ? { ...u, activo: false, eliminado: true, fecha_eliminacion: now } : u
  );
  setCachedUsers(updatedUsers);

  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(docRef, { activo: false, eliminado: true, fecha_eliminacion: now }, { merge: true });

    await logAuditEvent({
      usuario_id: actor?.id || 'admin',
      usuario_nombre: actor?.nombre || 'Administrador',
      accion: 'USUARIO_ARCHIVADO',
      entidad: 'users',
      entidad_id: userId,
      detalles: {
        nombre: user?.nombre || userId,
        correo: user?.correo,
        rol: user?.rol,
        tipo_accion: 'Borrado Lógico (Soft Delete) para preservar historial referencial',
        fecha_archivado: now
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.USERS);
    throw err;
  }
};

export const deleteUser = async (id: string, actor?: { id: string; nombre: string }): Promise<void> => {
  const cached = getCachedUsers();
  const userToDelete = cached.find(u => u.id === id);
  setCachedUsers(cached.filter(u => u.id !== id));

  try {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));

    await logAuditEvent({
      usuario_id: actor?.id || 'admin',
      usuario_nombre: actor?.nombre || 'Administrador',
      accion: 'USUARIO_ELIMINADO',
      entidad: 'users',
      entidad_id: id,
      detalles: {
        nombre: userToDelete?.nombre || id,
        correo: userToDelete?.correo,
        rol: userToDelete?.rol,
        tipo_accion: 'Eliminación física definitiva'
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, COLLECTIONS.USERS);
    throw err;
  }
};

/**
 * Reassign all clients from one seller to another to avoid orphaned records
 */
export const reassignClientPortfolio = async (
  fromUserId: string,
  toUserId: string,
  toUserName: string,
  actor?: { id: string; nombre: string }
): Promise<number> => {
  try {
    const clients = await getClients();
    const affectedClients = clients.filter(c => c.vendedor_id === fromUserId);

    for (const client of affectedClients) {
      await saveClient({
        ...client,
        vendedor_id: toUserId,
        vendedor_nombre: toUserName
      });
    }

    await logAuditEvent({
      usuario_id: actor?.id || 'admin',
      usuario_nombre: actor?.nombre || 'Administrador',
      accion: 'CARTERA_REASIGNADA',
      entidad: 'clients',
      entidad_id: fromUserId,
      detalles: {
        desde_usuario_id: fromUserId,
        hacia_usuario_id: toUserId,
        hacia_usuario_nombre: toUserName,
        total_clientes_reasignados: affectedClients.length,
        clientes_afectados: affectedClients.map(c => ({ id: c.id, nombre: c.nombre, rut: c.rut }))
      }
    });

    return affectedClients.length;
  } catch (err) {
    console.error("Error al reasignar cartera:", err);
    throw err;
  }
};

export const subscribeToUsers = (callback: (users: SystemUser[]) => void) => {
  // Send cached users immediately for instant UI render
  const initialCache = getCachedUsers();
  callback(initialCache);

  const q = query(collection(db, COLLECTIONS.USERS));
  return onSnapshot(q, async (snap) => {
    const hasSeeded = localStorage.getItem(USERS_SEEDED_KEY) === 'true';

    if (snap.empty) {
      if (!hasSeeded) {
        // First run: Seed default users to Firestore
        await seedDefaultUsersToFirestore();
        callback(DEFAULT_USERS);
      } else {
        setCachedUsers([]);
        callback([]);
      }
    } else {
      localStorage.setItem(USERS_SEEDED_KEY, 'true');
      const loaded = snap.docs.map(d => ({ id: d.id, ...(d.data() as object) } as SystemUser));
      setCachedUsers(loaded);
      callback(loaded);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.USERS);
    callback(getCachedUsers());
  });
};


