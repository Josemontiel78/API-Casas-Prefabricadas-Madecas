import React, { useState, useEffect, useMemo } from 'react';
import { Contract, Client, Budget, ContractAlert } from '@/types';
import {
  subscribeToContracts,
  subscribeToClients,
  subscribeToBudgets,
  saveBudget,
  logAuditEvent
} from '@/services/db';
import {
  computeContractAlerts,
  computeStagnationAlerts,
  getStagnationThresholdDays,
  setStagnationThresholdDaysPref,
  StagnationAlert
} from '@/services/contractAlerts';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  MessageCircle,
  Mail,
  Calendar,
  FileSignature,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  Snowflake,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContractAlertsViewProps {
  onNavigate?: (view: 'contracts' | 'tracking' | 'budgets') => void;
}

export const ContractAlertsView: React.FC<ContractAlertsViewProps> = ({ onNavigate }) => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [stagnationDays, setStagnationDays] = useState<number>(getStagnationThresholdDays);
  const [activeTab, setActiveTab] = useState<'todos' | 'vencidos' | 'urgentes' | 'pagos' | 'estancadas'>('todos');

  useEffect(() => {
    const unsubCo = subscribeToContracts(setContracts);
    const unsubCl = subscribeToClients(setClients);
    const unsubB = subscribeToBudgets(setBudgets);
    const handleThresholdSync = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') setStagnationDays(val);
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleThresholdSync);
    return () => {
      unsubCo();
      unsubCl();
      unsubB();
      window.removeEventListener('crm-stagnation-threshold-changed', handleThresholdSync);
    };
  }, []);

  const contractAlerts = useMemo(
    () => computeContractAlerts(contracts, clients),
    [contracts, clients]
  );

  const stagnationAlerts = useMemo(
    () => computeStagnationAlerts(budgets, clients, contracts, stagnationDays),
    [budgets, clients, contracts, stagnationDays]
  );

  const overdueAlerts = contractAlerts.filter(a => a.tipo === 'entrega_vencida');
  const criticalAlerts = contractAlerts.filter(
    a => a.tipo === 'entrega_urgente' || a.tipo === 'entrega_proxima'
  );
  const paymentAlerts = contractAlerts.filter(a => a.tipo === 'cuota_impaga');

  const handleChangeStagnationDays = (days: number) => {
    setStagnationDays(days);
    setStagnationThresholdDaysPref(days);
  };

  const handleOpenContract = (contractId: string) => {
    window.localStorage.setItem('selected_contract_id', contractId);
    if (onNavigate) {
      onNavigate('contracts');
    } else {
      window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
    }
  };

  const handleGoToTracking = () => {
    if (onNavigate) {
      onNavigate('tracking');
    } else {
      window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'tracking' }));
    }
  };

  const handleWhatsAppContract = (alert: ContractAlert) => {
    const phone = alert.cliente_telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${alert.cliente_nombre} no tiene teléfono registrado.`, type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    let message = `Hola ${alert.cliente_nombre}, le saluda el equipo de MADECAS Prefabricados respecto a su contrato vigente. `;
    if (alert.tipo === 'cuota_impaga') {
      message += `Le escribimos cordialmente para coordinar el estado de pago pendiente de su proyecto.`;
    } else {
      message += `Queremos confirmar el avance de obras y la fecha comprometida de entrega (${alert.fecha_referencia}).`;
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleWhatsAppStagnant = async (alert: StagnationAlert) => {
    const phone = alert.cliente_telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${alert.cliente_nombre} no tiene teléfono registrado.`, type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    const msg = `Hola ${alert.cliente_nombre}, te contactamos de MADECAS Prefabricados respecto a tu cotización por $${alert.monto_total.toLocaleString('es-CL')} CLP. ¿Pudiste revisarla o te gustaría que coordinemos una llamada para resolver dudas?`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    const budget = budgets.find(b => b.id === alert.budget_id);
    if (budget) {
      const todayIso = new Date().toISOString().split('T')[0];
      await saveBudget({ ...budget, ultima_interaccion: todayIso }).catch(() => {});
      logAuditEvent({
        accion: 'SEGUIMIENTO_REGISTRADO',
        entidad: 'budgets',
        entidad_id: budget.id,
        detalles: { canal: 'WhatsApp', origen: 'Módulo de Alertas', cliente: alert.cliente_nombre }
      }).catch(() => {});
    }
  };

  const handleEmailStagnant = async (alert: StagnationAlert) => {
    if (!alert.cliente_correo) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${alert.cliente_nombre} no tiene correo registrado.`, type: 'info' }
      }));
      return;
    }
    const subject = `MADECAS Prefabricados - Seguimiento a su cotización`;
    const body = `Hola ${alert.cliente_nombre},\n\nTe contactamos desde MADECAS Prefabricados para saber si pudiste revisar la cotización enviada ($${alert.monto_total.toLocaleString('es-CL')} CLP) o si necesitas ajustar especificaciones, medidas o facilidades de pago.\n\nAtentamente,\nEquipo Comercial MADECAS`;
    window.location.href = `mailto:${alert.cliente_correo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const budget = budgets.find(b => b.id === alert.budget_id);
    if (budget) {
      const todayIso = new Date().toISOString().split('T')[0];
      await saveBudget({ ...budget, ultima_interaccion: todayIso }).catch(() => {});
    }
  };

  const totalAllAlerts = contractAlerts.length + stagnationAlerts.length;

  const displayedContractAlerts =
    activeTab === 'todos'
      ? contractAlerts
      : activeTab === 'vencidos'
      ? overdueAlerts
      : activeTab === 'urgentes'
      ? criticalAlerts
      : activeTab === 'pagos'
      ? paymentAlerts
      : [];

  const displayedStagnationAlerts =
    activeTab === 'todos' || activeTab === 'estancadas' ? stagnationAlerts : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-slate-900 p-6 md:p-8 rounded-3xl text-white shadow-sm border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              Control de Plazos & Estancamiento
            </span>
            <span className="bg-white/10 text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full tabular-nums">
              {totalAllAlerts} notificaciones activas
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <Bell className="text-amber-400" size={26} />
            Sistema de Alertas Contractuales y Comerciales
          </h2>
          <p className="text-slate-300 text-xs md:text-sm font-medium mt-1 max-w-2xl leading-relaxed">
            Monitorea automáticamente fechas comprometidas de ejecución e instalación según contratos firmados,
            cuotas pendientes y cotizaciones sin avance comercial.
          </p>
        </div>

        {/* Configurable Stagnation Window */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 flex items-center gap-3 shrink-0">
          <SlidersHorizontal size={16} className="text-amber-400 shrink-0" />
          <div>
            <span className="block text-[10px] font-bold uppercase text-slate-400">
              Umbral de Estancamiento
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {[3, 5, 7, 10, 15].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => handleChangeStagnationDays(d)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums transition',
                    stagnationDays === d
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Filter Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('todos')}
          className={cn(
            'p-4 rounded-2xl border text-left transition cursor-pointer',
            activeTab === 'todos'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
          )}
        >
          <span className={cn('text-[10px] font-black uppercase', activeTab === 'todos' ? 'text-slate-300' : 'text-slate-400')}>
            Vista Consolidada
          </span>
          <p className="text-2xl font-black tabular-nums mt-1">{totalAllAlerts}</p>
          <span className={cn('text-[11px] font-medium', activeTab === 'todos' ? 'text-slate-300' : 'text-slate-500')}>
            Todas las alertas
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vencidos')}
          className={cn(
            'p-4 rounded-2xl border text-left transition cursor-pointer',
            activeTab === 'vencidos'
              ? 'bg-red-50 border-red-300 ring-2 ring-red-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <span className="text-[10px] font-black uppercase text-red-600 flex items-center gap-1">
            <AlertTriangle size={12} /> Plazos Vencidos
          </span>
          <p className="text-2xl font-black text-red-700 tabular-nums mt-1">{overdueAlerts.length}</p>
          <span className="text-[11px] font-medium text-slate-500">Contratos fuera de fecha</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('urgentes')}
          className={cn(
            'p-4 rounded-2xl border text-left transition cursor-pointer',
            activeTab === 'urgentes'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <span className="text-[10px] font-black uppercase text-amber-600 flex items-center gap-1">
            <Clock size={12} /> Próximos (≤15d)
          </span>
          <p className="text-2xl font-black text-amber-700 tabular-nums mt-1">{criticalAlerts.length}</p>
          <span className="text-[11px] font-medium text-slate-500">Entregas por vencer</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pagos')}
          className={cn(
            'p-4 rounded-2xl border text-left transition cursor-pointer',
            activeTab === 'pagos'
              ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1">
            <DollarSign size={12} /> Cuotas Impagas
          </span>
          <p className="text-2xl font-black text-blue-700 tabular-nums mt-1">{paymentAlerts.length}</p>
          <span className="text-[11px] font-medium text-slate-500">Cobros contractuales</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('estancadas')}
          className={cn(
            'p-4 rounded-2xl border text-left transition cursor-pointer',
            activeTab === 'estancadas'
              ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <span className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-1">
            <Snowflake size={12} /> Estancadas (&gt;{stagnationDays}d)
          </span>
          <p className="text-2xl font-black text-orange-700 tabular-nums mt-1">{stagnationAlerts.length}</p>
          <span className="text-[11px] font-medium text-slate-500">Sin interacción reciente</span>
        </button>
      </div>

      {/* Empty State */}
      {displayedContractAlerts.length === 0 && displayedStagnationAlerts.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-14 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={30} />
          </div>
          <h3 className="text-base font-black text-slate-800">Sin alertas activas en esta categoría</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Todos los plazos contractuales y cotizaciones en seguimiento se encuentran dentro de los rangos configurados.
          </p>
        </div>
      )}

      {/* Section 1: Contract Deadlines & Installments */}
      {displayedContractAlerts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Alertas de Ejecución Contractual y Pagos
                </h3>
                <p className="text-xs text-slate-500">
                  Basado en fechas de inicio de obra, plazos de instalación y pautas de pago
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full tabular-nums">
              {displayedContractAlerts.length} registros
            </span>
          </div>

          <div className="space-y-3">
            {displayedContractAlerts.map(alert => {
              const isOverdue = alert.tipo === 'entrega_vencida';
              const isCritical = alert.tipo === 'entrega_urgente';
              const isPayment = alert.tipo === 'cuota_impaga';

              return (
                <div
                  key={alert.id}
                  className={cn(
                    'p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
                    isOverdue
                      ? 'bg-red-50/60 border-red-200'
                      : isCritical
                      ? 'bg-amber-50/60 border-amber-200'
                      : isPayment
                      ? 'bg-blue-50/60 border-blue-200'
                      : 'bg-slate-50 border-slate-200'
                  )}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white',
                        isOverdue
                          ? 'bg-red-600'
                          : isCritical
                          ? 'bg-amber-500'
                          : isPayment
                          ? 'bg-blue-600'
                          : 'bg-emerald-600'
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
                        <span className="text-sm font-black text-slate-800">
                          {alert.cliente_nombre}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{alert.detalle}</p>
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 mt-2 font-semibold tabular-nums">
                        <span>Fecha ref: {alert.fecha_referencia}</span>
                        {alert.monto_referencia !== undefined && (
                          <span>Monto: ${alert.monto_referencia.toLocaleString('es-CL')} CLP</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleWhatsAppContract(alert)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenContract(alert.contract_id)}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <FileSignature size={14} />
                      <span>Ver Contrato</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Stagnant Quotations */}
      {displayedStagnationAlerts.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                <Snowflake size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Alertas de Cotizaciones Estancadas (≥ {stagnationDays} días sin interacción)
                </h3>
                <p className="text-xs text-slate-500">
                  Prospectos que requieren contacto inmediato antes de enfriarse
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoToTracking}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <TrendingUp size={14} />
              <span>Ir a Seguimiento</span>
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="space-y-3">
            {displayedStagnationAlerts.map(st => (
              <div
                key={st.id}
                className={cn(
                  'p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4',
                  st.severidad === 'urgente'
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-amber-50/50 border-amber-200'
                )}
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-black text-xs',
                      st.lead_score === 'Alta'
                        ? 'bg-emerald-600'
                        : st.lead_score === 'Media'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    )}
                    title={`Lead Score: ${st.lead_score}`}
                  >
                    {st.lead_score[0]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 tabular-nums">
                        {st.dias_sin_interaccion} días sin avance
                      </span>
                      <span className="text-sm font-black text-slate-800">
                        {st.cliente_nombre}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        Probabilidad: {st.lead_score}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 tabular-nums">
                      Última actividad: {st.ultima_fecha} • Monto en juego: <strong>${st.monto_total.toLocaleString('es-CL')} CLP</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleWhatsAppStagnant(st)}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <MessageCircle size={14} />
                    <span>WhatsApp 1-Clic</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmailStagnant(st)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Mail size={14} />
                    <span>Correo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGoToTracking}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <span>Gestionar</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractAlertsView;
