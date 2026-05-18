
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClients, getContracts } from '@/services/db';
import { Client, Contract } from '@/types';
import { Users, MapPin, ExternalLink, Home, Phone, Target, Navigation, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// Component to handle live location and map centering
const MapController = ({ centerPos }: { centerPos: L.LatLngExpression | null }) => {
  const map = useMap();
  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 13);
    }
  }, [centerPos, map]);
  return null;
};

// Custom Icon for better visibility
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color};" class="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
};

const DefaultIcon = createCustomIcon('#4f46e5'); // Indigo for prospects
const ContractIcon = createCustomIcon('#d946ef'); // Fuchsia for contracts

const ProjectMapOverview: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [userLocation, setUserLocation] = useState<L.LatLngExpression | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        try {
            // Lazy import to avoid circular or heavy load
            const { getBudgets } = await import('@/services/db');
            const [allClients, allContracts, allBudgets] = await Promise.all([
                getClients(),
                getContracts(),
                getBudgets()
            ]);
            setClients(allClients.filter(c => c.location));
            setContracts(allContracts);
            setBudgets(allBudgets);
        } catch (error) {
            console.error("Error loading map data:", error);
        }
    };
    loadData();
  }, []);

  const findMyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización");
      setIsLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // Check if searching for a client first
    const client = clients.find(c => c.nombre.toLowerCase().includes(searchQuery.toLowerCase()));
    if (client && client.location) {
        setUserLocation([client.location.lat, client.location.lng]);
        return;
    }

    // Otherwise, use Nominatim for geocoding
    setIsLocating(true);
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Chile')}`);
        const data = await response.json();
        if (data && data.length > 0) {
            setUserLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } else {
            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: 'No se encontró la dirección o sector mencionado.', type: 'info' } 
            }));
        }
    } catch (err) {
        console.error("Geocoding error", err);
    } finally {
        setIsLocating(false);
    }
  };

  const years = useMemo(() => {
    const allYears = clients.map(c => new Date(c.fecha_registro || Date.now()).getFullYear().toString());
    return ['Todos', ...Array.from(new Set(allYears)).sort().reverse()];
  }, [clients]);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || c.rut.includes(searchQuery);
    const clientYear = new Date(c.fecha_registro || Date.now()).getFullYear().toString();
    const matchesYear = selectedYear === 'Todos' || clientYear === selectedYear;
    return matchesSearch && matchesYear;
  });

  return (
    <div className="space-y-6 h-full flex flex-col pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Georeferencia Global</h2>
          <p className="text-slate-500 text-sm font-medium">Control territorial de clientes y obras regionales.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {years.map(year => (
              <option key={year} value={year}>{year === 'Todos' ? 'Todos los Años' : `Año ${year}`}</option>
            ))}
          </select>

          <form onSubmit={handleAddressSearch} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-80">
            <Search className="text-slate-400 w-5 h-5 ml-2" />
            <input 
              type="text" 
              placeholder="Buscar dirección, sector o cliente..."
              className="bg-transparent border-none outline-none text-sm w-full py-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
      </div>

      <div className="flex-1 min-h-[500px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <button 
                onClick={findMyLocation}
                disabled={isLocating}
                className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
            >
                {isLocating ? <Navigation className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
                MI UBICACIÓN
            </button>
        </div>

        <MapContainer
          center={[-33.4489, -70.6693]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <MapController centerPos={userLocation} />
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredClients.map(client => {
            const clientContracts = contracts.filter(con => con.cliente_id === client.id);
            const clientBudgets = budgets.filter(b => b.cliente_id === client.id).sort((a, b) => 
               new Date(b.fecha_registro || 0).getTime() - new Date(a.fecha_registro || 0).getTime()
            );
            
            const latestBudget = clientBudgets[0];
            const hasContract = clientContracts.length > 0;
            
            let modelDisplayName = latestBudget?.modelo_vivienda || 'Sin Modelo';
            if (modelDisplayName.toLowerCase().includes('personal')) {
                modelDisplayName = `Presupuesto Personalizado (${latestBudget?.superficie_m2 || '0'} m²)`;
            } else if (latestBudget?.superficie_m2) {
                modelDisplayName += ` (${latestBudget.superficie_m2} m²)`;
            }

            return client.location && (
              <Marker 
                key={client.id} 
                position={[client.location.lat, client.location.lng]}
                icon={hasContract ? ContractIcon : DefaultIcon}
              >
                <Tooltip direction="top" offset={[0, -24]} opacity={1}>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-800 text-xs">{client.nombre}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                        {hasContract ? 'OBRA: ' : 'INTERÉS: '} {modelDisplayName}
                    </span>
                  </div>
                </Tooltip>
                <Popup className="custom-popup" minWidth={260}>
                  <div className="p-2">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black text-sm">
                        {client.nombre.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-slate-800 text-sm leading-tight">{client.nombre}</p>
                        <p className="text-[10px] text-indigo-600 font-bold mt-0.5 uppercase tracking-wider">{modelDisplayName}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-start gap-2 text-[11px] text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">{client.domicilio}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{client.telefono}</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200 mt-1">
                        <Target className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                            Status: {client.etapa_venta || 'Registro'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                       <button 
                         onClick={() => {
                             window.localStorage.setItem('hub_selected_client_rut', client.rut);
                             window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'hub' }));
                         }}
                         className="py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                       >
                         PROYECTO <ExternalLink size={12} />
                       </button>
                       <button className="py-2 bg-white text-slate-900 border border-slate-200 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                         DETALLES <Info size={12} />
                       </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
            <h3 className="font-black text-slate-800 text-lg mb-2">Anexo de Carterización</h3>
            <p className="text-slate-500 text-sm">Control centralizado de emplazamientos de obra y logística regional.</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Puntos Georef</p>
                <p className="text-2xl font-black text-slate-800">{clients.length}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Cerca de Ti</p>
                <p className="text-2xl font-black text-indigo-600">{filteredClients.length}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectMapOverview;

