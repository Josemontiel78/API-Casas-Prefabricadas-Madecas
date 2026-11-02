import React, { useState, useEffect } from 'react';
import { SystemUser, Client, AuditLog, AuditAction } from '@/types';
import { 
  getUsers, 
  saveUser, 
  deleteUser, 
  softDeleteUser,
  reassignClientPortfolio,
  subscribeToUsers, 
  subscribeToClients,
  subscribeToAuditLogs 
} from '@/services/db';
import { uuid } from '@/lib/utils';
import { 
  validateChileanRut, 
  formatChileanRut, 
  validateEmail, 
  validateCommission, 
  validateMonthlyTarget 
} from '@/utils/validation';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail, 
  Phone, 
  Shield, 
  Briefcase, 
  DollarSign, 
  Edit3, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  X, 
  Save, 
  Filter,
  BadgeCheck,
  TrendingUp,
  Percent,
  Archive,
  RefreshCw,
  ArrowRightLeft,
  ShieldAlert,
  History,
  FileText,
  Download,
  Eye,
  AlertTriangle,
  UserCheck
} from 'lucide-react';

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  vendedor: { 
    label: 'Vendedor Comercial', 
    color: 'text-emerald-700', 
    bg: 'bg-emerald-50 border-emerald-200',
    desc: 'Atención a clientes, emisión de cotizaciones y contratos'
  },
  admin: { 
    label: 'Administrador General', 
    color: 'text-purple-700', 
    bg: 'bg-purple-50 border-purple-200',
    desc: 'Control total de usuarios, auditoría, configuración y catálogo'
  },
  supervisor: { 
    label: 'Supervisor de Obras', 
    color: 'text-blue-700', 
    bg: 'bg-blue-50 border-blue-200',
    desc: 'Seguimiento en terreno, georeferencia y avance de proyectos'
  },
  notarial: { 
    label: 'Asesor Notarial / Legal', 
    color: 'text-amber-700', 
    bg: 'bg-amber-50 border-amber-200',
    desc: 'Revisión jurídica de contratos, anexos y firmas notariales'
  },
  arquitecto: { 
    label: 'Arquitecto / Cubicador', 
    color: 'text-indigo-700', 
    bg: 'bg-indigo-50 border-indigo-200',
    desc: 'Cubicación técnica, planos, especificaciones y radier'
  },
};

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  USUARIO_CREADO: { label: 'Usuario Creado', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  USUARIO_MODIFICADO: { label: 'Usuario Modificado', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  USUARIO_ESTADO_CAMBIADO: { label: 'Estado Cambiado', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  USUARIO_ARCHIVADO: { label: 'Usuario Archivado', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  USUARIO_ELIMINADO: { label: 'Usuario Eliminado', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  CARTERA_REASIGNADA: { label: 'Cartera Reasignada', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  CLIENTE_CREADO: { label: 'Cliente Creado', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
  CLIENTE_MODIFICADO: { label: 'Cliente Modificado', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
  CLIENTE_ELIMINADO: { label: 'Cliente Eliminado', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  CONTRATO_CREADO: { label: 'Contrato Emitido', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  CONTRATO_FIRMADO: { label: 'Contrato Firmado', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
};

interface UserManagerProps {
  initialTab?: 'users' | 'audit';
}

const UserManager: React.FC<UserManagerProps> = ({ initialTab = 'users' }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [users, setUsers] = useState<SystemUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Filters for users
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('activos');
  const [showArchived, setShowArchived] = useState(false);

  // Filters for audit logs
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilter, setAuditFilter] = useState('todas');
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<SystemUser | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  
  // Loading States
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReassigning, setIsReassigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<SystemUser>({
    id: '',
    nombre: '',
    correo: '',
    telefono: '',
    rut: '',
    rol: 'vendedor',
    cargo: '',
    activo: true,
    fecha_creacion: '',
    comision_porcentaje: 3,
    meta_mensual_pesos: 50000000
  });

  // Validation Errors state
  const [validationErrors, setValidationErrors] = useState<{
    rut?: string;
    correo?: string;
    comision?: string;
    meta?: string;
  }>({});

  useEffect(() => {
    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data);
    });
    const unsubClients = subscribeToClients((data) => {
      setClients(data);
    });
    const unsubAudit = subscribeToAuditLogs((data) => {
      setAuditLogs(data);
    });

    return () => {
      unsubUsers();
      unsubClients();
      unsubAudit();
    };
  }, []);

  // Compute portfolio counts per user
  const clientCountByUser = React.useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => {
      if (c.vendedor_id) {
        counts[c.vendedor_id] = (counts[c.vendedor_id] || 0) + 1;
      }
    });
    return counts;
  }, [clients]);

  // Available sellers for portfolio reassignment
  const availableReceivers = React.useMemo(() => {
    if (!userToDelete) return [];
    return users.filter(u => u.id !== userToDelete.id && u.activo && !u.eliminado);
  }, [users, userToDelete]);

  const handleOpenNew = () => {
    setEditingUser(null);
    setValidationErrors({});
    setFormData({
      id: uuid(),
      nombre: '',
      correo: '',
      telefono: '',
      rut: '',
      rol: 'vendedor',
      cargo: 'Ejecutivo Comercial',
      activo: true,
      fecha_creacion: new Date().toISOString(),
      comision_porcentaje: 3.0,
      meta_mensual_pesos: 50000000
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: SystemUser) => {
    setEditingUser(user);
    setValidationErrors({});
    setFormData({
      id: user.id,
      nombre: user.nombre || '',
      correo: user.correo || '',
      telefono: user.telefono || '',
      rut: user.rut || '',
      rol: user.rol || 'vendedor',
      cargo: user.cargo || '',
      activo: user.activo !== undefined ? user.activo : true,
      fecha_creacion: user.fecha_creacion || new Date().toISOString(),
      comision_porcentaje: user.comision_porcentaje ?? 3.0,
      meta_mensual_pesos: user.meta_mensual_pesos ?? 50000000,
      eliminado: user.eliminado,
      fecha_eliminacion: user.fecha_eliminacion
    });
    setIsModalOpen(true);
  };

  // Real-time RUT input handler
  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatChileanRut(raw);
    setFormData(prev => ({ ...prev, rut: formatted }));

    if (raw.trim().length >= 8) {
      const isValid = validateChileanRut(raw);
      setValidationErrors(prev => ({
        ...prev,
        rut: isValid ? undefined : 'RUT inválido según el algoritmo Módulo 11 chileno'
      }));
    } else {
      setValidationErrors(prev => ({ ...prev, rut: undefined }));
    }
  };

  // Real-time Email input handler
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setFormData(prev => ({ ...prev, correo: email }));

    if (email.trim().length > 3) {
      const isValid = validateEmail(email);
      setValidationErrors(prev => ({
        ...prev,
        correo: isValid ? undefined : 'Formato de correo electrónico no válido'
      }));
    } else {
      setValidationErrors(prev => ({ ...prev, correo: undefined }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    const errors: typeof validationErrors = {};
    if (!formData.nombre.trim()) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'El nombre completo es obligatorio', type: 'error' } 
      }));
      return;
    }

    if (!formData.correo.trim() || !validateEmail(formData.correo)) {
      errors.correo = 'Ingresa un correo electrónico corporativo válido';
    }

    if (formData.rut && formData.rut.trim() && !validateChileanRut(formData.rut)) {
      errors.rut = 'El RUT ingresado no cumple la validación Módulo 11';
    }

    if (formData.rol === 'vendedor') {
      const commCheck = validateCommission(Number(formData.comision_porcentaje));
      if (!commCheck.valid) errors.comision = commCheck.error;

      const targetCheck = validateMonthlyTarget(Number(formData.meta_mensual_pesos));
      if (!targetCheck.valid) errors.meta = targetCheck.error;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Por favor corrige los campos con error en el formulario', type: 'error' } 
      }));
      return;
    }

    setIsSaving(true);
    const userToSave: SystemUser = {
      ...formData,
      nombre: formData.nombre.trim(),
      correo: formData.correo.trim().toLowerCase(),
      telefono: formData.telefono?.trim() || '',
      rut: formData.rut?.trim() || '',
      cargo: formData.cargo?.trim() || '',
      comision_porcentaje: Number(formData.comision_porcentaje) || 0,
      meta_mensual_pesos: Number(formData.meta_mensual_pesos) || 0,
      fecha_creacion: formData.fecha_creacion || new Date().toISOString()
    };

    // Optimistic UI update
    setUsers(prev => {
      const exists = prev.some(u => u.id === userToSave.id);
      if (exists) {
        return prev.map(u => u.id === userToSave.id ? userToSave : u);
      }
      return [userToSave, ...prev];
    });

    try {
      await saveUser(userToSave);
      setIsModalOpen(false);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { 
          message: editingUser ? 'Usuario actualizado exitosamente y registrado en auditoría' : 'Nuevo usuario registrado exitosamente', 
          type: 'success' 
        } 
      }));
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Error al sincronizar con la base de datos', type: 'error' } 
      }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: SystemUser) => {
    const updated: SystemUser = { ...user, activo: !user.activo };
    setUsers(prev => prev.map(u => u.id === user.id ? updated : u));

    try {
      await saveUser(updated);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { 
          message: `Usuario "${updated.nombre}" ${updated.activo ? 'activado' : 'desactivado'} correctamente`, 
          type: 'info' 
        } 
      }));
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      setUsers(prev => prev.map(u => u.id === user.id ? user : u));
    }
  };

  const handleRestoreUser = async (user: SystemUser) => {
    const restored: SystemUser = { ...user, activo: true, eliminado: false, fecha_eliminacion: undefined };
    setUsers(prev => prev.map(u => u.id === user.id ? restored : u));
    try {
      await saveUser(restored);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Usuario "${user.nombre}" restaurado exitosamente`, type: 'success' } 
      }));
    } catch (err) {
      console.error("Error al restaurar usuario:", err);
    }
  };

  const handleOpenDelete = (user: SystemUser) => {
    setUserToDelete(user);
    // Auto-select first available receiver if any
    const firstReceiver = users.find(u => u.id !== user.id && u.activo && !u.eliminado);
    setReassignTargetId(firstReceiver?.id || '');
  };

  const handleReassignAndArchive = async () => {
    if (!userToDelete || !reassignTargetId) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Selecciona el ejecutivo receptor para reasignar la cartera', type: 'error' } 
      }));
      return;
    }

    setIsReassigning(true);
    const targetUser = users.find(u => u.id === reassignTargetId);
    const targetName = targetUser?.nombre || 'Ejecutivo Comercial';

    try {
      // 1. Reassign portfolio
      const reassignedCount = await reassignClientPortfolio(userToDelete.id, reassignTargetId, targetName);
      
      // 2. Soft delete user
      await softDeleteUser(userToDelete.id);

      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { 
          message: `Cartera (${reassignedCount} clientes) reasignada a "${targetName}" y usuario archivado`, 
          type: 'success' 
        } 
      }));
      setUserToDelete(null);
    } catch (err) {
      console.error("Error en reasignación y baja:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'No se pudo completar la reasignación de cartera', type: 'error' } 
      }));
    } finally {
      setIsReassigning(false);
    }
  };

  const handleSoftDeleteOnly = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    try {
      await softDeleteUser(userToDelete.id);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Usuario "${userToDelete.nombre}" archivado (borrado lógico)`, type: 'info' } 
      }));
      setUserToDelete(null);
    } catch (err) {
      console.error("Error al archivar usuario:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Error al archivar usuario', type: 'error' } 
      }));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDeleteDefinitive = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    const targetId = userToDelete.id;
    const targetName = userToDelete.nombre;

    setUsers(prev => prev.filter(u => u.id !== targetId));

    try {
      await deleteUser(targetId);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Usuario "${targetName}" eliminado definitivamente del sistema`, type: 'info' } 
      }));
      setUserToDelete(null);
    } catch (err) {
      console.error("Error al eliminar usuario físicamente:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'No se pudo eliminar el usuario', type: 'error' } 
      }));
      const fresh = await getUsers();
      setUsers(fresh);
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter(user => {
    // If showArchived is false, hide soft deleted users
    if (!showArchived && user.eliminado) return false;
    if (showArchived && !user.eliminado) return false;

    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      user.nombre.toLowerCase().includes(term) ||
      user.correo.toLowerCase().includes(term) ||
      (user.rut && user.rut.toLowerCase().includes(term)) ||
      (user.cargo && user.cargo.toLowerCase().includes(term));

    const matchesRole = roleFilter === 'todos' || user.rol === roleFilter;
    const matchesStatus = 
      statusFilter === 'todos' || 
      (statusFilter === 'activos' && user.activo) || 
      (statusFilter === 'inactivos' && !user.activo);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const term = auditSearch.toLowerCase();
    const matchesSearch = 
      log.usuario_nombre.toLowerCase().includes(term) ||
      log.accion.toLowerCase().includes(term) ||
      log.entidad.toLowerCase().includes(term) ||
      log.entidad_id.toLowerCase().includes(term) ||
      JSON.stringify(log.detalles).toLowerCase().includes(term);

    const matchesCategory = 
      auditFilter === 'todas' || 
      (auditFilter === 'usuarios' && log.entidad === 'users') ||
      (auditFilter === 'reasignacion' && log.accion === 'CARTERA_REASIGNADA') ||
      (auditFilter === 'clientes' && log.entidad === 'clients') ||
      (auditFilter === 'contratos' && log.entidad === 'contracts');

    return matchesSearch && matchesCategory;
  });

  // Export audit logs to CSV
  const exportAuditCsv = () => {
    if (filteredAuditLogs.length === 0) return;
    const headers = ['Fecha_Hora', 'Usuario_Responsable', 'Accion', 'Entidad', 'Entidad_ID', 'Detalles'];
    const rows = filteredAuditLogs.map(l => [
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.usuario_nombre}"`,
      `"${l.accion}"`,
      `"${l.entidad}"`,
      `"${l.entidad_id}"`,
      `"${JSON.stringify(l.detalles).replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Auditoria_Madecas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeCount = users.filter(u => u.activo && !u.eliminado).length;
  const sellersCount = users.filter(u => u.rol === 'vendedor' && !u.eliminado).length;
  const adminCount = users.filter(u => u.rol === 'admin' && !u.eliminado).length;
  const archivedCount = users.filter(u => u.eliminado).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Navigation Tabs */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Shield size={26} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Administración & Auditoría</h2>
              <p className="text-slate-500 text-sm font-medium">
                Gestión de usuarios, integridad referencial de carteras y trazabilidad de operaciones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {activeTab === 'users' && (
              <button 
                onClick={handleOpenNew}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition font-bold text-sm shrink-0 w-full md:w-auto"
              >
                <UserPlus size={18} />
                <span>Nuevo Usuario</span>
              </button>
            )}
            {activeTab === 'audit' && (
              <button 
                onClick={exportAuditCsv}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 shadow-sm transition font-bold text-xs shrink-0 w-full md:w-auto"
              >
                <Download size={15} />
                <span>Exportar CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 -mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'users'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users size={18} />
            <span>Equipo y Fuerza de Ventas ({users.filter(u => !u.eliminado).length})</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-4 px-4 font-bold text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'audit'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <History size={18} />
            <span>Registro de Auditoría ({auditLogs.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'users' && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center font-black">
                <Users size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Equipo</p>
                <p className="text-2xl font-black text-slate-800">{users.filter(u => !u.eliminado).length}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
                <BadgeCheck size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Activos</p>
                <p className="text-2xl font-black text-slate-800">{activeCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">
                <TrendingUp size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Fuerza de Ventas</p>
                <p className="text-2xl font-black text-slate-800">{sellersCount}</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center font-black">
                <Shield size={22} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-purple-600 tracking-wider">Administradores</p>
                <p className="text-2xl font-black text-slate-800">{adminCount}</p>
              </div>
            </div>
          </div>

          {/* Filters and Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, RUT o cargo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos los Roles</option>
                <option value="vendedor">Vendedores</option>
                <option value="admin">Administradores</option>
                <option value="supervisor">Supervisores de Obra</option>
                <option value="notarial">Asesores Notariales</option>
                <option value="arquitecto">Arquitectos</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos los Estados</option>
                <option value="activos">Solo Habilitados</option>
                <option value="inactivos">Solo Desactivados</option>
              </select>

              <button
                type="button"
                onClick={() => setShowArchived(!showArchived)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                  showArchived 
                    ? 'bg-purple-100 text-purple-800 border-purple-300' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Archive size={14} />
                <span>{showArchived ? 'Ocultar Archivados' : `Archivados (${archivedCount})`}</span>
              </button>
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredUsers.length === 0 ? (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                <Users size={48} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-600 font-bold">No se encontraron usuarios</p>
                <p className="text-slate-400 text-xs mt-1">Prueba cambiando los filtros o registrando un nuevo usuario.</p>
              </div>
            ) : (
              filteredUsers.map(user => {
                const roleMeta = ROLE_LABELS[user.rol] || { 
                  label: user.rol, 
                  color: 'text-slate-700', 
                  bg: 'bg-slate-50 border-slate-200',
                  desc: ''
                };
                const initials = user.nombre
                  .split(' ')
                  .map(n => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                const assignedClientsCount = clientCountByUser[user.id] || 0;

                return (
                  <div 
                    key={user.id} 
                    className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                      user.eliminado 
                        ? 'border-purple-200 bg-purple-50/30' 
                        : user.activo 
                          ? 'border-slate-200' 
                          : 'border-slate-200 opacity-80 bg-slate-50/50'
                    }`}
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl text-white font-black text-base flex items-center justify-center shadow-sm ${
                            user.eliminado ? 'bg-purple-700' : 'bg-gradient-to-br from-emerald-500 to-teal-700'
                          }`}>
                            {initials}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{user.nombre}</h4>
                            <p className="text-xs text-slate-500 font-medium">{user.cargo || 'Funcionario'}</p>
                          </div>
                        </div>

                        {user.eliminado ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                            Archivado
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleStatus(user)}
                            title={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                              user.activo 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                            }`}
                          >
                            {user.activo ? 'Habilitado' : 'Desactivado'}
                          </button>
                        )}
                      </div>

                      {/* Role Badge and Portfolio Count */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${roleMeta.bg} ${roleMeta.color}`}>
                          <Shield size={12} />
                          {roleMeta.label}
                        </span>

                        {assignedClientsCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <Users size={11} />
                            {assignedClientsCount} clientes
                          </span>
                        )}
                      </div>

                      {/* Contact Info List */}
                      <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail size={14} className="text-emerald-600 shrink-0" />
                          <span className="font-semibold select-all truncate">{user.correo}</span>
                        </div>

                        {user.telefono && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone size={14} className="text-blue-600 shrink-0" />
                            <span>{user.telefono}</span>
                          </div>
                        )}

                        {user.rut && (
                          <div className="flex items-center gap-2 text-slate-500">
                            <span className="text-[10px] uppercase font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-mono">RUT</span>
                            <span className="font-medium">{user.rut}</span>
                          </div>
                        )}

                        {user.rol === 'vendedor' && (
                          <div className="pt-2 mt-1 border-t border-dashed border-slate-100 grid grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Comisión</span>
                              <span className="font-bold text-emerald-600">{user.comision_porcentaje || 0}%</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block">Meta Mensual</span>
                              <span className="font-bold text-slate-700">
                                ${(user.meta_mensual_pesos || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-4 mt-2">
                      {user.eliminado ? (
                        <button
                          type="button"
                          onClick={() => handleRestoreUser(user)}
                          className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition flex items-center gap-1.5"
                        >
                          <RefreshCw size={14} />
                          <span>Restaurar Usuario</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(user);
                            }}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
                            title="Editar Usuario"
                          >
                            <Edit3 size={15} />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDelete(user);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-1.5 text-xs font-semibold"
                            title="Eliminar o Reasignar Usuario"
                          >
                            <Trash2 size={15} />
                            <span>Baja / Eliminar</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por usuario, acción o ID de entidad..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="flex gap-2 w-full md:w-auto">
              <select
                value={auditFilter}
                onChange={(e) => setAuditFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todas">Todas las Operaciones</option>
                <option value="usuarios">Gestión de Usuarios</option>
                <option value="reasignacion">Reasignación de Carteras</option>
                <option value="clientes">Operaciones de Clientes</option>
                <option value="contratos">Contratos y Firmas</option>
              </select>
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Usuario Responsable</th>
                    <th className="p-4">Acción Realizada</th>
                    <th className="p-4">Entidad Afectada</th>
                    <th className="p-4">Resumen del Evento</th>
                    <th className="p-4 text-right">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400">
                        <History size={36} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-600">No se registran eventos de auditoría</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => {
                      const actionMeta = ACTION_LABELS[log.accion] || { 
                        label: log.accion, 
                        color: 'text-slate-700', 
                        bg: 'bg-slate-50 border-slate-200' 
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4 font-mono text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {log.usuario_nombre}
                          </td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${actionMeta.bg} ${actionMeta.color}`}>
                              {actionMeta.label}
                            </span>
                          </td>
                          <td className="p-4 uppercase font-bold text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                              {log.entidad}: {log.entidad_id.slice(0, 12)}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 max-w-xs truncate">
                            {log.detalles?.nombre || 
                             log.detalles?.motivo || 
                             log.detalles?.hacia_usuario_nombre ? `Reasignado a ${log.detalles.hacia_usuario_nombre}` :
                             JSON.stringify(log.detalles)}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedAuditLog(log)}
                              className="px-2.5 py-1 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg font-bold text-xs transition inline-flex items-center gap-1"
                            >
                              <Eye size={13} />
                              <span>Ver</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inspector de Auditoría */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2 text-slate-800">
                <History size={20} className="text-emerald-600" />
                <h3 className="font-bold text-base">Detalle de Registro de Auditoría</h3>
              </div>
              <button 
                onClick={() => setSelectedAuditLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">ID del Evento</span>
                  <span className="font-mono font-bold text-slate-700">{selectedAuditLog.id}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Fecha & Hora</span>
                  <span className="font-mono text-slate-700">{new Date(selectedAuditLog.timestamp).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Usuario Responsable</span>
                  <span className="font-bold text-slate-800">{selectedAuditLog.usuario_nombre}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Acción</span>
                  <span className="font-bold text-emerald-700">{selectedAuditLog.accion}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-bold uppercase block text-[10px] mb-1">Payload / Detalles Técnicos</span>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed max-h-60">
                  {JSON.stringify(selectedAuditLog.detalles, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 transition"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Inteligente: Baja / Eliminación con Reasignación de Cartera */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <AlertTriangle size={26} />
            </div>

            <h3 className="text-lg font-black text-slate-800">
              Gestión de Baja de Usuario
            </h3>
            <p className="text-slate-600 text-sm mt-1">
              Estás modificando el estado del usuario <strong className="text-slate-900">{userToDelete.nombre}</strong> ({userToDelete.correo}).
            </p>

            {/* Check if seller has clients assigned */}
            {(() => {
              const assignedCount = clientCountByUser[userToDelete.id] || 0;

              if (assignedCount > 0) {
                return (
                  <div className="mt-4 space-y-4">
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                      <div className="flex items-center gap-2 font-bold mb-1">
                        <ArrowRightLeft size={16} className="text-amber-700" />
                        <span>¡Integridad Referencial Detectada!</span>
                      </div>
                      <p>
                        Este ejecutivo tiene <strong className="font-black text-amber-950">{assignedCount} cliente(s)</strong> registrados en su cartera activa.
                        Para no perder el seguimiento comercial, reasigna su cartera a otro ejecutivo antes de dar de baja.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                        Seleccionar Ejecutivo Receptor de la Cartera:
                      </label>
                      <select
                        value={reassignTargetId}
                        onChange={(e) => setReassignTargetId(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="">-- Selecciona un ejecutivo activo --</option>
                        {availableReceivers.map(rec => (
                          <option key={rec.id} value={rec.id}>
                            {rec.nombre} ({rec.cargo || rec.rol}) - {rec.correo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleReassignAndArchive}
                        disabled={isReassigning || !reassignTargetId}
                        className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isReassigning ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Reasignando cartera y archivando...</span>
                          </>
                        ) : (
                          <>
                            <ArrowRightLeft size={16} />
                            <span>Reasignar Cartera y Archivar Usuario (Recomendado)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleSoftDeleteOnly}
                        disabled={isDeleting}
                        className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                      >
                        Archivar sin reasignar (Mantener vendedor histórico)
                      </button>

                      <button
                        type="button"
                        onClick={() => setUserToDelete(null)}
                        className="w-full py-1.5 text-slate-400 hover:text-slate-600 text-xs font-medium"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                );
              }

              // No clients assigned -> Standard safe delete/archive
              return (
                <div className="mt-4 space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                    <p>Este usuario no tiene clientes asociados en este momento.</p>
                    <p className="mt-1 font-semibold text-slate-800">
                      Recomendamos realizar un <strong>Borrado Lógico (Archivado)</strong> para mantener el historial de auditoría del sistema.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(null)}
                      disabled={isDeleting}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleHardDeleteDefinitive}
                      disabled={isDeleting}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition border border-red-200"
                    >
                      Eliminación Física Definitiva
                    </button>
                    <button
                      type="button"
                      onClick={handleSoftDeleteOnly}
                      disabled={isDeleting}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-200 transition flex items-center gap-1.5"
                    >
                      <Archive size={15} />
                      <span>Archivar Usuario (Recomendado)</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Crear / Editar con Validaciones Completas */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">
                    {editingUser ? 'Editar Ficha de Usuario' : 'Registrar Nuevo Usuario'}
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Validación de RUT chileno (Módulo 11), correo y políticas comerciales.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    placeholder="Ej: Carlos Valenzuela Soto"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Mail size={12} className="text-emerald-600" />
                      Correo Electrónico *
                    </span>
                    {formData.correo && !validationErrors.correo && (
                      <span className="text-[10px] text-emerald-600 font-bold">Email Válido ✓</span>
                    )}
                  </label>
                  <input
                    required
                    type="email"
                    value={formData.correo}
                    onChange={handleEmailChange}
                    placeholder="ejecutivo@madecas.cl"
                    className={`w-full p-2.5 border rounded-xl text-sm outline-none ${
                      validationErrors.correo 
                        ? 'border-red-400 focus:ring-2 focus:ring-red-400' 
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  {validationErrors.correo && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">{validationErrors.correo}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                    <span>RUT del Usuario (Módulo 11)</span>
                    {formData.rut && !validationErrors.rut && (
                      <span className="text-[10px] text-emerald-600 font-bold">RUT Válido ✓</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.rut || ''}
                    onChange={handleRutChange}
                    placeholder="12.345.678-9"
                    className={`w-full p-2.5 border rounded-xl text-sm outline-none font-mono ${
                      validationErrors.rut 
                        ? 'border-red-400 focus:ring-2 focus:ring-red-400' 
                        : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                    }`}
                  />
                  {validationErrors.rut && (
                    <p className="text-[11px] text-red-500 font-medium mt-1">{validationErrors.rut}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                    <Phone size={12} className="text-blue-600" />
                    Teléfono de Contacto
                  </label>
                  <input
                    type="tel"
                    value={formData.telefono || ''}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    placeholder="+569 8812 3456"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Cargo / Especialidad
                  </label>
                  <input
                    type="text"
                    value={formData.cargo || ''}
                    onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                    placeholder="Ej: Ejecutivo Senior Osorno"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Rol en el Sistema (RBAC)
                  </label>
                  <select
                    value={formData.rol}
                    onChange={(e) => setFormData({ ...formData, rol: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-medium"
                  >
                    <option value="vendedor">Vendedor Comercial</option>
                    <option value="admin">Administrador General</option>
                    <option value="supervisor">Supervisor de Obras</option>
                    <option value="notarial">Asesor Notarial / Legal</option>
                    <option value="arquitecto">Arquitecto / Cubicador</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {ROLE_LABELS[formData.rol]?.desc}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Estado de la Cuenta
                  </label>
                  <select
                    value={formData.activo ? 'activo' : 'inactivo'}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.value === 'activo' })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option value="activo">Habilitado para operar</option>
                    <option value="inactivo">Desactivado temporalmente</option>
                  </select>
                </div>

                {formData.rol === 'vendedor' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                        <Percent size={12} className="text-emerald-600" />
                        Comisión por Venta (0 - 30%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="30"
                        value={formData.comision_porcentaje ?? 0}
                        onChange={(e) => setFormData({ ...formData, comision_porcentaje: parseFloat(e.target.value) || 0 })}
                        className={`w-full p-2.5 border rounded-xl text-sm outline-none ${
                          validationErrors.comision ? 'border-red-400' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                        }`}
                      />
                      {validationErrors.comision && (
                        <p className="text-[11px] text-red-500 font-medium mt-1">{validationErrors.comision}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                        <DollarSign size={12} className="text-emerald-600" />
                        Meta Mensual ($ CLP)
                      </label>
                      <input
                        type="number"
                        step="1000000"
                        min="0"
                        value={formData.meta_mensual_pesos ?? 0}
                        onChange={(e) => setFormData({ ...formData, meta_mensual_pesos: parseFloat(e.target.value) || 0 })}
                        className={`w-full p-2.5 border rounded-xl text-sm outline-none ${
                          validationErrors.meta ? 'border-red-400' : 'border-slate-300 focus:ring-2 focus:ring-emerald-500'
                        }`}
                      />
                      {validationErrors.meta && (
                        <p className="text-[11px] text-red-500 font-medium mt-1">{validationErrors.meta}</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Guardando en base de datos...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{editingUser ? 'Guardar Cambios' : 'Registrar Usuario'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
