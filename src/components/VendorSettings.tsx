
import React, { useState, useEffect } from 'react';
import { Vendor, AppTheme } from '@/types';
import { getVendor, saveVendor } from '@/services/db';
import { Save, Building2, Phone, Mail, MapPin, CreditCard, Landmark, Palette, Layout as LayoutIcon, Check } from 'lucide-react';

const PRESET_THEMES: AppTheme[] = [
  {
    name: 'Modern (Default)',
    background: '#f8fafc',
    text: '#0f172a',
    card: '#ffffff',
    menu: '#0f172a',
    button: '#10b981'
  },
  {
    name: 'Windows Classic',
    background: '#c0c0c0',
    text: '#000000',
    card: '#ffffff',
    menu: '#000080',
    button: '#c0c0c0'
  },
  {
    name: 'Dark Madecas',
    background: '#1a1a1a',
    text: '#ffffff',
    card: '#2d2d2d',
    menu: '#143e18',
    button: '#1b5e20'
  },
  {
    name: 'Soft Wood',
    background: '#fafaf5',
    text: '#453a33',
    card: '#ffffff',
    menu: '#453a33',
    button: '#8b5e3c'
  }
];

const VendorSettings: React.FC = () => {
  const [vendor, setVendor] = useState<Vendor>({
    id: '', nombre: '', rut: '', domicilio: '', telefono: '', correo: '',
    banco_nombre: '', banco_tipo_cuenta: '', banco_numero_cuenta: ''
  });

  const [currentTheme, setCurrentTheme] = useState<AppTheme>(PRESET_THEMES[0]);

  useEffect(() => {
    const loadData = async () => {
        const data = await getVendor();
        setVendor(data);
    };
    loadData();
    
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) {
      try {
        setCurrentTheme(JSON.parse(savedTheme));
      } catch (e) {
        console.error("Error loading theme", e);
      }
    }
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveVendor(vendor);
    localStorage.setItem('app_theme', JSON.stringify(currentTheme));
    window.dispatchEvent(new CustomEvent('app-theme-update', { detail: currentTheme }));
    window.dispatchEvent(new CustomEvent('app-notification', { 
      detail: { message: 'Configuración y tema guardados', type: 'success' } 
    }));
  };

  const applyTheme = (theme: AppTheme) => {
    setCurrentTheme(theme);
  };

  return (
    <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="lg:col-span-12">
         <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Configuración Central</h2>
         <p className="text-slate-500 font-medium">Personalización de identidad corporativa y visualización</p>
      </div>

      <div className="lg:col-span-7 space-y-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Building2 size={24} className="text-emerald-600" /> Datos de la Empresa
          </h3>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">Razón Social</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.nombre}
                  onChange={e => setVendor({...vendor, nombre: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">RUT Empresa</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.rut}
                  onChange={e => setVendor({...vendor, rut: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider flex items-center gap-2">
                  <Phone size={14} /> Teléfono
                </label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.telefono}
                  onChange={e => setVendor({...vendor, telefono: e.target.value})}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider flex items-center gap-2">
                  <Mail size={14} /> Correo Electrónico
                </label>
                <input 
                  type="email" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.correo}
                  onChange={e => setVendor({...vendor, correo: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Landmark size={20} className="text-emerald-600" /> Configuración Bancaria
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Banco</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white text-sm"
                    value={vendor.banco_nombre || ''}
                    placeholder="Ej: BANCO ESTADO"
                    onChange={e => setVendor({...vendor, banco_nombre: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tipo de Cuenta</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white text-sm"
                    value={vendor.banco_tipo_cuenta || ''}
                    placeholder="Ej: CUENTA CORRIENTE"
                    onChange={e => setVendor({...vendor, banco_tipo_cuenta: e.target.value})}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Número de Cuenta</label>
                  <input 
                    type="text" 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white font-mono"
                    value={vendor.banco_numero_cuenta || ''}
                    onChange={e => setVendor({...vendor, banco_numero_cuenta: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 shadow-lg transition active:scale-95">
                <Save size={20} /> Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Theme Customization Sidebar */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full">
          <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Palette size={24} className="text-indigo-600" /> Personalización de Temas
          </h3>

          <div className="space-y-6 flex-1">
            <div className="grid grid-cols-2 gap-3">
              {PRESET_THEMES.map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => applyTheme(theme)}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    currentTheme.name === theme.name ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-indigo-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ background: theme.menu }}></div>
                      <div className="w-3 h-3 rounded-full" style={{ background: theme.button }}></div>
                    </div>
                    {currentTheme.name === theme.name && <Check size={14} className="text-indigo-600" />}
                  </div>
                  <p className="text-xs font-bold text-slate-800 mb-1">{theme.name}</p>
                </button>
              ))}
            </div>

            <div className="space-y-4 pt-6 border-t border-slate-100">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ajuste Manual</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Fondo APP</label>
                    <div className="flex items-center gap-2">
                       <input type="color" value={currentTheme.background} onChange={e => setCurrentTheme({...currentTheme, background: e.target.value, name: 'Personalizado'})} className="w-8 h-8 rounded border-none cursor-pointer" />
                       <span className="text-[10px] font-mono">{currentTheme.background}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Color Texto</label>
                    <div className="flex items-center gap-2">
                       <input type="color" value={currentTheme.text} onChange={e => setCurrentTheme({...currentTheme, text: e.target.value, name: 'Personalizado'})} className="w-8 h-8 rounded border-none cursor-pointer" />
                       <span className="text-[10px] font-mono">{currentTheme.text}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Color Cajones</label>
                    <div className="flex items-center gap-2">
                       <input type="color" value={currentTheme.card} onChange={e => setCurrentTheme({...currentTheme, card: e.target.value, name: 'Personalizado'})} className="w-8 h-8 rounded border-none cursor-pointer" />
                       <span className="text-[10px] font-mono">{currentTheme.card}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Color Menú</label>
                    <div className="flex items-center gap-2">
                       <input type="color" value={currentTheme.menu} onChange={e => setCurrentTheme({...currentTheme, menu: e.target.value, name: 'Personalizado'})} className="w-8 h-8 rounded border-none cursor-pointer" />
                       <span className="text-[10px] font-mono">{currentTheme.menu}</span>
                    </div>
                  </div>
               </div>
            </div>

            <div className="mt-8 p-4 bg-slate-900 rounded-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-2 opacity-20 transform group-hover:rotate-12 transition-transform">
                  <LayoutIcon size={40} className="text-white" />
               </div>
               <p className="text-[10px] font-bold text-emerald-400 mb-1 uppercase tracking-widest">Vista Previa de Tema</p>
               <h4 className="text-white font-bold mb-3">{currentTheme.name}</h4>
               <div className="space-y-2">
                  <div className="h-2 w-full rounded" style={{ background: currentTheme.text, opacity: 0.1 }}></div>
                  <div className="h-2 w-2/3 rounded" style={{ background: currentTheme.text, opacity: 0.1 }}></div>
                  <div className="h-8 w-1/2 rounded-lg mt-4" style={{ background: currentTheme.button }}></div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorSettings;
