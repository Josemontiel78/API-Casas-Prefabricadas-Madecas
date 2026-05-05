import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { getProjects, saveProject, deleteProject } from '../services/db';
import { Plus, Save, Home, Trash2, Search, Ruler, Layers } from 'lucide-react';

const ProjectManager: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Project>({
    id: '', modelo: '', superficie_m2: 0, materiales_principales: [], adicionales: []
  });
  
  const [tempMaterial, setTempMaterial] = useState('');
  const [tempAdicional, setTempAdicional] = useState('');

  useEffect(() => {
    const data = getProjects();
    setProjects(data);
    setFilteredProjects(data);
  }, []);

  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    setFilteredProjects(projects.filter(p => p.modelo.toLowerCase().includes(lower)));
  }, [searchTerm, projects]);

  const handleNew = () => {
    setFormData({
      id: crypto.randomUUID(),
      modelo: '', superficie_m2: 0, materiales_principales: [], adicionales: []
    });
    setIsEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveProject(formData);
    setProjects(getProjects());
    setIsEditing(false);
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Modelo guardado correctamente', type: 'success' } 
    }));
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if(window.confirm('¿Estás seguro de eliminar este modelo de casa?')) {
          deleteProject(id);
          setProjects(getProjects());
      }
  };

  const addMaterial = () => {
    if (tempMaterial) {
      setFormData(prev => ({ ...prev, materiales_principales: [...prev.materiales_principales, tempMaterial] }));
      setTempMaterial('');
    }
  };

  const addAdicional = () => {
    if (tempAdicional) {
      setFormData(prev => ({ ...prev, adicionales: [...prev.adicionales, tempAdicional] }));
      setTempAdicional('');
    }
  };

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-slate-200 animate-in zoom-in-95 duration-200">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-slate-800">
            <Home className="text-blue-600" /> Definición de Modelo
        </h3>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Modelo</label>
              <input required type="text" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.modelo} onChange={e => setFormData({...formData, modelo: e.target.value})} placeholder="Ej: Casa Mediterránea" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Superficie (m²)</label>
              <input required type="number" className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={formData.superficie_m2} onChange={e => setFormData({...formData, superficie_m2: Number(e.target.value)})} />
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Materiales Base (Especificaciones Técnicas)</label>
            <div className="flex gap-2 mb-3">
              <input type="text" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: Pino Oregón 2x4" 
                value={tempMaterial} onChange={e => setTempMaterial(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMaterial())} />
              <button type="button" onClick={addMaterial} className="bg-slate-800 text-white px-4 rounded-lg font-bold hover:bg-slate-900">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.materiales_principales.map((m, i) => (
                <span key={i} className="bg-white text-slate-700 text-xs px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1">
                    {m} <button type="button" onClick={() => setFormData({...formData, materiales_principales: formData.materiales_principales.filter((_, idx) => idx !== i)})} className="text-slate-400 hover:text-red-500">×</button>
                </span>
              ))}
              {formData.materiales_principales.length === 0 && <span className="text-xs text-slate-400 italic">No hay materiales añadidos.</span>}
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <label className="block text-sm font-bold text-slate-700 mb-2">Adicionales / Terminaciones</label>
            <div className="flex gap-2 mb-3">
              <input type="text" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm" placeholder="Ej: Fosa Séptica 1200L" 
                value={tempAdicional} onChange={e => setTempAdicional(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAdicional())} />
              <button type="button" onClick={addAdicional} className="bg-slate-800 text-white px-4 rounded-lg font-bold hover:bg-slate-900">+</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.adicionales.map((m, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-1">
                   {m} <button type="button" onClick={() => setFormData({...formData, adicionales: formData.adicionales.filter((_, idx) => idx !== i)})} className="text-blue-400 hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
            <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-md transition font-medium">
              <Save size={18} /> Guardar Modelo
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-slate-800">Catálogo de Modelos</h3>
            <p className="text-slate-500 text-sm">Gestiona los tipos de casas y sus especificaciones.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Buscar modelo..." 
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button onClick={handleNew} className="px-4 py-2 bg-blue-600 text-white rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-md shadow-blue-200 transition font-medium whitespace-nowrap">
                <Plus size={18} /> Nuevo
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map(proj => (
          <div key={proj.id} onClick={() => {setFormData(proj); setIsEditing(true);}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-lg cursor-pointer transition-all group relative">
            <button 
                onClick={(e) => handleDelete(proj.id, e)}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition"
                title="Eliminar Modelo"
            >
                <Trash2 size={18} />
            </button>
            
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Home size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{proj.modelo}</h4>
                <div className="flex items-center gap-1 text-slate-500 text-sm mt-1">
                    <Ruler size={14} /> {proj.superficie_m2} m² construidos
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Layers size={12} /> Materialidad
              </div>
              <div className="flex flex-wrap gap-1.5">
                  {proj.materiales_principales.slice(0, 3).map((m, i) => (
                      <span key={i} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md border border-slate-200">
                          {m}
                      </span>
                  ))}
                  {proj.materiales_principales.length > 3 && (
                      <span className="bg-slate-50 text-slate-400 text-xs px-2 py-1 rounded-md border border-slate-100">
                          +{proj.materiales_principales.length - 3} más
                      </span>
                  )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProjectManager;