
import React, { useState, useCallback } from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MapPin, Info, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Access the key through multiple possible patterns for maximum compatibility
const getApiKey = () => {
  // 1. Try Vite's static replacement (defined in vite.config.ts)
  try {
    const definedKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (definedKey && definedKey !== 'undefined' && definedKey !== '') {
      return definedKey;
    }
  } catch (e) {}

  // 2. Try Vite's standard import.meta.env with VITE_ prefix
  const metaEnvKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY;
  if (metaEnvKey && metaEnvKey !== '') return metaEnvKey;

  // 3. Fallback for some specific deployment scenarios
  return (import.meta as any).env?.GOOGLE_MAPS_PLATFORM_KEY || '';
};

const API_KEY = getApiKey();

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

interface MapProjectPickerProps {
  onLocationSelect: (location: { lat: number; lng: number }) => void;
  initialLocation?: { lat: number; lng: number };
}

const MapProjectPicker: React.FC<MapProjectPickerProps> = ({ onLocationSelect, initialLocation }) => {
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(initialLocation || null);
  const [saved, setSaved] = useState(false);

  const handleMapClick = useCallback((e: any) => {
    if (e.detail?.latLng) {
      const newLoc = { lat: e.detail.latLng.lat, lng: e.detail.latLng.lng };
      setSelectedLocation(newLoc);
      setSaved(false);
    }
  }, []);

  const handleSave = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  if (!hasValidKey) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-6">
          <MapPin className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Configuración de Mapa Requirida</h2>
        <p className="text-slate-500 max-w-md mb-8">
          Para habilitar la georeferenciación de proyectos, debe configurar su API Key de Google Maps Platform.
        </p>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-left w-full max-w-lg space-y-4">
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">1</div>
            <p className="text-sm text-slate-600">Obtenga una API Key en <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" className="text-indigo-600 underline">Google Cloud Console</a>.</p>
          </div>
          <div className="flex gap-3">
            <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">2</div>
            <p className="text-sm text-slate-600">Agregue la variable <code>GOOGLE_MAPS_PLATFORM_KEY</code> en la configuración de <strong>Secrets</strong> del proyecto.</p>
          </div>
        </div>
        
        {/* DEMO PLACEHOLDER FOR UI VISUALIZATION */}
        <div className="mt-8 pt-8 border-t border-slate-200 w-full flex flex-col items-center">
             <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-4">Vista previa del marcador</p>
             <div className="relative w-full h-48 bg-slate-200 rounded-xl overflow-hidden flex items-center justify-center">
                <div className="absolute inset-0 bg-[url('https://www.google.com/maps/vt/pb=!1m4!1m3!1i12!2i1261!3i1622!2m3!1e0!2sm!3i383174914!3m8!2ses-CL!3spr!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0')] opacity-30 bg-center"></div>
                <div className="z-10 bg-white p-4 rounded-lg shadow-xl flex items-center gap-3">
                    <Pin background="#4F46E5" glyphColor="#fff" />
                    <span className="text-sm font-medium">Marcador Manual Movible</span>
                </div>
             </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Georeferenciación Casa Prefabricada</h3>
            <p className="text-xs text-slate-500">Haga clic en el mapa para situar la ubicación exacta del proyecto</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!selectedLocation || saved}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm",
            saved ? "bg-emerald-500 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          )}
        >
          {saved ? <><Save className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Fijar Ubicación</>}
        </button>
      </div>

      <div className="h-[600px] w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200 relative">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            defaultCenter={initialLocation || { lat: -33.4489, lng: -70.6693 }} // Santiago, Chile
            defaultZoom={12}
            mapId="DEMO_MAP_ID"
            onClick={handleMapClick}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {selectedLocation && (
              <AdvancedMarker position={selectedLocation}>
                <Pin background="#4F46E5" glyphColor="#fff" />
              </AdvancedMarker>
            )}
          </Map>
        </APIProvider>
        
        {/* Info Overlay */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 shadow-lg flex items-center gap-3 max-w-sm">
           <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />
           <p className="text-xs text-slate-600">
             {selectedLocation 
               ? `Ubicación Seleccionada: ${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}` 
               : "Haz clic en el mapa para establecer un punto de referencia."}
           </p>
        </div>
      </div>
    </div>
  );
};

export default MapProjectPicker;
