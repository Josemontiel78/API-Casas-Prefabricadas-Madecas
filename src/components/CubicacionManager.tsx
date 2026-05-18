
import React, { useState, useRef, useEffect } from 'react';
import { 
    Calculator, 
    Upload, 
    FileText, 
    Plus, 
    Trash2, 
    ChevronRight, 
    BrainCircuit, 
    Loader2, 
    CheckCircle,
    Maximize2,
    Ruler,
    Layers,
    Save,
    ArrowRight,
    Users,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeBudgetFile } from '@/services/gemini';
import { uuid } from '@/lib/utils';
import { BudgetItem, Client } from '@/types';
import { getClients } from '@/services/db';

const CubicacionManager: React.FC = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [items, setItems] = useState<BudgetItem[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState('');
    const [selectedStep, setSelectedStep] = useState(1);
    const [surface, setSurface] = useState<number>(0);
    const [techAnalysis, setTechAnalysis] = useState<string>('');
    const [adjustments, setAdjustments] = useState({
        tolerancia: 5, // 5% default
        machimbre: 10, // 10% for wood
        montajeZing: 15 // 15% for roofing overlaps
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadClients = async () => {
            const data = await getClients();
            setClients(data);
        };
        loadClients();
    }, []);

    const updateAdjustedValue = (baseValue: number, factor: number) => {
        return baseValue * (1 + factor / 100);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setAnalysisStatus('Subiendo archivo...');
        setItems([]);
        setTechAnalysis('');
        setSurface(0);
        try {
            setAnalysisStatus('Procesando imagen con IA...');
            const base64 = await fileToBase64(file);
            
            setAnalysisStatus('Analizando plano y extrayendo partidas (esto puede tardar 20-30 seg)...');
            const resultText = await analyzeBudgetFile(base64, file.type);
            
            setAnalysisStatus('Estructurando datos...');
            const parsed = JSON.parse(resultText);
            
            if (parsed.items) {
                const formattedItems: BudgetItem[] = parsed.items.map((i: any) => ({
                    id: uuid(),
                    descripcion: i.descripcion,
                    cantidad: i.cantidad || 0,
                    unidad: i.unidad || 'un',
                    precio_unitario: i.precio_unitario || 0,
                    total: (i.cantidad || 0) * (i.precio_unitario || 0)
                }));
                setItems(formattedItems);
                if (parsed.superficie_m2) setSurface(parsed.superficie_m2);
                if (parsed.analisis_tecnico) setTechAnalysis(parsed.analisis_tecnico);
                setSelectedStep(2);

                const msg = parsed.analisis_tecnico 
                    ? `Análisis Técnico: ${parsed.analisis_tecnico}. Partidas extraídas con éxito.`
                    : "Plano analizado exitosamente. Revise las partidas extraídas.";

                window.dispatchEvent(new CustomEvent('app-notification', { 
                    detail: { message: msg, type: 'success' } 
                }));
            }
        } catch (error) {
            console.error("Error analyzing plan:", error);
            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: "Error al analizar el archivo. Asegúrese de que sea un PDF o imagen clara.", type: 'error' } 
            }));
        } finally {
            setIsAnalyzing(false);
        }
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

    const addItem = () => {
        const newItem: BudgetItem = {
            id: uuid(),
            descripcion: 'Nueva Partida',
            cantidad: 1,
            unidad: 'un',
            precio_unitario: 0,
            total: 0
        };
        setItems([...items, newItem]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = (id: string, field: keyof BudgetItem, value: any) => {
        setItems(items.map(i => {
            if (i.id === id) {
                const updated = { ...i, [field]: value };
                if (field === 'cantidad' || field === 'precio_unitario') {
                    updated.total = updated.cantidad * updated.precio_unitario;
                }
                return updated;
            }
            return i;
        }));
    };

    const totalCost = items.reduce((acc, i) => acc + i.total, 0);

    return (
        <div id="cubicacion-manager" className="space-y-6">
            <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-3 lowercase first-letter:uppercase">
                        <Calculator className="text-emerald-600" /> Cubicación Inteligente
                    </h2>
                    <p className="text-slate-500 text-sm italic">Extrae cantidades automáticamente desde planos y presupuestos tipo.</p>
                </div>
                <div className="flex gap-4">
                     <div className="flex flex-col items-end">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente Asociado</label>
                        <select 
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="">Seleccionar Cliente...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                        </select>
                     </div>
                     <span className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 self-end">
                        <Ruler size={14} /> {surface} m² detectados
                     </span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Stepper / Steps */}
                <div className="lg:col-span-1 space-y-3">
                    {[
                        { step: 1, label: 'Carga de Plano/Archivo', icon: Upload },
                        { step: 2, label: 'Revisión de Partidas', icon: Layers },
                        { step: 3, label: 'Ajuste de Precios', icon: Calculator },
                        { step: 4, label: 'Exportar a Presupuesto', icon: ArrowRight },
                    ].map((s) => (
                        <button
                            key={s.step}
                            onClick={() => setSelectedStep(s.step)}
                            disabled={s.step > 1 && items.length === 0}
                            className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                                selectedStep === s.step 
                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-200' 
                                : 'bg-white border-slate-100 text-slate-400 hover:border-emerald-200'
                            }`}
                        >
                            <s.icon size={18} />
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Paso 0{s.step}</p>
                                <p className="text-xs font-bold">{s.label}</p>
                            </div>
                            {selectedStep > s.step && <CheckCircle size={16} className="ml-auto text-emerald-400" />}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    <AnimatePresence mode="wait">
                        {selectedStep === 1 && (
                            <motion.div 
                                key="step1"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-6"
                            >
                                <div className="bg-emerald-50 p-6 rounded-full text-emerald-600">
                                    <Upload size={48} strokeWidth={1} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Cargar Documento de Cubicación</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto mt-2">
                                        Sube un plano en PDF o una imagen del listado de materiales. Nuestra IA detectará automáticamente las partidas y cantidades.
                                    </p>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="application/pdf,image/*"
                                    onChange={handleFileUpload}
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isAnalyzing}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition flex flex-col items-center gap-1 disabled:opacity-50"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <Loader2 className="animate-spin" size={20} /> ANALIZANDO CON IA...
                                            </div>
                                            <span className="text-[10px] opacity-70 font-medium">{analysisStatus}</span>
                                        </>
                                    ) : (
                                        <><BrainCircuit size={20} /> SELECCIONAR ARCHIVO</>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Soporta PDF, PNG, JPG</p>
                            </motion.div>
                        )}

                        {(selectedStep === 2 || selectedStep === 3) && (
                            <motion.div 
                                key="list"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
                            >
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                    <h4 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                                        <Layers size={14} /> Detalle de Partidas Extraídas
                                    </h4>
                                    <button 
                                        onClick={addItem}
                                        className="text-xs font-bold text-emerald-600 flex items-center gap-1 hover:underline"
                                    >
                                        <Plus size={14} /> Añadir Manualmente
                                    </button>
                                </div>

                                {techAnalysis && (
                                    <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm">
                                                <BrainCircuit size={16} />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Análisis Técnico de IA</p>
                                                <p className="text-sm text-slate-700 leading-tight italic">"{techAnalysis}"</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Factors Adjustment Bar */}
                                <div className="px-6 py-4 bg-slate-100 border-b border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Tolerancia General (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="range" min="0" max="25" step="1" 
                                                value={adjustments.tolerancia}
                                                onChange={(e) => setAdjustments({...adjustments, tolerancia: parseInt(e.target.value)})}
                                                className="flex-1 accent-emerald-600 h-1"
                                            />
                                            <span className="text-xs font-bold w-8 text-slate-700">{adjustments.tolerancia}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pérdida Machimbre (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="range" min="0" max="30" step="1" 
                                                value={adjustments.machimbre}
                                                onChange={(e) => setAdjustments({...adjustments, machimbre: parseInt(e.target.value)})}
                                                className="flex-1 accent-emerald-600 h-1"
                                            />
                                            <span className="text-xs font-bold w-10 text-slate-700">{adjustments.machimbre}%</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Cubicación Zing/Montaje (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="range" min="0" max="40" step="1" 
                                                value={adjustments.montajeZing}
                                                onChange={(e) => setAdjustments({...adjustments, montajeZing: parseInt(e.target.value)})}
                                                className="flex-1 accent-emerald-600 h-1"
                                            />
                                            <span className="text-xs font-bold w-10 text-slate-700">{adjustments.montajeZing}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descripción</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Cant. Base</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">Cant. Ajustada</th>
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-20 text-center">Unidad</th>
                                                {selectedStep === 3 && (
                                                    <>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Unitario</th>
                                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-32 text-right">Total</th>
                                                    </>
                                                )}
                                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => {
                                                // Intelligent adjustment selection
                                                let factor = adjustments.tolerancia;
                                                const desc = item.descripcion.toLowerCase();
                                                if (desc.includes('pino') || desc.includes('madera') || desc.includes('machimbre') || desc.includes('forro') || desc.includes('piso')) {
                                                    factor = adjustments.machimbre;
                                                } else if (desc.includes('zing') || desc.includes('techo') || desc.includes('zinc') || desc.includes('acanalada')) {
                                                    factor = adjustments.montajeZing;
                                                }
                                                
                                                const adjustedQty = updateAdjustedValue(item.cantidad, factor);
                                                const itemTotal = adjustedQty * item.precio_unitario;

                                                return (
                                                    <tr key={item.id} className="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.descripcion}
                                                                onChange={(e) => updateItem(item.id, 'descripcion', e.target.value)}
                                                                className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <input 
                                                                type="number" 
                                                                value={item.cantidad}
                                                                onChange={(e) => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 0)}
                                                                className="w-full bg-transparent border border-slate-200 rounded-lg py-1 px-2 text-sm text-center font-bold text-slate-400 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                            />
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                                {adjustedQty.toFixed(2)}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <input 
                                                                type="text" 
                                                                value={item.unidad}
                                                                onChange={(e) => updateItem(item.id, 'unidad', e.target.value)}
                                                                className="w-full bg-transparent border-none text-center focus:ring-0 text-sm text-slate-500"
                                                            />
                                                        </td>
                                                        {selectedStep === 3 && (
                                                            <>
                                                                <td className="px-6 py-4 text-right">
                                                                    <input 
                                                                        type="number" 
                                                                        value={item.precio_unitario}
                                                                        onChange={(e) => updateItem(item.id, 'precio_unitario', parseFloat(e.target.value) || 0)}
                                                                        className="w-full bg-transparent border border-slate-200 rounded-lg py-1 px-2 text-sm text-right font-bold text-emerald-600 focus:ring-emerald-500/20 focus:border-emerald-500"
                                                                    />
                                                                </td>
                                                                <td className="px-6 py-4 text-sm font-bold text-slate-800 text-right">
                                                                    ${(itemTotal).toLocaleString()}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-6 py-4 text-center">
                                                            <button 
                                                                onClick={() => removeItem(item.id)}
                                                                className="text-slate-300 hover:text-red-500 transition"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            {items.length === 0 && (
                                                <tr>
                                                    <td colSpan={selectedStep === 3 ? 6 : 4} className="p-12 text-center text-slate-400 italic text-sm">
                                                        No hay partidas cargadas. Use el cargador de archivos de IA.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        {selectedStep === 3 && (
                                            <tfoot>
                                                <tr className="bg-emerald-50/50">
                                                    <td colSpan={4} className="px-6 py-6 text-right font-black text-[10px] text-emerald-600 uppercase tracking-widest">Monto Total Estimado (Ajustado)</td>
                                                    <td className="px-6 py-6 text-right font-black text-xl text-emerald-700">
                                                        ${items.reduce((acc, item) => {
                                                            let factor = adjustments.tolerancia;
                                                            const desc = item.descripcion.toLowerCase();
                                                            if (desc.includes('pino') || desc.includes('madera') || desc.includes('machimbre') || desc.includes('forro') || desc.includes('piso')) {
                                                                factor = adjustments.machimbre;
                                                            } else if (desc.includes('zing') || desc.includes('techo') || desc.includes('zinc') || desc.includes('acanalada')) {
                                                                factor = adjustments.montajeZing;
                                                            }
                                                            return acc + (updateAdjustedValue(item.cantidad, factor) * item.precio_unitario);
                                                        }, 0).toLocaleString()}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                                <div className="p-8 bg-slate-900 flex justify-between items-center text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-500 p-2 rounded-lg">
                                            <BrainCircuit size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Validado por Gemini Flash</p>
                                            <p className="text-xs text-slate-400">Detección de materiales y unidades mediante visión artificial.</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (!selectedClientId) {
                                                window.dispatchEvent(new CustomEvent('app-notification', { 
                                                    detail: { message: "Por favor seleccione un cliente antes de continuar.", type: 'error' } 
                                                }));
                                                setSelectedStep(1);
                                                return;
                                            }
                                            setSelectedStep(selectedStep + 1);
                                        }}
                                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
                                    >
                                        Continuar <ChevronRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {selectedStep === 4 && (
                            <motion.div 
                                key="step4"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white p-12 rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center space-y-8"
                            >
                                <div className="bg-emerald-100 p-8 rounded-full text-emerald-600 animate-pulse">
                                    <CheckCircle size={64} strokeWidth={1} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-800">Cubicación Finalizada</h3>
                                    <p className="text-slate-500 max-w-md mx-auto mt-2">
                                        Se han procesado {items.length} partidas. 
                                        El monto final ajustado (incluyendo tolerancias y machimbres) es de 
                                        <span className="block text-emerald-600 font-black text-2xl mt-1">
                                            ${items.reduce((acc, item) => {
                                                let factor = adjustments.tolerancia;
                                                const desc = item.descripcion.toLowerCase();
                                                if (desc.includes('pino') || desc.includes('madera') || desc.includes('machimbre') || desc.includes('forro') || desc.includes('piso')) {
                                                    factor = adjustments.machimbre;
                                                } else if (desc.includes('zing') || desc.includes('techo') || desc.includes('zinc') || desc.includes('acanalada')) {
                                                    factor = adjustments.montajeZing;
                                                }
                                                return acc + (updateAdjustedValue(item.cantidad, factor) * item.precio_unitario);
                                            }, 0).toLocaleString()}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                                    <button 
                                        onClick={() => {
                                            if (items.length === 0) {
                                                window.dispatchEvent(new CustomEvent('app-notification', { 
                                                    detail: { message: "No hay partidas para exportar.", type: 'error' } 
                                                }));
                                                return;
                                            }

                                            const adjustedItems = items.map(item => {
                                                let factor = adjustments.tolerancia;
                                                const desc = item.descripcion.toLowerCase();
                                                if (desc.includes('pino') || desc.includes('madera') || desc.includes('machimbre') || desc.includes('forro') || desc.includes('piso')) {
                                                    factor = adjustments.machimbre;
                                                } else if (desc.includes('zing') || desc.includes('techo') || desc.includes('zinc') || desc.includes('acanalada')) {
                                                    factor = adjustments.montajeZing;
                                                }
                                                const adjustedQty = updateAdjustedValue(item.cantidad, factor);
                                                return {
                                                    ...item,
                                                    cantidad: parseFloat(adjustedQty.toFixed(2)),
                                                    total: adjustedQty * item.precio_unitario
                                                };
                                            });
                                            const finalTotal = adjustedItems.reduce((acc, i) => acc + i.total, 0);
                                            // Save to local storage for BudgetManager to pick up
                                            localStorage.setItem('pending_cubicacion_items', JSON.stringify(adjustedItems));
                                            localStorage.setItem('pending_cubicacion_total', finalTotal.toString());
                                            if (selectedClientId) {
                                                localStorage.setItem('pending_quote_client_id', selectedClientId);
                                            }
                                            window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }));
                                        }}
                                        className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transform hover:-translate-y-1 transition"
                                    >
                                        <ArrowRight size={20} /> Crear Presupuesto
                                    </button>
                                    <button 
                                        onClick={() => setSelectedStep(1)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition"
                                    >
                                        Nueva Cubicación
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};

export default CubicacionManager;
