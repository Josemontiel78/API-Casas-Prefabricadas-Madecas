
import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClients } from '@/services/db';
import { Client } from '@/types';
import { Users, MapPin, ExternalLink, Home, Phone, Target, Navigation, Search } from 'lucide-react';
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

// Fix for Leaflet default icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const ProjectMapOverview: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('Todos');
  const [userLocation, setUserLocation] = useState<L.LatLngExpression | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    const allClients = getClients().filter(c => c.location);
    setClients(allClients);
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
        console.log("Ubicación obtenida (Resumen):", latitude, longitude);
        setUserLocation([latitude, longitude]);
        setIsLocating(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        let msg = "No se pudo obtener tu ubicación.";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            msg = "Permiso de ubicación denegado. Por favor, habilítalo en tu navegador.";
            break;
          case error.POSITION_UNAVAILABLE:
            msg = "La ubicación no está disponible actualmente.";
            break;
          case error.TIMEOUT:
            msg = "Se agotó el tiempo de espera para obtener la ubicación.";
            break;
        }
        alert(msg);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
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
    <div className="space-y-6 h-full flex flex-col">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monitor Geográfico de Proyectos</h2>
          <p className="text-slate-500 text-sm">Visualización global de clientes georeferenciados</p>
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

          <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-80">
            <MapPin className="text-slate-400 w-5 h-5 ml-2" />
            <input 
              type="text" 
              placeholder="Buscar por cliente o RUT..."
              className="bg-transparent border-none outline-none text-sm w-full py-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[600px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
            <button 
                onClick={findMyLocation}
                disabled={isLocating}
                className="bg-white p-3 rounded-xl shadow-lg border border-slate-200 text-indigo-600 hover:bg-slate-50 transition-all flex items-center gap-2 font-bold text-xs"
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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredClients.map(client => (
            client.location && (
              <Marker 
                key={client.id} 
                position={[client.location.lat, client.location.lng]}
                icon={DefaultIcon}
              >
                <Popup className="custom-popup">
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-xs">
                        {client.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{client.nombre}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{client.rut}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{client.domicilio}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{client.telefono}</span>
                      </div>
                    </div>
                    <button className="w-full py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2">
                       VER EXPEDIENTE <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Georef</p>
          <p className="text-2xl font-black text-slate-800">{clients.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">En Pantalla</p>
          <p className="text-2xl font-black text-indigo-600">{filteredClients.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
            <div>
                <h3 className="font-bold text-lg">Anexo Técnico de Cartera Georeferenciada</h3>
                <p className="text-slate-400 text-xs mt-1">Control de emplazamientos y fechas de cierre por periodo</p>
            </div>
            <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Documento de Control</p>
                <p className="text-sm font-mono">{new Date().toLocaleDateString('es-CL')}</p>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-separate border-spacing-0">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                        <th className="px-6 py-4 border-b border-slate-100">Fecha Registro</th>
                        <th className="px-6 py-4 border-b border-slate-100">Titular del Proyecto</th>
                        <th className="px-6 py-4 border-b border-slate-100">RUT / ID</th>
                        <th className="px-6 py-4 border-b border-slate-100">Coordenadas GPS</th>
                        <th className="px-6 py-4 border-b border-slate-100 text-right">Estado</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredClients.length > 0 ? filteredClients.map(client => (
                        <tr key={client.id} className="hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-6 py-4 font-mono text-slate-500 text-xs">
                                {new Date(client.fecha_registro || Date.now()).toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                                <div className="font-bold text-slate-800">{client.nombre}</div>
                                <div className="text-[10px] text-slate-400 italic truncate w-48">{client.domicilio}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-500">{client.rut}</td>
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                                    <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                        {client.location?.lat.toFixed(6)}, {client.location?.lng.toFixed(6)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[10px] font-black border border-blue-100 uppercase tracking-tighter">Vigente</span>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic bg-slate-50/50">
                                <Search className="mx-auto mb-2 opacity-20" size={32} />
                                No se encontraron registros para los filtros aplicados.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
            <span>PrefabContracts AI - Sistema de Gestión Técnica</span>
            <span>Total Auditoría: {filteredClients.length} Registros</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectMapOverview;
