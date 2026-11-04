import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Info, 
  Save, 
  Crosshair, 
  Navigation, 
  Target, 
  Search, 
  Loader2, 
  CheckCircle2, 
  Compass,
  MessageCircle,
  ExternalLink,
  HelpCircle,
  ClipboardPaste,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  parseGeoInput, 
  parseSingleLatitude, 
  parseSingleLongitude, 
  isWithinChile,
  ParsedLocation 
} from '@/utils/geoParser';

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
  const [whatsappPasteInput, setWhatsappPasteInput] = useState('');
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'info' | 'warning' | 'error' } | null>(null);

  // Sync internal search input if external query updates and user hasn't typed
  useEffect(() => {
    if (externalSearchQuery && !searchInput) {
      setSearchInput(externalSearchQuery);
    }
  }, [externalSearchQuery]);

  // Update Lat/Lng inputs whenever selectedLocation changes
  const updateMarkerAndNotify = useCallback((pos: L.LatLng, extraNote?: string) => {
    setSelectedLocation(pos);
    setLatInput(pos.lat.toFixed(6));
    setLngInput(pos.lng.toFixed(6));
    onLocationSelect({ lat: pos.lat, lng: pos.lng });
    
    const isChile = isWithinChile(pos.lat, pos.lng);
    let note = extraNote || `Ubicación fijada en ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    if (isChile) {
      note += ' (Hemisferio Sur y Oeste - Chile 🇨🇱)';
    }
    
    setStatusMessage({
      text: note,
      type: isChile ? 'success' : 'warning'
    });
    setTimeout(() => setStatusMessage(null), 5000);
  }, [onLocationSelect]);

  // Geocoding & coordinate search handler
  const executeSearch = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 3) return;

    // 1. SMART CHECK: First verify if user pasted coordinates, a WhatsApp link or cardinal text (e.g., "40.3127 s y 73.4207 w")
    const parsedGeo = parseGeoInput(trimmed);
    if (parsedGeo) {
      const newPos = L.latLng(parsedGeo.lat, parsedGeo.lng);
      setFlyCenter(newPos);
      updateMarkerAndNotify(newPos, `Coordenadas reconocidas: ${parsedGeo.formattedDisplay}${parsedGeo.notes ? ` (${parsedGeo.notes})` : ''}`);
      return;
    }

    setIsSearching(true);
    setStatusMessage({ text: 'Buscando dirección en el mapa...', type: 'info' });

    try {
      // Build search query, appending country or comuna context if appropriate
      let fullQuery = trimmed;
      if (comuna && !trimmed.toLowerCase().includes(comuna.toLowerCase())) {
        fullQuery += `, ${comuna}`;
      }
      if (!fullQuery.toLowerCase().includes('chile')) {
        fullQuery += ', Chile';
      }

      // Try Nominatim (OpenStreetMap) first with Chilean context
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
          updateMarkerAndNotify(newPos, `Ubicado: ${data[0].display_name.split(',').slice(0, 3).join(',')}`);
          found = true;
        }
      }

      // If not found, try Photon Komoot fallback
      if (!found) {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.features && pData.features.length > 0) {
            const [lng, lat] = pData.features[0].geometry.coordinates;
            const newPos = L.latLng(lat, lng);
            setFlyCenter(newPos);
            updateMarkerAndNotify(newPos, 'Ubicación aproximada encontrada');
            found = true;
          }
        }
      }

      if (!found) {
        setStatusMessage({
          text: 'No se encontró la dirección exacta. Puedes ingresar las coordenadas o hacer clic directamente en el mapa.',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error("Error geocodificando:", error);
      setStatusMessage({
        text: 'Error en búsqueda automática. Puedes ingresar coordenadas o marcar en el mapa.',
        type: 'error'
      });
    } finally {
      setIsSearching(false);
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
      setStatusMessage({ text: 'Tu navegador no soporta geolocalización GPS.', type: 'warning' });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPos = L.latLng(position.coords.latitude, position.coords.longitude);
        setFlyCenter(newPos);
        updateMarkerAndNotify(newPos, 'Ubicación GPS obtenida desde tu dispositivo');
        setIsLocating(false);
      },
      (error) => {
        console.error("Error GPS:", error);
        setStatusMessage({
          text: 'No se pudo acceder a la señal GPS. Verifica los permisos de ubicación en tu navegador.',
          type: 'warning'
        });
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  // Process manual Lat and Lng inputs with intelligent Chile hemisphere protection
  const handleApplyCoordinates = () => {
    // 1. Check if user pasted a combined string or URL in either box
    const combinedTest = `${latInput} ${lngInput}`.trim();
    const parsedCombined = parseGeoInput(combinedTest);
    if (parsedCombined) {
      const newPos = L.latLng(parsedCombined.lat, parsedCombined.lng);
      setFlyCenter(newPos);
      updateMarkerAndNotify(newPos, `${parsedCombined.formattedDisplay} ${parsedCombined.notes ? `(${parsedCombined.notes})` : ''}`);
      return;
    }

    // 2. Parse individual lat and lng
    const parsedLatResult = parseSingleLatitude(latInput);
    const parsedLngResult = parseSingleLongitude(lngInput);

    if (parsedLatResult && parsedLngResult) {
      const lat = parsedLatResult.value;
      const lng = parsedLngResult.value;
      const newPos = L.latLng(lat, lng);
      setFlyCenter(newPos);

      let note = `Coordenadas aplicadas: ${lat}, ${lng}`;
      if (parsedLatResult.wasCorrected || parsedLngResult.wasCorrected) {
        note = `Coordenadas ajustadas a Hemisferio Sur (-) y Oeste (-) para Chile (${lat}, ${lng})`;
      }

      updateMarkerAndNotify(newPos, note);
    } else {
      setStatusMessage({
        text: 'Por favor ingresa coordenadas válidas (ejemplo: -40.3127 s y -73.4207 w o pega el enlace de WhatsApp).',
        type: 'warning'
      });
    }
  };

  // Process input from WhatsApp / Google Maps paste box
  const handleApplyWhatsappLocation = (rawText: string) => {
    if (!rawText.trim()) return;

    const parsed = parseGeoInput(rawText);
    if (parsed) {
      const newPos = L.latLng(parsed.lat, parsed.lng);
      setFlyCenter(newPos);
      updateMarkerAndNotify(newPos, `Ubicación WhatsApp/Maps procesada: ${parsed.formattedDisplay} ${parsed.notes ? `(${parsed.notes})` : ''}`);
      setWhatsappPasteInput('');
      setShowWhatsappModal(false);
    } else {
      setStatusMessage({
        text: 'No pudimos reconocer coordenadas en ese texto o enlace. Por favor verifica que incluya números de latitud/longitud o enlace de Google Maps.',
        type: 'error'
      });
    }
  };

  const isLocationInChile = selectedLocation ? isWithinChile(selectedLocation.lat, selectedLocation.lng) : false;

  return (
    <div className="space-y-3 w-full">
      {/* Top Search Controls */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Escribe dirección, coordenadas (ej: 40.3127 s y 73.4207 w) o enlace..."
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

          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => executeSearch(searchInput)}
              disabled={isSearching}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              title="Buscar en el mapa"
            >
              {isSearching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              <span>Buscar</span>
            </button>

            {/* Button for WhatsApp / External Location Paste */}
            <button
              type="button"
              onClick={() => setShowWhatsappModal(!showWhatsappModal)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap",
                showWhatsappModal 
                  ? "bg-emerald-700 text-white" 
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              )}
              title="Pegar ubicación compartida por WhatsApp o Google Maps"
            >
              <MessageCircle size={14} />
              <span>Pegar de WhatsApp</span>
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
              title="Centrar en mi ubicación actual"
            >
              {isLocating ? <Loader2 size={14} className="animate-spin" /> : <Compass size={14} />}
              <span className="hidden md:inline">Mi GPS</span>
            </button>
          </div>
        </div>

        {/* Dedicated WhatsApp / Link Extraction Drawer */}
        {showWhatsappModal && (
          <div className="bg-emerald-50/80 border border-emerald-200 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <MessageCircle size={15} className="text-emerald-700" />
                Pegar ubicación recibida por WhatsApp, Google Maps o Redes Sociales
              </span>
              <button
                type="button"
                onClick={() => setShowWhatsappModal(false)}
                className="text-emerald-700 hover:text-emerald-900 text-xs font-bold px-1"
              >
                ✕ Cerrar
              </button>
            </div>
            <p className="text-[11px] text-emerald-800 leading-tight">
              Pega aquí el mensaje completo de WhatsApp, el enlace de Google Maps (ej: <code className="bg-white/70 px-1 rounded font-mono">https://maps.google.com/?q=-40.3127,-73.4207</code>) o las coordenadas con letras (ej: <code className="bg-white/70 px-1 rounded font-mono">40.3127 s y 73.4207 w</code>). El sistema convertirá automáticamente el hemisferio para situarlo en Chile.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Pega aquí el enlace o texto de WhatsApp..."
                value={whatsappPasteInput}
                onChange={(e) => setWhatsappPasteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyWhatsappLocation(whatsappPasteInput);
                  }
                }}
                className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <button
                type="button"
                onClick={() => handleApplyWhatsappLocation(whatsappPasteInput)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <ClipboardPaste size={14} />
                <span>Aplicar Ubicación</span>
              </button>
            </div>
          </div>
        )}

        {/* Status Message / Notification Banner */}
        {statusMessage && (
          <div className={cn(
            "text-xs font-semibold p-2.5 rounded-lg border flex items-center gap-2 animate-in fade-in duration-150",
            statusMessage.type === 'success' && "bg-emerald-50 text-emerald-800 border-emerald-200",
            statusMessage.type === 'info' && "bg-blue-50 text-blue-800 border-blue-200",
            statusMessage.type === 'warning' && "bg-amber-50 text-amber-800 border-amber-200",
            statusMessage.type === 'error' && "bg-red-50 text-red-800 border-red-200"
          )}>
            {statusMessage.type === 'success' && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
            {statusMessage.type === 'info' && <Info size={15} className="text-blue-600 shrink-0" />}
            {statusMessage.type === 'warning' && <AlertTriangle size={15} className="text-amber-600 shrink-0" />}
            {statusMessage.type === 'error' && <Info size={15} className="text-red-600 shrink-0" />}
            <span className="flex-1">{statusMessage.text}</span>
          </div>
        )}

        {/* Manual Coordinates Input Row with Chile Hemisphere Protections */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <span>Coordenadas:</span>
          </span>
          
          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-sm">
            <span className="text-[10px] text-slate-500 font-bold" title="Latitud (Sur en Chile es negativo -)">Lat (Sur):</span>
            <input 
              type="text" 
              placeholder="-40.3127 o 40.3127 s" 
              value={latInput} 
              onChange={(e) => setLatInput(e.target.value)}
              onBlur={() => {
                const parsed = parseSingleLatitude(latInput);
                if (parsed) setLatInput(parsed.value.toString());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCoordinates();
                }
              }}
              className="w-28 p-0.5 px-1 bg-transparent border-0 text-xs font-mono font-bold text-slate-800 outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-300 shadow-sm">
            <span className="text-[10px] text-slate-500 font-bold" title="Longitud (Oeste en Chile es negativo -)">Lng (Oeste):</span>
            <input 
              type="text" 
              placeholder="-73.4207 o 73.4207 w" 
              value={lngInput} 
              onChange={(e) => setLngInput(e.target.value)}
              onBlur={() => {
                const parsed = parseSingleLongitude(lngInput);
                if (parsed) setLngInput(parsed.value.toString());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCoordinates();
                }
              }}
              className="w-28 p-0.5 px-1 bg-transparent border-0 text-xs font-mono font-bold text-slate-800 outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleApplyCoordinates}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-[11px] transition shadow-sm"
          >
            Aplicar Coordenadas
          </button>

          {selectedLocation && (
            <div className="ml-auto flex items-center gap-2">
              <span className={cn(
                "text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border",
                isLocationInChile 
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200" 
                  : "text-amber-800 bg-amber-50 border-amber-300"
              )}>
                <CheckCircle2 size={12} />
                {isLocationInChile ? "Chile 🇨🇱 (Sur/Oeste)" : "Coordenadas fijadas"}
              </span>

              <a
                href={`https://maps.google.com/?q=${selectedLocation.lat},${selectedLocation.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-slate-500 hover:text-emerald-600 flex items-center gap-0.5 font-semibold underline"
                title="Verificar en Google Maps"
              >
                <span>Ver en Maps</span>
                <ExternalLink size={10} />
              </a>
            </div>
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
              ? `${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)} (Haz clic o arrastra el marcador)` 
              : "Haz clic en el mapa para ubicar el predio/terreno"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MapProjectPicker;
