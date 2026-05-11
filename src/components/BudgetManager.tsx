import React, { useState, useEffect } from 'react';
import { Budget, BudgetItem, Client, Project } from '@/types';
import { getBudgets, saveBudget, getClients, getProjects, deleteBudget, saveProject } from '@/services/db';
import { analyzeBudgetFile } from '@/services/geminiService';
import { Plus, Save, Trash2, Calculator, Upload, Loader2, Eye, X, FileText, Search, ArrowRight } from 'lucide-react';

const BudgetManager: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null);
  const [modelName, setModelName] = useState('');
  const [showModelSave, setShowModelSave] = useState(false);
  
  const [formData, setFormData] = useState<Budget>({
    id: '', 
    cliente_id: '', 
    proyecto_id: '', 
    fecha: new Date().toISOString().split('T')[0], 
    detalle_items: [], 
    monto_total: 0,
    plazo_instalacion_dias: 30,
    lugar_suscripcion: 'Osorno'
  });

  useEffect(() => {
    // If a project is selected but no items are present, load defaults from catalog
    if (formData.proyecto_id && formData.detalle_items.length === 0) {
      const project = projects.find(p => p.id === formData.proyecto_id);
      if (project && project.especificaciones_default) {
        setFormData(prev => ({
          ...prev,
          detalle_items: project.especificaciones_default || [],
          monto_total: project.precio_base
        }));
      }
    }
  }, [formData.proyecto_id, projects]);

  // Temp item input
  const [newItem, setNewItem] = useState<BudgetItem>({
    id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0
  });

  useEffect(() => {
    setBudgets(getBudgets());
    setClients(getClients());
    setProjects(getProjects());

    // Check for pending quote from catalog
    const pendingProjectId = window.localStorage.getItem('pending_quote_project_id');
    if (pendingProjectId) {
      window.localStorage.removeItem('pending_quote_project_id');
      
      // Auto-start a new budget with this project
      const allProjects = getProjects();
      const proj = allProjects.find(p => p.id === pendingProjectId);
      
      if (proj) {
        setFormData({
            id: crypto.randomUUID(),
            cliente_id: '',
            proyecto_id: proj.id,
            fecha: new Date().toISOString().split('T')[0],
            detalle_items: proj.especificaciones_default || [],
            monto_total: proj.precio_base || 0,
            plazo_instalacion_dias: 30,
            lugar_suscripcion: 'Osorno'
        });
        setIsEditing(true);
      }
    }
  }, []);

  useEffect(() => {
    // Filter logic
    const lower = searchTerm.toLowerCase();
    const filtered = budgets.filter(b => {
        const cName = clients.find(c => c.id === b.cliente_id)?.nombre.toLowerCase() || '';
        const pName = projects.find(p => p.id === b.proyecto_id)?.modelo.toLowerCase() || '';
        return cName.includes(lower) || pName.includes(lower) || b.fecha.includes(lower);
    });
    setFilteredBudgets(filtered);
  }, [searchTerm, budgets, clients, projects]);

  const handleNew = () => {
    setFormData({
      id: crypto.randomUUID(),
      cliente_id: '',
      proyecto_id: '',
      fecha: new Date().toISOString().split('T')[0],
      detalle_items: [],
      monto_total: 0,
      plazo_instalacion_dias: 30,
      lugar_suscripcion: 'Osorno'
    });
    setIsEditing(true);
  };

  // --- File Analysis Logic ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        try {
            const jsonResult = await analyzeBudgetFile(base64Data, file.type);
            const parsed = JSON.parse(jsonResult);
            
            if (parsed.items && Array.isArray(parsed.items)) {
                const newItems: BudgetItem[] = parsed.items.map((item: any) => ({
                    id: crypto.randomUUID(),
                    descripcion: item.descripcion || "Ítem importado",
                    cantidad: Number(item.cantidad) || 1,
                    unidad: item.unidad || 'un',
                    precio_unitario: Number(item.precio_unitario) || 0,
                    total: (Number(item.cantidad) || 1) * (Number(item.precio_unitario) || 0)
                }));
                
                setFormData(prev => ({
                    ...prev,
                    detalle_items: [...prev.detalle_items, ...newItems],
                    monto_total: prev.monto_total + newItems.reduce((s, i) => s + i.total, 0)
                }));
                
                window.dispatchEvent(new CustomEvent('app-notification', { 
                    detail: { message: `Se importaron ${newItems.length} ítems con IA`, type: 'success' } 
                }));
            }
        } catch (err: any) {
            console.error("Error analyzing budget:", err);
            let userMsg = 'Error al analizar el archivo. Intente con una imagen más clara o PDF legible.';
            
            if (err.message === 'API_KEY_INVALID') {
                userMsg = 'API Key de Gemini inválida o no configurada.';
            } else if (err.message === 'QUOTA_EXCEEDED') {
                userMsg = 'Límite de cuota de IA excedido. Intente más tarde.';
            } else if (err.message?.includes('ERROR_CONFIG')) {
                userMsg = 'Configuración de IA incompleta (Falta API Key).';
            }

            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: userMsg, type: 'error' } 
            }));
        } finally {
            setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
    }
  };

  const addItem = () => {
    if (!newItem.descripcion || newItem.precio_unitario < 0) return; 
    const total = newItem.cantidad * newItem.precio_unitario;
    const itemToAdd = { ...newItem, id: crypto.randomUUID(), total };
    
    setFormData(prev => {
      const newItems = [...prev.detalle_items, itemToAdd];
      return {
        ...prev,
        detalle_items: newItems,
        monto_total: newItems.reduce((sum, i) => sum + i.total, 0)
      };
    });

    setNewItem({ id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0 });
  };

  const removeItem = (id: string) => {
    setFormData(prev => {
      const newItems = prev.detalle_items.filter(i => i.id !== id);
      return {
        ...prev,
        detalle_items: newItems,
        monto_total: newItems.reduce((sum, i) => sum + i.total, 0)
      };
    });
  };

  const handleDeleteBudget = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm('¿Estás seguro de eliminar este presupuesto?')) {
          deleteBudget(id);
          setBudgets(getBudgets());
      }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.proyecto_id) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Debe seleccionar Cliente y Proyecto', type: 'error' } 
      }));
      return;
    }
    saveBudget(formData);
    setBudgets(getBudgets());
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Presupuesto guardado correctamente', type: 'success' } 
    }));
  };

  const handleSaveAsModel = () => {
    if (!modelName) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Debe ingresar un nombre para el modelo', type: 'error' } 
      }));
      return;
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      modelo: modelName.toUpperCase(),
      superficie_m2: 0, // Should be filled or guessed
      precio_base: formData.monto_total,
      etapa: 'Cotización',
      materiales_principales: formData.detalle_items.map(i => i.descripcion).slice(0, 5),
      adicionales: [],
      especificaciones_default: formData.detalle_items.map(i => ({...i, id: crypto.randomUUID()}))
    };

    saveProject(newProject);
    setProjects(getProjects());
    setShowModelSave(false);
    setModelName('');
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Modelo "${newProject.modelo}" creado en el catálogo`, type: 'success' } 
    }));
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.nombre || 'Desconocido';
  const getProjectName = (id: string) => projects.find(p => p.id === id)?.modelo || 'Desconocido';

  if (isEditing) {
    return (
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-black flex items-center gap-2 text-slate-800">
            <Calculator className="text-orange-600" /> 
            {formData.id ? 'Editar Presupuesto' : 'Nueva Cotización Técnica'}
          </h3>
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">1</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cliente</span>
              </div>
              <div className="w-4 h-px bg-slate-200"></div>
              <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-bold">2</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cubicación</span>
              </div>
              <div className="w-4 h-px bg-slate-200"></div>
              <div className="flex items-center gap-2 opacity-50">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-[10px] flex items-center justify-center font-bold">3</div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cierre</span>
              </div>
          </div>
        </div>
        
        {/* File Upload Section */}
        <div className="mb-8 group">
            <label className={`relative block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isAnalyzing ? 'border-orange-300 bg-orange-50' : 'border-slate-300 hover:border-orange-500 hover:bg-orange-50/50'}`}>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={isAnalyzing} />
                <div className="flex flex-col items-center justify-center gap-2">
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="animate-spin text-orange-600" size={32} />
                            <p className="text-orange-700 font-medium">Analizando documento con IA...</p>
                        </>
                    ) : (
                        <>
                            <div className="bg-orange-100 p-3 rounded-full text-orange-600 mb-1 group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <p className="text-slate-700 font-medium">Arrastra o sube un presupuesto (PDF/Imagen)</p>
                            <p className="text-xs text-slate-400">La IA extraerá los ítems y precios automáticamente.</p>
                        </>
                    )}
                </div>
            </label>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
              <select required className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                <option value="">Seleccione...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proyecto Base (Modelo)</label>
              <select required className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-bold text-slate-800"
                value={formData.proyecto_id} onChange={e => {
                  const pId = e.target.value;
                  const selectedProj = projects.find(p => p.id === pId);
                  
                  let newItems = [...formData.detalle_items];
                  let newTotal = formData.monto_total;

                  if (selectedProj && selectedProj.especificaciones_default && selectedProj.especificaciones_default.length > 0) {
                    if (confirm("¿Deseas cargar las especificaciones técnicas predeterminadas de este modelo?")) {
                       const mapped = selectedProj.especificaciones_default.map(i => ({...i, id: crypto.randomUUID()}));
                       newItems = [...newItems, ...mapped];
                       newTotal = newItems.reduce((s, i) => s + i.total, 0);
                    }
                  } else if (selectedProj?.precio_base && formData.detalle_items.length === 0) {
                    newTotal = selectedProj.precio_base;
                  }

                  setFormData({
                    ...formData, 
                    proyecto_id: pId,
                    detalle_items: newItems,
                    monto_total: newTotal
                  });
                }}>
                <option value="">Seleccione Modelo...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.modelo} (${p.precio_base?.toLocaleString()})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Emisión</label>
              <input type="date" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Plazo de Instalación (Días Hábiles)</label>
              <input type="number" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.plazo_instalacion_dias} onChange={e => setFormData({...formData, plazo_instalacion_dias: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad de Suscripción</label>
              <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.lugar_suscripcion} onChange={e => setFormData({...formData, lugar_suscripcion: e.target.value})} />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <h4 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wide flex items-center gap-2">
                <FileText size={16} /> Detalle de Cubicaciones
            </h4>
            
            <div className="flex flex-wrap md:flex-nowrap gap-3 items-end mb-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex-grow min-w-[200px]">
                <label className="text-xs text-slate-500 ml-1">Ítem / Material</label>
                <input type="text" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-orange-500 outline-none" placeholder="Ej: Tablas 1x4"
                  value={newItem.descripcion} onChange={e => setNewItem({...newItem, descripcion: e.target.value})} />
              </div>
              <div className="w-24">
                <label className="text-xs text-slate-500 ml-1">Cant.</label>
                <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-orange-500 outline-none"
                  value={newItem.cantidad} onChange={e => setNewItem({...newItem, cantidad: Number(e.target.value)})} />
              </div>
              <div className="w-24">
                <label className="text-xs text-slate-500 ml-1">Unidad</label>
                <select className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-orange-500 outline-none bg-white"
                  value={newItem.unidad} onChange={e => setNewItem({...newItem, unidad: e.target.value})}>
                  <option value="un">un</option>
                  <option value="m2">m²</option>
                  <option value="m3">m³</option>
                  <option value="ml">ml</option>
                  <option value="gl">gl</option>
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs text-slate-500 ml-1">Precio Unit.</label>
                <input type="number" className="w-full p-2 border border-slate-200 rounded-lg text-sm focus:border-orange-500 outline-none"
                  value={newItem.precio_unitario} onChange={e => setNewItem({...newItem, precio_unitario: Number(e.target.value)})} />
              </div>
              <button type="button" onClick={addItem} className="bg-orange-600 text-white p-2 rounded-lg hover:bg-orange-700 h-[38px] w-[38px] flex items-center justify-center shrink-0">
                <Plus size={20} />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                    <tr>
                    <th className="p-3 text-left">Descripción</th>
                    <th className="p-3 text-right">Cant.</th>
                    <th className="p-3 text-right">Precio</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {formData.detalle_items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3">{item.descripcion}</td>
                        <td className="p-3 text-right">{item.cantidad} {item.unidad}</td>
                        <td className="p-3 text-right">${item.precio_unitario.toLocaleString()}</td>
                        <td className="p-3 text-right font-medium">${item.total.toLocaleString()}</td>
                        <td className="p-3 text-center">
                        <button type="button" onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition">
                            <Trash2 size={16} />
                        </button>
                        </td>
                    </tr>
                    ))}
                    {formData.detalle_items.length === 0 && (
                        <tr><td colSpan={5} className="p-4 text-center text-slate-400 italic">Agrega ítems manualmente o sube un archivo.</td></tr>
                    )}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr className="font-bold text-lg">
                    <td colSpan={3} className="p-4 text-right text-slate-600">TOTAL NETO</td>
                    <td className="p-4 text-right text-orange-600">${formData.monto_total.toLocaleString()}</td>
                    <td></td>
                    </tr>
                </tfoot>
                </table>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setShowModelSave(true)}
              className="px-4 py-2 text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg font-medium transition flex items-center gap-2"
            >
              <Plus size={18} /> Convertir a Nuevo Modelo
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition">Cancelar</button>
              <button type="submit" className="px-5 py-2.5 bg-orange-600 text-white rounded-lg flex items-center gap-2 hover:bg-orange-700 shadow-md transition font-medium">
                <Save size={18} /> Guardar Presupuesto
              </button>
            </div>
          </div>

          {showModelSave && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 animate-in zoom-in-95">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Guardar como Modelo de Catálogo</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre del Modelo</label>
                    <input 
                      type="text" 
                      className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Mediterránea Premium 90m2"
                      value={modelName}
                      onChange={e => setModelName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setShowModelSave(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
                    <button type="button" onClick={handleSaveAsModel} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md">Crear Modelo</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    );
  }

  // --- View Detail Modal ---
  const BudgetDetailModal = () => {
    if (!viewingBudget) return null;
    const client = clients.find(c => c.id === viewingBudget.cliente_id);
    const project = projects.find(p => p.id === viewingBudget.proyecto_id);

    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
            <div>
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={20} className="text-orange-600" /> 
                    Presupuesto #{viewingBudget.id.slice(0,6)}
                </h3>
            </div>
            <button onClick={() => setViewingBudget(null)} className="text-slate-400 hover:text-red-500 transition bg-slate-100 p-2 rounded-full">
              <X size={20} />
            </button>
          </div>
          
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Cliente</h4>
                    <p className="font-bold text-slate-800 text-lg">{client?.nombre || 'Desconocido'}</p>
                    <p className="text-sm text-slate-600">{client?.rut}</p>
                    <p className="text-sm text-slate-600 mt-1">{client?.correo}</p>
                </div>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                    <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Proyecto</h4>
                    <p className="font-bold text-slate-800 text-lg">{project?.modelo || 'Desconocido'}</p>
                    <p className="text-sm text-slate-600">Fecha Emisión: {viewingBudget.fecha}</p>
                </div>
            </div>

            <div>
                <h4 className="font-bold text-slate-700 mb-3">Ítems y Cubicaciones</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-700">
                            <tr>
                                <th className="p-3 text-left">Descripción</th>
                                <th className="p-3 text-right">Cant.</th>
                                <th className="p-3 text-right">Precio Unit.</th>
                                <th className="p-3 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewingBudget.detalle_items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="p-3">{item.descripcion}</td>
                                    <td className="p-3 text-right text-slate-500">{item.cantidad} {item.unidad}</td>
                                    <td className="p-3 text-right text-slate-500">${item.precio_unitario.toLocaleString()}</td>
                                    <td className="p-3 text-right font-medium text-slate-800">${item.total.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-orange-50/50">
                            <tr>
                                <td colSpan={3} className="p-4 text-right font-bold text-slate-700">TOTAL FINAL</td>
                                <td className="p-4 text-right font-bold text-orange-600 text-xl">
                                    ${viewingBudget.monto_total.toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <BudgetDetailModal />

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-slate-800">Presupuestos Emitidos</h3>
            <p className="text-slate-500 text-sm">Control de costos y cubicaciones por proyecto.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar presupuesto..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={handleNew} className="px-4 py-2 bg-orange-600 text-white rounded-xl flex items-center gap-2 hover:bg-orange-700 shadow-md shadow-orange-200 transition font-medium whitespace-nowrap">
                <Plus size={18} /> Nuevo
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo</th>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Monto Total</th>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ítems</th>
              <th className="p-5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {filteredBudgets.length === 0 && (
                <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                        No se encontraron presupuestos.
                    </td>
                </tr>
             )}
            {filteredBudgets.map(budget => (
              <tr 
                key={budget.id} 
                className="hover:bg-slate-50 transition cursor-pointer group"
                onClick={() => setViewingBudget(budget)}
              >
                <td className="p-5 text-sm text-slate-600 font-mono">{budget.fecha}</td>
                <td className="p-5 font-bold text-slate-800">{getClientName(budget.cliente_id)}</td>
                <td className="p-5 text-sm text-slate-600 bg-slate-50/50 rounded-lg">{getProjectName(budget.proyecto_id)}</td>
                <td className="p-5 text-right font-bold text-orange-600">${budget.monto_total.toLocaleString()}</td>
                <td className="p-5 text-center text-sm text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">{budget.detalle_items.length}</span>
                </td>
                <td className="p-5 text-center flex justify-center gap-2">
                   <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Ver Detalle">
                       <Eye size={18} />
                   </button>
                   <button 
                     onClick={(e) => handleDeleteBudget(budget.id, e)}
                     className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" 
                     title="Eliminar"
                   >
                       <Trash2 size={18} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BudgetManager;