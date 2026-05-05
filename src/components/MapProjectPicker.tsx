
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Info, Save, Crosshair, Navigation, Target } from 'lucide-react';
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
      map.flyTo(centerPos, 15);
    }
  }, [centerPos, map]);
  return null;
};

const MapProjectPicker: React.FC<MapProjectPickerProps> = ({ onLocationSelect, initialLocation }) => {
  const [selectedLocation, setSelectedLocation] = useState<L.LatLng | null>(
    initialLocation ? L.latLng(initialLocation.lat, initialLocation.lng) : null
  );
  const [liveLocation, setLiveLocation] = useState<L.LatLng | null>(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);

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
        setLocating(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        alert("No se pudo obtener tu ubicación. Verifica los permisos.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="space-y-4 w-full">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Georeferenciación</h3>
            <p className="text-[10px] text-slate-500">Mueve el marcador o usa tu ubicación actual</p>
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              findMyLocation();
            }}
            disabled={locating}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-100 z-[2000]"
          >
            {locating ? <Navigation className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {locating ? "LOCALIZANDO..." : "BUSCAR MI UBICACIÓN"}
          </button>
          
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleSave();
            }}
            disabled={!selectedLocation || saved}
            className={cn(
              "flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg",
              saved ? "bg-emerald-500 text-white shadow-emerald-100" : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            )}
          >
            {saved ? <><Save className="w-4 h-4" /> GUARDADO</> : <><Save className="w-4 h-4" /> FIJAR PUNTO</>}
          </button>
        </div>
      </div>

      <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative z-0">
        <MapContainer
          center={initialLocation || { lat: -33.4489, lng: -70.6693 }}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <LocationPickerMarker position={selectedLocation} setPosition={setSelectedLocation} />
          
          {liveLocation && (
             <Marker position={liveLocation} icon={L.divIcon({
                className: 'custom-div-icon',
                html: "<div style='background-color:#4F46E5; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px rgba(79,70,229,0.5)'></div>",
                iconSize: [12, 12],
                iconAnchor: [6, 6]
             })} />
          )}

          <MapController centerPos={liveLocation} />
        </MapContainer>
        
        {/* Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg flex items-center gap-3 max-w-sm z-[1000] pointer-events-none">
           <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />
           <p className="text-xs text-slate-600">
             {selectedLocation 
               ? `Coordenadas: ${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}` 
               : "Haz clic en el mapa o selecciona 'Mi Ubicación'"}
           </p>
        </div>
      </div>

      <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
         <p className="text-xs text-indigo-700 leading-relaxed">
           <strong>Nota del Ingeniero:</strong> Este mapa utiliza OpenStreetMap, eliminando la dependencia de Google Maps y solucionando los problemas de acceso en Vercel. Soporta arrastre de marcador y geolocalización nativa.
         </p>
      </div>
    </div>
  );
};

export default MapProjectPicker;
