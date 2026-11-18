import React, { useState, useEffect, useMemo } from 'react';
import { Budget, Client, Contract, HouseModel, ViewState } from '@/types';
import {
  subscribeToBudgets,
  subscribeToClients,
  subscribeToContracts,
  subscribeToHouseModels,
  saveBudget,
  logAuditEvent
} from '@/services/db';
import {
  computeContractAlerts,
  computeStagnationAlerts,
  daysElapsedSince,
  getSuggestedLeadScore,
  getStagnationThresholdDays
} from '@/services/contractAlerts';
import {
  Calculator,
  Users,
  FileSignature,
  Bell,
  TrendingUp,
  ArrowRight,
  MessageCircle,
  Mail,
  CheckCircle2,
  Home,
  Zap,
  Search,
  ShieldAlert,
  DollarSign,
  Snowflake,
  BarChart3
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { cn } from '@/lib/utils';

interface SmartViewProps {
  onNavigate: (view: ViewState) => void;
  onOpenAlerts: () => void;
  onSwitchToOriginal: () => void;
}

export const SmartView: React.FC<SmartViewProps> = ({
  onNavigate,
  onOpenAlerts,
  onSwitchToOriginal
}) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [houseModels, setHouseModels] = useState<HouseModel[]>([]);
  const [quickSearch, setQuickSearch] = useState('');
  const [stagnationDays, setStagnationDays] = useState<number>(getStagnationThresholdDays);

  useEffect(() => {
    const unsubB = subscribeToBudgets(setBudgets);
    const unsubC = subscribeToClients(setClients);
    const unsubCo = subscribeToContracts(setContracts);
    const unsubH = subscribeToHouseModels(setHouseModels);
    const handleSync = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') setStagnationDays(val);
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleSync);
    return () => {
      unsubB();
      unsubC();
      unsubCo();
      unsubH();
      window.removeEventListener('crm-stagnation-threshold-changed', handleSync);
    };
  }, []);

  const contractedBudgetIds = useMemo(() => {
    return new Set(contracts.map(c => c.presupuesto_id));
  }, [contracts]);

  // Compute active pending quotations
  const pendingQuotations = useMemo(() => {
    return budgets
      .filter(b => !contractedBudgetIds.has(b.id) && !b.descartado)
      .map(b => {
        const client = clients.find(c => c.id === b.cliente_id);
        const model = houseModels.find(m => m.id === b.proyecto_id);
        const refDate = b.ultima_interaccion || b.fecha;
        const daysSince = daysElapsedSince(refDate);
        const score = b.lead_score || getSuggestedLeadScore(b, daysSince, client);

        return {
          budget: b,
          client,
          modelName: model?.nombre || (b.es_combinacion_modelos ? 'Combinación Modular' : 'Modelo Madecas'),
          daysSince,
          score,
          isStagnant: daysSince >= stagnationDays
        };
      })
      .sort((a, b) => {
        const scoreVal = (s: string) => (s === 'Alta' ? 3 : s === 'Media' ? 2 : 1);
        if (scoreVal(b.score) !== scoreVal(a.score)) return scoreVal(b.score) - scoreVal(a.score);
        return a.daysSince - b.daysSince;
      });
  }, [budgets, clients, houseModels, contractedBudgetIds, stagnationDays]);

  const contractAlerts = useMemo(
    () => computeContractAlerts(contracts, clients),
    [contracts, clients]
  );

  const stagnationAlerts = useMemo(
    () => computeStagnationAlerts(budgets, clients, contracts, stagnationDays),
    [budgets, clients, contracts, stagnationDays]
  );

  const totalAlertsCount = contractAlerts.length + stagnationAlerts.length;

  const totalInNegotiation = useMemo(() => {
    return pendingQuotations.reduce((s, q) => s + q.budget.monto_total, 0);
  }, [pendingQuotations]);

  const totalContractedVolume = useMemo(() => {
    return contracts.reduce((s, c) => s + (c.monto_total || 0), 0);
  }, [contracts]);

  const conversionRate = useMemo(() => {
    if (budgets.length === 0) return 0;
    return (contracts.length / budgets.length) * 100;
  }, [budgets.length, contracts.length]);

  // Compact 6-month trend chart for Smart Dashboard
  const smartTrendData = useMemo(() => {
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const today = new Date();
    const months: { month: string; monthIdx: number; year: number; cotizadoM: number; ventasM: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        cotizadoM: 0,
        ventasM: 0
      });
    }
    budgets.forEach(b => {
      if (!b.fecha) return;
      const d = new Date(b.fecha);
      if (isNaN(d.getTime())) return;
      const pt = months.find(m => m.monthIdx === d.getMonth() && m.year === d.getFullYear());
      if (pt) pt.cotizadoM = Number((pt.cotizadoM + (b.monto_total || 0) / 1000000).toFixed(2));
    });
    contracts.forEach(c => {
      if (!c.fecha_contrato) return;
      const d = new Date(c.fecha_contrato);
      if (isNaN(d.getTime())) return;
      const pt = months.find(m => m.monthIdx === d.getMonth() && m.year === d.getFullYear());
      if (pt) pt.ventasM = Number((pt.ventasM + (c.monto_total || 0) / 1000000).toFixed(2));
    });
    return months;
  }, [budgets, contracts]);

  // Filtered by quick search
  const filteredQuotations = useMemo(() => {
    if (!quickSearch.trim()) return pendingQuotations.slice(0, 6);
    const lower = quickSearch.toLowerCase();
    return pendingQuotations.filter(q => {
      const cName = q.client?.nombre.toLowerCase() || '';
      const mName = q.modelName.toLowerCase();
      const folio = q.budget.id.toLowerCase();
      return cName.includes(lower) || mName.includes(lower) || folio.includes(lower);
    });
  }, [pendingQuotations, quickSearch]);

  const handleSendWhatsApp = async (q: any) => {
    const phone = q.client?.telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'El cliente no tiene teléfono registrado', type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    const name = q.client?.nombre || 'Estimado/a';
    const msg = `Hola ${name}, te contacto desde MADECAS Prefabricados respecto a la cotización de tu casa modelo ${q.modelName}. ¿Pudiste revisarla o te gustaría coordinar una visita técnica a nuestro showroom en Osorno?`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');

    const todayIso = new Date().toISOString().split('T')[0];
    await saveBudget({ ...q.budget, ultima_interaccion: todayIso }).catch(() => {});
    logAuditEvent({
      accion: 'SEGUIMIENTO_REGISTRADO',
      entidad: 'budgets',
      entidad_id: q.budget.id,
      detalles: { canal: 'WhatsApp Web (Smart)', cliente: name }
    }).catch(() => {});
  };

  const handleSendEmail = async (q: any) => {
    if (!q.client?.correo) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'El cliente no tiene correo registrado', type: 'info' }
      }));
      return;
    }
    const subject = `MADECAS Prefabricados - Cotización ${q.modelName}`;
    const body = `Hola ${q.client.nombre},\n\nTe escribimos respecto a tu cotización del modelo ${q.modelName} ($${q.budget.monto_total.toLocaleString('es-CL')} CLP). ¿Tienes alguna consulta para avanzar?\n\nAtentamente,\nEquipo MADECAS`;
    window.location.href = `mailto:${q.client.correo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const todayIso = new Date().toISOString().split('T')[0];
    await saveBudget({ ...q.budget, ultima_interaccion: todayIso }).catch(() => {});
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* SmartDOM-Inspired Minimalist Header */}
      <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-emerald-600 p-6 md:p-8 rounded-3xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-white/15 text-white border border-white/20 text-[10px] font-black uppercase px-3 py-1 rounded-full flex items-center gap-1.5">
              <Zap size={12} className="text-lime-300" />
              Modo Smart Minimalista
            </span>
            <span className="bg-lime-400/20 text-lime-200 border border-lime-300/30 text-[10px] font-bold px-2.5 py-1 rounded-full">
              Operación Diaria Prioritaria
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Dashboard Smart Comercial
          </h1>

          <p className="text-sky-100 text-xs md:text-sm font-medium max-w-2xl leading-relaxed">
            Vista simplificada orientada al flujo diario real: cotizar en m², dar seguimiento con semáforo de probabilidad,
            contactar en un clic y controlar plazos contractuales.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAlerts}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition border border-white/20 flex items-center gap-2 tabular-nums"
          >
            <Bell size={15} />
            <span>Alertas ({totalAlertsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('budgets')}
            className="px-4 py-2.5 bg-lime-400 hover:bg-lime-300 text-slate-950 rounded-2xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
          >
            <Calculator size={15} />
            <span>+ Cotizar Casa</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToOriginal}
            className="px-3.5 py-2.5 bg-slate-900/40 hover:bg-slate-900/60 text-white rounded-2xl text-xs font-bold transition border border-white/20"
          >
            Vista Original
          </button>
        </div>
      </div>

      {/* 6 Daily Operational Circular Modules (SmartDOM Wheel Inspired — Only Daily Work Functions) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          {
            id: 'budgets',
            title: 'Cotizador m²',
            desc: 'Presupuestos & Extras',
            icon: Calculator,
            color: 'from-emerald-500 to-teal-600',
            textColor: 'text-emerald-700',
            bgColor: 'bg-emerald-50',
            badge: `${budgets.length} emitidos`,
            action: () => onNavigate('budgets')
          },
          {
            id: 'tracking',
            title: 'Seguimiento',
            desc: 'Semáforo & WhatsApp',
            icon: TrendingUp,
            color: 'from-sky-500 to-blue-600',
            textColor: 'text-sky-700',
            bgColor: 'bg-sky-50',
            badge: `${pendingQuotations.length} activas`,
            action: () => onNavigate('tracking')
          },
          {
            id: 'contracts',
            title: 'Contratos',
            desc: 'Legal & Pagos',
            icon: FileSignature,
            color: 'from-indigo-500 to-blue-700',
            textColor: 'text-indigo-700',
            bgColor: 'bg-indigo-50',
            badge: `${contracts.length} vigentes`,
            action: () => onNavigate('contracts')
          },
          {
            id: 'alerts',
            title: 'Alertas Plazos',
            desc: 'Entregas & Estancadas',
            icon: Bell,
            color: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-700',
            bgColor: 'bg-amber-50',
            badge: `${totalAlertsCount} avisos`,
            action: () => onNavigate('alerts')
          },
          {
            id: 'designs',
            title: 'Modelos 2025',
            desc: 'Catálogo Oficial',
            icon: Home,
            color: 'from-lime-600 to-emerald-600',
            textColor: 'text-lime-700',
            bgColor: 'bg-lime-50',
            badge: `${houseModels.length} modelos`,
            action: () => onNavigate('designs')
          },
          {
            id: 'clients',
            title: 'Clientes',
            desc: 'Fichas & Datos',
            icon: Users,
            color: 'from-cyan-500 to-sky-600',
            textColor: 'text-cyan-700',
            bgColor: 'bg-cyan-50',
            badge: `${clients.length} registros`,
            action: () => onNavigate('clients')
          }
        ].map(mod => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={mod.action}
              className="bg-white p-4 rounded-3xl border border-slate-200 hover:border-sky-300 hover:shadow-md transition-all flex flex-col items-center text-center group cursor-pointer"
            >
              <div
                className={cn(
                  'w-14 h-14 rounded-full bg-gradient-to-tr text-white flex items-center justify-center shadow-sm mb-2.5 group-hover:scale-105 transition-transform ring-4 ring-slate-50',
                  mod.color
                )}
              >
                <Icon size={22} />
              </div>

              <h4 className="text-xs font-black text-slate-800 tracking-tight">{mod.title}</h4>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 line-clamp-1">{mod.desc}</p>

              <span
                className={cn(
                  'mt-2 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tabular-nums',
                  mod.bgColor,
                  mod.textColor
                )}
              >
                {mod.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4 Clean Minimalist KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Ventas Contratadas</span>
            <DollarSign size={15} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 tabular-nums">
            ${(totalContractedVolume / 1000000).toFixed(1)}M
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {contracts.length} contratos • {conversionRate.toFixed(1)}% conversión
          </p>
        </div>

        <div
          onClick={() => onNavigate('tracking')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-sky-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>En Negociación</span>
            <TrendingUp size={15} className="text-sky-600" />
          </div>
          <p className="text-2xl font-black text-sky-700 tabular-nums">
            ${(totalInNegotiation / 1000000).toFixed(1)}M
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {pendingQuotations.length} cotizaciones abiertas
          </p>
        </div>

        <div
          onClick={() => onNavigate('tracking')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Estancadas (≥{stagnationDays}d)</span>
            <Snowflake size={15} className="text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-700 tabular-nums">{stagnationAlerts.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Sin interacción reciente</p>
        </div>

        <div
          onClick={() => onNavigate('alerts')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-rose-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
            <span>Plazos & Cuotas</span>
            <Bell size={15} className="text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-700 tabular-nums">{contractAlerts.length}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Alertas contractuales activas</p>
        </div>
      </div>

      {/* Main Smart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left (2 cols): Priority Pipeline & 1-Click Outreach */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 tracking-tight">
                Cotizaciones Prioritarias sin Cierre
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 tabular-nums">
                Ordenadas por semáforo de cierre • Total activo: <strong>${totalInNegotiation.toLocaleString('es-CL')} CLP</strong>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar rápido..."
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-sky-500 w-36 sm:w-44"
                />
              </div>

              <button
                type="button"
                onClick={() => onNavigate('tracking')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <span>Ver Todo</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {filteredQuotations.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-600">No hay cotizaciones pendientes</p>
                <p className="text-[11px] text-slate-400">Todas las cotizaciones han sido cerradas o descartadas.</p>
              </div>
            ) : (
              filteredQuotations.map(q => (
                <div
                  key={q.budget.id}
                  className={cn(
                    'p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300',
                    q.isStagnant ? 'bg-amber-50/30 border-amber-200' : 'bg-slate-50/70 border-slate-200/80'
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span
                      className={cn(
                        'w-7 h-7 rounded-xl flex items-center justify-center text-white text-[10px] font-black shrink-0',
                        q.score === 'Alta' ? 'bg-emerald-600' : q.score === 'Media' ? 'bg-amber-500' : 'bg-rose-500'
                      )}
                      title={`Probabilidad: ${q.score}`}
                    >
                      {q.score[0]}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-800 truncate">
                          {q.client?.nombre || 'Cliente'}
                        </span>
                        {q.isStagnant && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 tabular-nums">
                            +{q.daysSince}d estancada
                          </span>
                        )}
                        {!q.isStagnant && q.daysSince <= 2 && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-green-100 text-green-800">
                            Activa
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate tabular-nums">
                        {q.modelName} ({q.budget.superficie_m2 || 36} m²) • Folio: {q.budget.id.slice(0, 6).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                    <span className="text-xs font-black text-slate-800 tabular-nums mr-1">
                      ${q.budget.monto_total.toLocaleString('es-CL')}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(q)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                      title="WhatsApp de seguimiento"
                    >
                      <MessageCircle size={13} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendEmail(q)}
                      className="p-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[11px] font-bold transition"
                      title="Correo de seguimiento"
                    >
                      <Mail size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.localStorage.setItem('pending_contract_budget_id', q.budget.id);
                        onNavigate('contracts');
                      }}
                      className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <span>Contratar</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right (1 col): Compact Smart Trend Chart + Alerts Card */}
        <div className="space-y-6">
          {/* Compact Monthly Chart */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-sky-600" />
                <h3 className="text-xs font-black uppercase text-slate-800">Cotizado vs Ventas ($M)</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">6 meses</span>
            </div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={smartTrendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip formatter={(val: any) => [`$${val}M CLP`]} />
                  <Bar dataKey="cotizadoM" name="Cotizado" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ventasM" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alerts Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-800">Alertas Activas</h3>
                  <p className="text-[10px] text-slate-400">Plazos contractuales y estancamiento</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition"
              >
                Abrir ({totalAlertsCount})
              </button>
            </div>

            <div className="space-y-2.5">
              {totalAlertsCount === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-1" />
                  <p className="font-bold text-slate-700">Sin plazos críticos</p>
                  <p className="text-[10px] text-slate-400">Obras y seguimientos al día</p>
                </div>
              ) : (
                <>
                  {contractAlerts.slice(0, 2).map(alt => (
                    <div
                      key={alt.id}
                      onClick={() => onNavigate('alerts')}
                      className={cn(
                        'p-3 rounded-2xl border transition cursor-pointer text-xs',
                        alt.tipo === 'entrega_vencida'
                          ? 'bg-red-50 border-red-200 text-red-900'
                          : alt.tipo === 'entrega_urgente'
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-blue-50 border-blue-200 text-blue-900'
                      )}
                    >
                      <div className="flex items-center justify-between font-black text-[11px]">
                        <span className="truncate">{alt.titulo}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md bg-white/80">
                          {alt.severidad}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-700 mt-1 line-clamp-1">
                        {alt.cliente_nombre} • {alt.detalle}
                      </p>
                    </div>
                  ))}
                  {stagnationAlerts.slice(0, 2).map(st => (
                    <div
                      key={st.id}
                      onClick={() => onNavigate('tracking')}
                      className="p-3 rounded-2xl border border-orange-200 bg-orange-50/70 text-orange-950 transition cursor-pointer text-xs"
                    >
                      <div className="flex items-center justify-between font-black text-[11px]">
                        <span className="truncate">Estancada ({st.dias_sin_interaccion}d sin avance)</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-md bg-white/80">
                          {st.lead_score}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-700 mt-1 line-clamp-1 tabular-nums">
                        {st.cliente_nombre} • ${st.monto_total.toLocaleString('es-CL')} CLP
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartView;
