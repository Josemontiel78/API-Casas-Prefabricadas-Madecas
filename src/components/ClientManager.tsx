import React, { useState, useEffect, useCallback } from 'react';
import { Client, SystemUser } from '@/types';
import { getClients, saveClient, deleteClient, subscribeToClients, subscribeToUsers } from '@/services/db';
import { uuid, cn } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Save, 
  Users, 
  Trash2, 
  Phone, 
  Mail, 
  MapPin, 
  Map as MapIcon, 
  Edit3, 
  Compass, 
  Tag, 
  ExternalLink,
  Building,
  UserCheck
} from 'lucide-react';
import { validateChileanRut, formatChileanRut, validateEmail } from '@/utils/validation';
import MapProjectPicker from '@/components/MapProjectPicker';

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [formData, setFormData] = useState<Client>({
    id: '', 
    nombre: '', 
    rut: '', 
    domicilio: '', 
    telefono: '', 
    correo: '', 
    vendedor_id: '',
    vendedor_nombre: '', 
    etapa_venta: 'Registro',
    rol_propiedad: '',
    comuna: '',
    region: 'Los Lagos'
  });

  useEffect(() => {
    const unsubClients = subscribeToClients((data) => {
      setClients(data);
      setFilteredClients(data);
    });

    const unsubUsers = subscribeToUsers((data) => {
      setUsers(data);
    });

    const timer = setTimeout(() => {
      const triggerId = window.localStorage.getItem('dash_trigger_client_id');
      const focusFields = window.localStorage.getItem('dash_focus_field');
      
      if (triggerId) {
        const client = clients.find(c => c.id === triggerId);
        if (client) {
          handleEdit(client);
          setTimeout(() => {
            const fields = focusFields ? focusFields.split(',') : [];
            fields.forEach(field => {
              const el = document.querySelector(`[name="${field}"]`);
              if (el) {
                el.classList.add('animate-pulse', 'ring-2', 'ring-red-500', 'border-red-500');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                  el.classList.remove('animate-pulse', 'ring-2', 'ring-red-500', 'border-red-500');
                }, 5000);
              }
            });
          }, 500);
        }
        window.localStorage.removeItem('dash_trigger_client_id');
        window.localStorage.removeItem('dash_focus_field');
      }
    }, 1000);

    return () => {
      unsubClients();
      unsubUsers();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFilteredClients(clients.filter(c => 
      c.nombre.toLowerCase().includes(lower) || 
      c.rut.toLowerCase().includes(lower) ||
      (c.correo && c.correo.toLowerCase().includes(lower)) ||
      (c.rol_propiedad && c.rol_propiedad.toLowerCase().includes(lower)) ||
      (c.domicilio && c.domicilio.toLowerCase().includes(lower)) ||
      (c.comuna && c.comuna.toLowerCase().includes(lower)) ||
      (c.vendedor_nombre && c.vendedor_nombre.toLowerCase().includes(lower))
    ));
  }, [searchTerm, clients]);

  const handleNew = () => {
    setFormData({
      id: uuid(),
      nombre: '', 
      rut: '', 
      domicilio: '', 
      telefono: '', 
      correo: '',
      rol_propiedad: '',
      comuna: 'Osorno',
      region: 'Los Lagos',
      vendedor_id: users.find(u => u.rol === 'vendedor')?.id || '',
      vendedor_nombre: users.find(u => u.rol === 'vendedor')?.nombre || '',
      etapa_venta: 'Registro',
      fecha_registro: new Date().toISOString()
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auto-format RUT if needed
    const clientToSave: Client = {
      ...formData,
      rut: formatChileanRut(formData.rut.trim())
    };

    await saveClient(clientToSave);
    setIsEditing(false);
    
    // Set selected client for designs workflow
    window.localStorage.setItem('selected_client_id', clientToSave.id);

    // Trigger notification
    const event = new CustomEvent('app-notification', { 
      detail: { 
        message: 'Cliente guardado correctamente. Listo para cotizar o asociar diseño de vivienda.', 
        type: 'success' 
      } 
    });
    window.dispatchEvent(event);
  };

  const handleEdit = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormData({
      ...client,
      rol_propiedad: client.rol_propiedad || '',
      comuna: client.comuna || '',
      region: client.region || 'Los Lagos'
    });
    setIsEditing(true);
  };

  const confirmDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeletingClient(true);
    const id = clientToDelete.id;
    const name = clientToDelete.nombre;

    setClients(prev => prev.filter(c => c.id !== id));
    setFilteredClients(prev => prev.filter(c => c.id !== id));

    try {
      await deleteClient(id);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Cliente "${name}" eliminado exitosamente`, type: 'info' } 
      }));
      setClientToDelete(null);
    } catch (err) {
      console.error("Error al eliminar cliente:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Error al eliminar el cliente de la base de datos', type: 'error' } 
      }));
      const fresh = await getClients();
      setClients(fresh);
      setFilteredClients(fresh);
    } finally {
      setIsDeletingClient(false);
    }
  };

  const handleLocationSelect = useCallback((loc: { lat: number; lng: number }) => {
    setFormData(prev => {
      if (prev.location?.lat === loc.lat && prev.location?.lng === loc.lng) return prev;
      return { ...prev, location: loc };
    });
  }, []);

  const handleSellerChange = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    setFormData(prev => ({
      ...prev,
      vendedor_id: userId,
      vendedor_nombre: selected ? selected.nombre : ''
    }));
  };

  const goToGlobalMapWithClient = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (client.location) {
      window.localStorage.setItem('map_target_client_id', client.id);
      window.localStorage.setItem('map_target_lat', client.location.lat.toString());
      window.localStorage.setItem('map_target_lng', client.location.lng.toString());
    }
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'map' }));
  };

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <Users size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-800">
                {formData.id && clients.some(c => c.id === formData.id) ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Completa los datos del comprador y fija la georeferenciación del terreno.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setIsEditing(false)}
            className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Nombre Completo *</label>
              <input 
                required 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.nombre} 
                onChange={e => setFormData({...formData, nombre: e.target.value})} 
                placeholder="Ej: Juan Pérez Morales" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                <span>RUT Chileno (Módulo 11) *</span>
                {formData.rut && validateChileanRut(formData.rut) && (
                  <span className="text-[10px] text-emerald-600 font-bold">RUT Válido ✓</span>
                )}
                {formData.rut && formData.rut.length >= 8 && !validateChileanRut(formData.rut) && (
                  <span className="text-[10px] text-amber-600 font-bold">RUT no válido</span>
                )}
              </label>
              <input 
                required 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition font-mono" 
                value={formData.rut} 
                onChange={e => setFormData({...formData, rut: formatChileanRut(e.target.value)})} 
                placeholder="12.345.678-9" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <Tag size={13} className="text-emerald-600" />
                Rol de la Propiedad / Terreno (SII)
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.rol_propiedad || ''} 
                onChange={e => setFormData({...formData, rol_propiedad: e.target.value})} 
                placeholder="Ej: 1540-22 (Predio Las Encinas)" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <Building size={13} className="text-blue-600" />
                Comuna / Localidad
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.comuna || ''} 
                onChange={e => setFormData({...formData, comuna: e.target.value})} 
                placeholder="Ej: Osorno, Puerto Varas, Puyehue" 
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Domicilio / Dirección del Terreno *</label>
              <input 
                required 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.domicilio} 
                onChange={e => setFormData({...formData, domicilio: e.target.value})} 
                placeholder="Ej: Ruta U-55 Km 8 Cruce Pichil, Osorno" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Teléfono *</label>
              <input 
                required 
                type="tel" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.telefono} 
                onChange={e => setFormData({...formData, telefono: e.target.value})} 
                placeholder="+569 9123 4567" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Correo Electrónico</label>
              <input 
                type="email" 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.correo || ''} 
                onChange={e => setFormData({...formData, correo: e.target.value})} 
                placeholder="comprador@ejemplo.com" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                <UserCheck size={13} className="text-emerald-600" />
                Ejecutivo / Vendedor Asignado
              </label>
              <select 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
                value={formData.vendedor_id || ''} 
                onChange={e => handleSellerChange(e.target.value)}
              >
                <option value="">-- Seleccionar Ejecutivo --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.cargo || u.rol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Etapa del Negocio</label>
              <select 
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition bg-white"
                value={formData.etapa_venta || 'Registro'} 
                onChange={e => setFormData({...formData, etapa_venta: e.target.value as any})}
              >
                <option value="Registro">1. Registro e Ingreso</option>
                <option value="Selección Modelo">2. Selección de Modelo</option>
                <option value="Personalización">3. Personalización</option>
                <option value="Cotización">4. Cotización</option>
                <option value="Negociación">5. Negociación</option>
                <option value="Cierre">6. Cierre (Contrato)</option>
                <option value="Postventa">7. Postventa</option>
              </select>
            </div>
            
            {/* Georeferencing Block */}
            <div className="md:col-span-2 p-5 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Compass size={18} className="text-emerald-600" />
                  Georeferenciación del Terreno (Búsqueda Automática y Fijación de Marca)
                </label>
              </div>

              <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                <MapProjectPicker 
                  initialLocation={formData.location}
                  externalSearchQuery={formData.domicilio}
                  rolPropiedad={formData.rol_propiedad}
                  comuna={formData.comuna}
                  onLocationSelect={handleLocationSelect} 
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Puedes buscar por dirección o rol, mover el marcador directamente en el mapa o usar tu GPS actual.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setIsEditing(false)} 
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition text-sm"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition font-bold text-sm"
            >
              <Save size={18} /> Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">Cartera de Clientes</h3>
          <p className="text-slate-500 text-sm font-medium">
            Gestión completa con georeferenciación, rol de propiedad y seguimiento de ventas.
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, RUT, rol o dirección..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleNew} 
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition font-bold text-sm whitespace-nowrap"
          >
            <Plus size={18} /> Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClients.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
            <Users size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-700 font-bold">No se encontraron clientes</p>
            <p className="text-slate-400 text-xs mt-1">Crea un nuevo cliente o ajusta el criterio de búsqueda.</p>
          </div>
        )}

        {filteredClients.map(client => (
          <div 
            key={client.id} 
            className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-12 -mt-12 transition-transform group-hover:scale-110"></div>
            
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition z-10">
              <button 
                onClick={(e) => handleEdit(client, e)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                title="Editar Cliente"
              >
                <Edit3 size={16} /> 
              </button>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setClientToDelete(client);
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Eliminar Cliente"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div>
              {/* Header */}
              <div className="flex items-start gap-3.5 mb-4 relative z-0">
                <div className="h-12 w-12 bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  <span>{client.nombre.charAt(0)}</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-base leading-tight">{client.nombre}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded font-bold">
                      {client.rut}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      client.etapa_venta === 'Cierre' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      client.etapa_venta === 'Postventa' ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      "bg-blue-50 text-blue-700 border-blue-200"
                    )}>
                      {client.etapa_venta || 'Registro'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Client Details List */}
              <div className="space-y-2 py-3 border-y border-slate-100 text-xs">
                {/* Rol de Propiedad Badge */}
                {client.rol_propiedad && (
                  <div className="flex items-center gap-2 text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-100">
                    <Tag size={13} className="text-emerald-600 shrink-0" />
                    <span className="font-bold">ROL: {client.rol_propiedad}</span>
                    {client.comuna && <span className="text-slate-500 font-normal">({client.comuna})</span>}
                  </div>
                )}

                {client.vendedor_nombre && (
                  <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                    <UserCheck size={14} className="text-indigo-500 shrink-0" />
                    <span>Ejecutivo: {client.vendedor_nombre}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-slate-600">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <a href={`tel:${client.telefono}`} className="hover:text-emerald-600 transition font-medium">
                    {client.telefono}
                  </a>
                </div>

                {client.correo && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{client.correo}</span>
                  </div>
                )}

                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" /> 
                  <span className="leading-tight line-clamp-2">{client.domicilio}</span>
                </div>

                {/* Geolocation Tag */}
                {client.location ? (
                  <div className="flex items-center justify-between pt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Compass size={11} />
                      {client.location.lat.toFixed(4)}, {client.location.lng.toFixed(4)}
                    </span>
                    <button 
                      onClick={(e) => goToGlobalMapWithClient(client, e)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition"
                    >
                      <span>Ver en Mapa</span>
                      <ExternalLink size={10} />
                    </button>
                  </div>
                ) : (
                  <div className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-semibold">
                    Sin georeferencia fijada
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Card Actions */}
            <div className="mt-4 pt-2 flex gap-2">
              <button 
                onClick={() => handleEdit(client)}
                className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Editar Ficha
              </button>
              <button 
                onClick={() => {
                  window.localStorage.setItem('selected_client_id', client.id);
                  window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'designs' }));
                }}
                className="flex-1 py-2 text-[11px] font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-sm"
              >
                Elegir Modelo
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Confirmación de Eliminación de Cliente */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-800">¿Eliminar cliente?</h3>
            <p className="text-slate-600 text-sm mt-2">
              Estás a punto de eliminar al cliente <strong className="text-slate-900">{clientToDelete.nombre}</strong> (RUT: {clientToDelete.rut}).
            </p>
            <div className="mt-3 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200 space-y-1">
              <p><span className="font-bold text-slate-700">Domicilio:</span> {clientToDelete.domicilio}</p>
              {clientToDelete.rol_propiedad && <p><span className="font-bold text-slate-700">ROL SII:</span> {clientToDelete.rol_propiedad}</p>}
              <p className="text-amber-700 text-[11px] font-medium pt-1">
                Se perderán sus datos de contacto y puntos de geolocalización asociados.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                disabled={isDeletingClient}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteClient}
                disabled={isDeletingClient}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-md shadow-red-200 transition flex items-center gap-2"
              >
                {isDeletingClient ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Sí, eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientManager;