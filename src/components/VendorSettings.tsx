
import React, { useState, useEffect } from 'react';
import { Vendor } from '@/types';
import { getVendor, saveVendor } from '@/services/db';
import { Save, Building2, Phone, Mail, MapPin, CreditCard, Landmark } from 'lucide-react';

const VendorSettings: React.FC = () => {
  const [vendor, setVendor] = useState<Vendor>({
    id: '', nombre: '', rut: '', domicilio: '', telefono: '', correo: '',
    banco_nombre: '', banco_tipo_cuenta: '', banco_numero_cuenta: ''
  });

  useEffect(() => {
    setVendor(getVendor());
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveVendor(vendor);
    window.dispatchEvent(new CustomEvent('app-notification', { 
      detail: { message: 'Configuración de empresa guardada', type: 'success' } 
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Building2 size={24} className="text-emerald-600" /> Datos de la Empresa (MADECAS)
        </h3>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">Razón Social</label>
              <input 
                type="text" 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                value={vendor.nombre}
                onChange={e => setVendor({...vendor, nombre: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">RUT Empresa</label>
              <input 
                type="text" 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                value={vendor.rut}
                onChange={e => setVendor({...vendor, rut: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
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
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <Mail size={14} /> Correo Electrónico
              </label>
              <input 
                type="email" 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                value={vendor.correo}
                onChange={e => setVendor({...vendor, correo: e.target.value})}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                <MapPin size={14} /> Dirección Casa Matriz
              </label>
              <input 
                type="text" 
                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                value={vendor.domicilio}
                onChange={e => setVendor({...vendor, domicilio: e.target.value})}
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Landmark size={20} className="text-emerald-600" /> Configuración Bancaria
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Banco</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.banco_nombre || ''}
                  placeholder="Ej: BANCO ESTADO"
                  onChange={e => setVendor({...vendor, banco_nombre: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Tipo de Cuenta</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
                  value={vendor.banco_tipo_cuenta || ''}
                  placeholder="Ej: CUENTA CORRIENTE"
                  onChange={e => setVendor({...vendor, banco_tipo_cuenta: e.target.value})}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-2">Número de Cuenta</label>
                <input 
                  type="text" 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition shadow-sm bg-slate-50 focus:bg-white"
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
      
      <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
        <div className="bg-white p-2 rounded-lg shadow-sm text-emerald-600">
           <Landmark size={24} />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-emerald-900">Información del Contrato</p>
          <p className="text-sm text-emerald-700 leading-relaxed">
            Esta información se utiliza automáticamente al generar nuevos contratos vía IA. Asegúrate de que el RUT y los datos bancarios sean exactos para evitar errores legales.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VendorSettings;
