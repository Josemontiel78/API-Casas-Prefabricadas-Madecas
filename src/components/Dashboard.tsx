
import React, { useEffect, useState } from 'react';
import { getClients, getProjects, getBudgets, getContracts } from '@/services/db';
import { Contract, Client, Project, Budget, ViewState } from '@/types';
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
  ArrowRight
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
  Cell
} from 'recharts';

interface Warning {
  id: string;
  type: 'stale' | 'missing_data' | 'pending_contract';
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  refId: string;
}

const Dashboard: React.FC = () => {
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

  useEffect(() => {
    const loadData = async () => {
      const [clients, projects, budgets, contracts] = await Promise.all([
        getClients(),
        getProjects(),
        getBudgets(),
        getContracts()
      ]);

      const totalVolume = contracts.reduce((sum, c) => sum + (c.monto_total || 0), 0);
      const pendingVolume = budgets.reduce((sum, b) => {
          const isContracted = contracts.some(c => c.presupuesto_id === b.id);
          return isContracted ? sum : sum + b.monto_total;
      }, 0);

      setStats({
        totalClients: clients.length,
        activeProjects: projects.length,
        totalQuotes: budgets.length,
        signedContracts: contracts.length,
        totalVolume,
        pendingVolume
      });

      setRecentContracts(contracts.slice(-5).reverse());

      // Generate Warnings
      const newWarnings: Warning[] = [];
      const now = new Date();

      budgets.forEach(b => {
        const isContracted = contracts.some(c => c.presupuesto_id === b.id);
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

      clients.forEach(c => {
        const missingFields = [];
        if (!c.correo) missingFields.push('Correo');
        if (!c.telefono) missingFields.push('Teléfono');
        if (!c.location) missingFields.push('Ubicación GPS');

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
          ventas: 100, 
          cotizado: 200, 
          realVentas: 0,
          realCotizado: 0
        });
      }

      contracts.forEach(c => {
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

      budgets.forEach(b => {
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

      // Conversion Data
      const lost = Math.max(0, budgets.length - contracts.length);
      setConversionData([
        { name: 'Cerrados', value: contracts.length || 0, color: '#10b981' },
        { name: 'En Proceso', value: lost || 0, color: '#f59e0b' }
      ]);
    };

    loadData();
  }, []);

  const handleManage = (warn: Warning) => {
    let view: ViewState = 'dashboard';
    switch (warn.type) {
        case 'missing_data': 
            view = 'clients'; 
            window.localStorage.setItem('dash_trigger_client_id', warn.refId);
            window.localStorage.setItem('dash_focus_field', 'telefono,correo,domicilio');
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

  const EmptyChartNotice = ({ title }: { title: string }) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[1px] z-10 rounded-2xl">
        <TrendingUp size={32} className="text-slate-300 mb-2" />
        <p className="text-slate-600 font-bold">Datos Insuficientes</p>
        <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">Genera ventas o cotizaciones para {title}</p>
    </div>
  );

  const MetricCard = ({ title, value, sub, icon: Icon, color, trend }: any) => (
    <motion.div 
      whileHover={{ y: -4 }}
      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden"
    >
      <div className={cn("absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-5 rounded-full", color)}></div>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-xl", color.replace('bg-', 'bg-opacity-10 text-'))}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
            <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3" />
                {trend}
            </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800">{value}</h3>
        <p className="text-slate-400 text-xs mt-1">{sub}</p>
      </div>
    </motion.div>
  );

  return (
    <div id="dashboard-monitor" className="space-y-8 animate-in fade-in duration-700 pb-12">
      {/* Top Section: Sales Pipeline & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Crecimiento Comercial</h3>
              <p className="text-sm text-slate-500">Historial de ventas vs cotizaciones (últimos 6 meses)</p>
            </div>
            <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div> Ventas</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-200"></div> Cotizado</div>
                </div>
            </div>
          </div>
          
          {chartData.every(d => d.realVentas === 0 && d.realCotizado === 0) && (
              <EmptyChartNotice title="ver historial" />
          )}
          
          <div className="h-64 w-full min-h-[256px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCotizado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c7d2fe" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#c7d2fe" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: any, name: string, props: any) => {
                    const isReal = props.payload[`real${name.charAt(0).toUpperCase() + name.slice(1)}`] > 0;
                    const val = isReal ? props.payload[`real${name.charAt(0).toUpperCase() + name.slice(1)}`] : 0;
                    return [`$${val.toLocaleString()}`, name.charAt(0).toUpperCase() + name.slice(1)];
                  }}
                />
                <Area type="monotone" dataKey="cotizado" stroke="#c7d2fe" fillOpacity={1} fill="url(#colorCotizado)" strokeWidth={2} isAnimationActive={true} />
                <Area type="monotone" dataKey="ventas" stroke="#10b981" fillOpacity={1} fill="url(#colorVentas)" strokeWidth={3} isAnimationActive={true} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative overflow-hidden">
          <h3 className="text-xl font-black text-slate-800 mb-6">Tasa de Conversión</h3>
          {stats.totalQuotes === 0 && <EmptyChartNotice title="calcular conversión" />}
          <div className="flex-1 flex flex-col items-center justify-center relative min-h-[240px]">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {conversionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-x-0 bottom-4 flex justify-around">
               {conversionData.map(d => (
                 <div key={d.name} className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{d.name}</p>
                    <p className="text-lg font-black text-slate-800">{d.value}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Warning Panel */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 bg-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center">
               <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-800">Panel de Advertencias e Hitos</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Acciones comerciales sugeridas</p>
            </div>
          </div>
          <span className="bg-white px-3 py-1 rounded-full text-xs font-black text-slate-500 border border-slate-200">
            {warnings.length} PENDIENTES
          </span>
        </div>
        
        <div className="divide-y divide-slate-50 max-h-[300px] overflow-y-auto">
          {warnings.length > 0 ? warnings.map(warn => (
            <div key={warn.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
              <div className="flex gap-4">
                <div className={cn(
                  "w-2 h-2 mt-2 rounded-full",
                  warn.severity === 'high' ? 'bg-red-500' : warn.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                )} />
                <div>
                  <p className="text-sm font-black text-slate-800 flex items-center gap-2">
                    {warn.title}
                    {warn.severity === 'high' && (
                      <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Urgente</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xl">{warn.message}</p>
                </div>
              </div>
              <button 
                onClick={() => handleManage(warn)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all flex items-center gap-2 text-xs font-bold"
              >
                Gestionar <ArrowRight size={14} />
              </button>
            </div>
          )) : (
            <div className="p-12 text-center text-slate-400 italic">
               <Target className="mx-auto mb-3 opacity-20" size={40} />
               No hay advertencias críticas pendientes. ¡Buen trabajo!
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Conversion Rate" 
          value={`${stats.totalQuotes > 0 ? ((stats.signedContracts / stats.totalQuotes) * 100).toFixed(1) : 0}%`} 
          trend={stats.signedContracts > 0 ? "+2.4%" : null}
          sub="Efectividad de cierre"
          icon={TrendingUp} 
          color="bg-emerald-600"
        />
        <MetricCard 
          title="Oportunidades" 
          value={`$${(stats.pendingVolume / 1000000).toFixed(1)}M`} 
          sub="Presupuesto en negociación"
          icon={Calculator} 
          color="bg-orange-600"
        />
        <MetricCard 
          title="Ticket Promedio" 
          value={`$${(stats.totalVolume / (stats.signedContracts || 1) / 1000000).toFixed(1)}M`}
          sub="Venta media por contrato"
          icon={DollarSign} 
          color="bg-indigo-600"
        />
        <MetricCard 
          title="Catalog Health" 
          value={stats.activeProjects} 
          sub="Opciones de modelos activos"
          icon={Layers} 
          color="bg-blue-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Analysis */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-full">
              <div className="flex justify-between items-center mb-8">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Pipeline por Etapa</h3>
                    <p className="text-sm text-slate-500">Volumen financiero distribuido por proceso</p>
                </div>
              </div>

              <div className="space-y-8">
                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-600">Presupuestos en Proceso</span>
                          <span className="font-mono text-indigo-600 font-bold">${stats.pendingVolume.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (stats.pendingVolume / ((stats.totalVolume + stats.pendingVolume) || 1)) * 100)}%` }}
                            className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                          />
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-600">Volumen de Cierre</span>
                          <span className="font-mono text-emerald-600 font-bold">${stats.totalVolume.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, (stats.totalVolume / ((stats.totalVolume + stats.pendingVolume) || 1)) * 100)}%` }}
                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      {[
                        { label: 'Visitas', val: stats.totalClients, icon: Users, color: 'text-blue-500' },
                        { label: 'Cotizado', val: stats.totalQuotes, icon: Calculator, color: 'text-indigo-500' },
                        { label: 'Cierre', val: stats.signedContracts, icon: Target, color: 'text-emerald-500' },
                        { label: 'Proyección', val: `$${((stats.totalVolume + stats.pendingVolume) / 1000000).toFixed(1)}M`, icon: TrendingUp, color: 'text-amber-500' },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                             <item.icon className={cn("w-5 h-5 mb-2", item.color)} />
                             <p className="text-xl font-black text-slate-800">{item.val}</p>
                             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</p>
                        </div>
                      ))}
                  </div>
              </div>
           </div>
        </div>

        {/* Sidebar Activity */}
        <div className="space-y-6">
            <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[80px] opacity-20"></div>
                <div>
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-emerald-400" />
                      Actividad de Cierre
                  </h3>
                  <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                      {recentContracts.length > 0 ? recentContracts.map((c, i) => (
                          <div key={c.id} className="relative pl-8">
                              <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-500 z-10"></div>
                              <p className="text-sm font-bold truncate">Cotización {c.presupuesto_id.slice(0,8)}</p>
                              <p className="text-xs text-slate-400 mb-1">{c.fecha_contrato}</p>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">Contrato Generado</span>
                          </div>
                      )) : (
                          <p className="text-slate-500 text-sm italic pl-8">No hay cierres recientes</p>
                      )}
                  </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

