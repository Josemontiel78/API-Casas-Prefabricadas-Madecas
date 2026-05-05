import React, { useEffect, useState } from 'react';
import { getClients, getProjects, getBudgets, getContracts } from '../services/db';
import { Contract, Client } from '../types';
import { Users, FolderOpen, Calculator, FileSignature, ArrowUpRight, Clock, DollarSign } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [recentContracts, setRecentContracts] = useState<(Contract & { clientName?: string })[]>([]);
  const clients = getClients();
  const projects = getProjects();
  const budgets = getBudgets();
  const contracts = getContracts();

  useEffect(() => {
    // Process recent activity
    const sorted = [...contracts]
      .sort((a, b) => new Date(b.fecha_contrato).getTime() - new Date(a.fecha_contrato).getTime())
      .slice(0, 5)
      .map(c => ({
        ...c,
        clientName: clients.find(cli => cli.id === c.cliente_id)?.nombre || 'Cliente Desconocido'
      }));
    setRecentContracts(sorted);
  }, []);

  const stats = [
    { label: 'Clientes Totales', value: clients.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Modelos Disponibles', value: projects.length, icon: FolderOpen, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
    { label: 'Presupuestos Emitidos', value: budgets.length, icon: Calculator, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' },
    { label: 'Contratos Cerrados', value: contracts.length, icon: FileSignature, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl"></div>
        <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-3 tracking-tight">Bienvenido al Panel de Control</h2>
            <p className="text-slate-300 max-w-2xl text-lg font-light leading-relaxed">
            Gestione sus proyectos de casas prefabricadas, analice presupuestos con IA y genere contratos legales en segundos.
            </p>
            <div className="mt-8 flex gap-4">
                <div className="flex items-center px-3 py-1 bg-white/10 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span> 
                    IA Gemini Activa
                </div>
                <div className="flex items-center px-3 py-1 bg-white/10 rounded-full text-xs font-medium backdrop-blur-sm border border-white/10">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span> 
                    v1.2.0 Stable
                </div>
            </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-white p-6 rounded-2xl shadow-sm border ${stat.border} flex items-center justify-between hover:shadow-md transition-shadow group`}>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-slate-800">{stat.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
              <stat.icon size={26} />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-bold text-slate-800 text-lg">Actividad Reciente</h3>
                  <button className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                      Ver todos <ArrowUpRight size={14} />
                  </button>
              </div>
              <div className="divide-y divide-slate-100">
                  {recentContracts.length === 0 ? (
                      <div className="p-10 text-center text-slate-400">
                          <Clock size={40} className="mx-auto mb-3 opacity-20" />
                          <p>No hay actividad reciente registrada.</p>
                      </div>
                  ) : (
                      recentContracts.map(contract => (
                          <div key={contract.id} className="p-5 hover:bg-slate-50 transition flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                                      contract.estado === 'Firmado' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                                  }`}>
                                      <FileSignature size={18} />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">Contrato #{contract.id.slice(0,6)}</h4>
                                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                          <Users size={10} /> {contract.clientName}
                                      </p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      contract.estado === 'Firmado' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                      {contract.estado}
                                  </span>
                                  <p className="text-xs text-slate-400 mt-1">{contract.fecha_contrato}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center items-center text-center">
             <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <DollarSign size={32} />
             </div>
             <h3 className="font-bold text-slate-800 text-lg mb-2">Ingresos Estimados</h3>
             <p className="text-sm text-slate-500 mb-6">Basado en contratos generados este mes.</p>
             <div className="text-4xl font-bold text-slate-800 mb-2">
                 ${contracts.reduce((sum, c) => sum + (c.monto_total || 0), 0).toLocaleString()}
             </div>
             <p className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                 +12% vs mes anterior
             </p>
          </div>
      </div>
    </div>
  );
};

export default Dashboard;