import React, { useState, useEffect, useCallback } from 'react';
import { Client } from '@/types';
import { getClients, saveClient, deleteClient, subscribeToClients } from '@/services/db';
import { uuid, cn } from '@/lib/utils';
import { Plus, Search, Save, Users, Trash2, Phone, Mail, MapPin, Map as MapIcon, Edit3 } from 'lucide-react';
import MapProjectPicker from '@/components/MapProjectPicker';

const ClientManager: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Client>({
    id: '', nombre: '', rut: '', domicilio: '', telefono: '', correo: '', 
    vendedor_nombre: '', etapa_venta: 'Registro'
  });

  useEffect(() => {
    const unsubClients = subscribeToClients((data) => {
        setClients(data);
        setFilteredClients(data);
    });

    const timer = setTimeout(() => {
        const triggerId = window.localStorage.getItem('dash_trigger_client_id');
        const focusFields = window.localStorage.getItem('dash_focus_field');
        
        if (triggerId) {
            // Check if client is already loaded
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
        clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFilteredClients(clients.filter(c => 
        c.nombre.toLowerCase().includes(lower) || 
        c.rut.toLowerCase().includes(lower) ||
        c.correo.toLowerCase().includes(lower)
    ));
  }, [searchTerm, clients]);

  const handleNew = () => {
    setFormData({
      id: uuid(),
      nombre: '', rut: '', domicilio: '', telefono: '', correo: '',
      fecha_registro: new Date().toISOString()
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveClient(formData);
    setIsEditing(false);
    
    // Trigger notification
    const event = new CustomEvent('app-notification', { 
        detail: { message: 'Cliente guardado correctamente', type: 'success' } 
    });
    window.dispatchEvent(event);

    if (confirm("¿Deseas seleccionar un diseño para este cliente?")) {
        window.localStorage.setItem('selected_client_id', formData.id);
        window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'designs' }));
    }
  };

  const handleEdit = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormData(client);
    setIsEditing(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm('¿Estás seguro de eliminar este cliente? Se perderán sus datos de contacto.')) {
          await deleteClient(id);
          const event = new CustomEvent('app-notification', { 
            detail: { message: 'Cliente eliminado', type: 'info' } 
          });
          window.dispatchEvent(event);
      }
  };

  const handleLocationSelect = useCallback((loc: { lat: number; lng: number }) => {
    setFormData(prev => {
      // Avoid update if location is the same (to prevent infinite loops)
      if (prev.location?.lat === loc.lat && prev.location?.lng === loc.lng) return prev;
      return { ...prev, location: loc };
    });
  }, []);

  if (isEditing) {
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
            <Users className="text-emerald-600" /> 
            {formData.id ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h3>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
              <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} placeholder="Ej: Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RUT</label>
              <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})} placeholder="12.345.678-9" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Domicilio (Calle y Número, Ciudad)</label>
              <input 
                required 
                type="text" 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
                value={formData.domicilio} 
                onChange={e => setFormData({...formData, domicilio: e.target.value})} 
                placeholder="Ej: Av. Principal 123, Valdivia" 
              />
              <p className="text-[10px] text-slate-400 mt-1">El mapa inferior se sincronizará automáticamente mientras escribes.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input required type="tel" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} placeholder="+569..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
              <input type="email" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition" 
                value={formData.correo || ''} onChange={e => setFormData({...formData, correo: e.target.value})} placeholder="correo@ejemplo.com" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ejecutivo Responsable</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" 
                value={formData.vendedor_nombre || ''} onChange={e => setFormData({...formData, vendedor_nombre: e.target.value})} placeholder="Nombre del ejecutivo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Etapa del Negocio</label>
              <select className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                value={formData.etapa_venta || 'Registro'} onChange={e => setFormData({...formData, etapa_venta: e.target.value as any})}>
                <option value="Registro">1. Registro e Ingreso</option>
                <option value="Selección Modelo">2. Selección de Modelo</option>
                <option value="Personalización">3. Personalización</option>
                <option value="Cotización">4. Cotización</option>
                <option value="Negociación">5. Negociación</option>
                <option value="Cierre">6. Cierre (Contrato)</option>
                <option value="Postventa">7. Postventa</option>
              </select>
            </div>
            
            <div className="col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <MapIcon size={18} className="text-blue-600" />
                Ubicación del Proyecto (Georeferencia)
              </label>
              <div className="bg-white p-1 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <MapProjectPicker 
                  initialLocation={formData.location}
                  externalSearchQuery={formData.domicilio}
                  onLocationSelect={handleLocationSelect} 
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-2 text-center">
                Busca la ubicación exacta donde se construirá la casa para el seguimiento logístico.
              </p>
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-6 border-t border-slate-100">
            <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg flex items-center gap-2 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition font-medium">
              <Save size={18} /> Guardar Cliente
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-slate-800">Cartera de Clientes</h3>
            <p className="text-slate-500 text-sm">Gestiona la información de contacto de tus compradores.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o RUT..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={handleNew} className="px-4 py-2 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-md shadow-emerald-200 transition font-medium whitespace-nowrap">
            <Plus size={18} /> Nuevo
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredClients.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <Users size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No se encontraron clientes.</p>
          </div>
        )}
        {filteredClients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>
            
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition z-10">
                <button 
                    onClick={(e) => handleEdit(client, e)}
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                    title="Editar Cliente"
                >
                    <Edit3 size={18} /> 
                </button>
                <button 
                    onClick={(e) => handleDelete(client.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar Cliente"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            <div className="flex items-center gap-4 mb-4 relative z-0">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                <span className="font-bold text-lg">{client.nombre.charAt(0)}</span>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-lg leading-tight">{client.nombre}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{client.rut}</p>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                    client.etapa_venta === 'Cierre' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                    client.etapa_venta === 'Postventa' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                    "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    {client.etapa_venta || 'Registro'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              {client.vendedor_nombre && (
                <div className="flex items-center gap-3 text-[10px] font-bold text-indigo-600 mb-1">
                   <Users size={12} /> Ejecutivo: {client.vendedor_nombre}
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-slate-600">
                 <Phone size={14} className="text-slate-400" /> {client.telefono}
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                 <Mail size={14} className="text-slate-400" /> <span className="truncate">{client.correo}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                 <MapPin size={14} className="text-slate-400 shrink-0" /> 
                 <span className="truncate">{client.domicilio}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button 
                  onClick={() => handleEdit(client)}
                  className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                >
                    Editar Datos
                </button>
                <button 
                  onClick={() => {
                    window.localStorage.setItem('selected_client_id', client.id);
                    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'designs' }));
                  }}
                  className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                    Elegir Diseño
                </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientManager;