import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  Upload, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  ArrowRight,
  FileText,
  ImageIcon,
  Loader2,
  X,
  CreditCard,
  Maximize2,
  Calculator,
  BedDouble,
  Bath,
  CheckCircle2,
  Gift,
  Sliders,
  DollarSign,
  Tag,
  Layers
} from 'lucide-react';
import { HouseModel, BudgetItem, Client, CombinedModelModule } from '@/types';
import { subscribeToHouseModels, saveHouseModel, deleteHouseModel, getClients, saveClient } from '@/services/db';
import { analyzeHouseModelFile } from '@/services/gemini';
import { uuid, compressImage, cn } from '@/lib/utils';
import { 
  DEFAULT_VALOR_M2_BASE, 
  MADECAS_PROMO_THRESHOLD_M2, 
  MADECAS_PROMO_TEXT, 
  MADECAS_PACK_BASICO_SPECS 
} from '@/constants/catalog';

const PRESET_VALORES_M2 = [
  { label: 'Económico', valor: 175000 },
  { label: 'Estándar Madecas', valor: 195000 },
  { label: 'Terminación Superior', valor: 220000 }
];

const CATEGORIAS_MODELOS = [
  'Todos',
  'Básico 2 Aguas',
  'Básico 4 Aguas',
  'Contemporáneo',
  'Premium',
  'Básico 6 Aguas'
];

const DesignGallery: React.FC = () => {
  const [models, setModels] = useState<HouseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentModel, setCurrentModel] = useState<Partial<HouseModel> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedFile, setSelectedFile] = useState<{base64: string, type: string} | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Dynamic Pricing State: calculated by m2 * valor_m2
  const [globalValorM2, setGlobalValorM2] = useState<number>(DEFAULT_VALOR_M2_BASE);
  const [customRatesPerModel, setCustomRatesPerModel] = useState<Record<string, number>>({});
  const [viewingModel, setViewingModel] = useState<HouseModel | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToHouseModels((data) => {
      setModels(data);
      setLoading(false);
    });

    // Check for selected client context from ClientManager
    const clientId = window.localStorage.getItem('selected_client_id');
    if (clientId) {
      getClients().then(allClients => {
        const client = allClients.find(c => c.id === clientId);
        if (client) setSelectedClient(client);
      });
    }

    return () => unsubscribe();
  }, []);

  const getModelRate = (model: HouseModel): number => {
    if (customRatesPerModel[model.id]) return customRatesPerModel[model.id];
    if (model.valor_m2_sugerido && model.valor_m2_sugerido > 0) return model.valor_m2_sugerido;
    return globalValorM2;
  };

  const handleModelRateChange = (modelId: string, newRate: number) => {
    setCustomRatesPerModel(prev => ({
      ...prev,
      [modelId]: Math.max(0, newRate)
    }));
  };

  const calculateTotalBase = (model: HouseModel): number => {
    const rate = getModelRate(model);
    return Math.round(model.superficie_m2 * rate);
  };

  const handleCreateNew = () => {
    setCurrentModel({
      id: uuid(),
      nombre: '',
      descripcion: '',
      superficie_m2: 36,
      preciobase: 0,
      valor_m2_sugerido: globalValorM2,
      categoria: 'Contemporáneo',
      dormitorios: '2 a 3 dormitorios',
      banos: 1,
      especificaciones: [],
      caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
      fecha_creacion: new Date().toISOString(),
      vendedor_id: 'public'
    });
    setIsEditing(true);
  };

  const handleEdit = (model: HouseModel) => {
    setCurrentModel(model);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este diseño del catálogo?')) {
      await deleteHouseModel(id);
    }
  };

  const handleSave = async () => {
    if (currentModel && currentModel.id) {
      try {
        setAnalyzing(true);
        setAnalysisStatus('Guardando cambios en catálogo...');
        
        const modelToSave: HouseModel = {
          id: currentModel.id,
          nombre: currentModel.nombre || 'Modelo Sin Nombre',
          descripcion: currentModel.descripcion || '',
          superficie_m2: Number(currentModel.superficie_m2) || 36,
          preciobase: 0, // Not hardcoded; calculated dynamically
          valor_m2_sugerido: Number(currentModel.valor_m2_sugerido) || globalValorM2,
          categoria: currentModel.categoria || 'Contemporáneo',
          dormitorios: currentModel.dormitorios || '2 dormitorios',
          banos: Number(currentModel.banos) || 1,
          imagen_url: currentModel.imagen_url || '',
          especificaciones: currentModel.especificaciones || [],
          caracteristicas_pack_basico: currentModel.caracteristicas_pack_basico || MADECAS_PACK_BASICO_SPECS,
          fecha_creacion: currentModel.fecha_creacion || new Date().toISOString()
        };

        await saveHouseModel(modelToSave);
        setIsEditing(false);
        setCurrentModel(null);
        setSelectedFile(null);
        setPreviewImage(null);
        setAnalyzing(false);
        
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Diseño guardado correctamente en el catálogo', type: 'success' } 
        }));
      } catch (error) {
        console.error("Error saving model:", error);
        setAnalyzing(false);
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Error al actualizar el catálogo', type: 'error' } 
        }));
      }
    }
  };

  const startBudget = async (model: HouseModel) => {
    const rate = getModelRate(model);
    const calculatedTotal = calculateTotalBase(model);

    const modelForBudget: HouseModel = {
      ...model,
      preciobase: calculatedTotal,
      valor_m2_sugerido: rate
    };

    if (selectedClient) {
      const updatedClient: Client = {
        ...selectedClient,
        etapa_venta: 'Personalización'
      };
      await saveClient(updatedClient);
      window.localStorage.setItem('pending_quote_client_id', selectedClient.id);
      window.localStorage.removeItem('selected_client_id');
    }

    sessionStorage.setItem('prefill_house_model', JSON.stringify(modelForBudget));
    sessionStorage.setItem('prefill_valor_m2', rate.toString());
    sessionStorage.setItem('prefill_superficie_m2', model.superficie_m2.toString());
    sessionStorage.setItem('prefill_monto_base', calculatedTotal.toString());

    // Switch view to budgets
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }));
  };

  // Multi-model combination logic
  const [combinationCart, setCombinationCart] = useState<HouseModel[]>([]);

  const toggleModelInCombination = (model: HouseModel) => {
    setCombinationCart(prev => {
      const exists = prev.some(m => m.id === model.id);
      if (exists) {
        return prev.filter(m => m.id !== model.id);
      } else {
        return [...prev, model];
      }
    });
  };

  const startCombinedBudget = async () => {
    if (combinationCart.length === 0) return;

    if (selectedClient) {
      const updatedClient: Client = {
        ...selectedClient,
        etapa_venta: 'Personalización'
      };
      await saveClient(updatedClient);
      window.localStorage.setItem('pending_quote_client_id', selectedClient.id);
      window.localStorage.removeItem('selected_client_id');
    }

    const modules: CombinedModelModule[] = combinationCart.map((m, idx) => {
      const rate = getModelRate(m);
      const subtotal = Math.round(m.superficie_m2 * rate);
      let defaultRol = 'Principal';
      if (idx === 1) defaultRol = 'Cabaña / Módulo 2';
      else if (idx > 1) defaultRol = `Módulo ${idx + 1}`;

      return {
        id: uuid(),
        model_id: m.id,
        nombre: m.nombre,
        superficie_m2: m.superficie_m2,
        valor_m2: rate,
        subtotal,
        rol: defaultRol,
        categoria: m.categoria,
        imagen_url: m.imagen_url
      };
    });

    sessionStorage.removeItem('prefill_house_model');
    sessionStorage.setItem('prefill_combined_models', JSON.stringify(modules));

    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }));
  };

  const filteredModels = useMemo(() => {
    return models.filter(m => {
      const matchesSearch = 
        m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.categoria && m.categoria.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat = selectedCategory === 'Todos' || m.categoria === selectedCategory;

      return matchesSearch && matchesCat;
    });
  }, [models, searchTerm, selectedCategory]);

  const handlePrintModel = (model: HouseModel) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rate = getModelRate(model);
    const total = calculateTotalBase(model);

    printWindow.document.write(`
      <html>
        <head>
          <title>Ficha Técnica Comercial - ${model.nombre}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; color: #059669; font-size: 24px; text-transform: uppercase; }
            .header p { margin: 4px 0 0; font-size: 11px; color: #64748b; font-weight: bold; }
            .hero-img { width: 100%; max-height: 380px; object-fit: cover; border-radius: 16px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
            .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; }
            .box { background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
            .box h3 { margin-top: 0; font-size: 14px; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; }
            ul { padding-left: 18px; font-size: 12px; line-height: 1.6; }
            .calc-box { background: #ecfdf5; border: 1.5px solid #10b981; padding: 18px; border-radius: 12px; margin-top: 15px; }
            .calc-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
            .calc-total { border-top: 2px solid #059669; padding-top: 8px; margin-top: 8px; font-size: 16px; font-weight: 800; color: #065f46; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${model.nombre}</h1>
              <p>CATÁLOGO DE MODELOS PREFABRICADOS MADECAS • OSORNO / PURRANQUE</p>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b;">
              Fecha: ${new Date().toLocaleDateString('es-CL')}
            </div>
          </div>

          ${model.imagen_url ? `<img src="${model.imagen_url}" class="hero-img" />` : ''}

          <div class="grid">
            <div class="box">
              <h3>Descripción y Distribución</h3>
              <p style="font-size: 13px; line-height: 1.6; color: #334155;">${model.descripcion}</p>
              
              <h3>Características del Pack Básico Incluido</h3>
              <ul>
                ${(model.caracteristicas_pack_basico || MADECAS_PACK_BASICO_SPECS).map(s => `<li>${s}</li>`).join('')}
              </ul>

              ${model.superficie_m2 >= MADECAS_PROMO_THRESHOLD_M2 ? `
                <div style="background: #fffbeb; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; font-size: 12px; color: #854d0e; font-weight: bold; margin-top: 15px;">
                  🎁 PROMO INCLUIDA: Todas las casas de 66 m² o más se entregan pintadas con impregnante antihongos y repelente (color a elección) sin costo.
                </div>
              ` : ''}
            </div>

            <div class="box">
              <h3>Cálculo Comercial Estimado</h3>
              <p style="font-size: 12px; margin-bottom: 5px;"><strong>Superficie Construida:</strong> ${model.superficie_m2} m²</p>
              <p style="font-size: 12px; margin-bottom: 5px;"><strong>Categoría:</strong> ${model.categoria || 'Estándar'}</p>
              <p style="font-size: 12px; margin-bottom: 15px;"><strong>Distribución:</strong> ${model.dormitorios || '2 dorm.'} • ${model.banos || 1} baño(s)</p>

              <div class="calc-box">
                <div class="calc-row">
                  <span>Metros Cuadrados:</span>
                  <strong>${model.superficie_m2} m²</strong>
                </div>
                <div class="calc-row">
                  <span>Valor estimado por m²:</span>
                  <strong>$${rate.toLocaleString('es-CL')} CLP</strong>
                </div>
                <div class="calc-total">
                  <span>Total Base Estimado:</span>
                  <span>$${total.toLocaleString('es-CL')} CLP</span>
                </div>
              </div>
              <p style="font-size: 10px; color: #64748b; margin-top: 10px; text-align: center;">
                *El valor final se complementa según los mejoramientos adicionales y partidas seleccionadas en la cotización.
              </p>
            </div>
          </div>

          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const ModelDetailModal = () => {
    if (!viewingModel) return null;
    const rate = getModelRate(viewingModel);
    const total = calculateTotalBase(viewingModel);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewingModel(null)} />
        <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 p-6 md:p-8 border border-slate-100">
          <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-emerald-200">
                {viewingModel.categoria || 'Modelo Madecas'}
              </span>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mt-1">{viewingModel.nombre}</h2>
            </div>
            <button onClick={() => setViewingModel(null)} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-video bg-slate-100 relative">
                {viewingModel.imagen_url ? (
                  <img src={viewingModel.imagen_url} alt={viewingModel.nombre} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon size={60} />
                  </div>
                )}
              </div>

              {/* Dynamic Price Box */}
              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                    <Calculator size={16} className="text-emerald-700" />
                    Cálculo Dinámico por m²
                  </span>
                  <span className="text-xs font-black text-emerald-700">{viewingModel.superficie_m2} m²</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-600 font-medium">Valor por metro:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">$</span>
                    <input
                      type="number"
                      value={rate}
                      onChange={(e) => handleModelRateChange(viewingModel.id, Number(e.target.value))}
                      className="w-full pl-6 pr-2 py-1.5 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-emerald-200">
                  <span className="text-xs font-bold text-slate-700">Total Modelo Base:</span>
                  <span className="text-2xl font-black text-emerald-700">
                    ${total.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-500">CLP</span>
                  </span>
                </div>
              </div>

              {viewingModel.superficie_m2 >= MADECAS_PROMO_THRESHOLD_M2 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-start gap-2 text-xs text-amber-900 font-medium">
                  <Gift size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{MADECAS_PROMO_TEXT}</span>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción de la Vivienda</h4>
                <p className="text-slate-600 text-sm leading-relaxed">{viewingModel.descripcion || 'Sin descripción detallada.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Distribución</span>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <BedDouble size={14} className="text-slate-500" />
                    {viewingModel.dormitorios || '2 dormitorios'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Baños</span>
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                    <Bath size={14} className="text-slate-500" />
                    {viewingModel.banos || 1} Baño(s)
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Características Pack Básico Incluidas</h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(viewingModel.caracteristicas_pack_basico || MADECAS_PACK_BASICO_SPECS).map((spec, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                <button
                  onClick={() => handlePrintModel(viewingModel)}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <FileText size={15} />
                  <span>Ficha PDF</span>
                </button>
                <button
                  onClick={() => toggleModelInCombination(viewingModel)}
                  className={cn(
                    "px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition border",
                    combinationCart.some(m => m.id === viewingModel.id)
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-1 ring-emerald-400"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <Layers size={15} />
                  <span>{combinationCart.some(m => m.id === viewingModel.id) ? '✓ En Combinación' : '+ Combinar con otros'}</span>
                </button>
                <button 
                  onClick={() => startBudget(viewingModel)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-200 transition"
                >
                  <span>Personalizar y Cotizar</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ImagePreviewModal = () => {
    if (!previewImage) return null;
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" onClick={() => setPreviewImage(null)} />
        <div className="relative z-[210] max-w-5xl max-h-[90vh] w-full flex items-center justify-center p-2" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20" />
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <ImagePreviewModal />
      <ModelDetailModal />

      {/* Active Client Selection Banner */}
      {selectedClient && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md border border-emerald-500 flex items-center justify-between animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <CheckCircle2 size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-100">Paso 2: Selección de Modelo para Cliente Activo</p>
              <h4 className="text-lg font-bold">{selectedClient.nombre} <span className="text-xs font-normal opacity-80">(RUT: {selectedClient.rut})</span></h4>
            </div>
          </div>
          <button 
            onClick={() => {
              window.localStorage.removeItem('selected_client_id');
              setSelectedClient(null);
            }}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition"
          >
            Cambiar Cliente
          </button>
        </div>
      )}

      {/* Header & Global M2 Rate Configuration */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Home className="text-emerald-600" />
              Diseños y Modelos de Casas Prefabricadas
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-1">
              Catálogo oficial Madecas 2025. Los valores se calculan dinámicamente por metro cuadrado (m² × valor/m²).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleCreateNew}
              className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-slate-800 transition shadow-sm"
            >
              <Plus size={16} />
              <span>Agregar Nuevo Modelo</span>
            </button>
          </div>
        </div>

        {/* Global Value per m2 Control Bar */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-emerald-600" />
            <div>
              <span className="text-xs font-bold text-slate-800">Tarifa Base por Metro Cuadrado:</span>
              <p className="text-[11px] text-slate-500">Ajusta el valor por m² para cotizar los modelos de inmediato.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-sm">
              <span className="text-xs font-bold text-slate-400 mr-1">$</span>
              <input
                type="number"
                value={globalValorM2}
                onChange={(e) => setGlobalValorM2(Math.max(1, Number(e.target.value)))}
                className="w-28 text-xs font-bold text-slate-800 outline-none"
              />
              <span className="text-[11px] font-bold text-slate-400">/ m²</span>
            </div>

            <div className="flex items-center gap-1">
              {PRESET_VALORES_M2.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setGlobalValorM2(preset.valor)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition",
                    globalValorM2 === preset.valor 
                      ? "bg-emerald-600 text-white shadow-sm" 
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {preset.label} (${(preset.valor / 1000).toFixed(0)}k)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {CATEGORIAS_MODELOS.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap",
                  selectedCategory === cat 
                    ? "bg-slate-900 text-white shadow-sm" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre o m²..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredModels.map(model => {
          const rate = getModelRate(model);
          const total = calculateTotalBase(model);
          const hasPromo = model.superficie_m2 >= MADECAS_PROMO_THRESHOLD_M2;

          return (
            <div 
              key={model.id}
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group relative"
            >
              {/* Image & Quick Overlays */}
              <div className="h-56 bg-slate-100 relative overflow-hidden">
                {model.imagen_url ? (
                  <div className="h-full w-full cursor-pointer relative" onClick={() => setPreviewImage(model.imagen_url!)}>
                    <img 
                      src={model.imagen_url} 
                      alt={model.nombre} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="text-white" size={24} />
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                    <ImageIcon size={48} />
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-2">Sin Imagen</span>
                  </div>
                )}

                {/* Top Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                  <span className="bg-slate-900/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg font-black text-xs shadow-sm">
                    {model.superficie_m2} m²
                  </span>
                  {hasPromo && (
                    <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md font-extrabold text-[10px] shadow-sm flex items-center gap-1">
                      <Gift size={11} /> Promo Pintura Gratis
                    </span>
                  )}
                </div>

                {/* Top Right Quick Actions */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-xl shadow-sm">
                  <button 
                    onClick={() => setViewingModel(model)}
                    className="p-1.5 text-slate-600 hover:text-emerald-600 rounded-lg transition"
                    title="Ver Ficha Detallada"
                  >
                    <FileText size={15} />
                  </button>
                  <button 
                    onClick={() => handlePrintModel(model)}
                    className="p-1.5 text-slate-600 hover:text-blue-600 rounded-lg transition"
                    title="Imprimir Ficha Técnica"
                  >
                    <CreditCard size={15} />
                  </button>
                  <button 
                    onClick={() => handleEdit(model)}
                    className="p-1.5 text-slate-600 hover:text-amber-600 rounded-lg transition"
                    title="Editar Modelo"
                  >
                    <Edit3 size={15} />
                  </button>
                  <button 
                    onClick={() => handleDelete(model.id)}
                    className="p-1.5 text-slate-600 hover:text-red-600 rounded-lg transition"
                    title="Eliminar Modelo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">
                      {model.categoria || 'Modelo Madecas'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {model.dormitorios || '2 dorm.'} • {model.banos || 1} baño
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-800 leading-tight group-hover:text-emerald-700 transition">
                    {model.nombre}
                  </h3>
                  
                  <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                    {model.descripcion || 'Sin descripción detallada.'}
                  </p>
                </div>

                {/* Dynamic Price Calculation Box */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Valor Estimado m²</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-700">${rate.toLocaleString('es-CL')}</span>
                      <span className="text-[10px] text-slate-400">/m²</span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Total Base:</span>
                      <p className="text-[10px] text-slate-400">{model.superficie_m2} m² × ${rate.toLocaleString()}</p>
                    </div>
                    <span className="text-lg font-black text-emerald-700">
                      ${total.toLocaleString('es-CL')} <span className="text-[10px] font-normal text-slate-500">CLP</span>
                    </span>
                  </div>
                </div>

                {/* Actions: Cotizar o Combinar con otros modelos */}
                <div className="flex gap-2 pt-1">
                  <button 
                    onClick={() => startBudget(model)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-200 transition"
                  >
                    <span>Cotizar</span>
                    <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => toggleModelInCombination(model)}
                    title={combinationCart.some(m => m.id === model.id) ? 'Quitar de la combinación' : 'Combinar con otros modelos'}
                    className={cn(
                      "px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition border",
                      combinationCart.some(m => m.id === model.id)
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                    )}
                  >
                    <Layers size={14} />
                    <span>{combinationCart.some(m => m.id === model.id) ? '✓ Combinado' : '+ Combinar'}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor Modal for Adding / Editing House Models */}
      <AnimatePresence>
        {isEditing && currentModel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
            <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl relative z-10 p-6 md:p-8 border border-slate-200 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-xl font-black text-slate-800">
                  {currentModel.id && models.some(m => m.id === currentModel.id) ? 'Editar Modelo' : 'Nuevo Modelo de Casa'}
                </h3>
                <button onClick={() => setIsEditing(false)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Nombre del Modelo *</label>
                  <input
                    type="text"
                    required
                    value={currentModel.nombre || ''}
                    onChange={(e) => setCurrentModel({ ...currentModel, nombre: e.target.value })}
                    placeholder="Ej: Casa 54 m² Modelo Contemporáneo"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Superficie (m²) *</label>
                    <input
                      type="number"
                      required
                      value={currentModel.superficie_m2 || 36}
                      onChange={(e) => setCurrentModel({ ...currentModel, superficie_m2: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Valor por m² Sugerido</label>
                    <input
                      type="number"
                      value={currentModel.valor_m2_sugerido || globalValorM2}
                      onChange={(e) => setCurrentModel({ ...currentModel, valor_m2_sugerido: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Categoría</label>
                    <select
                      value={currentModel.categoria || 'Contemporáneo'}
                      onChange={(e) => setCurrentModel({ ...currentModel, categoria: e.target.value })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Básico 2 Aguas">Básico 2 Aguas</option>
                      <option value="Básico 4 Aguas">Básico 4 Aguas</option>
                      <option value="Contemporáneo">Contemporáneo</option>
                      <option value="Premium">Premium</option>
                      <option value="Básico 6 Aguas">Básico 6 Aguas</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Dormitorios</label>
                    <input
                      type="text"
                      value={currentModel.dormitorios || ''}
                      onChange={(e) => setCurrentModel({ ...currentModel, dormitorios: e.target.value })}
                      placeholder="Ej: 2 a 3 dormitorios"
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Baños</label>
                    <input
                      type="number"
                      value={currentModel.banos || 1}
                      onChange={(e) => setCurrentModel({ ...currentModel, banos: Number(e.target.value) })}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Descripción Comercial</label>
                  <textarea
                    rows={3}
                    value={currentModel.descripcion || ''}
                    onChange={(e) => setCurrentModel({ ...currentModel, descripcion: e.target.value })}
                    placeholder="Detalla la arquitectura, características y distribución..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">URL de Imagen del Modelo</label>
                  <input
                    type="text"
                    value={currentModel.imagen_url || ''}
                    onChange={(e) => setCurrentModel({ ...currentModel, imagen_url: e.target.value })}
                    placeholder="/assets/aistudio/... o https://..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
                >
                  Guardar Modelo
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Multi-Model Combination Tray */}
      {combinationCart.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl bg-slate-900/95 backdrop-blur-md text-white p-4 sm:p-5 rounded-2xl shadow-2xl border border-emerald-500/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in slide-in-from-bottom-6 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-900 flex items-center justify-center font-black shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Combinación de {combinationCart.length} Modelos Seleccionada
                </span>
                <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                  {combinationCart.reduce((sum, m) => sum + m.superficie_m2, 0)} m² Totales
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                {combinationCart.map((m, idx) => `Módulo ${idx + 1}: ${m.nombre} (${m.superficie_m2}m²)`).join(' + ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCombinationCart([])}
              className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition"
            >
              Vaciar
            </button>
            <button
              onClick={startCombinedBudget}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
            >
              <span>Cotizar Combinación ({combinationCart.reduce((s, m) => s + m.superficie_m2, 0)} m²)</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignGallery;
