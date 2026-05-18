
import React, { useState, useEffect } from 'react';
import { getClients, getClientCommercialHistory, deleteBudget } from '@/services/db';
import { analyzeCommercialAI } from '@/services/gemini';
import { Client, Project, Budget, Contract } from '@/types';
import { Search, User, Home, Calculator, FileCheck, MapPin, ExternalLink, Calendar, DollarSign, Map as MapIcon, BrainCircuit, Loader2, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet icons in this component too
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const CommercialHub: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [clientData, setClientData] = useState<{
    client: Client;
    projects: Project[];
    budgets: Budget[];
    contracts: Contract[];
  } | null>(null);

  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    const loadClients = async () => {
      const data = await getClients();
      setClients(data);

      const savedRut = window.localStorage.getItem('hub_selected_client_rut');
      if (savedRut) {
          window.localStorage.removeItem('hub_selected_client_rut');
          handleSearch(savedRut);
      }
    };
    loadClients();
  }, []);

  const handleSearch = async (rut: string) => {
    const history = await getClientCommercialHistory(rut);
    if (history) {
      setClientData(history);
      
      // Trigger AI Analysis
      setIsAnalyzing(true);
      try {
          const analysis = await analyzeCommercialAI(
              history.client, 
              history.projects, 
              history.budgets, 
              history.contracts
          );
          setAiAnalysis(analysis);
      } catch (err) {
          console.error("Analysis failed", err);
          setAiAnalysis("Error al generar el análisis comercial.");
      } finally {
          setIsAnalyzing(false);
      }
    } else {
      setClientData(null);
      setAiAnalysis(null);
    }
  };

  useEffect(() => {
    if (searchQuery.length > 5) {
      const match = clients.find(c => 
        c.rut.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.nombre.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (match) handleSearch(match.rut);
    }
  }, [searchQuery, clients]);

  return (
    <div id="commercial-hub" className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight uppercase">Interoperabilidad</h2>
          <p className="text-slate-500 italic">Cruce de información experto basado en RUT / Nombre para toma de decisiones.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            id="hub-search"
            type="text"
            placeholder="Buscar por RUT o Nombre..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {!clientData ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center justify-center text-slate-400">
          <Search className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">Ingrese un RUT o Nombre para visualizar el expediente completo</p>
          <p className="text-sm">Ej: 12.345.678-9</p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Ficha de Cliente - Core Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <User className="w-24 h-24" />
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{clientData.client.nombre}</h3>
                  <p className="text-sm text-slate-500 font-mono">{clientData.client.rut}</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{clientData.client.domicilio}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Calculator className="w-4 h-4" />
                  <span>Proyectos: {clientData.projects.length}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <FileCheck className="w-4 h-4" />
                  <span>Contratos: {clientData.contracts.length}</span>
                </div>
              </div>
              {clientData.client.location && (
                <div className="mt-6 h-64 rounded-xl overflow-hidden border border-slate-200 relative z-0">
                  <MapContainer
                    center={[clientData.client.location.lat, clientData.client.location.lng]}
                    zoom={15}
                    scrollWheelZoom={false}
                    dragging={false}
                    zoomControl={false}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[clientData.client.location.lat, clientData.client.location.lng]} icon={DefaultIcon} />
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-slate-600 font-mono text-center z-[1000]">
                    {clientData.client.location.lat.toFixed(4)}, {clientData.client.location.lng.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
            
            <div className="bg-indigo-600 p-6 rounded-2xl shadow-md text-white">
              <h4 className="font-semibold mb-2 flex items-center gap-2 uppercase tracking-tighter">
                <BrainCircuit className="w-5 h-5" />
                IA Comercial Pro Insights
              </h4>
              <div className="text-indigo-100 text-sm leading-relaxed whitespace-pre-wrap">
                {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center py-4 gap-2">
                        <Loader2 className="animate-spin text-white/50" size={24} />
                        <p className="text-xs font-bold animate-pulse">Analizando comportamiento del cliente...</p>
                    </div>
                ) : (
                    aiAnalysis || (clientData.contracts.length > 0 
                        ? "Cliente fidelizado con contrato activo. Oportunidad de Up-selling."
                        : "Se requiere mayor interacción para análisis profundo.")
                )}
              </div>
            </div>
          </div>

          {/* Timeline de Información Cruzada */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-indigo-500" />
                Línea de Tiempo del Negocio
              </h3>
              
              <div className="space-y-8 relative before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {/* Proyectos Detectados */}
                <div className="relative pl-12">
                  <div className="absolute left-4 top-2 w-4 h-4 rounded-full bg-white border-4 border-indigo-500 z-10"></div>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Modelos de Interés</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientData.projects.map(p => (
                      <div key={p.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-slate-700">{p.modelo}</p>
                            <p className="text-xs text-slate-500">{p.superficie_m2}m² - {p.etapa}</p>
                          </div>
                          <Home className="w-5 h-5 text-slate-300" />
                        </div>
                      </div>
                    ))}
                    {clientData.projects.length === 0 && <p className="text-slate-400 italic text-sm">Sin proyectos registrados.</p>}
                  </div>
                </div>

                {/* Presupuestos Detectados */}
                <div className="relative pl-12">
                  <div className="absolute left-4 top-2 w-4 h-4 rounded-full bg-white border-4 border-emerald-500 z-10"></div>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Cotizaciones y Análisis</h4>
                  <div className="space-y-3">
                    {clientData.budgets.map(b => (
                      <div key={b.id} className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-700">${b.monto_total.toLocaleString('es-CL')}</p>
                            <p className="text-xs text-slate-500">{b.fecha}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded">VIGENTE</span>
                           <button 
                             onClick={async (e) => {
                               e.stopPropagation();
                               if (confirm('¿Eliminar este presupuesto?')) {
                                 try {
                                   await deleteBudget(b.id);
                                   handleSearch(clientData.client.rut); // Refresh view
                                 } catch (error) {
                                   console.error("Error deleting from hub", error);
                                 }
                               }
                             }}
                             className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                             title="Eliminar"
                           >
                             <Trash2 size={14} />
                           </button>
                        </div>
                      </div>
                    ))}
                     {clientData.budgets.length === 0 && <p className="text-slate-400 italic text-sm">Sin cotizaciones registradas.</p>}
                  </div>
                </div>

                {/* Contratos Firmados */}
                <div className="relative pl-12">
                  <div className="absolute left-4 top-2 w-4 h-4 rounded-full bg-white border-4 border-amber-500 z-10"></div>
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Compromisos Contractuales</h4>
                  <div className="space-y-3">
                    {clientData.contracts.map(c => (
                      <div key={c.id} className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-amber-900">{c.estado}</p>
                            <p className="text-xs text-amber-700">Firmado el: {c.fecha_contrato}</p>
                          </div>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-amber-600 font-bold tracking-tighter">REF: {c.id.slice(0,8)}</p>
                        </div>
                      </div>
                    ))}
                    {clientData.contracts.length === 0 && <p className="text-slate-400 italic text-sm">Sin contratos formalizados.</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CommercialHub;
