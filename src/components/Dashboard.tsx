import React, { useEffect, useState, useMemo } from 'react';
import { getClients, getProjects, getBudgets, getContracts, getUsers, subscribeToUsers } from '@/services/db';
import { Contract, Client, Project, Budget, ViewState, SystemUser } from '@/types';
import { 
  Users, 
  FolderOpen, 
  Calculator, 
  FileSignature, 
  ArrowUpRight, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Target,
  BarChart3,
  Calendar,
  Layers,
  AlertTriangle,
  UserPlus,
  ArrowRight,
  UserCheck,
  Award,
  Filter,
  CheckCircle2,
  Mail,
  Percent,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
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

  // Selected Seller Filter
  const [selectedUserId, setSelectedUserId] = useState<string>('todos');

  const [stats, setStats] = useState({
    totalClients: 0,
    activeProjects: 0,
    totalQuotes: 0,
    signedContracts: 0,
    totalVolume: 0,
    pendingVolume: 0
  });

  const [recentContracts, setRecentContracts] = useState<Contract[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [conversionData, setConversionData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [clients, projects, budgets, contracts, users] = await Promise.all([
        getClients(),
        getProjects(),
        getBudgets(),
        getContracts(),
        getUsers()
      ]);

      setAllClients(clients);
      setAllProjects(projects);
      setAllBudgets(budgets);
      setAllContracts(contracts);
      setAllUsers(users);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToUsers((u) => setAllUsers(u));
    return () => unsub();
  }, []);

  // Compute stats dynamically whenever data or selectedUserId changes
  useEffect(() => {
    if (allClients.length === 0 && allBudgets.length === 0 && allContracts.length === 0) return;

    // Filter by selected user if not 'todos'
    const filteredClients = selectedUserId === 'todos' 
      ? allClients 
      : allClients.filter(c => c.vendedor_id === selectedUserId || (c.vendedor_nombre && allUsers.find(u => u.id === selectedUserId)?.nombre === c.vendedor_nombre));

    const filteredBudgets = selectedUserId === 'todos'
      ? allBudgets
      : allBudgets.filter(b => b.vendedor_id === selectedUserId || filteredClients.some(c => c.id === b.cliente_id));

    const filteredContracts = selectedUserId === 'todos'
      ? allContracts
      : allContracts.filter(c => c.vendedor_id === selectedUserId || filteredClients.some(cl => cl.id === c.cliente_id));

    // Sales Funnel Data
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
    const pendingVolume = filteredBudgets.reduce((sum, b) => {
      const isContracted = filteredContracts.some(c => c.presupuesto_id === b.id);
      return isContracted ? sum : sum + b.monto_total;
    }, 0);

    setStats({
      totalClients: filteredClients.length,
      activeProjects: allProjects.length,
      totalQuotes: filteredBudgets.length,
      signedContracts: filteredContracts.length,
      totalVolume,
      pendingVolume
    });

    setRecentContracts(filteredContracts.slice(-5).reverse());

    // Generate Warnings
    const newWarnings: Warning[] = [];
    const now = new Date();

    filteredBudgets.forEach(b => {
      const isContracted = filteredContracts.some(c => c.presupuesto_id === b.id);
      if (!isContracted) {
        const quoteDate = new Date(b.fecha);
        const diffDays = Math.floor((now.getTime() - quoteDate.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays >= 3) {
          newWarnings.push({
            id: `stale-${b.id}`,
            type: 'stale',
            title: 'Cotización Estancada',
            message: `El cliente lleva ${diffDays} días sin cerrar su cotización de $${b.monto_total.toLocaleString()}.`,
            severity: diffDays > 7 ? 'high' : 'medium',
            refId: b.id
          });
        }
      }
    });

    filteredClients.forEach(c => {
      const missingFields = [];
      if (!c.correo) missingFields.push('Correo');
      if (!c.telefono) missingFields.push('Teléfono');
      if (!c.location) missingFields.push('Ubicación GPS');
      if (!c.rol_propiedad) missingFields.push('Rol SII');

      if (missingFields.length > 0) {
        newWarnings.push({
          id: `missing-${c.id}`,
          type: 'missing_data',
          title: 'Datos Incompletos',
          message: `El cliente ${c.nombre} no tiene: ${missingFields.join(', ')}.`,
          severity: 'medium',
          refId: c.id
        });
      }
    });

    setWarnings(newWarnings.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }));

    // Generate Chart Data (Last 6 months)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const last6Months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last6Months.push({
        month: monthNames[d.getMonth()],
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        ventas: 0, 
        cotizado: 0, 
        realVentas: 0,
        realCotizado: 0
      });
    }

    filteredContracts.forEach(c => {
      if (!c.fecha_contrato) return;
      const d = new Date(c.fecha_contrato);
      if (isNaN(d.getTime())) return;
      const m = d.getMonth();
      const y = d.getFullYear();
      const point = last6Months.find(p => p.monthIdx === m && p.year === y);
      if (point) {
        point.ventas += c.monto_total;
        point.realVentas += c.monto_total;
      }
    });

    filteredBudgets.forEach(b => {
      if (!b.fecha) return;
      const d = new Date(b.fecha);
      if (isNaN(d.getTime())) return;
      const m = d.getMonth();
      const y = d.getFullYear();
      const point = last6Months.find(p => p.monthIdx === m && p.year === y);
      if (point) {
        point.cotizado += b.monto_total;
        point.realCotizado += b.monto_total;
      }
    });

    setChartData(last6Months);
    setFunnelData(funnelValues);

    // Conversion Data
    const lost = Math.max(0, filteredBudgets.length - filteredContracts.length);
    setConversionData([
      { name: 'Cerrados', value: filteredContracts.length || 0, color: '#10b981' },
      { name: 'En Proceso', value: lost || 0, color: '#f59e0b' }
    ]);
  }, [allClients, allProjects, allBudgets, allContracts, allUsers, selectedUserId]);

  // Aggregate User Sales Report for all registered users
  const userSalesReports: UserSalesReport[] = useMemo(() => {
    return allUsers.map(user => {
      // Find clients linked to this user
      const userClients = allClients.filter(c => c.vendedor_id === user.id || c.vendedor_nombre === user.nombre);
      const userClientIds = new Set(userClients.map(c => c.id));

      // Find contracts for this user
      const userContracts = allContracts.filter(c => c.vendedor_id === user.id || userClientIds.has(c.cliente_id));
      
      // Find budgets for this user
      const userBudgets = allBudgets.filter(b => b.vendedor_id === user.id || userClientIds.has(b.cliente_id));

      const totalSalesVolume = userContracts.reduce((sum, c) => sum + (c.monto_total || 0), 0);
      const pendingQuotesVolume = userBudgets.reduce((sum, b) => {
        const isContracted = userContracts.some(c => c.presupuesto_id === b.id);
        return isContracted ? sum : sum + b.monto_total;
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
    }).sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);
  }, [allUsers, allClients, allContracts, allBudgets]);

  // User comparison chart data
  const userBarChartData = useMemo(() => {
    return userSalesReports.map(rep => ({
      name: rep.user.nombre.split(' ')[0],
      fullName: rep.user.nombre,
      ventas: rep.totalSalesVolume / 1000000, // In Millions CLP
      cotizado: rep.pendingQuotesVolume / 1000000,
      contratos: rep.contractsCount
    }));
  }, [userSalesReports]);

  const handleManage = (warn: Warning) => {
    let view: ViewState = 'dashboard';
    switch (warn.type) {
      case 'missing_data': 
        view = 'clients'; 
        window.localStorage.setItem('dash_trigger_client_id', warn.refId);
        window.localStorage.setItem('dash_focus_field', 'telefono,correo,domicilio,rol_propiedad');
        break;
      case 'stale':
      case 'pending_contract': 
        view = 'budgets'; 
        window.localStorage.setItem('dash_trigger_budget_id', warn.refId);
        break;
      default: view = 'dashboard';
    }
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: view }));
  };

  const selectedUserObj = allUsers.find(u => u.id === selectedUserId);

  return (
    <div id="dashboard-monitor" className="space-y-8 animate-in fade-in duration-700 pb-16">
      {/* Top Banner with User / Seller Filter */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <BarChart3 size={24} />
            </span>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Monitor Comercial & Reporte de Ventas</h2>
          </div>
          <p className="text-slate-500 text-xs font-medium">
            Métricas de ventas globales y reporte detallado del desempeño por usuario / ejecutivo.
          </p>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-3 w-full md:w-auto bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <Filter size={16} className="text-emerald-600 ml-2 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[9px] uppercase font-bold text-slate-400">Filtrar por Vendedor / Usuario:</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none pr-4 cursor-pointer py-0.5"
            >
              <option value="todos">🌐 Todos los Usuarios (Visión General)</option>
              {allUsers.map(user => (
                <option key={user.id} value={user.id}>
                  👤 {user.nombre} ({user.cargo || user.rol})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active User Filter Badge if filtered */}
      {selectedUserId !== 'todos' && selectedUserObj && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center">
              {selectedUserObj.nombre.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-900">
                Mostrando reporte individual de: <span className="font-black text-sm">{selectedUserObj.nombre}</span>
              </p>
              <p className="text-[11px] text-emerald-700">
                {selectedUserObj.correo} • Rol: {selectedUserObj.rol} • Cargo: {selectedUserObj.cargo || 'Ejecutivo'}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSelectedUserId('todos')}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 underline px-3 py-1"
          >
            Restablecer a todos los usuarios
          </button>
        </div>
      )}

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div whileHover={{ y: -3 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Ventas
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Monto Total Facturado</p>
          <h3 className="text-2xl font-black text-slate-800">${(stats.totalVolume / 1000000).toFixed(1)}M</h3>
          <p className="text-slate-400 text-xs mt-1">
            {stats.signedContracts} contratos firmados {selectedUserId !== 'todos' ? 'por este usuario' : 'en total'}
          </p>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-orange-50 text-orange-600">
              <Calculator className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              Pipeline
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Oportunidades Abiertas</p>
          <h3 className="text-2xl font-black text-slate-800">${(stats.pendingVolume / 1000000).toFixed(1)}M</h3>
          <p className="text-slate-400 text-xs mt-1">Presupuestos en etapa de negociación</p>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              Cartera
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Clientes Asignados</p>
          <h3 className="text-2xl font-black text-slate-800">{stats.totalClients}</h3>
          <p className="text-slate-400 text-xs mt-1">Compradores y prospectos registrados</p>
        </motion.div>

        <motion.div whileHover={{ y: -3 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              Cierre
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Tasa de Conversión</p>
          <h3 className="text-2xl font-black text-slate-800">
            {stats.totalQuotes > 0 ? ((stats.signedContracts / stats.totalQuotes) * 100).toFixed(1) : 0}%
          </h3>
          <p className="text-slate-400 text-xs mt-1">Contratos cerrados vs cotizaciones</p>
        </motion.div>
      </div>

      {/* SECTION: REPORTE DE VENTAS POR USUARIO */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
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

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-bold bg-slate-100 px-3 py-1.5 rounded-xl">
              {userSalesReports.length} Usuarios Registrados
            </span>
          </div>
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
                <th className="py-3 px-3 text-right">Comisión Estimada</th>
                <th className="py-3 px-3 text-center">Tasa Cierre</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userSalesReports.map((report, idx) => {
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

                    <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                      {report.clientsCount}
                    </td>

                    <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                      {report.quotesCount}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                        {report.contractsCount}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-right font-black text-slate-800 text-sm">
                      ${report.totalSalesVolume.toLocaleString()} CLP
                    </td>

                    <td className="py-3.5 px-3 text-right font-bold text-emerald-700">
                      ${Math.round(report.estimatedCommission).toLocaleString()}
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-slate-800">{report.conversionRate.toFixed(1)}%</span>
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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userBarChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `$${val}M`} />
                <Tooltip 
                  formatter={(val: any, name: string) => [
                    `$${(Number(val) * 1000000).toLocaleString()} CLP`, 
                    name === 'ventas' ? 'Ventas Cerradas' : 'Cotizaciones Pendientes'
                  ]}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend formatter={(val) => val === 'ventas' ? 'Ventas Cerradas ($M)' : 'Cotizaciones Pendientes ($M)'} />
                <Bar dataKey="ventas" fill="#059669" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cotizado" fill="#93c5fd" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical Growth Chart & Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Crecimiento Comercial Mensual</h3>
              <p className="text-xs text-slate-500">Historial de ventas vs cotizaciones en los últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Ventas</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-200"></div> Cotizado</div>
            </div>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCotizado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c7d2fe" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#c7d2fe" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  formatter={(val: any) => [`$${Number(val).toLocaleString()} CLP`]}
                />
                <Area type="monotone" dataKey="cotizado" stroke="#a5b4fc" strokeWidth={2} fillOpacity={1} fill="url(#colorCotizado)" />
                <Area type="monotone" dataKey="ventas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVentas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Embudo de Ventas */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
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
                    <span className="font-extrabold text-slate-900">{stage.count}</span>
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
    </div>
  );
};

export default Dashboard;
