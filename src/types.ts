
export enum ContractStatus {
  DRAFT = 'Borrador',
  GENERATED = 'Generado',
  SIGNED = 'Firmado',
  COMPLETED = 'Finalizado',
  CANCELLED = 'Anulado'
}

export interface Client {
  id: string;
  nombre: string;
  rut: string;
  domicilio: string;
  telefono: string;
  correo: string;
  fecha_registro?: string; // Standardized ISO date
  vendedor_id?: string; // Linked seller UID
  vendedor_nombre?: string; // Cache executive name for display
  etapa_venta?: 'Registro' | 'Selección Modelo' | 'Personalización' | 'Cotización' | 'Negociación' | 'Cierre' | 'Postventa';
  location?: {
    lat: number;
    lng: number;
  };
  notas_comerciales?: string;
  rol_propiedad?: string; // ROL SII de la propiedad / terreno
  comuna?: string;
  region?: string;
  superficie_terreno_m2?: number;
}

export interface SystemUser {
  id: string;
  nombre: string;
  correo: string;
  telefono?: string;
  rut?: string;
  rol: 'vendedor' | 'admin' | 'supervisor' | 'notarial' | 'arquitecto';
  cargo?: string;
  activo: boolean;
  fecha_creacion: string;
  comision_porcentaje?: number;
  meta_mensual_pesos?: number;
  eliminado?: boolean;
  fecha_eliminacion?: string;
}

export type AuditAction = 
  | 'USUARIO_CREADO'
  | 'USUARIO_MODIFICADO'
  | 'USUARIO_ESTADO_CAMBIADO'
  | 'USUARIO_ARCHIVADO'
  | 'USUARIO_ELIMINADO'
  | 'CARTERA_REASIGNADA'
  | 'CLIENTE_CREADO'
  | 'CLIENTE_MODIFICADO'
  | 'CLIENTE_ELIMINADO'
  | 'PRESUPUESTO_CREADO'
  | 'PRESUPUESTO_MODIFICADO'
  | 'CONTRATO_CREADO'
  | 'CONTRATO_FIRMADO';

export interface AuditLog {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  accion: AuditAction;
  entidad: 'users' | 'clients' | 'budgets' | 'contracts' | 'settings';
  entidad_id: string;
  detalles: Record<string, any>;
  timestamp: string;
}

export interface Vendor {
  id: string;
  nombre: string;
  rut: string;
  domicilio: string;
  telefono: string;
  correo: string;
  banco_nombre?: string;
  banco_tipo_cuenta?: string;
  banco_numero_cuenta?: string;
}

export interface Material {
  id: string;
  nombre: string;
  unidad: string; // m2, m3, un, gl
}

export interface Project {
  id: string;
  cliente_id?: string; // Linked client RUT reference
  vendedor_id?: string; // Linked seller UID
  modelo: string;
  superficie_m2: number;
  precio_base: number;
  especificaciones_default?: BudgetItem[]; // Array of items directly
  materiales_principales: string[]; // List of names
  adicionales: string[];
  etapa: 'Cotización' | 'Venta' | 'Construcción' | 'Entregado';
  location?: {
    lat: number;
    lng: number;
  };
  // New Fields for Catalog
  imagen_url?: string;
  pdf_url?: string;
  es_modelo_fijo?: boolean;
  partidas_adicionales_permitidas?: boolean;
}

export interface BudgetItem {
  id: string;
  descripcion: string; // e.g., "Madera Pino Insigne 2x4"
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  total: number;
}

export interface CombinedModelModule {
  id: string;
  model_id: string;
  nombre: string;
  superficie_m2: number;
  valor_m2: number;
  subtotal: number;
  rol?: 'Principal' | 'Secundario' | 'Ampliación' | 'Cabaña' | 'Quincho' | 'Módulo' | string;
  categoria?: string;
  imagen_url?: string;
}

export interface Budget {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  proyecto_id: string;
  fecha: string;
  detalle_items: BudgetItem[];
  monto_total: number;
  forma_pago: 'Contado' | 'Transferencia' | 'Crédito Directo' | 'Crédito Hipotecario';
  cuotas: number;
  estado_pago: 'Pendiente' | 'Parcial' | 'Pagado';
  plazo_instalacion_dias?: number;
  fecha_inicio_obra?: string;
  lugar_suscripcion?: string;
  superficie_m2?: number;
  valor_m2?: number;
  monto_base_modelo?: number;
  monto_adicionales?: number;
  mejoramientos_adicionales?: SelectedImprovement[];
  medidas_radier?: { largo: number; ancho: number };
  es_modelo_fijo?: boolean;
  partidas_adicionales_permitidas?: boolean;
  notas_personalizacion?: string;
  observaciones_negociacion?: string;
  es_anexo?: boolean;
  parent_contract_id?: string;
  tipo_documento?: 'PRESUPUESTO_BASE' | 'PRESUPUESTO_ANEXO';
  
  // Multi-model combination support
  es_combinacion_modelos?: boolean;
  modelos_combinados?: CombinedModelModule[];
}

export interface PaymentInstallment {
  descripcion: string; // e.g., "Al firmar contrato"
  porcentaje: number;
  monto: number;
  pagado?: boolean;
  fecha_pago?: string;
}

export interface Contract {
  id: string;
  cliente_id: string;
  vendedor_id: string;
  proyecto_id: string;
  presupuesto_id: string;
  fecha_contrato: string;
  monto_total: number;
  metodo_pago: 'Contado' | 'Transferencia' | 'Crédito Directo' | 'Crédito Hipotecario';
  cuotas_pago: number;
  estado_pago: 'Pendiente' | 'Parcial' | 'Pagado';
  hitos_pago: PaymentInstallment[];
  pautas_pago: PaymentInstallment[]; // Ensuring this is present for ContractManager
  estado: ContractStatus;
  contenido_texto: string; // The AI generated text

  // Plazos y Fechas
  plazo_instalacion_dias: number;
  fecha_inicio_obra: string;
  fecha_entrega_estimada?: string;
  lugar_suscripcion: string;
  
  // Snapshots for Historical Registry (Inmutable record)
  cliente_snapshot?: Client;
  proyecto_snapshot?: Project;
  presupuesto_snapshot?: Budget;
  
  // Electronic Signature Fields
  firma_cliente?: string; // Base64 image data
  firma_vendedor?: string; // Base64 image data
  fecha_firma?: string;
  documento_archivo_url?: string; // Base64 or Blob URL for now
  documento_archivo_tipo?: 'PDF' | 'PHOTO';
  fecha_escaneo?: string;
  es_anexo?: boolean;
  parent_contract_id?: string;
  anexo_nro?: number;
  anexo_motivo?: string;
  es_combinacion_modelos?: boolean;
  modelos_combinados?: CombinedModelModule[];
}

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface AppTheme {
  background: string;
  text: string;
  card: string;
  menu: string;
  button: string;
  name: string;
}

export interface AdditionalImprovementItem {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  precio_m2: number;
  unidad: 'm2' | 'global';
  categoria: 'fundacion' | 'aislacion' | 'techumbre' | 'terminaciones' | 'estructura';
  beneficio?: string;
}

export interface SelectedImprovement {
  improvement_id: string;
  codigo: string;
  titulo: string;
  m2: number;
  precio_m2: number;
  total: number;
  nota?: string;
}

export interface HouseModel {
  id: string;
  nombre: string;
  descripcion: string;
  superficie_m2: number;
  preciobase: number; // For compatibility
  valor_m2_sugerido?: number;
  categoria?: 'Básico 2 Aguas' | 'Básico 4 Aguas' | 'Contemporáneo' | 'Premium' | 'Básico 6 Aguas' | string;
  dormitorios?: string | number;
  banos?: number;
  imagen_url?: string;
  pdf_url?: string;
  caracteristicas_pack_basico?: string[];
  especificaciones?: BudgetItem[];
  vendedor_id?: string;
  fecha_creacion: string;
}

// Helper type for views
export type ViewState = 'dashboard' | 'hub' | 'map' | 'clients' | 'projects' | 'budgets' | 'contracts' | 'settings' | 'ai-assistant' | 'cubicacion' | 'designs' | 'users' | 'audit';
export type UserRole = 'vendedor' | 'admin';

