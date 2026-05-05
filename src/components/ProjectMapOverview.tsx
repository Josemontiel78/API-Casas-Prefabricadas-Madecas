
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClients } from '@/services/db';
import { Client } from '@/types';
import { Users, MapPin, ExternalLink, Home, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    const allClients = getClients().filter(c => c.location);
    setClients(allClients);
  }, []);

  const filteredClients = clients.filter(c => 
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.rut.includes(searchQuery)
  );

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Monitor Geográfico de Proyectos</h2>
          <p className="text-slate-500 text-sm">Visualización global de clientes georeferenciados</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 w-full md:w-96">
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

      <div className="flex-1 min-h-[600px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
        <MapContainer
          center={[-33.4489, -70.6693]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
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
    </div>
  );
};

export default ProjectMapOverview;
