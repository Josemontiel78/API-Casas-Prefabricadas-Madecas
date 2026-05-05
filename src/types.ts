
export enum ContractStatus {
  DRAFT = 'Borrador',
  GENERATED = 'Generado',
  SIGNED = 'Firmado',
  CANCELLED = 'Anulado'
}

export interface Client {
  id: string;
  nombre: string;
  rut: string;
  domicilio: string;
  telefono: string;
  correo: string;
  location?: {
    lat: number;
    lng: number;
  };
  notas_comerciales?: string;
}

export interface Vendor {
  id: string;
  nombre: string;
  rut: string;
  domicilio: string;
  telefono: string;
  correo: string;
}

export interface Material {
  id: string;
  nombre: string;
  unidad: string; // m2, m3, un, gl
}

export interface Project {
  id: string;
  cliente_id?: string; // Linked client RUT reference
  modelo: string;
  superficie_m2: number;
  materiales_principales: string[]; // List of names
  adicionales: string[];
  etapa: 'Cotización' | 'Venta' | 'Construcción' | 'Entregado';
  location?: {
    lat: number;
    lng: number;
  };
}

export interface BudgetItem {
  id: string;
  descripcion: string; // e.g., "Madera Pino Insigne 2x4"
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
}

export interface Budget {
  id: string;
  cliente_id: string;
  proyecto_id: string;
  fecha: string;
  detalle_items: BudgetItem[];
  monto_total: number;
}

export interface PaymentInstallment {
  descripcion: string; // e.g., "Al firmar contrato"
  porcentaje: number;
  monto: number;
}

export interface Contract {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  proyecto_id: string;
  presupuesto_id: string;
  fecha_contrato: string;
  monto_total: number;
  forma_pago: PaymentInstallment[];
  estado: ContractStatus;
  contenido_texto: string; // The AI generated text
  
  // Snapshots for Historical Registry (Inmutable record)
  cliente_snapshot?: Client;
  proyecto_snapshot?: Project;
  presupuesto_snapshot?: Budget;
  
  // Electronic Signature Fields
  firma_cliente?: string; // Base64 image data
  firma_vendedor?: string; // Base64 image data
  fecha_firma?: string;
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Helper type for views
export type ViewState = 'dashboard' | 'hub' | 'map' | 'clients' | 'projects' | 'budgets' | 'contracts' | 'settings' | 'ai-assistant';
export type UserRole = 'vendedor' | 'admin';
