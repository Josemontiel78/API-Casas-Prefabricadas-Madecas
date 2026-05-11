
import React, { useEffect, useState } from 'react';
import { getClients, getProjects, getBudgets, getContracts } from '@/services/db';
import { Contract, Client, Project, Budget } from '@/types';
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
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

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

  useEffect(() => {
    const clients = getClients();
    const projects = getProjects();
    const budgets = getBudgets();
    const contracts = getContracts();

    const totalVolume = contracts.reduce((sum, c) => sum + (c.monto_total || 0), 0);
    const pendingVolume = budgets.reduce((sum, b) => {
        // Only count if not yet contracted
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
  }, []);

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
    <div id="dashboard-monitor" className="space-y-8 animate-in fade-in duration-700">
      {/* Visual Sales Funnel */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="flex justify-between items-end mb-8">
              <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Embudo de Ventas (Funnel)</h3>
                  <p className="text-sm text-slate-500">Estado actual del proceso comercial en tiempo real</p>
              </div>
              <div className="text-right">
                  <p className="text-3xl font-black text-emerald-600">${stats.totalVolume.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ventas Cerradas</p>
              </div>
          </div>

          <div className="relative h-48 flex items-center justify-center">
              {/* Funnel SVG Visualization */}
              <div className="absolute inset-0 flex justify-between items-center px-12 pointer-events-none opacity-10">
                  <div className="h-full w-px bg-slate-300"></div>
                  <div className="h-full w-px bg-slate-300"></div>
                  <div className="h-full w-px bg-slate-300"></div>
              </div>
              
              <div className="flex w-full max-w-4xl gap-4 items-end h-32">
                  <div className="flex-1 flex flex-col items-center gap-2 group">
                      <motion.div initial={{ height: 0 }} animate={{ height: '100%' }} className="w-full bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 group-hover:bg-indigo-50 transition-colors">
                          <span className="text-2xl font-black text-slate-400 group-hover:text-indigo-600">{stats.totalClients}</span>
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Clientes</span>
                  </div>
                  <div className="w-8 flex items-center justify-center text-slate-300">
                      <ArrowUpRight className="rotate-45" />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2 group">
                      <motion.div initial={{ height: 0 }} animate={{ height: '75%' }} className="w-full bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 group-hover:bg-orange-50 transition-colors">
                          <span className="text-2xl font-black text-slate-400 group-hover:text-orange-600">{stats.totalQuotes}</span>
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cotizaciones</span>
                  </div>
                  <div className="w-8 flex items-center justify-center text-slate-300">
                      <ArrowUpRight className="rotate-45" />
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-2 group">
                      <motion.div initial={{ height: 0 }} animate={{ height: '40%' }} className="w-full bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200 group-hover:bg-emerald-50 transition-colors">
                          <span className="text-2xl font-black text-slate-400 group-hover:text-emerald-600">{stats.signedContracts}</span>
                      </motion.div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cierres</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Conversion Rate" 
          value={`${((stats.signedContracts / (stats.totalQuotes || 1)) * 100).toFixed(1)}%`} 
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
                    <h3 className="text-xl font-bold text-slate-800">Visualización de Pipeline Comercial</h3>
                    <p className="text-sm text-slate-500">Proyección de ingresos y estados de cotización</p>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl flex gap-2">
                    <button className="px-4 py-2 bg-white shadow-sm rounded-lg text-xs font-bold text-slate-700">Mensual</button>
                    <button className="px-4 py-2 hover:bg-white/50 rounded-lg text-xs font-bold text-slate-400 transition-all">Anual</button>
                </div>
              </div>

              {/* Progress visualizer */}
              <div className="space-y-8">
                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-600">Presupuestos en Proceso</span>
                          <span className="font-mono text-indigo-600 font-bold">${stats.pendingVolume.toLocaleString('es-CL')}</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '65%' }}
                            className="h-full bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"
                          />
                      </div>
                  </div>

                  <div>
                      <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-600">Contratos por Firmar</span>
                          <span className="font-mono text-emerald-600 font-bold">12 unidades</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: '42%' }}
                            className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      {[
                        { label: 'Visitas', val: '24', icon: Users, color: 'text-blue-500' },
                        { label: 'Cotizado', val: '18', icon: Calculator, color: 'text-indigo-500' },
                        { label: 'Cierre', val: '4', icon: Target, color: 'text-emerald-500' },
                        { label: 'Proyección', val: '$240M', icon: TrendingUp, color: 'text-amber-500' },
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
            <div className="bg-slate-900 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[80px] opacity-20"></div>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-400" />
                    Actividad Reciente
                </h3>
                <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                    {recentContracts.length > 0 ? recentContracts.map((c, i) => (
                        <div key={c.id} className="relative pl-8">
                            <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-500 z-10"></div>
                            <p className="text-sm font-bold truncate">Contrato {c.id.slice(0,8)}</p>
                            <p className="text-xs text-slate-400 mb-1">{c.fecha_contrato}</p>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 uppercase font-bold">Firmado</span>
                        </div>
                    )) : (
                        <p className="text-slate-500 text-sm italic pl-8">No hay contratos recientes</p>
                    )}
                </div>
                <button className="w-full mt-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold tracking-wider uppercase border border-white/10 transition-all">
                    Ver Historial Completo
                </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Ratio de Gestión</p>
                        <p className="text-xs text-slate-500">Eficiencia vs Meta Mensual</p>
                    </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-2xl font-black text-slate-800">76%</span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">+4.2%</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
