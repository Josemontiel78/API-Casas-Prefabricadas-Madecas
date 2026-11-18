import React, { useEffect, useState, useMemo } from 'react';
import {
  subscribeToClients,
  subscribeToProjects,
  subscribeToBudgets,
  subscribeToContracts,
  subscribeToUsers
} from '@/services/db';
import {
  computeContractAlerts,
  computeStagnationAlerts,
  getStagnationThresholdDays
} from '@/services/contractAlerts';
import { Contract, Client, Project, Budget, ViewState, SystemUser } from '@/types';
import {
  Users,
  Calculator,
  FileSignature,
  DollarSign,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  ArrowRight,
  Award,
  Filter,
  Mail,
  Bell,
  Clock,
  CheckCircle2,
  Snowflake,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';

interface Warning {
  id: string;
  type: 'stale' | 'missing_data' | 'pending_contract';
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  refId: string;
}

interface UserSalesReport {
  user: SystemUser;
  clientsCount: number;
  quotesCount: number;
  contractsCount: number;
  totalSalesVolume: number;
  pendingQuotesVolume: number;
  conversionRate: number;
  targetAchievement: number;
  estimatedCommission: number;
}

const Dashboard: React.FC = () => {
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [allBudgets, setAllBudgets] = useState<Budget[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [allUsers, setAllUsers] = useState<SystemUser[]>([]);
  const [stagnationDays, setStagnationDays] = useState<number>(getStagnationThresholdDays);

  // Selected Seller Filter
  const [selectedUserId, setSelectedUserId] = useState<string>('todos');

  useEffect(() => {
    const unsubCl = subscribeToClients(setAllClients);
    const unsubPr = subscribeToProjects(setAllProjects);
    const unsubBu = subscribeToBudgets(setAllBudgets);
    const unsubCo = subscribeToContracts(setAllContracts);
    const unsubUs = subscribeToUsers(setAllUsers);

    const handleThresholdSync = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') setStagnationDays(val);
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleThresholdSync);

    return () => {
      unsubCl();
      unsubPr();
      unsubCo();
      unsubBu();
      unsubUs();
      window.removeEventListener('crm-stagnation-threshold-changed', handleThresholdSync);
    };
  }, []);

  // Compute filtered entities & derived metrics unconditionally so charts/KPIs always render cleanly
  const dashboardComputed = useMemo(() => {
    const selectedUser = allUsers.find(u => u.id === selectedUserId);

    const filteredClients =
      selectedUserId === 'todos'
        ? allClients
        : allClients.filter(
            c =>
              c.vendedor_id === selectedUserId ||
              (c.vendedor_nombre && selectedUser?.nombre === c.vendedor_nombre)
          );

    const filteredBudgets =
      selectedUserId === 'todos'
        ? allBudgets
        : allBudgets.filter(
            b =>
              b.vendedor_id === selectedUserId ||
              filteredClients.some(c => c.id === b.cliente_id)
          );

    const filteredContracts =
      selectedUserId === 'todos'
        ? allContracts
        : allContracts.filter(
            c =>
              c.vendedor_id === selectedUserId ||
              filteredClients.some(cl => cl.id === c.cliente_id)
          );

    const contractedBudgetIds = new Set(filteredContracts.map(c => c.presupuesto_id));

    const stages = [
      'Registro',
      'Selección Modelo',
      'Personalización',
      'Cotización',
      'Negociación',
      'Cierre',
      'Postventa'
    ];

    const funnelValues = stages.map(stage => ({
      name: stage,
      count: filteredClients.filter(c => (c.etapa_venta || 'Registro') === stage).length
    }));

    const totalVolume = filteredContracts.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const activePendingBudgets = filteredBudgets.filter(
      b => !contractedBudgetIds.has(b.id) && !b.descartado
    );
    const discardedBudgets = filteredBudgets.filter(b => !!b.descartado);

    const pendingVolume = activePendingBudgets.reduce((sum, b) => sum + (b.monto_total || 0), 0);

    // Warnings (missing client fields + stagnant budgets)
    const newWarnings: Warning[] = [];
    const stagnationAlerts = computeStagnationAlerts(
      filteredBudgets,
      filteredClients,
      filteredContracts,
      stagnationDays
    );

    stagnationAlerts.forEach(st => {
      newWarnings.push({
        id: st.id,
        type: 'stale',
        title: `Cotización Estancada (${st.dias_sin_interaccion}d)`,
        message: `${st.cliente_nombre} lleva ${st.dias_sin_interaccion} días sin interacción ($${st.monto_total.toLocaleString('es-CL')} CLP).`,
        severity: st.severidad === 'urgente' ? 'high' : 'medium',
        refId: st.budget_id
      });
    });

    filteredClients.forEach(c => {
      const missingFields: string[] = [];
      if (!c.correo) missingFields.push('Correo');
      if (!c.telefono) missingFields.push('Teléfono');
      if (!c.location) missingFields.push('Ubicación GPS');
      if (!c.rol_propiedad) missingFields.push('Rol SII');

      if (missingFields.length > 0) {
        newWarnings.push({
          id: `missing-${c.id}`,
          type: 'missing_data',
          title: 'Ficha de Cliente Incompleta',
          message: `${c.nombre}: falta ${missingFields.join(', ')}.`,
          severity: 'low',
          refId: c.id
        });
      }
    });

    const sortedWarnings = newWarnings.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });

    // Contract alerts
    const contractAlerts = computeContractAlerts(filteredContracts, filteredClients);

    // Last 6 months baseline
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const last6Months: {
      month: string;
      monthIdx: number;
      year: number;
      ventas: number;
      cotizado: number;
    }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        ventas: 0,
        cotizado: 0
      });
    }

    filteredContracts.forEach(c => {
      if (!c.fecha_contrato) return;
      const d = new Date(c.fecha_contrato);
      if (isNaN(d.getTime())) return;
      const pt = last6Months.find(p => p.monthIdx === d.getMonth() && p.year === d.getFullYear());
      if (pt) pt.ventas += c.monto_total || 0;
    });

    filteredBudgets.forEach(b => {
      if (!b.fecha) return;
      const d = new Date(b.fecha);
      if (isNaN(d.getTime())) return;
      const pt = last6Months.find(p => p.monthIdx === d.getMonth() && p.year === d.getFullYear());
      if (pt) pt.cotizado += b.monto_total || 0;
    });

    // Conversion Pie Data
    const conversionData = [
      { name: 'Contratos Cerrados', value: filteredContracts.length, color: '#10b981' },
      { name: 'En Seguimiento', value: activePendingBudgets.length, color: '#f59e0b' },
      { name: 'Descartadas', value: discardedBudgets.length, color: '#f43f5e' }
    ].filter(d => d.value > 0);

    // Top Loss Reasons
    const lossCounts: Record<string, number> = {};
    discardedBudgets.forEach(b => {
      const reason = b.motivo_descarte || 'Sin motivo';
      lossCounts[reason] = (lossCounts[reason] || 0) + 1;
    });
    const topLossReasons = Object.entries(lossCounts)
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      stats: {
        totalClients: filteredClients.length,
        activeProjects: allProjects.length,
        totalQuotes: filteredBudgets.length,
        pendingQuotesCount: activePendingBudgets.length,
        signedContracts: filteredContracts.length,
        discardedCount: discardedBudgets.length,
        totalVolume,
        pendingVolume
      },
      recentContracts: [...filteredContracts].slice(-5).reverse(),
      warnings: sortedWarnings,
      contractAlerts,
      stagnationAlerts,
      chartData: last6Months,
      funnelData: funnelValues,
      conversionData,
      topLossReasons
    };
  }, [allClients, allProjects, allBudgets, allContracts, allUsers, selectedUserId, stagnationDays]);

  const {
    stats,
    recentContracts,
    warnings,
    contractAlerts,
    stagnationAlerts,
    chartData,
    funnelData,
    conversionData,
    topLossReasons
  } = dashboardComputed;

  // Aggregate User Sales Report for all registered users
  const userSalesReports: UserSalesReport[] = useMemo(() => {
    return allUsers
      .filter(u => !u.eliminado)
      .map(user => {
        const userClients = allClients.filter(
          c => c.vendedor_id === user.id || c.vendedor_nombre === user.nombre
        );
        const userClientIds = new Set(userClients.map(c => c.id));

        const userContracts = allContracts.filter(
          c => c.vendedor_id === user.id || userClientIds.has(c.cliente_id)
        );
        const userBudgets = allBudgets.filter(
          b => b.vendedor_id === user.id || userClientIds.has(b.cliente_id)
        );

        const totalSalesVolume = userContracts.reduce((sum, c) => sum + (c.monto_total || 0), 0);
        const pendingQuotesVolume = userBudgets.reduce((sum, b) => {
          const isContracted = userContracts.some(c => c.presupuesto_id === b.id);
          return isContracted || b.descartado ? sum : sum + (b.monto_total || 0);
        }, 0);

        const quotesCount = userBudgets.length;
        const contractsCount = userContracts.length;
        const conversionRate = quotesCount > 0 ? (contractsCount / quotesCount) * 100 : 0;

        const targetMonthly = user.meta_mensual_pesos || 50000000;
        const targetAchievement = targetMonthly > 0 ? (totalSalesVolume / targetMonthly) * 100 : 0;
        const commissionRate = (user.comision_porcentaje || 3) / 100;
        const estimatedCommission = totalSalesVolume * commissionRate;

        return {
          user,
          clientsCount: userClients.length,
          quotesCount,
          contractsCount,
          totalSalesVolume,
          pendingQuotesVolume,
          conversionRate,
          targetAchievement,
          estimatedCommission
        };
      })
      .sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);
  }, [allUsers, allClients, allContracts, allBudgets]);

  const userBarChartData = useMemo(() => {
    return userSalesReports.map(rep => ({
      name: rep.user.nombre.split(' ')[0],
      fullName: rep.user.nombre,
      ventas: rep.totalSalesVolume / 1000000,
      cotizado: rep.pendingQuotesVolume / 1000000,
      contratos: rep.contractsCount
    }));
  }, [userSalesReports]);

  const navigateTo = (view: ViewState) => {
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: view }));
  };

  const handleManageWarning = (warn: Warning) => {
    if (warn.type === 'missing_data') {
      window.localStorage.setItem('dash_trigger_client_id', warn.refId);
      navigateTo('clients');
    } else if (warn.type === 'stale') {
      navigateTo('tracking');
    } else {
      navigateTo('budgets');
    }
  };

  const selectedUserObj = allUsers.find(u => u.id === selectedUserId);

  return (
    <div id="dashboard-monitor" className="space-y-6 animate-in fade-in duration-300 pb-16">
      {/* Top Banner with User / Seller Filter & Quick Navigation */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <BarChart3 size={22} />
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Dashboard Comercial & Control de Ventas
            </h2>
          </div>
          <p className="text-slate-500 text-xs font-medium">
            Resumen ejecutivo en tiempo real: facturación, pipeline de cotizaciones, alertas de plazos contractuales y rendimiento por vendedor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          {/* Quick View Shortcuts */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigateTo('tracking')}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <TrendingUp size={14} className="text-emerald-600" />
              <span>Seguimiento ({stats.pendingQuotesCount})</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('alerts')}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 tabular-nums"
            >
              <Bell size={14} className="text-amber-600" />
              <span>Alertas ({contractAlerts.length + stagnationAlerts.length})</span>
            </button>

            <button
              type="button"
              onClick={() => navigateTo('budgets')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Calculator size={14} />
              <span>+ Cotizar</span>
            </button>
          </div>

          {/* Filter Dropdown */}
          <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
            <Filter size={15} className="text-emerald-600 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase font-bold text-slate-400">Ejecutivo / Vendedor:</span>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-3 cursor-pointer"
              >
                <option value="todos">Todos los Usuarios (Global)</option>
                {allUsers.filter(u => !u.eliminado).map(user => (
                  <option key={user.id} value={user.id}>
                    {user.nombre} ({user.cargo || user.rol})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Active User Filter Badge if filtered */}
      {selectedUserId !== 'todos' && selectedUserObj && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center">
              {selectedUserObj.nombre.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Reporte individual de: <span className="font-black text-sm">{selectedUserObj.nombre}</span>
              </p>
              <p className="text-[11px] text-emerald-700">
                {selectedUserObj.correo} • Rol: {selectedUserObj.rol} • Cargo: {selectedUserObj.cargo || 'Ejecutivo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedUserId('todos')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline px-3 py-1"
          >
            Restablecer filtro
          </button>
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Ventas
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Monto Total Contratado</p>
          <h3 className="text-2xl font-black text-slate-900 tabular-nums">
            ${(stats.totalVolume / 1000000).toFixed(1)}M
          </h3>
          <p className="text-slate-500 text-xs mt-1 tabular-nums">
            {stats.signedContracts} contratos {selectedUserId !== 'todos' ? 'del usuario' : 'registrados'}
          </p>
        </div>

        <div
          onClick={() => navigateTo('tracking')}
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-orange-300 transition cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-600">
              <Calculator className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-200">
              Pipeline
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Cotizaciones por Cerrar</p>
          <h3 className="text-2xl font-black text-slate-900 tabular-nums">
            ${(stats.pendingVolume / 1000000).toFixed(1)}M
          </h3>
          <p className="text-slate-500 text-xs mt-1 tabular-nums">
            {stats.pendingQuotesCount} activas • {stagnationAlerts.length} estancadas
          </p>
        </div>

        <div
          onClick={() => navigateTo('clients')}
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-300 transition cursor-pointer"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
              Cartera
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Clientes Registrados</p>
          <h3 className="text-2xl font-black text-slate-900 tabular-nums">{stats.totalClients}</h3>
          <p className="text-slate-500 text-xs mt-1">Compradores y prospectos</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Cierre
            </span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tasa de Conversión</p>
          <h3 className="text-2xl font-black text-slate-900 tabular-nums">
            {stats.totalQuotes > 0 ? ((stats.signedContracts / stats.totalQuotes) * 100).toFixed(1) : '0.0'}%
          </h3>
          <p className="text-slate-500 text-xs mt-1 tabular-nums">
            {stats.signedContracts} cierres de {stats.totalQuotes} cotizaciones
          </p>
        </div>
      </div>

      {/* Operational Intelligence Row: Alerts & Stagnation + Conversion & Loss Reasons + Recent Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Alertas Activas (Contratos + Estancamiento + Fichas) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Alertas de Plazos y Seguimiento</h3>
                <p className="text-[11px] text-slate-500">Contratos, cuotas y cotizaciones estancadas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('alerts')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              Ver módulo <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {contractAlerts.length === 0 && warnings.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CheckCircle2 size={28} className="mx-auto text-emerald-500 mb-2" />
                <p className="text-xs font-bold text-slate-700">Operación al día</p>
                <p className="text-[11px]">No hay plazos vencidos ni cotizaciones estancadas.</p>
              </div>
            ) : (
              <>
                {contractAlerts.slice(0, 3).map(al => (
                  <div
                    key={al.id}
                    onClick={() => navigateTo('alerts')}
                    className="p-3 rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                      <span className="truncate">{al.titulo}</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-white border border-amber-200">
                        Contrato
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-0.5 truncate">
                      {al.cliente_nombre} • Ref: {al.fecha_referencia}
                    </p>
                  </div>
                ))}

                {warnings.slice(0, Math.max(1, 4 - Math.min(3, contractAlerts.length))).map(w => (
                  <div
                    key={w.id}
                    onClick={() => handleManageWarning(w)}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/70 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                      <span className="flex items-center gap-1.5 truncate">
                        {w.type === 'stale' ? (
                          <Snowflake size={12} className="text-orange-500 shrink-0" />
                        ) : (
                          <Clock size={12} className="text-slate-500 shrink-0" />
                        )}
                        {w.title}
                      </span>
                      <ArrowRight size={12} className="text-slate-400 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">{w.message}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Column 2: Estado de Cotizaciones & Motivos de Pérdida */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <PieChartIcon size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Efectividad & Motivos de Pérdida</h3>
                <p className="text-[11px] text-slate-500">Distribución de cotizaciones emitidas</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('tracking')}
              className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1"
            >
              Detalle <ArrowRight size={12} />
            </button>
          </div>

          <div className="h-44 w-full">
            {conversionData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Sin cotizaciones emitidas aún
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={conversionData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={66}
                    paddingAngle={3}
                  >
                    {conversionData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => [`${val} cotizaciones`]} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <span className="text-[10px] font-black uppercase text-slate-400 block">
              Principales motivos de pérdida ({stats.discardedCount} descartes)
            </span>
            {topLossReasons.length === 0 ? (
              <p className="text-[11px] text-slate-500">Sin descartes registrados actualmente.</p>
            ) : (
              topLossReasons.map(r => (
                <div key={r.motivo} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 truncate pr-2">{r.motivo}</span>
                  <span className="font-black text-rose-700 tabular-nums">{r.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Últimos Contratos */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileSignature size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800">Últimos Contratos</h3>
                <p className="text-[11px] text-slate-500">Operaciones cerradas recientemente</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('contracts')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-2.5 flex-1">
            {recentContracts.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <FileSignature size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold text-slate-600">Sin contratos recientes</p>
                <p className="text-[11px]">Convierte una cotización en contrato para verla aquí.</p>
              </div>
            ) : (
              recentContracts.map(contract => {
                const client = contract.cliente_snapshot || allClients.find(c => c.id === contract.cliente_id);
                return (
                  <div
                    key={contract.id}
                    onClick={() => {
                      window.localStorage.setItem('selected_contract_id', contract.id);
                      navigateTo('contracts');
                    }}
                    className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100 transition cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {client?.nombre || 'Cliente'}
                      </p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {contract.fecha_contrato} • {contract.estado}
                      </p>
                    </div>
                    <span className="text-xs font-black text-emerald-700 shrink-0 tabular-nums">
                      ${(contract.monto_total || 0).toLocaleString('es-CL')}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Historical Growth Chart & Sales Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-3xl border border-slate-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Crecimiento Comercial Mensual</h3>
              <p className="text-xs text-slate-500">Historial de ventas contratadas vs monto cotizado (últimos 6 meses)</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Ventas
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-indigo-300"></div> Cotizado
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCotizado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a5b4fc" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a5b4fc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', padding: '12px' }}
                  formatter={(val: any) => [`$${Number(val).toLocaleString('es-CL')} CLP`]}
                />
                <Area type="monotone" dataKey="cotizado" stroke="#818cf8" strokeWidth={2} fillOpacity={1} fill="url(#colorCotizado)" />
                <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Embudo de Ventas */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200">
          <h3 className="text-lg font-black text-slate-800 mb-1">Embudo de Ventas (7 Pasos)</h3>
          <p className="text-xs text-slate-500 mb-4">Avance de clientes por ciclo de venta</p>

          <div className="space-y-3">
            {funnelData.map((stage, idx) => {
              const total = stats.totalClients || 1;
              const pct = (stage.count / total) * 100;
              return (
                <div key={stage.name}>
                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                    <span>{idx + 1}. {stage.name}</span>
                    <span className="font-extrabold text-slate-900 tabular-nums">{stage.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION: REPORTE DE VENTAS POR USUARIO */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Award className="text-emerald-600" size={22} />
              <h3 className="text-xl font-black text-slate-800">Reporte de Ventas por Usuario</h3>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              Comparativa de ventas, cotizaciones, efectividad de cierre y comisiones por cada ejecutivo comercial.
            </p>
          </div>

          <span className="text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-xl tabular-nums">
            {userSalesReports.length} Usuarios Activos
          </span>
        </div>

        {/* User Sales Performance Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 rounded-l-xl">Ejecutivo / Usuario</th>
                <th className="py-3 px-3">Correo Electrónico</th>
                <th className="py-3 px-3 text-center">Clientes</th>
                <th className="py-3 px-3 text-center">Cotizaciones</th>
                <th className="py-3 px-3 text-center">Contratos</th>
                <th className="py-3 px-3 text-right">Ventas Totales ($)</th>
                <th className="py-3 px-3 text-right">Comisión Est.</th>
                <th className="py-3 px-3 text-center">Tasa Cierre</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userSalesReports.map(report => {
                const isSelected = selectedUserId === report.user.id;
                return (
                  <tr
                    key={report.user.id}
                    className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-emerald-50/60 font-semibold' : ''}`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {report.user.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs">{report.user.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{report.user.cargo || report.user.rol}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Mail size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{report.user.correo}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                      {report.clientsCount}
                    </td>

                    <td className="py-3.5 px-3 text-center font-bold text-slate-700 tabular-nums">
                      {report.quotesCount}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 tabular-nums">
                        {report.contractsCount}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-black text-slate-800 text-sm tabular-nums">
                      ${report.totalSalesVolume.toLocaleString('es-CL')} CLP
                    </td>

                    <td className="py-3.5 px-3 text-right font-bold text-emerald-700 tabular-nums">
                      ${Math.round(report.estimatedCommission).toLocaleString('es-CL')}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-800 tabular-nums">{report.conversionRate.toFixed(1)}%</span>
                        <div className="w-16 bg-slate-200 h-1 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.min(100, report.conversionRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(isSelected ? 'todos' : report.user.id)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg transition ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {isSelected ? 'Filtrado' : 'Ver Detalle'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Visual Chart: Sales Comparison by User */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-indigo-600" />
            Comparación Gráfica de Ventas por Ejecutivo (Millones CLP)
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={userBarChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}M`} />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    `$${(Number(val) * 1000000).toLocaleString('es-CL')} CLP`,
                    name === 'ventas' ? 'Ventas Cerradas' : 'Cotizaciones Pendientes'
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
                <Legend formatter={(val) => (val === 'ventas' ? 'Ventas Cerradas ($M)' : 'Cotizaciones Pendientes ($M)')} />
                <Bar dataKey="ventas" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cotizado" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
