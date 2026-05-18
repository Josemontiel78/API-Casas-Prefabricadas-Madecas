import React, { useState, useEffect } from 'react';
import { Budget, BudgetItem, Client, Project, HouseModel } from '@/types';
import { getBudgets, saveBudget, getClients, getProjects, deleteBudget, saveProject, subscribeToBudgets, subscribeToClients, subscribeToProjects, saveClient, subscribeToHouseModels } from '@/services/db';
import { analyzeBudgetFile, suggestCubicacionAI } from '@/services/gemini';
import { BudgetTable } from './budget/BudgetTable';
import { Plus, Save, Trash2, Calculator, Upload, Loader2, Eye, X, FileText, Search, ArrowRight, Maximize2, Edit3, BrainCircuit, CheckCircle } from 'lucide-react';
import { uuid } from '@/lib/utils';

const BudgetManager: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [houseModels, setHouseModels] = useState<HouseModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
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
    // Sync UI fields when a project/model is selected
    if (formData.proyecto_id) {
      const project = projects.find(p => p.id === formData.proyecto_id) || (houseModels.find(m => m.id === formData.proyecto_id) as any);
      if (project) {
        setFormData(prev => ({
          ...prev,
          superficie_m2: prev.superficie_m2 || project.superficie_m2 || 0,
          medidas_radier: prev.medidas_radier || project.medidas_radier || { largo: 0, ancho: 0 }
        }));
      }
    }
  }, [formData.proyecto_id, projects, houseModels]);

  useEffect(() => {
    // If a project is selected but no items are present, load defaults from catalog
    if (formData.proyecto_id && formData.detalle_items.length === 0) {
      const project = projects.find(p => p.id === formData.proyecto_id) || (houseModels.find(m => m.id === formData.proyecto_id) as any);
      if (project) {
        const price = project.precio_base || project.preciobase || 0;
        const houseItem: BudgetItem = {
          id: uuid(),
          descripcion: `CASA MODELO ${(project.modelo || project.nombre || '').toUpperCase()}`,
          cantidad: 1,
          unidad: 'un',
          precio_unitario: price,
          total: price
        };

        setFormData(prev => ({
          ...prev,
          detalle_items: [houseItem],
          monto_total: price,
          es_modelo_fijo: project.es_modelo_fijo,
          partidas_adicionales_permitidas: project.partidas_adicionales_permitidas
        }));
      }
    }
  }, [formData.proyecto_id, projects, houseModels]);

  // Temp item input
  const [newItem, setNewItem] = useState<BudgetItem>({
    id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0
  });

  const [isCubicando, setIsCubicando] = useState(false);

  const handleAICubicacion = async () => {
    if (!formData.proyecto_id) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: "Seleccione un modelo base para realizar la cubicación inteligente.", type: 'info' } 
        }));
        return;
    }
    
    setIsCubicando(true);
    setAnalysisStatus('Generando cubicación técnica...');
    try {
        const project = projects.find(p => p.id === formData.proyecto_id) || (houseModels.find(m => m.id === formData.proyecto_id) as any);
        const suggestedItems = await suggestCubicacionAI(
            `Casa modelo ${(project?.modelo || project?.nombre) || 'Estándar'}. ${formData.detalle_items.map(i => i.descripcion).join(', ')}`,
            formData.superficie_m2 || 50
        );
        
        if (suggestedItems && suggestedItems.length > 0) {
            const formattedItems: BudgetItem[] = suggestedItems.map((item: any) => ({
                id: uuid(),
                descripcion: item.descripcion,
                cantidad: item.cantidad,
                unidad: item.unidad,
                precio_unitario: item.precio_unitario,
                total: item.cantidad * item.precio_unitario
            }));
            
            setFormData(prev => {
                const updatedItems = [...prev.detalle_items, ...formattedItems];
                const total = updatedItems.reduce((acc, i) => acc + i.total, 0);
                return {
                    ...prev,
                    detalle_items: updatedItems,
                    monto_total: total
                };
            });
            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: "Cubicación generada con IA exitosamente.", type: 'success' } 
            }));
        }
    } catch (error) {
        console.error("Error in AI calculation", error);
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: "Error al generar cubicación con IA.", type: 'error' } 
        }));
    } finally {
        setIsCubicando(false);
        setAnalysisStatus('');
    }
  };

  useEffect(() => {
    const unsubBudgets = subscribeToBudgets((data) => setBudgets(data));
    const unsubClients = subscribeToClients((data) => setClients(data));
    const unsubProjects = subscribeToProjects((data) => setProjects(data));
    const unsubModels = subscribeToHouseModels ? (subscribeToHouseModels as any)((data: any) => setHouseModels(data)) : () => {};

    return () => {
        unsubBudgets();
        unsubClients();
        unsubProjects();
        if (typeof unsubModels === 'function') unsubModels();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        // Check for house model pre-fill from Design Gallery
        const prefillData = sessionStorage.getItem('prefill_house_model');
        const selectedClientId = window.localStorage.getItem('selected_client_id');
        const pendingClientId = window.localStorage.getItem('pending_quote_client_id');

        if (prefillData) {
          sessionStorage.removeItem('prefill_house_model');
          try {
            const model = JSON.parse(prefillData) as HouseModel;
            const newId = uuid();
            
            // The user wants to start with the base model and then add items.
            // We'll add the base model as the first item.
            const houseItem: BudgetItem = {
              id: uuid(),
              descripcion: `CASA MODELO ${model.nombre.toUpperCase()}`,
              cantidad: 1,
              unidad: 'un',
              precio_unitario: model.preciobase,
              total: model.preciobase
            };

            // Use selectedClientId if available, otherwise fallback
            const effectiveClientId = selectedClientId || pendingClientId || '';

            setFormData({
              id: newId,
              cliente_id: effectiveClientId,
              proyecto_id: model.id, 
              fecha: new Date().toISOString().split('T')[0],
              detalle_items: [houseItem],
              monto_total: model.preciobase,
              plazo_instalacion_dias: 30,
              lugar_suscripcion: 'Osorno',
              superficie_m2: model.superficie_m2,
              notas_personalizacion: `Modelo seleccionado: ${model.nombre}`
            });
            setIsEditing(true);
            
            if (selectedClientId) window.localStorage.removeItem('selected_client_id');
            if (pendingClientId) window.localStorage.removeItem('pending_quote_client_id');
          } catch (e) {
            console.error("Error parsing prefill data", e);
          }
          return;
        }

        // Check for pending quote from other sources
        const pendingProjectId = window.localStorage.getItem('pending_quote_project_id');
        const pendingCubicacion = window.localStorage.getItem('pending_cubicacion_items');
        const dashTriggerId = window.localStorage.getItem('dash_trigger_budget_id');

        if (pendingProjectId || pendingClientId || pendingCubicacion || dashTriggerId) {
            if (pendingProjectId) window.localStorage.removeItem('pending_quote_project_id');
            if (pendingClientId && !prefillData) window.localStorage.removeItem('pending_quote_client_id');
            if (pendingCubicacion) window.localStorage.removeItem('pending_cubicacion_items');
            if (dashTriggerId) window.localStorage.removeItem('dash_trigger_budget_id');
            
            if (dashTriggerId) {
                const budget = budgets.find(b => b.id === dashTriggerId);
                if (budget) {
                    setFormData({ ...budget });
                    setIsEditing(true);
                    return;
                }
            }

            const proj = pendingProjectId ? projects.find(p => p.id === pendingProjectId) : null;
            const cubicacionItems = pendingCubicacion ? JSON.parse(pendingCubicacion) : null;
            
            setFormData(prev => ({
                ...prev,
                id: uuid(),
                cliente_id: pendingClientId || '',
                proyecto_id: proj ? proj.id : '',
                fecha: new Date().toISOString().split('T')[0],
                detalle_items: cubicacionItems || (proj ? (proj.especificaciones_default || []) : []),
                monto_total: cubicacionItems ? cubicacionItems.reduce((acc: number, i: any) => acc + i.total, 0) : (proj ? (proj.precio_base || 0) : 0),
                plazo_instalacion_dias: 30,
                lugar_suscripcion: 'Osorno'
            }));
            setIsEditing(true);
        }
    }, 1000);

    return () => clearTimeout(timer);
  }, [budgets, projects]);

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
      id: uuid(),
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
    setAnalysisStatus('Subiendo archivo...');
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        
        try {
            setAnalysisStatus('Gemini está analizando las partidas (esto puede tardar 20 seg)...');
            const jsonResult = await analyzeBudgetFile(base64Data, file.type);
            setAnalysisStatus('Estructurando información...');
            
            let parsed: any = {};
            try {
                parsed = JSON.parse(jsonResult);
            } catch (e) {
                console.error("Failed to parse budget JSON:", e);
                throw new Error("Respuesta de IA no válida");
            }
            
            if (parsed && parsed.items && Array.isArray(parsed.items)) {
                const newItems: BudgetItem[] = parsed.items.map((item: any) => ({
                    id: uuid(),
                    descripcion: item.descripcion || "Ítem importado",
                    cantidad: Number(item.cantidad) || 1,
                    unidad: item.unidad || 'un',
                    precio_unitario: Number(item.precio_unitario) || 0,
                    total: (Number(item.cantidad) || 1) * (Number(item.precio_unitario) || 0)
                }));
                
                setFormData(prev => ({
                    ...prev,
                    detalle_items: [...prev.detalle_items, ...newItems],
                    monto_total: Number(prev.monto_total || 0) + newItems.reduce((s, i) => s + i.total, 0),
                    superficie_m2: Number(parsed.superficie_m2) || prev.superficie_m2
                }));
                
                setShowModelSave(true);

                window.dispatchEvent(new CustomEvent('app-notification', { 
                    detail: { message: `Se importaron ${newItems.length} ítems con IA. ¿Deseas guardar esto como un nuevo modelo?`, type: 'success' } 
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
            setAnalysisStatus('');
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
      setAnalysisStatus('');
    }
  };

  const addItem = () => {
    if (!newItem.descripcion || newItem.precio_unitario < 0) return; 
    const total = newItem.cantidad * newItem.precio_unitario;
    const itemToAdd = { ...newItem, id: uuid(), total };
    
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

  const [budgetToDelete, setBudgetToDelete] = useState<string | null>(null);

  const confirmDeleteBudget = async () => {
      if (!budgetToDelete) return;
      
      try {
          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: 'Eliminando presupuesto...', type: 'info' } 
          }));
          
          await deleteBudget(budgetToDelete);
          
          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: 'Presupuesto eliminado con éxito', type: 'success' } 
          }));
      } catch (error) {
          console.error("Error deleting budget:", error);
          window.dispatchEvent(new CustomEvent('app-notification', { 
              detail: { message: 'Error al eliminar el presupuesto', type: 'error' } 
          }));
      } finally {
          setBudgetToDelete(null);
      }
  };

  const handleDeleteBudget = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setBudgetToDelete(id);
  };

  const handleEdit = (budget: Budget, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({ ...budget });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cliente_id || !formData.proyecto_id) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Debe seleccionar Cliente y Proyecto', type: 'error' } 
      }));
      return;
    }
    
    // Save budget
    await saveBudget(formData);
    
    // Update client stage
    const client = clients.find(c => c.id === formData.cliente_id);
    if (client) {
      await saveClient({
        ...client,
        etapa_venta: formData.observaciones_negociacion ? 'Negociación' : 'Cotización'
      });
    }
    const project = projects.find(p => p.id === formData.proyecto_id);
    if (project && project.superficie_m2 === 0 && formData.superficie_m2 && formData.superficie_m2 > 0) {
      await saveProject({ ...project, superficie_m2: formData.superficie_m2 });
    }

    setIsEditing(false);
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Presupuesto guardado correctamente. Redirigiendo a contratos...', type: 'success' } 
    }));

    // Auto redirect to contracts
    window.localStorage.setItem('pending_contract_budget_id', formData.id);
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
  };

  const handleSaveAsModel = async () => {
    if (!modelName) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Debe ingresar un nombre para el modelo', type: 'error' } 
      }));
      return;
    }

    const newProject: Project = {
      id: uuid(),
      modelo: modelName.toUpperCase(),
      superficie_m2: formData.superficie_m2 || 0,
      precio_base: formData.monto_total,
      etapa: 'Cotización',
      materiales_principales: formData.detalle_items.map(i => i.descripcion).slice(0, 5),
      adicionales: [],
      especificaciones_default: formData.detalle_items.map(i => ({...i, id: uuid()}))
    };

    await saveProject(newProject);
    const updatedProjects = await getProjects();
    setProjects(updatedProjects);
    setShowModelSave(false);
    setModelName('');
    
    // Auto-select the new model for the current budget
    setFormData(prev => ({ ...prev, proyecto_id: newProject.id }));
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: `Modelo "${newProject.modelo}" creado y seleccionado`, type: 'success' } 
    }));
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.nombre || 'Desconocido';
  const getProjectName = (id: string) => {
    const proj = projects.find(p => p.id === id);
    if (proj) return proj.modelo;
    const model = houseModels.find(m => m.id === id);
    if (model) return model.nombre;
    return 'Desconocido';
  };

  const handlePrint = (budget: Budget) => {
    const client = clients.find(c => c.id === budget.cliente_id);
    const project = projects.find(p => p.id === budget.proyecto_id);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = budget.detalle_items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.descripcion}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.cantidad} ${item.unidad}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.precio_unitario.toLocaleString('es-CL')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toLocaleString('es-CL')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Presupuesto - ${client?.nombre}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 4px solid #10b981; padding-bottom: 20px; }
            .company-info h1 { margin: 0; color: #10b981; }
            .budget-info { text-align: right; }
            .details { margin-bottom: 40px; display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
            .details-box { background: #f8fafc; padding: 20px; rounded: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; }
            .total-row { font-size: 1.5em; font-weight: bold; text-align: right; }
            .footer { margin-top: 60px; font-size: 0.8em; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <h1>MADECAS PREFABRICADOS</h1>
              <p>RUT: 77.300.759-4<br>Osorno, Chile</p>
            </div>
            <div class="budget-info">
              <h2>PRESUPUESTO TÉCNICO</h2>
              <p>Nº: ${budget.id.slice(0,8).toUpperCase()}<br>Fecha: ${budget.fecha}</p>
            </div>
          </div>

          <div class="details">
            <div class="details-box">
              <strong>CLIENTE:</strong><br>
              ${client?.nombre}<br>
              RUT: ${client?.rut}<br>
              Tel: ${client?.telefono}<br>
              Email: ${client?.correo}
            </div>
            <div class="details-box">
              <strong>PROYECTO:</strong><br>
              Modelo: ${project?.modelo || 'Personalizado'}<br>
              Superficie: ${budget.superficie_m2} m²<br>
              Plazo: ${budget.plazo_instalacion_dias} días hábiles
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción de Partida</th>
                <th style="text-align: right;">Cantidad</th>
                <th style="text-align: right;">P. Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-row">
            Monto Total: $${budget.monto_total.toLocaleString('es-CL')}
          </div>

          <div class="footer">
            <p>Este presupuesto tiene una validez de 15 días. MADECAS se reserva el derecho de ajustar precios según mercado de materiales.</p>
          </div>
          
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isEditing) {
    return (
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-black flex items-center gap-2 text-slate-800">
            <Calculator className="text-orange-600" /> 
            {formData.id ? 'Editar Presupuesto' : 'Nuevo Presupuesto Técnico'}
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
        {(!formData.es_modelo_fijo || formData.partidas_adicionales_permitidas) && (
            <div className="mb-8 group">
                <label className={`relative block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isAnalyzing ? 'border-orange-300 bg-orange-50' : 'border-slate-300 hover:border-orange-500 hover:bg-orange-50/50'}`}>
                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={isAnalyzing} />
                    <div className="flex flex-col items-center justify-center gap-2">
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin text-orange-600" size={32} />
                                <p className="text-orange-700 font-medium">Analizando documento con IA...</p>
                                <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">{analysisStatus}</p>
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
        )}

        {formData.es_modelo_fijo && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                <div className="bg-emerald-600 text-white p-2 rounded-lg">
                    <CheckCircle size={20} />
                </div>
                <div>
                    <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-tighter">Modelo de Precio Fijo</h4>
                    <p className="text-xs text-emerald-700 font-medium">Este modelo tiene un valor base inamovible de acuerdo al catálogo.</p>
                </div>
                {!formData.partidas_adicionales_permitidas && (
                    <div className="ml-auto bg-slate-200 text-slate-600 text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border border-slate-300">Sin Adicionales</div>
                )}
            </div>
        )}

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
                  const selectedProj = projects.find(p => p.id === pId) || (houseModels.find(m => m.id === pId) as any);
                  
                  let newItems = [...formData.detalle_items];
                  let newTotal = formData.monto_total;

                  if (selectedProj) {
                    const name = (selectedProj.modelo || selectedProj.nombre || '').toUpperCase();
                    const price = selectedProj.precio_base || selectedProj.preciobase || 0;
                    
                    // If items are empty, add the model as the first item
                    if (newItems.length === 0) {
                      const houseItem: BudgetItem = {
                        id: uuid(),
                        descripcion: `CASA MODELO ${name}`,
                        cantidad: 1,
                        unidad: 'un',
                        precio_unitario: price,
                        total: price
                      };
                      newItems = [houseItem];
                      newTotal = price;
                    } else if (confirm(`¿Deseas reemplazar/agregar el item base por el Modelo ${name}?`)) {
                        // Check if a model item already exists and replace it, or just add
                        const existingIdx = newItems.findIndex(i => i.descripcion.includes('CASA MODELO'));
                        const newItem: BudgetItem = {
                            id: uuid(),
                            descripcion: `CASA MODELO ${name}`,
                            cantidad: 1,
                            unidad: 'un',
                            precio_unitario: price,
                            total: price
                        };
                        if (existingIdx >= 0) {
                            newItems[existingIdx] = newItem;
                        } else {
                            newItems = [newItem, ...newItems];
                        }
                        newTotal = newItems.reduce((s, i) => s + i.total, 0);
                    }
                  }

                  setFormData(prev => ({
                    ...prev, 
                    proyecto_id: pId,
                    detalle_items: newItems,
                    monto_total: newTotal,
                    superficie_m2: (selectedProj?.superficie_m2 && selectedProj.superficie_m2 > 0) 
                      ? selectedProj.superficie_m2 
                      : (prev.superficie_m2 || 0)
                  }));
                }}>
                <option value="">Seleccione Modelo...</option>
                {/* Unified list of Models from both sources */}
                {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.modelo} ({p.superficie_m2}m²) - ${p.precio_base?.toLocaleString()}</option>
                ))}
                {houseModels.filter(hm => !projects.some(p => p.modelo === hm.nombre)).map(hm => (
                    <option key={hm.id} value={hm.id}>{hm.nombre} ({hm.superficie_m2}m²) - ${hm.preciobase?.toLocaleString()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Emisión</label>
              <input type="date" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
            </div>
          </div>

          <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100">
             <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                    <Maximize2 size={16} className="text-orange-600" /> Superficie y Radier
                </h4>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">M2 del Modelo</label>
                    <input 
                        type="number" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        value={formData.superficie_m2 || 0}
                        onChange={e => setFormData({...formData, superficie_m2: Number(e.target.value)})}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Largo Radier (m)</label>
                    <input 
                        type="number" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        value={formData.medidas_radier?.largo || 0}
                        onChange={e => {
                            const largo = Number(e.target.value);
                            const ancho = formData.medidas_radier?.ancho || 0;
                            setFormData({
                                ...formData, 
                                medidas_radier: { largo, ancho },
                                superficie_m2: largo * ancho || formData.superficie_m2
                            });
                        }}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ancho Radier (m)</label>
                    <input 
                        type="number" 
                        className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                        value={formData.medidas_radier?.ancho || 0}
                        onChange={e => {
                            const ancho = Number(e.target.value);
                            const largo = formData.medidas_radier?.largo || 0;
                            setFormData({
                                ...formData, 
                                medidas_radier: { largo, ancho },
                                superficie_m2: largo * ancho || formData.superficie_m2
                            });
                        }}
                    />
                </div>
             </div>
             {formData.medidas_radier && formData.medidas_radier.largo > 0 && formData.medidas_radier.ancho > 0 && (
                 <p className="mt-2 text-xs font-medium text-orange-700 italic">
                    * Superficie calculada automáticamente: {formData.medidas_radier.largo * formData.medidas_radier.ancho} m²
                 </p>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas de Personalización (Paso 3)</label>
              <textarea 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px]"
                value={formData.notas_personalizacion || ''} 
                onChange={e => setFormData({...formData, notas_personalizacion: e.target.value})}
                placeholder="Ej: Ampliación de terraza, acabados en madera nativa..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones de Negociación (Paso 5)</label>
              <textarea 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm min-h-[80px]"
                value={formData.observaciones_negociacion || ''} 
                onChange={e => setFormData({...formData, observaciones_negociacion: e.target.value})}
                placeholder="Ej: Acuerdo de pago en 3 cuotas con 50% pie..."
              />
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <FileText size={16} /> Detalle de Cubicaciones
                </h4>
                {(!formData.es_modelo_fijo || formData.partidas_adicionales_permitidas) && (
                    <button 
                        type="button" 
                        onClick={handleAICubicacion}
                        disabled={isCubicando}
                        className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50 font-black uppercase tracking-widest shadow-lg shadow-indigo-200"
                    >
                        {isCubicando ? <Loader2 className="animate-spin" size={12} /> : <BrainCircuit size={12} />}
                        Cubicación Inteligente IA
                    </button>
                )}
            </div>
            
            {(!formData.es_modelo_fijo || formData.partidas_adicionales_permitidas) ? (
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
            ) : (
                <div className="mb-4 bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs font-bold text-amber-700 uppercase tracking-widest text-center">
                    Cubicación cerrada para este modelo de precio fijo
                </div>
            )}

            <BudgetTable 
                items={formData.detalle_items} 
                isLocked={formData.es_modelo_fijo && !formData.partidas_adicionales_permitidas} 
                onRemove={removeItem} 
            />
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

      {/* Confirmation Modal for Budget Deletion */}
      {budgetToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in zoom-in-95 duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full border border-slate-200 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h4 className="text-xl font-bold text-slate-800 mb-2">¿Eliminar Presupuesto?</h4>
            <p className="text-slate-500 text-sm mb-6">
                Esta acción no se puede deshacer. El presupuesto se eliminará permanentemente de la base de datos.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setBudgetToDelete(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteBudget}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Presupuestos</h3>
              <p className="text-slate-500 text-sm">Control de costos, cubicaciones y cupones de pago.</p>
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
                <td className="p-5 text-sm text-slate-600 bg-slate-50/50 rounded-lg">
                    {getProjectName(budget.proyecto_id)}
                    {budget.superficie_m2 ? <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">{budget.superficie_m2} m²</span> : null}
                </td>
                <td className="p-5 text-right font-bold text-orange-600">${budget.monto_total.toLocaleString()}</td>
                <td className="p-5 text-center text-sm text-slate-500">
                    <span className="bg-slate-100 px-2 py-1 rounded-full text-xs font-bold">{budget.detalle_items.length}</span>
                </td>
                <td className="p-5 text-center flex justify-center gap-2">
                   <button 
                     onClick={(e) => handleEdit(budget, e)}
                     className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" 
                     title="Editar"
                   >
                       <Edit3 size={18} />
                   </button>
                   <button 
                      onClick={(e) => { e.stopPropagation(); handlePrint(budget); }}
                      className="p-2 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition" 
                      title="Imprimir"
                    >
                        <FileText size={18} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setViewingBudget(budget); }}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" 
                      title="Ver Detalle"
                    >
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