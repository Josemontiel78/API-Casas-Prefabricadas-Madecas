import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getClients, getContracts, getBudgets, getUsers, saveClient, deleteClient } from '@/services/db';
import { Client, Contract, Budget, SystemUser } from '@/types';
import { 
  Users, 
  MapPin, 
  ExternalLink, 
  Home, 
  Phone, 
  Target, 
  Navigation, 
  Search, 
  Info, 
  Edit3, 
  FileText, 
  Tag, 
  Building, 
  Mail, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Save, 
  X, 
  MessageSquare,
  UserCheck,
  Compass
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MapProjectPicker from '@/components/MapProjectPicker';

// Component to handle smooth map centering
const MapController = ({ centerPos }: { centerPos: L.LatLngExpression | null }) => {
  const map = useMap();
  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 14, { duration: 1.2 });
    }
  }, [centerPos, map]);
  return null;
};

// Create Custom Marker Icon with Owner Name & Pin
const createOwnerMarkerIcon = (nombre: string, rolPropiedad?: string, isContracted = false) => {
  const shortName = nombre.length > 20 ? nombre.substring(0, 18) + '…' : nombre;
  const pinColor = isContracted ? '#059669' : '#2563eb'; // Emerald for contract, Blue for prospect
  const badgeBg = isContracted ? '#ecfdf5' : '#eff6ff';
  const badgeBorder = isContracted ? '#059669' : '#3b82f6';
  const badgeText = isContracted ? '#065f46' : '#1e40af';

  return L.divIcon({
    className: 'owner-marker-custom',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;">
        <!-- Propietario Tag -->
        <div style="background-color: ${badgeBg}; border: 1.5px solid ${badgeBorder}; color: ${badgeText}; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; white-space: nowrap; box-shadow: 0 4px 8px rgba(0,0,0,0.18); display: flex; align-items: center; gap: 5px; margin-bottom: 3px;">
          <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ${pinColor};"></span>
          <span>${shortName}</span>
          ${rolPropiedad ? `<span style="font-size: 9px; opacity: 0.85; font-family: monospace; font-weight: bold; background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px;">ROL ${rolPropiedad}</span>` : ''}
        </div>
        <!-- Marker Pin -->
        <div style="width: 26px; height: 26px; background-color: ${pinColor}; border: 2.5px solid #ffffff; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); box-shadow: 0 4px 6px rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center;">
          <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
    popupAnchor: [0, -42]
  });
};

const ProjectMapOverview: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<string>('Todos');
  const [selectedStage, setSelectedStage] = useState<string>('Todos');
  const [userLocation, setUserLocation] = useState<L.LatLngExpression | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Modals state: Mini Ficha / Ficha Completa / Editor
  const [selectedClientForFicha, setSelectedClientForFicha] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isFullFichaOpen, setIsFullFichaOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = async () => {
    try {
      const [allClients, allContracts, allBudgets, allUsers] = await Promise.all([
        getClients(),
        getContracts(),
        getBudgets(),
        getUsers()
      ]);
      setClients(allClients);
      setContracts(allContracts);
      setBudgets(allBudgets);
      setUsers(allUsers);

      // Check if arriving from ClientManager with targeted client
      const targetClientId = window.localStorage.getItem('map_target_client_id');
      const targetLat = window.localStorage.getItem('map_target_lat');
      const targetLng = window.localStorage.getItem('map_target_lng');

      if (targetLat && targetLng) {
        setUserLocation([parseFloat(targetLat), parseFloat(targetLng)]);
        if (targetClientId) {
          const found = allClients.find(c => c.id === targetClientId);
          if (found) {
            setSelectedClientForFicha(found);
          }
        }
        window.localStorage.removeItem('map_target_client_id');
        window.localStorage.removeItem('map_target_lat');
        window.localStorage.removeItem('map_target_lng');
      }
    } catch (error) {
      console.error("Error cargando datos de mapa:", error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const findMyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización GPS");
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
        alert("No se pudo obtener la ubicación actual.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleAddressSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // Check if query matches a client's name or rol
    const match = clients.find(c => 
      c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.rol_propiedad && c.rol_propiedad.toLowerCase().includes(searchQuery.toLowerCase())) ||
      c.rut.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (match && match.location) {
      setUserLocation([match.location.lat, match.location.lng]);
      setSelectedClientForFicha(match);
      return;
    }

    // Otherwise geocode via Nominatim
    setIsLocating(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Chile')}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setUserLocation([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        window.dispatchEvent(new CustomEvent('app-notification', { 
          detail: { message: 'No se encontró la dirección en el mapa.', type: 'info' } 
        }));
      }
    } catch (err) {
      console.error("Error en geocodificación:", err);
    } finally {
      setIsLocating(false);
    }
  };

  // Filter clients with location
  const geocodedClients = useMemo(() => {
    return clients.filter(c => c.location && typeof c.location.lat === 'number' && typeof c.location.lng === 'number');
  }, [clients]);

  const filteredClients = useMemo(() => {
    return geocodedClients.filter(c => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        c.nombre.toLowerCase().includes(q) || 
        c.rut.toLowerCase().includes(q) ||
        (c.rol_propiedad && c.rol_propiedad.toLowerCase().includes(q)) ||
        (c.domicilio && c.domicilio.toLowerCase().includes(q)) ||
        (c.comuna && c.comuna.toLowerCase().includes(q));

      const matchesSeller = selectedSeller === 'Todos' || c.vendedor_nombre === selectedSeller || c.vendedor_id === selectedSeller;
      const matchesStage = selectedStage === 'Todos' || (c.etapa_venta || 'Registro') === selectedStage;

      return matchesSearch && matchesSeller && matchesStage;
    });
  }, [geocodedClients, searchQuery, selectedSeller, selectedStage]);

  // Open Full Ficha
  const handleOpenFullFicha = (client: Client) => {
    setSelectedClientForFicha(client);
    setIsFullFichaOpen(true);
  };

  // Open Edit Modal directly from Map
  const handleOpenEditModal = (client: Client) => {
    setEditingClient({ ...client });
    setIsEditModalOpen(true);
  };

  // Save changes to client
  const handleSaveClientEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      await saveClient(editingClient);
      setIsEditModalOpen(false);
      // Reload local state
      await loadData();
      if (selectedClientForFicha?.id === editingClient.id) {
        setSelectedClientForFicha(editingClient);
      }
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Cliente actualizado correctamente desde el mapa', type: 'success' } 
      }));
    } catch (err) {
      console.error("Error actualizando cliente:", err);
    }
  };

  // Find linked budget and contract
  const getClientFinancials = (clientId: string) => {
    const clientContracts = contracts.filter(con => con.cliente_id === clientId);
    const clientBudgets = budgets.filter(b => b.cliente_id === clientId);
    const hasContract = clientContracts.length > 0;
    const latestContract = clientContracts[clientContracts.length - 1];
    const latestBudget = clientBudgets[clientBudgets.length - 1];

    return {
      hasContract,
      latestContract,
      latestBudget,
      totalAmount: latestContract?.monto_total || latestBudget?.monto_total || 0,
      contractStatus: latestContract?.estado || (latestBudget ? 'Cotizado' : 'Registro')
    };
  };

  // Unique sellers from clients
  const sellersList = useMemo(() => {
    const list = Array.from(new Set(clients.map(c => c.vendedor_nombre).filter(Boolean)));
    return ['Todos', ...list];
  }, [clients]);

  return (
    <div className="space-y-4 h-full flex flex-col pb-8">
      {/* Top Header Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Compass size={22} />
            </span>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Georeferencia Global</h2>
          </div>
          <p className="text-slate-500 text-xs font-medium">
            Visualización con marcas personalizadas, nombres de propietarios, roles de propiedad y acceso a fichas editables.
          </p>
        </div>
        
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <form onSubmit={handleAddressSearch} className="flex items-center bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex-1 md:w-72">
            <Search className="text-slate-400 w-4 h-4 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar propietario, rol, comuna..."
              className="bg-transparent border-none outline-none text-xs w-full py-1 text-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          <select 
            value={selectedSeller}
            onChange={(e) => setSelectedSeller(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none"
          >
            {sellersList.map(s => (
              <option key={s} value={s}>{s === 'Todos' ? 'Todos los Vendedores' : `Vendedor: ${s}`}</option>
            ))}
          </select>

          <select 
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="Todos">Todas las Etapas</option>
            <option value="Registro">Registro</option>
            <option value="Cotización">Cotización</option>
            <option value="Negociación">Negociación</option>
            <option value="Cierre">Cierre (Contrato)</option>
            <option value="Postventa">Postventa</option>
          </select>

          <button 
            onClick={findMyLocation}
            disabled={isLocating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            {isLocating ? <Navigation className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
            <span>Mi GPS</span>
          </button>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="flex-1 min-h-[550px] bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-200 relative z-0">
        <MapContainer
          center={[-40.5744, -73.1360]}
          zoom={10}
          style={{ height: '100%', width: '100%' }}
        >
          <MapController centerPos={userLocation} />
          
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {filteredClients.map(client => {
            const financials = getClientFinancials(client.id);
            const isContracted = financials.hasContract || client.etapa_venta === 'Cierre';

            return client.location && (
              <Marker 
                key={client.id} 
                position={[client.location.lat, client.location.lng]}
                icon={createOwnerMarkerIcon(client.nombre, client.rol_propiedad, isContracted)}
                eventHandlers={{
                  click: () => {
                    setSelectedClientForFicha(client);
                  }
                }}
              >
                {/* Mini Ficha Popup on Click */}
                <Popup className="custom-popup" minWidth={300} maxWidth={340}>
                  <div className="p-3">
                    {/* Header: Propietario */}
                    <div className="flex items-start gap-3 mb-3 pb-3 border-b border-slate-100">
                      <div className={`w-11 h-11 rounded-xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                        isContracted ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}>
                        {client.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-black text-slate-800 text-sm leading-tight truncate">
                            {client.nombre}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 font-bold">RUT: {client.rut}</p>
                        
                        {client.rol_propiedad && (
                          <div className="mt-1 inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                            <Tag size={10} />
                            <span>ROL: {client.rol_propiedad}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Mini Ficha Details */}
                    <div className="space-y-2 mb-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-tight text-[11px] font-medium">
                          {client.domicilio} {client.comuna ? `(${client.comuna})` : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <a href={`tel:${client.telefono}`} className="font-semibold hover:text-emerald-600">
                            {client.telefono}
                          </a>
                        </div>
                        {client.telefono && (
                          <a 
                            href={`https://wa.me/${client.telefono.replace(/\+/g, '').replace(/\s/g, '')}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-bold hover:bg-emerald-700 transition"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>

                      {client.correo && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-600">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{client.correo}</span>
                        </div>
                      )}

                      {client.vendedor_nombre && (
                        <div className="flex items-center gap-2 text-[11px] text-indigo-700 font-semibold pt-1 border-t border-slate-200">
                          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Ejecutivo: {client.vendedor_nombre}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Estado</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isContracted 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {client.etapa_venta || 'Registro'}
                        </span>
                      </div>

                      {financials.totalAmount > 0 && (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Monto Negocio</span>
                          <span className="text-xs font-black text-slate-800">
                            ${financials.totalAmount.toLocaleString()} CLP
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions: Ficha Completa + Editar */}
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleOpenFullFicha(client)}
                        className="py-2 px-2 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <FileText size={13} />
                        <span>Ficha Completa</span>
                      </button>

                      <button 
                        onClick={() => handleOpenEditModal(client)}
                        className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Edit3 size={13} />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Floating Bottom Summary Strip */}
        <div className="absolute bottom-4 left-4 right-4 md:right-auto bg-white/95 backdrop-blur-md p-3.5 px-5 rounded-2xl border border-slate-200 shadow-xl z-[1000] flex flex-wrap items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block shadow-sm"></span>
            <span className="font-bold text-slate-700">Contratos / Obras:</span>
            <span className="font-black text-emerald-700">
              {filteredClients.filter(c => c.etapa_venta === 'Cierre' || getClientFinancials(c.id).hasContract).length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shadow-sm"></span>
            <span className="font-bold text-slate-700">En Cotización:</span>
            <span className="font-black text-blue-700">
              {filteredClients.filter(c => c.etapa_venta !== 'Cierre' && !getClientFinancials(c.id).hasContract).length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Tag size={14} className="text-slate-400" />
            <span className="font-bold text-slate-700">Con Rol SII:</span>
            <span className="font-black text-slate-900">
              {filteredClients.filter(c => !!c.rol_propiedad).length}
            </span>
          </div>

          <div className="text-slate-400 font-medium ml-auto hidden lg:inline">
            Total en Mapa: <strong className="text-slate-800">{filteredClients.length}</strong> clientes
          </div>
        </div>
      </div>

      {/* MODAL 1: FICHA COMPLETA DEL CLIENTE */}
      {isFullFichaOpen && selectedClientForFicha && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-xl flex items-center justify-center shadow-lg">
                  {selectedClientForFicha.nombre.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black">{selectedClientForFicha.nombre}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="bg-slate-800 text-slate-300 font-mono text-xs px-2 py-0.5 rounded font-bold">
                      RUT: {selectedClientForFicha.rut}
                    </span>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-bold">
                      {selectedClientForFicha.etapa_venta || 'Registro'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setIsFullFichaOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={22} />
              </button>
            </div>

            {/* Ficha Body */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Sección Terreno & Rol */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Tag size={14} className="text-emerald-600" />
                  Identificación del Terreno y Georeferenciación
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Rol de la Propiedad (SII):</span>
                    <span className="font-extrabold text-sm text-emerald-700 font-mono">
                      {selectedClientForFicha.rol_propiedad || 'No especificado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Comuna / Región:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedClientForFicha.comuna || 'Región de Los Lagos'} {selectedClientForFicha.region ? `, ${selectedClientForFicha.region}` : ''}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 font-bold block mb-0.5">Dirección del Emplazamiento:</span>
                    <span className="font-bold text-slate-800 text-sm">
                      {selectedClientForFicha.domicilio}
                    </span>
                  </div>
                  {selectedClientForFicha.location && (
                    <div className="md:col-span-2 flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-slate-500 font-bold">Coordenadas GPS fijadas:</span>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Lat {selectedClientForFicha.location.lat.toFixed(6)}, Lng {selectedClientForFicha.location.lng.toFixed(6)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección Contacto */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Phone size={14} className="text-blue-600" />
                  Información de Contacto y Ejecutivo
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Teléfono:</span>
                    <a href={`tel:${selectedClientForFicha.telefono}`} className="font-bold text-sm text-blue-600 hover:underline">
                      {selectedClientForFicha.telefono}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block mb-0.5">Correo Electrónico:</span>
                    <span className="font-bold text-sm text-slate-800">
                      {selectedClientForFicha.correo || 'No registrado'}
                    </span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-slate-400 font-bold block mb-0.5">Ejecutivo de Ventas Asignado:</span>
                    <span className="font-bold text-sm text-indigo-700">
                      {selectedClientForFicha.vendedor_nombre || 'Sin ejecutivo asignado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección Comercial & Historial */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <DollarSign size={14} className="text-emerald-600" />
                  Estado Comercial y Documentos
                </h4>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-3">
                  {(() => {
                    const fin = getClientFinancials(selectedClientForFicha.id);
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 font-medium">Contratos Firmados:</span>
                          <span className="font-bold text-slate-800">
                            {fin.hasContract ? 'Sí (Venta Cerrada)' : 'No (En proceso comercial)'}
                          </span>
                        </div>
                        {fin.totalAmount > 0 && (
                          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                            <span className="text-slate-600 font-bold">Monto Total Involucrado:</span>
                            <span className="font-black text-sm text-emerald-700">
                              ${fin.totalAmount.toLocaleString()} CLP
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-100 flex items-center justify-between border-t border-slate-200">
              <button
                onClick={() => {
                  setIsFullFichaOpen(false);
                  handleOpenEditModal(selectedClientForFicha);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                <Edit3 size={14} />
                <span>Editar Ficha de Cliente</span>
              </button>

              <button
                onClick={() => {
                  window.localStorage.setItem('hub_selected_client_rut', selectedClientForFicha.rut);
                  window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'hub' }));
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
              >
                <span>Ir al Hub del Proyecto</span>
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR CLIENTE DIRECTO DESDE EL MAPA */}
      {isEditModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <Edit3 size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">Editar Ficha de Propietario</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Modifica datos de contacto, rol de la propiedad y ubicación georreferenciada.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Edit Form */}
            <form onSubmit={handleSaveClientEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Nombre Completo *</label>
                  <input
                    required
                    type="text"
                    value={editingClient.nombre}
                    onChange={(e) => setEditingClient({ ...editingClient, nombre: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">RUT *</label>
                  <input
                    required
                    type="text"
                    value={editingClient.rut}
                    onChange={(e) => setEditingClient({ ...editingClient, rut: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1">
                    <Tag size={12} className="text-emerald-600" />
                    Rol de la Propiedad (SII)
                  </label>
                  <input
                    type="text"
                    value={editingClient.rol_propiedad || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, rol_propiedad: e.target.value })}
                    placeholder="Ej: 1540-22"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Comuna</label>
                  <input
                    type="text"
                    value={editingClient.comuna || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, comuna: e.target.value })}
                    placeholder="Ej: Osorno, Puerto Varas"
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Dirección / Terreno *</label>
                  <input
                    required
                    type="text"
                    value={editingClient.domicilio}
                    onChange={(e) => setEditingClient({ ...editingClient, domicilio: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Teléfono *</label>
                  <input
                    required
                    type="tel"
                    value={editingClient.telefono}
                    onChange={(e) => setEditingClient({ ...editingClient, telefono: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={editingClient.correo || ''}
                    onChange={(e) => setEditingClient({ ...editingClient, correo: e.target.value })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Ejecutivo / Vendedor</label>
                  <select
                    value={editingClient.vendedor_id || ''}
                    onChange={(e) => {
                      const u = users.find(x => x.id === e.target.value);
                      setEditingClient({
                        ...editingClient,
                        vendedor_id: e.target.value,
                        vendedor_nombre: u ? u.nombre : ''
                      });
                    }}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- Sin Ejecutivo --</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.nombre} ({u.cargo || u.rol})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Etapa de Venta</label>
                  <select
                    value={editingClient.etapa_venta || 'Registro'}
                    onChange={(e) => setEditingClient({ ...editingClient, etapa_venta: e.target.value as any })}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="Registro">Registro</option>
                    <option value="Selección Modelo">Selección Modelo</option>
                    <option value="Personalización">Personalización</option>
                    <option value="Cotización">Cotización</option>
                    <option value="Negociación">Negociación</option>
                    <option value="Cierre">Cierre (Contrato)</option>
                    <option value="Postventa">Postventa</option>
                  </select>
                </div>

                {/* Direct Map Picker for Re-georeferencing */}
                <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <Compass size={14} className="text-emerald-600" />
                    Actualizar Georeferenciación del Terreno
                  </label>
                  <MapProjectPicker
                    initialLocation={editingClient.location}
                    externalSearchQuery={editingClient.domicilio}
                    rolPropiedad={editingClient.rol_propiedad}
                    comuna={editingClient.comuna}
                    onLocationSelect={(loc) => {
                      setEditingClient(prev => prev ? ({ ...prev, location: loc }) : null);
                    }}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-200 transition flex items-center gap-2"
                >
                  <Save size={16} />
                  <span>Guardar y Actualizar Mapa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectMapOverview;
