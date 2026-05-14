import React, { useState, useEffect, useRef } from 'react';
import { Project, BudgetItem } from '@/types';
import { getProjects, saveProject, deleteProject } from '@/services/db';
import { analyzeBudgetFile } from '@/services/gemini';
import { Plus, Save, Home, Trash2, Search, Ruler, Layers, Calculator, Edit3, Upload, BrainCircuit, Loader2, FileText, ArrowRight, X, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const uuid = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    }
};

const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Project>({
    id: '', 
    modelo: '', 
    superficie_m2: 0, 
    precio_base: 0, 
    materiales_principales: [], 
    adicionales: [], 
    etapa: 'Cotización', 
    especificaciones_default: [],
    imagen_url: '',
    pdf_url: '',
    es_modelo_fijo: false,
    partidas_adicionales_permitidas: true
  });
  
  const [tempMaterial, setTempMaterial] = useState('');
  const [tempAdicional, setTempAdicional] = useState('');
  
  // Temp budget item for specs
  const [newSpecItem, setNewSpecItem] = useState<BudgetItem>({
    id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0
  });

  useEffect(() => {
    const loadData = async () => {
        const data = await getProjects();
        setProjects(data);
        setFilteredProjects(data);
    };
    loadData();
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFilteredProjects(projects.filter(p => p.modelo.toLowerCase().includes(lower)));
  }, [searchTerm, projects]);

  const handleNew = () => {
    setFormData({
      id: uuid(),
      modelo: '', 
      superficie_m2: 0, 
      precio_base: 0, 
      materiales_principales: [], 
      adicionales: [], 
      etapa: 'Cotización', 
      especificaciones_default: [],
      imagen_url: '',
      pdf_url: '',
      es_modelo_fijo: false,
      partidas_adicionales_permitidas: true
    });
    setIsEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProject(formData);
    const updated = await getProjects();
    setProjects(updated);
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Modelo guardado correctamente', type: 'success' } 
    }));
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm('¿Estás seguro de eliminar este modelo de casa?')) {
          await deleteProject(id);
          const updated = await getProjects();
          setProjects(updated);
      }
  };

  const addMaterial = () => {
    if (tempMaterial) {
      setFormData(prev => ({ ...prev, materiales_principales: [...prev.materiales_principales, tempMaterial] }));
      setTempMaterial('');
    }
  };

  const addAdicional = () => {
    if (tempAdicional) {
      setFormData(prev => ({ ...prev, adicionales: [...prev.adicionales, tempAdicional] }));
      setTempAdicional('');
    }
  };

  const addSpecItem = () => {
    if (!newSpecItem.descripcion) return;
    const total = newSpecItem.cantidad * newSpecItem.precio_unitario;
    const itemToAdd = { ...newSpecItem, id: uuid(), total };
    
    setFormData(prev => {
      const currentSpecs = prev.especificaciones_default || [];
      const newSpecs = [...currentSpecs, itemToAdd];
      return {
        ...prev,
        especificaciones_default: newSpecs,
        precio_base: newSpecs.reduce((sum, i) => sum + i.total, 0) || prev.precio_base
      };
    });

    setNewSpecItem({ id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0 });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
  };

  const handleAIModelExtraction = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
        const base64 = await fileToBase64(file);
        const resultText = await analyzeBudgetFile(base64, file.type);
        let parsed: any = {};
        try {
            parsed = JSON.parse(resultText);
        } catch (e) {
            // If it's not JSON, it's probably because Gemini returned the raw response
            // analyzeBudgetFile already tries to handle this, but let's be safe.
            console.error("Failed to parse AI response:", e);
        }
        
        if (parsed && parsed.items && Array.isArray(parsed.items)) {
            const formattedItems: BudgetItem[] = parsed.items.map((i: any) => ({
                id: uuid(),
                descripcion: i.descripcion || "Ítem extraído",
                cantidad: Number(i.cantidad) || 0,
                unidad: i.unidad || 'un',
                precio_unitario: Number(i.precio_unitario) || 0,
                total: (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0)
            }));
            
            setFormData(prev => ({
                ...prev,
                especificaciones_default: formattedItems,
                precio_base: formattedItems.reduce((acc, i) => acc + i.total, 0),
                superficie_m2: parsed.superficie_m2 || prev.superficie_m2
            }));

            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: "Modelo analizado y datos extraídos correctamente.", type: 'success' } 
            }));
        }
    } catch (error) {
        console.error("AI Extraction failed", error);
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: "Error al extraer datos del modelo.", type: 'error' } 
        }));
    } finally {
        setIsAnalyzing(false);
    }
  };

  const removeSpecItem = (id: string) => {
    setFormData(prev => {
      const currentSpecs = prev.especificaciones_default || [];
      const newSpecs = currentSpecs.filter(i => i.id !== id);
      return {
        ...prev,
        especificaciones_default: newSpecs,
        precio_base: newSpecs.reduce((sum, i) => sum + i.total, 0) || prev.precio_base
      };
    });
  };

  if (isEditing) {
    return (
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200 mb-20">
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                <Home className="text-blue-600" /> Definición de Modelo
            </h3>
            <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                   <input type="checkbox" checked={formData.es_modelo_fijo} onChange={e => setFormData({...formData, es_modelo_fijo: e.target.checked})} className="accent-blue-600 w-4 h-4" />
                   <span className="text-xs font-bold text-slate-600">PRECIO FIJO</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                   <input type="checkbox" checked={formData.partidas_adicionales_permitidas} onChange={e => setFormData({...formData, partidas_adicionales_permitidas: e.target.checked})} className="accent-blue-600 w-4 h-4" />
                   <span className="text-xs font-bold text-slate-600">BOTÓN CUBICACIÓN (+)</span>
                </label>
            </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* AI Extraction Banner */}
          <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center text-center space-y-4">
            <div className="bg-emerald-600 text-white p-3 rounded-full flex items-center justify-center">
                <BrainCircuit size={32} />
            </div>
            <div>
                <h4 className="font-bold text-emerald-800 uppercase text-xs tracking-widest">Carga Inteligente de Modelo</h4>
                <p className="text-xs text-emerald-600 max-w-sm mx-auto mt-1">Sube una ficha técnica o plano en PDF/Imagen. La IA extraerá automáticamente las partidas, superficie y sugerirá un precio base.</p>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf,image/*" onChange={handleAIModelExtraction} />
            <button 
                type="button" 
                disabled={isAnalyzing} 
                onClick={() => fileInputRef.current?.click()} 
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center gap-2 disabled:opacity-50 active:scale-95"
            >
                {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
                {isAnalyzing ? 'Extrayendo Datos...' : 'Subir PDF y Analizar con IA'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Modelo</label>
              <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} placeholder="Ej: Mediterránea Premium" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Superficie (m²)</label>
              <input required type="number" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.superficie_m2} onChange={e => setFormData({...formData, superficie_m2: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Precio Base ($)</label>
              <input required type="number" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600" 
                value={formData.precio_base} onChange={e => setFormData({...formData, precio_base: Number(e.target.value)})} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL Imagen (Pre-renderizada)</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-xs" 
                    value={formData.imagen_url} onChange={e => setFormData({...formData, imagen_url: e.target.value})} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">URL Ficha Técnica / PDF</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-lg text-xs" 
                    value={formData.pdf_url} onChange={e => setFormData({...formData, pdf_url: e.target.value})} placeholder="https://..." />
              </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Resumen de Especificaciones (Texto)</label>
            <div className="flex gap-2 mb-3">
              <input type="text" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: Madera Pino Oregón 2x4" 
                value={tempMaterial} onChange={e => setTempMaterial(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMaterial())} />
              <button type="button" onClick={addMaterial} className="bg-slate-800 text-white px-4 rounded-lg font-bold hover:bg-slate-900 shadow-sm transition active:scale-95">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.materiales_principales.map((m, i) => (
                <span key={i} className="bg-white text-slate-700 text-[11px] px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1 font-medium">
                    {m} <button type="button" onClick={() => setFormData({...formData, materiales_principales: formData.materiales_principales.filter((_, idx) => idx !== i)})} className="text-slate-400 hover:text-red-500 ml-1">×</button>
                </span>
              ))}
              {formData.materiales_principales.length === 0 && <span className="text-xs text-slate-400 italic">No hay especificaciones añadidas.</span>}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Adicionales / Terminaciones</label>
            <div className="flex gap-2 mb-3">
              <input type="text" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: Fosa Séptica 1200L" 
                value={tempAdicional} onChange={e => setTempAdicional(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAdicional())} />
              <button type="button" onClick={addAdicional} className="bg-slate-800 text-white px-4 rounded-lg font-bold hover:bg-slate-900">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.adicionales.map((m, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-1">
                   {m} <button type="button" onClick={() => setFormData({...formData, adicionales: formData.adicionales.filter((_, idx) => idx !== i)})} className="text-blue-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Partidas Detalladas (Presupuesto Base)</label>
            <div className="flex flex-wrap md:flex-nowrap gap-2 bg-white p-3 rounded-lg border border-slate-200 mb-3">
                <input type="text" className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" placeholder="Partida/Material"
                    value={newSpecItem.descripcion} onChange={e => setNewSpecItem({...newSpecItem, descripcion: e.target.value})} />
                <input type="number" className="w-20 p-2 border border-slate-200 rounded-lg text-sm" placeholder="Cant."
                    value={newSpecItem.cantidad} onChange={e => setNewSpecItem({...newSpecItem, cantidad: Number(e.target.value)})} />
                <input type="number" className="w-24 p-2 border border-slate-200 rounded-lg text-sm" placeholder="Precio"
                    value={newSpecItem.precio_unitario} onChange={e => setNewSpecItem({...newSpecItem, precio_unitario: Number(e.target.value)})} />
                <button type="button" onClick={addSpecItem} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700">+</button>
            </div>
            
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                <table className="w-full text-xs">
                    <thead className="bg-slate-100 sticky top-0">
                        <tr>
                            <th className="p-2 text-left">Ítem</th>
                            <th className="p-2 text-right">Cant.</th>
                            <th className="p-2 text-right">Precio</th>
                            <th className="p-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(formData.especificaciones_default || []).map((item) => (
                            <tr key={item.id}>
                                <td className="p-2">{item.descripcion}</td>
                                <td className="p-2 text-right">{item.cantidad} {item.unidad}</td>
                                <td className="p-2 text-right">${item.precio_unitario.toLocaleString()}</td>
                                <td className="p-2 text-center">
                                    <button type="button" onClick={() => removeSpecItem(item.id)} className="text-red-400 hover:text-red-600">×</button>
                                </td>
                            </tr>
                        ))}
                        {(formData.especificaciones_default || []).length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-slate-400 italic">No hay partidas detalladas.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="mt-2 text-right font-bold text-slate-700">
                Total Detallado: ${(formData.especificaciones_default || []).reduce((s, i) => s + i.total, 0).toLocaleString()}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-md transition font-medium">
              <Save size={18} /> Guardar Modelo
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div id="project-catalog" className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">Modelos Arquitectónicos</h3>
            <p className="text-slate-500 font-medium">Explore nuestra colección de diseños modulares de alta gama.</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-96 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} />
                <input 
                    type="text" 
                    placeholder="Buscar estilo, m² o nombre..." 
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none shadow-sm transition-all text-sm font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={handleNew} className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl flex items-center gap-3 hover:bg-slate-800 shadow-xl shadow-slate-200 transition-all font-black text-xs uppercase tracking-widest active:scale-95">
                <Plus size={18} /> Nuevo Diseño
            </button>
        </div>
      </header>

      {/* Modern Bento-style Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
        {filteredProjects.map(proj => (
          <motion.div 
            layoutId={proj.id}
            key={proj.id} 
            onClick={() => setSelectedProject(proj)} 
            className="group relative bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-100 hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] hover:border-emerald-200 cursor-pointer transition-all duration-500 flex flex-col h-[500px]"
          >
            {/* Main Visual Centerpiece */}
            <div className="relative h-full overflow-hidden">
                {proj.imagen_url ? (
                    <img 
                        src={proj.imagen_url} 
                        alt={proj.modelo} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                        referrerPolicy="no-referrer" 
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-200 group-hover:text-emerald-200 transition-colors">
                        <Home size={120} strokeWidth={0.5} className="mb-4 opacity-10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Pendiente de Render</span>
                    </div>
                )}
                
                {/* Visual Overlays (Price & Size) */}
                <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/20">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Desde</p>
                        <p className="text-xl font-black text-slate-800 tracking-tighter">${proj.precio_base?.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-white/10 text-white flex items-center gap-2">
                        <Ruler size={14} className="text-emerald-400" />
                        <span className="font-black text-sm tracking-tighter">{proj.superficie_m2} m²</span>
                    </div>
                </div>

                {/* Hover Interaction Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-8 pt-20 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                    <div className="flex flex-col gap-4">
                        <h4 className="text-3xl font-black text-white tracking-tighter uppercase italic">{proj.modelo}</h4>
                        <div className="flex gap-2 mb-2">
                            {proj.materiales_principales.slice(0, 3).map((m, i) => (
                                <span key={i} className="text-[10px] font-black text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">{m}</span>
                            ))}
                        </div>
                        <button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-emerald-500/40 transition-all active:scale-95">
                            <Plus size={18} /> Explorar Partidas y Cotizar
                        </button>
                    </div>
                </div>

                <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity z-10 hidden md:flex flex-col gap-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setFormData(proj); setIsEditing(true); }}
                        className="p-3 bg-white/20 backdrop-blur-md hover:bg-white text-white hover:text-slate-900 rounded-full transition shadow-xl border border-white/10"
                    >
                        <Edit3 size={18} />
                    </button>
                    <button 
                        onClick={(e) => handleDelete(proj.id, e)}
                        className="p-3 bg-white/20 backdrop-blur-md hover:bg-red-500 text-white rounded-full transition shadow-xl border border-white/10"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Model Detail Modal - Centered on content & images */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedProject(null)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            
            <motion.div 
                layoutId={selectedProject.id}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-6xl bg-white rounded-[3rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col lg:flex-row max-h-[90vh]"
            >
                {/* Visual Half */}
                <div className="lg:w-1/2 relative bg-slate-100">
                    {selectedProject.imagen_url ? (
                        <img src={selectedProject.imagen_url} alt={selectedProject.modelo} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                            <Home size={100} strokeWidth={0.5} className="opacity-20" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
                    <div className="absolute bottom-10 left-10 text-white">
                        <p className="text-[12px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-2">Diseño Arquitectónico</p>
                        <h3 className="text-5xl font-black tracking-tighter uppercase italic">{selectedProject.modelo}</h3>
                    </div>
                </div>

                {/* Info Half */}
                <div className="lg:w-1/2 p-10 overflow-y-auto flex flex-col bg-white">
                    <div className="flex justify-between items-start mb-8">
                        <div className="flex gap-4">
                            <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl text-center min-w-[100px]">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Superficie</p>
                                <p className="text-2xl font-black text-slate-800">{selectedProject.superficie_m2} <span className="text-sm font-bold text-slate-400 tracking-normal italic">m²</span></p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-3xl text-center min-w-[140px]">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Inversión Base</p>
                                <p className="text-2xl font-black text-emerald-700">${selectedProject.precio_base?.toLocaleString()}</p>
                            </div>
                        </div>
                        <button onClick={() => setSelectedProject(null)} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 transition">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="space-y-8 flex-1">
                        <div>
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Layers size={14} className="text-emerald-500" /> Especificaciones de Obra
                            </h5>
                            <div className="grid grid-cols-2 gap-3">
                                {selectedProject.materiales_principales.map((m, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{m}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Calculator size={14} className="text-emerald-500" /> Detalle de Partidas Incluidas
                            </h5>
                            <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                <table className="w-full text-[11px]">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-black text-slate-400 uppercase tracking-widest">Partida</th>
                                            <th className="px-4 py-3 text-center font-black text-slate-400 uppercase tracking-widest">Cant.</th>
                                            <th className="px-4 py-3 text-right font-black text-slate-400 uppercase tracking-widest">Unitario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {selectedProject.especificaciones_default?.slice(0, 6).map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3 font-bold text-slate-700">{item.descripcion}</td>
                                                <td className="px-4 py-3 text-center text-slate-500 font-medium">{item.cantidad} {item.unidad}</td>
                                                <td className="px-4 py-3 text-right font-black text-emerald-600">${item.precio_unitario.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {(selectedProject.especificaciones_default?.length ?? 0) > 6 && (
                                    <div className="p-3 bg-slate-50/50 border-t border-slate-50 text-center">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">+ {selectedProject.especificaciones_default!.length - 6} partidas adicionales en el presupuesto final</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-100 flex gap-4">
                        <button 
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }));
                                window.localStorage.setItem('pending_quote_project_id', selectedProject.id);
                                setSelectedProject(null);
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-3 transform hover:-translate-y-1 transition-all active:scale-95"
                        >
                            <ArrowRight size={20} /> Generar Presupuesto Base
                        </button>
                        <button 
                             onClick={() => { setFormData(selectedProject); setIsEditing(true); setSelectedProject(null); }}
                             className="px-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[2rem] font-bold text-xs uppercase tracking-widest transition-all"
                        >
                            Editar
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

export default ProjectManager;