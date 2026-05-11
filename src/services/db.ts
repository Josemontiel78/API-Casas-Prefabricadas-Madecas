import { Client, Project, Budget, Contract, Vendor, ContractStatus } from '@/types';

const STORAGE_KEYS = {
  CLIENTS: 'prefab_clients',
  PROJECTS: 'prefab_projects',
  BUDGETS: 'prefab_budgets',
  CONTRACTS: 'prefab_contracts',
  VENDOR: 'prefab_vendor',
};

// --- Helpers ---
const getItem = <T>(key: string, defaultVal: T): T => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultVal;
};

const setItem = <T>(key: string, val: T): void => {
  localStorage.setItem(key, JSON.stringify(val));
};

// --- Clients ---
export const getClients = (): Client[] => getItem<Client[]>(STORAGE_KEYS.CLIENTS, []);
export const saveClient = (client: Client): void => {
  const list = getClients();
  const index = list.findIndex(c => c.id === client.id);
  if (index >= 0) list[index] = client;
  else list.push(client);
  setItem(STORAGE_KEYS.CLIENTS, list);
};
export const deleteClient = (id: string): void => {
  const list = getClients().filter(c => c.id !== id);
  setItem(STORAGE_KEYS.CLIENTS, list);
};

// --- Projects ---
export const getProjects = (): Project[] => getItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
export const saveProject = (project: Project): void => {
  const list = getProjects();
  const index = list.findIndex(p => p.id === project.id);
  if (index >= 0) list[index] = project;
  else list.push(project);
  setItem(STORAGE_KEYS.PROJECTS, list);
};
export const deleteProject = (id: string): void => {
  const list = getProjects().filter(p => p.id !== id);
  setItem(STORAGE_KEYS.PROJECTS, list);
};

// --- Budgets ---
export const getBudgets = (): Budget[] => getItem<Budget[]>(STORAGE_KEYS.BUDGETS, []);
export const saveBudget = (budget: Budget): void => {
  const list = getBudgets();
  const index = list.findIndex(b => b.id === budget.id);
  if (index >= 0) list[index] = budget;
  else list.push(budget);
  setItem(STORAGE_KEYS.BUDGETS, list);
};
export const deleteBudget = (id: string): void => {
  const list = getBudgets().filter(b => b.id !== id);
  setItem(STORAGE_KEYS.BUDGETS, list);
};

// --- Contracts ---
export const getContracts = (): Contract[] => getItem<Contract[]>(STORAGE_KEYS.CONTRACTS, []);
export const saveContract = (contract: Contract): void => {
  const list = getContracts();
  const index = list.findIndex(c => c.id === contract.id);
  if (index >= 0) list[index] = contract;
  else list.push(contract);
  setItem(STORAGE_KEYS.CONTRACTS, list);
};
export const deleteContract = (id: string): void => {
  const list = getContracts().filter(c => c.id !== id);
  setItem(STORAGE_KEYS.CONTRACTS, list);
};

// --- Vendor (Single Entity for this app) ---
export const getVendor = (): Vendor => {
  return getItem<Vendor>(STORAGE_KEYS.VENDOR, {
    id: 'v-001',
    nombre: 'COMERCIALIZADORA MADECAS SPA',
    rut: '77.300.759-4',
    domicilio: 'RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Osorno, X REGION',
    telefono: '+569 7777 00 22',
    correo: 'obras@madecas.cl',
    banco_nombre: 'BANCO ESTADO',
    banco_tipo_cuenta: 'CUENTA CORRIENTE',
    banco_numero_cuenta: '81500255536'
  });
};

export const saveVendor = (vendor: Vendor): void => {
  setItem(STORAGE_KEYS.VENDOR, vendor);
};

// --- Cross-Referencing ---
export const getClientCommercialHistory = (rut: string) => {
  const clients = getClients();
  const client = clients.find(c => c.rut === rut);
  if (!client) return null;

  const projects = getProjects().filter(p => p.cliente_id === client.id);
  const budgets = getBudgets().filter(b => b.cliente_id === client.id);
  const contracts = getContracts().filter(c => c.cliente_id === client.id);

  return {
    client,
    projects,
    budgets,
    contracts
  };
};

// --- Seeding ---
export const seedDatabase = () => {
  if (getClients().length === 0) {
    saveClient({
      id: crypto.randomUUID(),
      nombre: "Juan Pérez",
      rut: "12.345.678-9",
      domicilio: "Calle Las Rosas 45, Valdivia",
      telefono: "912345678",
      correo: "juan.perez@email.com",
      fecha_registro: "2023-05-15T12:00:00Z",
      location: { lat: -39.8193, lng: -73.2452 }
    });
    saveClient({
      id: crypto.randomUUID(),
      nombre: "María González",
      rut: "15.987.654-3",
      domicilio: "Av. O'Higgins 120, Valdivia",
      telefono: "987654321",
      correo: "maria.g@email.com",
      fecha_registro: "2024-02-10T10:00:00Z",
      location: { lat: -39.8142, lng: -73.2459 }
    });
  }
  if (getProjects().length === 0) {
    saveProject({
      id: crypto.randomUUID(),
      modelo: "CABAÑA MODULAR 42M2",
      superficie_m2: 42,
      precio_base: 18500000,
      etapa: 'Cotización',
      materiales_principales: ["Pino Impregnado 2x6", "Zinc Acanalado 0.35", "Terciado Estructural 18mm", "Fibrocemento Exterior"],
      adicionales: ["Fosa Séptica", "Instalación Eléctrica", "Termopanel"]
    });
    saveProject({
      id: crypto.randomUUID(),
      modelo: "MODELO AUSTRAL 74M2",
      superficie_m2: 74,
      precio_base: 32900000,
      etapa: 'Cotización',
      materiales_principales: ["Estructura Metalcon", "Teja Asfáltica", "Piso Flotante", "Cerámicos"],
      adicionales: ["Radier de Hormigón", "Cocina Equipada"]
    });
  }
};