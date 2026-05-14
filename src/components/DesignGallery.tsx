import React, { useState, useEffect } from 'react';
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
  CreditCard
} from 'lucide-react';
import { HouseModel, BudgetItem } from '@/types';
import { subscribeToHouseModels, saveHouseModel, deleteHouseModel } from '@/services/db';
import { analyzeHouseModelFile } from '@/services/gemini';

const uuid = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    }
};

const DesignGallery: React.FC = () => {
  const [models, setModels] = useState<HouseModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentModel, setCurrentModel] = useState<Partial<HouseModel> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToHouseModels((data) => {
      setModels(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCreateNew = () => {
    setCurrentModel({
      id: uuid(),
      nombre: '',
      descripcion: '',
      superficie_m2: 0,
      preciobase: 0,
      especificaciones: [],
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
    if (confirm('¿Estás seguro de eliminar este diseño?')) {
      await deleteHouseModel(id);
    }
  };

  const handleSave = async () => {
    if (currentModel && currentModel.id) {
      await saveHouseModel(currentModel as HouseModel);
      setIsEditing(false);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Diseño guardado correctamente', type: 'success' } 
      }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzing(true);
    setAnalysisStatus('Subiendo archivo...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        setAnalysisStatus('Gemini está analizando la ficha técnica...');
        const extractedData = await analyzeHouseModelFile(base64, file.type);
        setAnalysisStatus('Finalizando extracción...');
        
        // Ensure especificaciones is an array to prevent crashes
        const safeData = {
          ...extractedData,
          especificaciones: Array.isArray(extractedData.especificaciones) ? extractedData.especificaciones : []
        };
        
        setCurrentModel(prev => ({
          ...prev,
          ...safeData,
          imagen_url: file.type.startsWith('image/') ? reader.result as string : prev?.imagen_url
        }));
        
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'Datos extraídos con éxito mediante IA', type: 'success' } 
        }));
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Error al analizar el archivo', type: 'error' } 
      }));
    } finally {
      setAnalyzing(false);
      setAnalysisStatus('');
    }
  };

  const filteredModels = models.filter(m => 
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.descripcion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startBudget = (model: HouseModel) => {
    // Dispatch event to change view to budgets and pass the selected model
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }));
    // Store in session or local storage to pre-fill
    sessionStorage.setItem('prefill_house_model', JSON.stringify(model));
  };

  const handlePrintModel = (model: HouseModel) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const specsHtml = (model.especificaciones || []).map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.descripcion}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.cantidad} ${item.unidad}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">$${item.precio_unitario.toLocaleString('es-CL')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Ficha Técnica - ${model.nombre}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { border-bottom: 4px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; }
            .model-info h1 { margin: 0; color: #10b981; text-transform: uppercase; font-style: italic; }
            .hero-img { width: 100%; max-height: 400px; object-fit: cover; border-radius: 20px; margin-bottom: 30px; }
            .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 40px; }
            .box { background: #f8fafc; padding: 25px; border-radius: 15px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f1f5f9; padding: 10px; text-align: left; }
            .total { font-size: 1.8em; font-weight: bold; color: #10b981; margin-top: 20px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="model-info">
              <h1>${model.nombre}</h1>
              <p>CATÁLOGO DE DISEÑOS MADECAS</p>
            </div>
          </div>

          ${model.imagen_url ? `<img src="${model.imagen_url}" class="hero-img" />` : ''}

          <div class="grid">
            <div class="box">
              <h3>Descripción General</h3>
              <p>${model.descripcion || 'Sin descripción.'}</p>
              
              <h3>Especificaciones Técnicas</h3>
              <table>
                <thead>
                  <tr>
                    <th>Partida</th>
                    <th style="text-align: right;">Cant/Un</th>
                    <th style="text-align: right;">Unitario</th>
                  </tr>
                </thead>
                <tbody>
                  ${specsHtml}
                </tbody>
              </table>
            </div>
            <div class="box">
              <h3>Detalles Base</h3>
              <p><strong>Superficie:</strong> ${model.superficie_m2} m²</p>
              <p><strong>Actualizado:</strong> ${new Date(model.fecha_creacion).toLocaleDateString()}</p>
              
              <div class="total">
                VALOR VENTA BASE:<br>
                $${model.preciobase.toLocaleString('es-CL')}
              </div>
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

  const [viewingModel, setViewingModel] = useState<HouseModel | null>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
      </div>
    );
  }

  const ModelDetailModal = () => {
    if (!viewingModel) return null;
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingModel(null)} />
        <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl relative z-10 p-10 border border-slate-100">
           <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">{viewingModel.nombre}</h2>
              <button onClick={() => setViewingModel(null)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl">
                 {viewingModel.imagen_url ? (
                   <img src={viewingModel.imagen_url} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full aspect-square bg-slate-50 flex items-center justify-center text-slate-300">
                      <ImageIcon size={100} />
                   </div>
                 )}
              </div>
              <div className="space-y-6">
                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Descripción General</h4>
                    <p className="text-slate-600 leading-relaxed">{viewingModel.descripcion || 'Sin descripción.'}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase">Superficie</p>
                       <p className="text-xl font-black text-slate-800">{viewingModel.superficie_m2} m²</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                       <p className="text-[10px] font-black text-emerald-400 uppercase">Precio Base</p>
                       <p className="text-xl font-black text-emerald-600">${viewingModel.preciobase.toLocaleString()}</p>
                    </div>
                 </div>
                 <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Especificaciones Destacadas</h4>
                    <div className="space-y-2">
                       {viewingModel.especificaciones?.slice(0, 8).map((spec, i) => (
                         <div key={i} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="font-bold text-slate-700 italic">{spec.descripcion}</span>
                            <span className="text-emerald-600 font-black">${spec.precio_unitario.toLocaleString()}</span>
                         </div>
                       ))}
                    </div>
                 </div>
                 <button 
                   onClick={() => startBudget(viewingModel)}
                   className="w-full py-5 bg-emerald-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-xl shadow-emerald-100 hover:bg-emerald-600 transition-all"
                 >
                    Continuar a Presupuesto
                 </button>
              </div>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 p-4 max-w-7xl mx-auto font-sans">
      <ModelDetailModal />
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic flex items-center gap-3">
            <Home className="text-emerald-500" />
            Galería de Diseños
          </h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2 flex items-center gap-2">
            Modelos de Casas Prefabricadas y Catálogo
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar modelos..." 
              className="pl-12 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 focus:border-emerald-500 outline-none w-64 transition-all font-medium text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={handleCreateNew}
            className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            <Plus size={18} />
            Nuevo Diseño
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredModels.map(model => (
          <motion.div 
            key={model.id}
            layoutId={model.id}
            className="bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-xl hover:shadow-2xl transition-all group relative"
          >
            <div className="h-64 bg-slate-100 relative overflow-hidden">
              {model.imagen_url ? (
                <img src={model.imagen_url} alt={model.nombre} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                  <ImageIcon size={60} />
                  <span className="text-xs font-black uppercase tracking-widest mt-4">Sin Imagen Principal</span>
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); setViewingModel(model); }}
                  className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-slate-600 hover:text-emerald-600 transition-colors shadow-lg"
                  title="Ver Detalle"
                >
                  <FileText size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrintModel(model); }}
                  className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-slate-600 hover:text-orange-600 transition-colors shadow-lg"
                  title="Imprimir"
                >
                  <CreditCard size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEdit(model); }}
                  className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-slate-600 hover:text-emerald-600 transition-colors shadow-lg"
                >
                  <Edit3 size={18} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(model.id); }}
                  className="p-3 bg-white/90 backdrop-blur-md rounded-2xl text-slate-600 hover:text-rose-600 transition-colors shadow-lg"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="absolute bottom-4 left-4">
                <div className="bg-emerald-500 text-white px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">
                  {model.superficie_m2} m²
                </div>
              </div>
            </div>

            <div className="p-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-tight mb-2 group-hover:text-emerald-600 transition-colors uppercase italic">{model.nombre}</h3>
              <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-6 leading-relaxed">
                {model.descripcion || 'Sin descripción detallada disponible para este modelo.'}
              </p>

              <div className="flex flex-col gap-4 border-t border-slate-50 pt-6">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Inversión Base</span>
                  <span className="text-xl font-black text-slate-800">
                    ${model.preciobase.toLocaleString('es-CL')}
                  </span>
                </div>
                
                <button 
                  onClick={() => startBudget(model)}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all active:scale-[0.98] shadow-lg shadow-emerald-100"
                >
                  Continuar a Presupuesto
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditing && currentModel && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[3rem] shadow-2xl relative z-10 flex flex-col md:flex-row border border-slate-100"
            >
              {/* Left Side: Upload & Media */}
              <div className="w-full md:w-2/5 bg-slate-50 p-10 flex flex-col gap-8 border-r border-slate-100">
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tighter">Documentación & IA</h3>
                  <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase">Sube el PDF o Imagen de las especificaciones y deja que la IA extraiga los datos automáticamente.</p>
                </div>

                <div className="group relative aspect-square bg-white rounded-[2rem] border-4 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 text-center transition-all hover:border-emerald-400 hover:bg-emerald-50 group">
                  {analyzing ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="animate-spin text-emerald-500 mb-4" size={48} />
                      <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Analizando...</span>
                      <span className="text-[10px] text-emerald-400 font-bold uppercase mt-2">{analysisStatus}</span>
                    </div>
                  ) : currentModel.imagen_url ? (
                    <img src={currentModel.imagen_url} alt="preview" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <>
                      <div className="bg-slate-100 p-6 rounded-full group-hover:bg-emerald-100 group-hover:scale-110 transition-all mb-4">
                        <Upload size={32} className="text-slate-400 group-hover:text-emerald-500" />
                      </div>
                      <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Cargar Planos / PDF</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    accept="image/*,application/pdf"
                  />
                </div>

                <button 
                  disabled={analyzing}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-xl shadow-indigo-100"
                >
                  <Sparkles size={18} />
                  IA COMMERCIAL PRO
                </button>
              </div>

              {/* Right Side: Form */}
              <div className="w-full md:w-3/5 p-12">
                <div className="flex justify-between items-center mb-10">
                  <h2 className="text-3xl font-black text-slate-800 uppercase italic tracking-tighter">Configurar Modelo</h2>
                  <button onClick={() => setIsEditing(false)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-600 transition-all">
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre del Modelo</label>
                    <input 
                      type="text" 
                      className="w-full px-6 py-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 outline-none focus:border-emerald-500 font-bold italic text-slate-700"
                      value={currentModel.nombre}
                      onChange={(e) => setCurrentModel({...currentModel, nombre: e.target.value})}
                      placeholder="Ej: MODELO BASIC 36 MT2"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Superficie (m²)</label>
                    <input 
                      type="number" 
                      className="w-full px-6 py-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 outline-none focus:border-emerald-500 font-bold"
                      value={currentModel.superficie_m2}
                      onChange={(e) => setCurrentModel({...currentModel, superficie_m2: Number(e.target.value)})}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Valor Venta Base ($)</label>
                    <input 
                      type="number" 
                      className="w-full px-6 py-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 outline-none focus:border-emerald-500 font-bold"
                      value={currentModel.preciobase}
                      onChange={(e) => setCurrentModel({...currentModel, preciobase: Number(e.target.value)})}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Descripción / Notas</label>
                    <textarea 
                      className="w-full px-6 py-4 bg-slate-50 rounded-[1.5rem] border border-slate-100 outline-none focus:border-emerald-500 font-medium text-sm min-h-[120px]"
                      value={currentModel.descripcion}
                      onChange={(e) => setCurrentModel({...currentModel, descripcion: e.target.value})}
                      placeholder="Detalles sobre terminaciones, dormitorios, etc."
                    />
                  </div>
                </div>

                {/* Specs Table */}
                <div className="mb-10">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                    Especificaciones Técnicas
                    <span className="bg-slate-100 px-2 py-1 rounded text-[10px]">Total items: {currentModel.especificaciones?.length || 0}</span>
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {currentModel.especificaciones?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div className="flex-1 flex flex-col">
                          <span className="text-sm font-bold text-slate-700 italic">{item.descripcion}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{item.cantidad} {item.unidad}</span>
                        </div>
                        <span className="font-black text-slate-700 text-sm">${item.precio_unitario.toLocaleString('es-CL')}</span>
                        <button 
                          onClick={() => {
                            const newSpecs = [...(currentModel.especificaciones || [])];
                            newSpecs.splice(idx, 1);
                            setCurrentModel({...currentModel, especificaciones: newSpecs});
                          }}
                          className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    {(!currentModel.especificaciones || currentModel.especificaciones.length === 0) && (
                      <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase">Sin especificaciones cargadas</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 py-5 bg-slate-50 text-slate-400 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-2 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] hover:bg-slate-800 transition-all shadow-2xl shadow-slate-200"
                  >
                    Actualizar Catálogo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DesignGallery;
