import React, { useState, useEffect } from 'react';
import { ViewState, UserRole, AppNotification, Contract, Client, Budget } from '@/types';
import { uuid, cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
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
  ExternalLink,
  Brush,
  UserCheck,
  History,
  TrendingUp,
  Zap
} from 'lucide-react';
import { ContractAlertsModal } from './ContractAlertsModal';
import { subscribeToContracts, subscribeToClients, subscribeToBudgets } from '@/services/db';
import {
  computeContractAlerts,
  computeStagnationAlerts,
  getStagnationThresholdDays
} from '@/services/contractAlerts';

interface LayoutProps {
  children: React.ReactNode;
  currentView: ViewState;
  setView: (view: ViewState) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  isSmartMode?: boolean;
  onToggleSmartMode?: (smart: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  currentView,
  setView,
  role,
  setRole,
  isSmartMode = false,
  onToggleSmartMode
}) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);
  const [theme, setTheme] = useState({
    background: '#f8fafc',
    text: '#0f172a',
    card: '#ffffff',
    menu: '#0f172a',
    button: '#10b981'
  });

  useEffect(() => {
    let contractsList: Contract[] = [];
    let clientsList: Client[] = [];
    let budgetsList: Budget[] = [];
    let thresholdDays = getStagnationThresholdDays();

    const updateCount = () => {
      const cAlerts = computeContractAlerts(contractsList, clientsList);
      const sAlerts = computeStagnationAlerts(budgetsList, clientsList, contractsList, thresholdDays);
      setActiveAlertsCount(cAlerts.length + sAlerts.length);
    };

    const unsubCo = subscribeToContracts((c) => {
      contractsList = c;
      updateCount();
    });
    const unsubCl = subscribeToClients((cl) => {
      clientsList = cl;
      updateCount();
    });
    const unsubBu = subscribeToBudgets((bu) => {
      budgetsList = bu;
      updateCount();
    });

    const handleThresholdChange = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') {
        thresholdDays = val;
        updateCount();
      }
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleThresholdChange);

    return () => {
      unsubCo();
      unsubCl();
      unsubBu();
      window.removeEventListener('crm-stagnation-threshold-changed', handleThresholdChange);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved) {
      try {
        setTheme(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing theme', e);
      }
    }

    const handleThemeUpdate = (e: any) => {
      setTheme(e.detail);
    };
    window.addEventListener('app-theme-update', handleThemeUpdate);
    return () => window.removeEventListener('app-theme-update', handleThemeUpdate);
  }, []);

  // Listen for custom notification & alerts-modal events
  useEffect(() => {
    const handleNotification = (e: any) => {
      const newNotif: AppNotification = {
        id: uuid(),
        message: e.detail.message,
        type: e.detail.type || 'info'
      };
      setNotifications(prev => [...prev, newNotif]);

      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
      }, 4000);
    };

    const handleOpenAlertsModal = () => setShowAlertsModal(true);

    window.addEventListener('app-notification', handleNotification);
    window.addEventListener('open-contract-alerts-modal', handleOpenAlertsModal);
    return () => {
      window.removeEventListener('app-notification', handleNotification);
      window.removeEventListener('open-contract-alerts-modal', handleOpenAlertsModal);
    };
  }, []);

  const groupVenta = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Registro de Clientes', icon: Users },
    { id: 'designs', label: 'Diseños y Modelos', icon: Brush },
    { id: 'budgets', label: 'Presupuestos', icon: Calculator },
    { id: 'tracking', label: 'Seguimiento Ventas', icon: TrendingUp },
    { id: 'contracts', label: 'Contratos y Pagos', icon: FileSignature },
    { id: 'alerts', label: 'Alertas y Plazos', icon: Bell }
  ];

  const groupEmpresa = [
    { id: 'users', label: 'Gestión de Usuarios', icon: UserCheck },
    { id: 'audit', label: 'Auditoría & Trazabilidad', icon: History },
    { id: 'hub', label: 'Interoperabilidad', icon: ExternalLink },
    { id: 'cubicacion', label: 'Cubicación Inteligente', icon: Calculator },
    { id: 'map', label: 'Georeferencia Global', icon: MapIcon },
    { id: 'ai-assistant', label: 'IA Comercial Pro', icon: BrainCircuit },
    { id: 'settings', label: 'Configuración Empresa', icon: Settings }
  ];

  const allItems = [...groupVenta, ...groupEmpresa];

  const NavButton = ({ item }: { item: any }) => (
    <button
      onClick={() => setView(item.id as ViewState)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
        currentView === item.id
          ? isSmartMode
            ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/40'
            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <item.icon size={18} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
      <span className="font-medium text-xs">{item.label}</span>
      {item.id === 'ai-assistant' && (
        <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
          PRO
        </span>
      )}
      {item.id === 'alerts' && activeAlertsCount > 0 && (
        <span className="ml-auto bg-amber-500 text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums">
          {activeAlertsCount}
        </span>
      )}
    </button>
  );

  return (
    <div
      className="flex h-screen font-sans transition-colors duration-500 overflow-hidden"
      style={{ backgroundColor: theme.background, color: theme.text }}
    >
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white min-w-[300px] animate-in slide-in-from-right-full transition-all ${
              n.type === 'success' ? 'bg-emerald-600' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-600'
            }`}
          >
            {n.type === 'success' && <CheckCircle size={18} />}
            {n.type === 'error' && <AlertCircle size={18} />}
            {n.type === 'info' && <Info size={18} />}
            <p className="text-sm font-medium flex-1">{n.message}</p>
            <button onClick={() => setNotifications(prev => prev.filter(p => p.id !== n.id))} className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar */}
      <aside
        className="w-64 flex flex-col shadow-2xl z-20 shrink-0 transition-hidden overflow-hidden"
        style={{ backgroundColor: isSmartMode ? '#0c192c' : theme.menu }}
      >
        <div className="p-6 pb-2">
          <div className={cn('flex items-center gap-3 mb-1', isSmartMode ? 'text-sky-400' : 'text-emerald-400')}>
            <div className={cn('p-2 rounded-lg', isSmartMode ? 'bg-sky-500/20' : 'bg-emerald-500/20')}>
              <FileSignature size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight">MADECAS AI</h1>
          </div>
          <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest pl-1">
            {isSmartMode ? 'Modo Smart Operativo' : 'Venta Prefabricadas'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scrollbar-hide">
          {/* Section: Operación Comercial / Venta Cliente */}
          <div>
            <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-4 pl-4">
              {isSmartMode ? 'Flujo Diario Smart' : 'Venta Cliente'}
            </h3>
            <div className="space-y-1">
              {groupVenta.map(item => (
                <div key={item.id}>
                  <NavButton item={item} />
                </div>
              ))}
            </div>
          </div>

          {/* Section: Empresa (Hidden in Minimalist Smart Mode unless switched to Original) */}
          {!isSmartMode ? (
            <div>
              <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-4 pl-4">Empresa</h3>
              <div className="space-y-1">
                {groupEmpresa.map(item => (
                  <div key={item.id}>
                    <NavButton item={item} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="px-2">
              <button
                type="button"
                onClick={() => onToggleSmartMode?.(false)}
                className="w-full text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-3 py-2.5 rounded-xl border border-slate-700/70 transition text-left"
              >
                Ver menú completo (Modo Original)
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase text-slate-500 font-bold tracking-wider">Perfil</span>
            <span
              className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                role === 'admin'
                  ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
              }`}
            >
              {role}
            </span>
          </div>
          <button
            onClick={() => setRole(role === 'admin' ? 'vendedor' : 'admin')}
            className="w-full text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg flex items-center justify-center space-x-2 transition border border-slate-700 font-bold uppercase tracking-wider"
          >
            <Settings size={12} />
            <span>Switch Role</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="bg-white border-b border-slate-200 min-h-20 flex items-center justify-between px-8 z-10 py-4 md:py-0">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2 whitespace-nowrap">
              {currentView === 'ai-assistant' && <BrainCircuit className="text-emerald-600" />}
              {currentView === 'dashboard' && isSmartMode
                ? 'Dashboard Smart'
                : allItems.find(i => i.id === currentView)?.label || 'Dashboard'}
            </h2>

            {/* Interactive Commercial Workflow Stepper */}
            {(currentView === 'clients' ||
              currentView === 'designs' ||
              currentView === 'budgets' ||
              currentView === 'tracking' ||
              currentView === 'contracts') && (
              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100/90 p-1 sm:px-3 sm:py-1.5 rounded-full border border-slate-200 shadow-xs">
                {[
                  { id: 'clients', step: 1, label: 'Cliente' },
                  { id: 'designs', step: 2, label: 'Modelo & m²' },
                  { id: 'budgets', step: 3, label: 'Presupuesto' },
                  { id: 'tracking', step: 4, label: 'Seguimiento' },
                  { id: 'contracts', step: 5, label: 'Contrato & Anexo' }
                ].map((s, idx, arr) => {
                  const isActive = currentView === s.id;
                  return (
                    <React.Fragment key={s.id}>
                      <button
                        type="button"
                        onClick={() => setView(s.id as ViewState)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                        }`}
                        title={`Ir a etapa ${s.step}: ${s.label}`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                            isActive ? 'bg-white text-emerald-700' : 'bg-slate-300 text-slate-700'
                          }`}
                        >
                          {s.step}
                        </span>
                        <span className="text-[11px] font-semibold whitespace-nowrap hidden sm:inline">{s.label}</span>
                      </button>
                      {idx < arr.length - 1 && <div className="w-2 sm:w-3 h-px bg-slate-300 hidden xs:block"></div>}
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4 sm:space-x-5">
            {/* View Mode Toggle: Original vs Smart */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => onToggleSmartMode?.(false)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5',
                  !isSmartMode
                    ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                )}
                title="Modo Clásico Original"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Original</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleSmartMode?.(true)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5',
                  isSmartMode
                    ? 'bg-gradient-to-r from-sky-600 to-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                )}
                title="Modo Minimalista Smart enfocado en flujo diario"
              >
                <Zap size={13} className={isSmartMode ? 'text-lime-300' : 'text-sky-500'} />
                <span>Smart</span>
              </button>
            </div>

            {/* Contract & Stagnation Alerts Bell */}
            <button
              onClick={() => setShowAlertsModal(true)}
              className="relative p-2.5 rounded-2xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              title="Alertas de plazos de contratos, cuotas y estancamiento"
            >
              <Bell size={20} className={activeAlertsCount > 0 ? 'text-amber-500' : 'text-slate-500'} />
              {activeAlertsCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white tabular-nums">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <div className="h-8 w-[1px] bg-slate-200"></div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800">Usuario Activo</p>
                <p className="text-xs text-slate-500">{role === 'admin' ? 'Administrador' : 'Ventas'}</p>
              </div>
              <div
                className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${
                  role === 'admin' ? 'bg-purple-600' : 'bg-emerald-600'
                }`}
              >
                {role === 'admin' ? 'AD' : 'VE'}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 md:p-8">
          <div className="max-w-7xl mx-auto h-full">{children}</div>
        </div>

        {/* Contract Alerts Modal */}
        <ContractAlertsModal
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          onNavigateContract={() => setView('contracts')}
          onNavigateAlertsView={() => setView('alerts')}
        />
      </main>
    </div>
  );
};

export default Layout;
