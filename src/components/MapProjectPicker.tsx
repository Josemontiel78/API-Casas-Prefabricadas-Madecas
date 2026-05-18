
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Info, Save, Crosshair, Navigation, Target, Search, Loader2 } from 'lucide-react';
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

L.Marker.prototype.options.icon = DefaultIcon;

interface MapProjectPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number };
  externalSearchQuery?: string;
}

// Component to handle map clicks
const LocationPickerMarker = ({ position, setPosition }: { position: L.LatLngExpression | null, setPosition: (pos: L.LatLng) => void }) => {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  const markerRef = useRef<L.Marker>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          setPosition(marker.getLatLng());
        }
      },
    }),
    [setPosition],
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

// Component to handle live location and map centering
const MapController = ({ centerPos }: { centerPos: L.LatLngExpression | null }) => {
  const map = useMap();
  
  useEffect(() => {
    // Crucial for Leaflet maps inside modals or tabs
    setTimeout(() => {
      map.invalidateSize();
    }, 500);
  }, [map]);

  useEffect(() => {
    if (centerPos) {
      map.flyTo(centerPos, 16);
    }
  }, [centerPos, map]);
  return null;
};

const DEFAULT_CENTER = { lat: -33.4489, lng: -70.6693 };

const MapProjectPicker: React.FC<MapProjectPickerProps> = ({ onLocationSelect, initialLocation, externalSearchQuery }) => {
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(
    initialLocation ? L.latLng(initialLocation.lat, initialLocation.lng) : null
  );
  const [liveLocation, setLiveLocation] = useState<L.LatLng | null>(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const lastSearchedQuery = useRef<string>('');

  // External search logic
  useEffect(() => {
    const query = (externalSearchQuery || '').trim();
    if (!query || query.length < 5 || query === lastSearchedQuery.current) return;

    // Use a secondary check: if initialLocation is already provided, 
    // maybe we don't need to auto-search on the first mount if the query matches the "saved" one.
    // But for now, let's just properly debounce and check the ref.

    const timer = setTimeout(async () => {
      // Mark as searched BEFORE the async calls to avoid race conditions with renders
      lastSearchedQuery.current = query;
      setSearching(true);
      try {
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`);
        const data = await response.json();
        
        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates;
          const newPos = L.latLng(lat, lng);
          
          // Only update if location is significantly different
          setSelectedLocation(prev => {
            if (prev && Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001) return prev;
            return newPos;
          });
          setLiveLocation(prev => {
            if (prev && Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001) return prev;
            return newPos;
          });
          
          onLocationSelect({ lat, lng });
        }
      } catch (error) {
        console.error("Error en búsqueda automática:", error);
      } finally {
        setSearching(false);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [externalSearchQuery, onLocationSelect]);

  const handleSave = () => {
    if (selectedLocation) {
      onLocationSelect({ lat: selectedLocation.lat, lng: selectedLocation.lng });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const findMyLocation = () => {
    setLocating(true);
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newPos = L.latLng(position.coords.latitude, position.coords.longitude);
        setLiveLocation(newPos);
        setSelectedLocation(newPos);
        onLocationSelect({ lat: newPos.lat, lng: newPos.lng });
        setLocating(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        alert("No se pudo obtener tu ubicación actual.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-4 w-full">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
              {searching ? 'Sincronizando ubicación...' : 'Ubicación Georeferenciada'}
            </h3>
            <p className="text-[10px] text-slate-500">Mueve el marcador o usa tu ubicación actual</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={findMyLocation}
            disabled={locating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-[10px] transition-all shadow-lg shadow-blue-100"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            MI UBICACIÓN
          </button>
          
          <button
            type="button"
            onClick={handleSave}
            disabled={!selectedLocation || saved}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-[10px] transition-all shadow-lg",
              saved ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            )}
          >
            {saved ? <><Save className="w-4 h-4" /> FIJADO</> : <><Save className="w-4 h-4" /> FIJAR PUNTO</>}
          </button>
        </div>
      </div>

      <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative z-0">
        <MapContainer
          center={initialLocation || DEFAULT_CENTER}
          zoom={selectedLocation ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <LocationPickerMarker position={selectedLocation} setPosition={setSelectedLocation} />
          
          <MapController centerPos={liveLocation} />
        </MapContainer>
        
        {/* Info Overlay */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg flex items-center gap-3 z-[1000] pointer-events-none">
           <Info className="w-4 h-4 text-indigo-600 flex-shrink-0" />
           <p className="text-[10px] font-bold text-slate-700">
             {selectedLocation 
               ? `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}` 
               : "Haz clic en el mapa para posicionar"}
           </p>
        </div>
      </div>
    </div>
  );
};

export default MapProjectPicker;
