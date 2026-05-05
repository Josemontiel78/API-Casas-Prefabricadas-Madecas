
import React, { useState, useEffect } from 'react';
import { ViewState, UserRole, AppNotification } from '@/types';
import { 
  Home, 
  Users, 
  FolderOpen, 
  Calculator, 
  FileSignature, 
  Settings,
  Bell,
  X,
  CheckCircle,
  AlertCircle,
  Info,
  BrainCircuit,
  Map as MapIcon,
  ExternalLink
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, setView, role, setRole }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Listen for custom events to show notifications
  useEffect(() => {
    const handleNotification = (e: any) => {
      const newNotif: AppNotification = {
        id: crypto.randomUUID(),
        message: e.detail.message,
        type: e.detail.type || 'info'
      };
      setNotifications(prev => [...prev, newNotif]);
      
      // Auto dismiss
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 4000);
    };

    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Monitor de Ventas', icon: Home },
    { id: 'clients', label: '1. Registro de Clientes', icon: Users },
    { id: 'projects', label: '2. Catálogo de Modelos', icon: FolderOpen },
    { id: 'budgets', label: '3. Análisis de Costos', icon: Calculator },
    { id: 'contracts', label: '4. Cierre y Gestión de Pagos', icon: FileSignature },
    { id: 'hub', label: 'Interoperabilidad (RUT)', icon: ExternalLink },
    { id: 'map', label: 'Georeferencia Global', icon: MapIcon },
    { id: 'ai-assistant', label: 'IA Comercial Pro', icon: BrainCircuit },
  ];

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(n => (
          <div key={n.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] animate-in slide-in-from-right-full transition-all ${
            n.type === 'success' ? 'bg-emerald-600' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-600'
          }`}>
            {n.type === 'success' && <CheckCircle size={18} />}
            {n.type === 'error' && <AlertCircle size={18} />}
            {n.type === 'info' && <Info size={18} />}
            <p className="text-sm font-medium flex-1">{n.message}</p>
            <button onClick={() => removeNotification(n.id)} className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 text-emerald-400 mb-1">
             <div className="bg-emerald-500/20 p-2 rounded-lg">
                <FileSignature size={24} /> 
             </div>
             <h1 className="text-xl font-bold tracking-tight">PrefabContracts</h1>
          </div>
          <p className="text-xs text-slate-400 pl-1">Gestión & IA Legal</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewState)}
              className={`w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
                currentView === item.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <item.icon size={20} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
              <span className="font-medium text-sm">{item.label}</span>
              {item.id === 'ai-assistant' && (
                  <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">PRO</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Perfil</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${role === 'admin' ? 'bg-purple-500/10 text-purple-300 border-purple-500/30' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'}`}>
              {role}
            </span>
          </div>
          <button 
            onClick={() => setRole(role === 'admin' ? 'vendedor' : 'admin')}
            className="w-full text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-lg flex items-center justify-center space-x-2 transition border border-slate-700"
          >
            <Settings size={14} />
            <span>Cambiar Rol</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="bg-white border-b border-slate-200 h-20 flex items-center justify-between px-8 z-10">
          <div>
              <h2 className="text-2xl font-bold text-slate-800 capitalize tracking-tight flex items-center gap-2">
                {currentView === 'ai-assistant' && <BrainCircuit className="text-emerald-600" />}
                {navItems.find(i => i.id === currentView)?.label || 'Panel'}
              </h2>
          </div>
          <div className="flex items-center space-x-6">
            <button className="relative text-slate-400 hover:text-slate-600 transition">
                <Bell size={22} />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800">Usuario Activo</p>
                <p className="text-xs text-slate-500">{role === 'admin' ? 'Administrador' : 'Ventas'}</p>
              </div>
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${role === 'admin' ? 'bg-purple-600' : 'bg-emerald-600'}`}>
                {role === 'admin' ? 'AD' : 'VE'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-8">
          <div className="max-w-7xl mx-auto h-full">
             {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
