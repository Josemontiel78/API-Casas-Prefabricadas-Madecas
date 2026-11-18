import React, { useState, useEffect, useMemo } from 'react';
import { Contract, Client, Budget, ContractAlert } from '@/types';
import {
  subscribeToContracts,
  subscribeToClients,
  subscribeToBudgets,
  saveBudget
} from '@/services/db';
import {
  computeContractAlerts,
  computeStagnationAlerts,
  getStagnationThresholdDays,
  StagnationAlert
} from '@/services/contractAlerts';
import {
  Bell,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageCircle,
  Calendar,
  FileSignature,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Snowflake
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateContract?: (contractId: string) => void;
  onNavigateAlertsView?: () => void;
}

export const ContractAlertsModal: React.FC<ContractAlertsModalProps> = ({
  isOpen,
  onClose,
  onNavigateContract,
  onNavigateAlertsView
}) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [stagnationDays, setStagnationDays] = useState<number>(getStagnationThresholdDays);
  const [activeTab, setActiveTab] = useState<'todos' | 'vencidos' | 'urgentes' | 'pagos' | 'estancadas'>('todos');

  useEffect(() => {
    const unsubContracts = subscribeToContracts(setContracts);
    const unsubClients = subscribeToClients(setClients);
    const unsubBudgets = subscribeToBudgets(setBudgets);
    const handleSync = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') setStagnationDays(val);
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleSync);
    return () => {
      unsubContracts();
      unsubClients();
      unsubBudgets();
      window.removeEventListener('crm-stagnation-threshold-changed', handleSync);
    };
  }, []);

  const alerts = useMemo(() => computeContractAlerts(contracts, clients), [contracts, clients]);
  const stagnationAlerts = useMemo(
    () => computeStagnationAlerts(budgets, clients, contracts, stagnationDays),
    [budgets, clients, contracts, stagnationDays]
  );

  if (!isOpen) return null;

  const overdueAlerts = alerts.filter(a => a.tipo === 'entrega_vencida');
  const criticalAlerts = alerts.filter(a => a.tipo === 'entrega_urgente' || a.tipo === 'entrega_proxima');
  const paymentAlerts = alerts.filter(a => a.tipo === 'cuota_impaga');

  const filteredAlerts =
    activeTab === 'estancadas'
      ? []
      : alerts.filter(a => {
          if (activeTab === 'vencidos') return a.tipo === 'entrega_vencida';
          if (activeTab === 'urgentes') return a.tipo === 'entrega_urgente' || a.tipo === 'entrega_proxima';
          if (activeTab === 'pagos') return a.tipo === 'cuota_impaga';
          return true;
        });

  const filteredStagnation = activeTab === 'todos' || activeTab === 'estancadas' ? stagnationAlerts : [];
  const totalCount = alerts.length + stagnationAlerts.length;

  const handleOpenContract = (contractId: string) => {
    onClose();
    if (onNavigateContract) {
      onNavigateContract(contractId);
    } else {
      window.localStorage.setItem('selected_contract_id', contractId);
      window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
    }
  };

  const handleSendWhatsApp = (alert: ContractAlert) => {
    const phone = alert.cliente_telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${alert.cliente_nombre} no tiene teléfono registrado.`, type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    let message = `Hola ${alert.cliente_nombre}, le saludo desde MADECAS Prefabricados respecto a su contrato de construcción. `;
    if (alert.tipo === 'entrega_vencida' || alert.tipo === 'entrega_urgente' || alert.tipo === 'entrega_proxima') {
      message += `Quisiéramos coordinar el estado de avance de las obras y la fecha de entrega convenida (${alert.fecha_referencia}). ¿Cuándo tendría disponibilidad para coordinar?`;
    } else {
      message += `Le escribimos cordialmente para coordinar el estado de pago correspondiente a su proyecto. Quedamos a su disposición.`;
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleSendWhatsAppStagnant = async (st: StagnationAlert) => {
    const phone = st.cliente_telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${st.cliente_nombre} no tiene teléfono registrado.`, type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    const msg = `Hola ${st.cliente_nombre}, te saludo de MADECAS Prefabricados respecto a tu cotización por $${st.monto_total.toLocaleString('es-CL')} CLP. ¿Pudiste revisarla o te gustaría que coordinemos los siguientes pasos?`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    const b = budgets.find(item => item.id === st.budget_id);
    if (b) {
      await saveBudget({ ...b, ultima_interaccion: new Date().toISOString().split('T')[0] }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Bell size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">Alertas de Contratos & Estancamiento</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-slate-950 tabular-nums">
                  {totalCount} activas
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Plazos de entrega contractuales, cuotas pendientes y cotizaciones sin seguimiento (≥{stagnationDays}d).
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
            title="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Highlights */}
        <div className="grid grid-cols-5 gap-2 p-4 bg-slate-50 border-b border-slate-200 shrink-0 text-center text-xs">
          <button
            onClick={() => setActiveTab('todos')}
            className={cn(
              'p-2.5 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5',
              activeTab === 'todos' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'text-slate-500 hover:bg-slate-200/50'
            )}
          >
            <span className="text-[10px] uppercase font-black text-slate-400">Total</span>
            <span className="text-base font-black text-slate-800 tabular-nums">{totalCount}</span>
          </button>

          <button
            onClick={() => setActiveTab('vencidos')}
            className={cn(
              'p-2.5 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5',
              activeTab === 'vencidos' ? 'bg-red-50 text-red-900 border border-red-200 shadow-xs' : 'text-slate-500 hover:bg-slate-200/50'
            )}
          >
            <span className="text-[10px] uppercase font-black text-red-600 flex items-center gap-1">
              <AlertTriangle size={11} /> Vencidos
            </span>
            <span className="text-base font-black text-red-700 tabular-nums">{overdueAlerts.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('urgentes')}
            className={cn(
              'p-2.5 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5',
              activeTab === 'urgentes' ? 'bg-amber-50 text-amber-900 border border-amber-200 shadow-xs' : 'text-slate-500 hover:bg-slate-200/50'
            )}
          >
            <span className="text-[10px] uppercase font-black text-amber-600 flex items-center gap-1">
              <Clock size={11} /> ≤15 días
            </span>
            <span className="text-base font-black text-amber-700 tabular-nums">{criticalAlerts.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('pagos')}
            className={cn(
              'p-2.5 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5',
              activeTab === 'pagos' ? 'bg-blue-50 text-blue-900 border border-blue-200 shadow-xs' : 'text-slate-500 hover:bg-slate-200/50'
            )}
          >
            <span className="text-[10px] uppercase font-black text-blue-600 flex items-center gap-1">
              <DollarSign size={11} /> Cuotas
            </span>
            <span className="text-base font-black text-blue-700 tabular-nums">{paymentAlerts.length}</span>
          </button>

          <button
            onClick={() => setActiveTab('estancadas')}
            className={cn(
              'p-2.5 rounded-xl font-bold transition flex flex-col items-center justify-center gap-0.5',
              activeTab === 'estancadas' ? 'bg-orange-50 text-orange-900 border border-orange-200 shadow-xs' : 'text-slate-500 hover:bg-slate-200/50'
            )}
          >
            <span className="text-[10px] uppercase font-black text-orange-600 flex items-center gap-1">
              <Snowflake size={11} /> Estancadas
            </span>
            <span className="text-base font-black text-orange-700 tabular-nums">{stagnationAlerts.length}</span>
          </button>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin">
          {filteredAlerts.length === 0 && filteredStagnation.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 size={32} />
              </div>
              <p className="font-bold text-slate-700 text-sm">Sin alertas pendientes en esta categoría</p>
              <p className="text-xs text-slate-400 mt-0.5">Todos los contratos, plazos y cotizaciones se encuentran al día.</p>
            </div>
          ) : (
            <>
              {filteredAlerts.map(alert => {
                const isOverdue = alert.tipo === 'entrega_vencida';
                const isCritical = alert.tipo === 'entrega_urgente';
                const isPayment = alert.tipo === 'cuota_impaga';

                return (
                  <div
                    key={alert.id}
                    className={cn(
                      'p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4',
                      isOverdue
                        ? 'bg-red-50/70 border-red-200'
                        : isCritical
                        ? 'bg-amber-50/70 border-amber-200'
                        : isPayment
                        ? 'bg-blue-50/70 border-blue-200'
                        : 'bg-slate-50 border-slate-200'
                    )}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs',
                          isOverdue
                            ? 'bg-red-600 text-white'
                            : isCritical
                            ? 'bg-amber-500 text-white'
                            : isPayment
                            ? 'bg-blue-600 text-white'
                            : 'bg-emerald-600 text-white'
                        )}
                      >
                        {isOverdue && <AlertTriangle size={18} />}
                        {isCritical && <Clock size={18} />}
                        {isPayment && <DollarSign size={18} />}
                        {!isOverdue && !isCritical && !isPayment && <Calendar size={18} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              'text-[10px] font-black uppercase px-2 py-0.5 rounded-md',
                              isOverdue
                                ? 'bg-red-100 text-red-800'
                                : isCritical
                                ? 'bg-amber-100 text-amber-800'
                                : isPayment
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-800'
                            )}
                          >
                            {alert.titulo}
                          </span>
                          <span className="text-xs font-black text-slate-800 truncate">
                            {alert.cliente_nombre}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {alert.detalle}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 font-medium tabular-nums">
                          <span>Ref: {alert.fecha_referencia}</span>
                          {alert.monto_referencia && (
                            <span>Monto: ${alert.monto_referencia.toLocaleString('es-CL')} CLP</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                      <button
                        onClick={() => handleSendWhatsApp(alert)}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        title="Contactar por WhatsApp"
                      >
                        <MessageCircle size={14} />
                        <span className="hidden xs:inline">WhatsApp</span>
                      </button>

                      <button
                        onClick={() => handleOpenContract(alert.contract_id)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                        title="Ver Contrato"
                      >
                        <FileSignature size={14} />
                        <span>Ver Contrato</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredStagnation.map(st => (
                <div
                  key={st.id}
                  className="p-4 rounded-2xl border bg-orange-50/70 border-orange-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <Snowflake size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 tabular-nums">
                          Cotización Estancada ({st.dias_sin_interaccion}d sin interacción)
                        </span>
                        <span className="text-xs font-black text-slate-800 truncate">{st.cliente_nombre}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 tabular-nums">
                        Último contacto: {st.ultima_fecha} • Cotizado: <strong>${st.monto_total.toLocaleString('es-CL')} CLP</strong> • Score: {st.lead_score}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-orange-200/60">
                    <button
                      onClick={() => handleSendWhatsAppStagnant(st)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      onClick={() => {
                        onClose();
                        window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'tracking' }));
                      }}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                    >
                      <span>Seguimiento</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1 font-medium">
            <ShieldAlert size={14} className="text-emerald-700" />
            Cálculo automático en base a fechas contractuales y seguimiento
          </span>
          <div className="flex items-center gap-2">
            {onNavigateAlertsView && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateAlertsView();
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition flex items-center gap-1.5"
              >
                <span>Abrir Módulo Completo</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition border border-slate-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractAlertsModal;
