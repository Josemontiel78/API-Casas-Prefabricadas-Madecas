import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Info, Save, Crosshair, Navigation, Target, Search, Loader2, CheckCircle2, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fix for Leaflet default icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProjectPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number };
  externalSearchQuery?: string;
  rolPropiedad?: string;
  comuna?: string;
}

// Component to handle map clicks and drag events
const LocationPickerMarker = ({ 
  position, 
  setPosition,
  onLocationChange 
}: { 
  position: L.LatLng | null; 
  setPosition: (pos: L.LatLng) => void;
  onLocationChange: (pos: L.LatLng) => void;
}) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      onLocationChange(e.latlng);
    },
  });

  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latlng = marker.getLatLng();
          setPosition(latlng);
          onLocationChange(latlng);
        }
      },
    }),
    [setPosition, onLocationChange],
  );

  return position === null ? null : (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
};

// Component to handle smooth map centering and size invalidation
const MapController = ({ centerPos }: { centerPos: L.LatLngExpression | null }) => {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);

  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 16, { duration: 1.2 });
    }
  }, [centerPos, map]);

  return null;
};

const DEFAULT_CENTER = { lat: -40.5744, lng: -73.1360 }; // Defaulting to Los Lagos / Osorno / Chile central-south hub

const MapProjectPicker: React.FC<MapProjectPickerProps> = ({ 
  onLocationSelect, 
  initialLocation, 
  externalSearchQuery,
  rolPropiedad,
  comuna
}) => {
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(
    initialLocation ? L.latLng(initialLocation.lat, initialLocation.lng) : null
  );
  const [flyCenter, setFlyCenter] = useState<L.LatLng | null>(null);
  const [searchInput, setSearchInput] = useState(externalSearchQuery || '');
  const [latInput, setLatInput] = useState(initialLocation?.lat ? initialLocation.lat.toString() : '');
  const [lngInput, setLngInput] = useState(initialLocation?.lng ? initialLocation.lng.toString() : '');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync internal search input if external query updates and user hasn't typed
  useEffect(() => {
    if (externalSearchQuery && !searchInput) {
      setSearchInput(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Update Lat/Lng inputs whenever selectedLocation changes
  const updateMarkerAndNotify = useCallback((pos: L.LatLng) => {
    setSelectedLocation(pos);
    setLatInput(pos.lat.toFixed(6));
    setLngInput(pos.lng.toFixed(6));
    onLocationSelect({ lat: pos.lat, lng: pos.lng });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  }, [onLocationSelect]);

  // Auto geocoding lookup function
  const executeSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 3) return;

    setIsSearching(true);
    setSearchStatus('Buscando ubicación...');

    try {
      // Build search query, appending country or comuna context if appropriate
      let fullQuery = trimmed;
      if (comuna && !trimmed.toLowerCase().includes(comuna.toLowerCase())) {
        fullQuery += `, ${comuna}`;
      }
      if (!fullQuery.toLowerCase().includes('chile')) {
        fullQuery += ', Chile';
      }

      // 1. Try Nominatim (OpenStreetMap) first with Chilean context
      let found = false;
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`;
      const res = await fetch(nominatimUrl, { headers: { 'Accept-Language': 'es' } });
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          const newPos = L.latLng(lat, lng);
          setFlyCenter(newPos);
          updateMarkerAndNotify(newPos);
          setSearchStatus(`Ubicado: ${data[0].display_name.split(',').slice(0, 3).join(',')}`);
          found = true;
        }
      }

      // 2. If not found, try Photon Komoot fallback
      if (!found) {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.features && pData.features.length > 0) {
            const [lng, lat] = pData.features[0].geometry.coordinates;
            const newPos = L.latLng(lat, lng);
            setFlyCenter(newPos);
            updateMarkerAndNotify(newPos);
            setSearchStatus('Ubicación encontrada en mapa');
            found = true;
          }
        }
      }

      if (!found) {
        setSearchStatus('No se encontró dirección exacta. Puedes hacer clic en el mapa para marcar.');
      }
    } catch (error) {
      console.error("Error geocodificando:", error);
      setSearchStatus('Error en búsqueda automática. Puedes seleccionar el punto en el mapa.');
    } finally {
      setIsSearching(false);
      setTimeout(() => setSearchStatus(null), 5000);
    }
  };


  // Search by Rol button
  const handleSearchByRol = () => {
    if (rolPropiedad) {
      const query = `Rol ${rolPropiedad} ${comuna || ''}`;
      setSearchInput(query);
      executeSearch(query);
    } else {
      executeSearch(searchInput);
    }
  };

  // Find user's live GPS
  const handleFindMyLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Tu dispositivo no soporta geolocalización GPS");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPos = L.latLng(position.coords.latitude, position.coords.longitude);
        setFlyCenter(newPos);
        updateMarkerAndNotify(newPos);
        setIsLocating(false);
        setSearchStatus('Ubicación GPS obtenida exitosamente');
        setTimeout(() => setSearchStatus(null), 3000);
      },
      (error) => {
        console.error("Error GPS:", error);
        alert("No se pudo obtener la señal GPS actual. Por favor verifica los permisos.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Apply manual lat/lng coordinate inputs
  const handleApplyCoordinates = () => {
    const parsedLat = parseFloat(latInput);
    const parsedLng = parseFloat(lngInput);
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      const newPos = L.latLng(parsedLat, parsedLng);
      setFlyCenter(newPos);
      updateMarkerAndNotify(newPos);
    } else {
      alert("Por favor ingresa coordenadas válidas (ejemplo: -40.5744, -73.1360)");
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Top Search Controls */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por dirección, calle, sector, comuna o rol..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  executeSearch(searchInput);
                }
              }}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => executeSearch(searchInput)}
              disabled={isSearching}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Buscar</span>
            </button>

            {rolPropiedad && (
              <button
                type="button"
                onClick={handleSearchByRol}
                disabled={isSearching}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-bold transition whitespace-nowrap"
              >
                Buscar Rol {rolPropiedad}
              </button>
            )}

            <button
              type="button"
              onClick={handleFindMyLocation}
              disabled={isLocating}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
            >
              {isLocating ? <Loader2 size={14} className="animate-spin" /> : <Compass size={14} />}
              <span className="hidden md:inline">Mi GPS</span>
            </button>
          </div>
        </div>

        {/* Search Status Toast / Notification */}
        {searchStatus && (
          <div className="text-[11px] font-semibold text-slate-700 bg-white p-2 rounded-lg border border-slate-200 flex items-center gap-2 animate-in fade-in">
            <Info size={14} className="text-emerald-600 shrink-0" />
            <span>{searchStatus}</span>
          </div>
        )}

        {/* Manual Coordinates Input Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Coordenadas:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold">Lat:</span>
            <input 
              type="text" 
              placeholder="-40.5744" 
              value={latInput} 
              onChange={(e) => setLatInput(e.target.value)}
              className="w-24 p-1 px-2 bg-white border border-slate-300 rounded text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-400 font-bold">Lng:</span>
            <input 
              type="text" 
              placeholder="-73.1360" 
              value={lngInput} 
              onChange={(e) => setLngInput(e.target.value)}
              className="w-24 p-1 px-2 bg-white border border-slate-300 rounded text-xs font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyCoordinates}
            className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold text-[10px] uppercase transition"
          >
            Aplicar
          </button>

          {selectedLocation && (
            <span className="ml-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} />
              Georreferenciado
            </span>
          )}
        </div>
      </div>

      {/* Map View */}
      <div className="h-[360px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative z-0">
        <MapContainer
          center={initialLocation || DEFAULT_CENTER}
          zoom={selectedLocation ? 15 : 11}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <LocationPickerMarker 
            position={selectedLocation} 
            setPosition={setSelectedLocation}
            onLocationChange={updateMarkerAndNotify}
          />
          
          <MapController centerPos={flyCenter} />
        </MapContainer>
        
        {/* Floating guidance badge */}
        <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-200 shadow-md flex items-center gap-2 z-[1000] pointer-events-none text-xs">
          <MapPin size={14} className="text-emerald-600 shrink-0" />
          <span className="text-[11px] font-bold text-slate-700">
            {selectedLocation 
              ? `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)} (Haz clic o arrastra para mover)` 
              : "Haz clic en el mapa para ubicar el predio/terreno"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapProjectPicker;
