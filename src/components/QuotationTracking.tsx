import React, { useState, useEffect, useMemo } from 'react';
import { Budget, Client, Contract, HouseModel, SystemUser } from '@/types';
import {
  saveBudget,
  saveClient,
  subscribeToBudgets,
  subscribeToClients,
  subscribeToContracts,
  subscribeToHouseModels,
  subscribeToUsers,
  logAuditEvent
} from '@/services/db';
import {
  daysElapsedSince,
  getSuggestedLeadScore,
  getStagnationThresholdDays,
  setStagnationThresholdDaysPref
} from '@/services/contractAlerts';
import {
  Calculator,
  Search,
  MessageCircle,
  Mail,
  ArrowRight,
  Trash2,
  RotateCcw,
  ShieldCheck,
  X,
  Clock,
  Flame,
  Snowflake,
  TrendingUp,
  FileSignature,
  SlidersHorizontal,
  StickyNote,
  BarChart2,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOTIVOS_PERDIDA = [
  'Precio alto / Fuera de presupuesto',
  'Eligió a otra empresa / competencia',
  'Proyecto cancelado o postergado',
  'Falta de financiamiento o rechazo bancario',
  'Plazo de entrega o instalación extenso',
  'Terreno sin factibilidad o fuera de cobertura',
  'Falta de contacto / No responde llamadas',
  'Otro motivo particular'
];

interface DiscardModalState {
  isOpen: boolean;
  budget: Budget | null;
  client: Client | null;
  motivo: string;
  detalle: string;
  authorizerId: string;
  authorizerName: string;
  authorizerRole: 'vendedor' | 'admin';
  explicitlyAuthorized: boolean;
  error?: string;
}

export const QuotationTracking: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [houseModels, setHouseModels] = useState<HouseModel[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);

  // Filters & State
  const [searchTerm, setSearchTerm] = useState('');
  const [scoreFilter, setScoreFilter] = useState<'todos' | 'Alta' | 'Media' | 'Baja'>('todos');
  const [statusFilter, setStatusFilter] = useState<'pendientes' | 'estancadas' | 'descartadas' | 'todas'>('pendientes');
  const [selectedSeller, setSelectedSeller] = useState<string>('todos');
  const [stagnationThresholdDays, setStagnationThresholdDays] = useState<number>(getStagnationThresholdDays);
  const [showLossAnalytics, setShowLossAnalytics] = useState<boolean>(false);

  // Discard Modal State
  const [discardModal, setDiscardModal] = useState<DiscardModalState>({
    isOpen: false,
    budget: null,
    client: null,
    motivo: MOTIVOS_PERDIDA[0],
    detalle: '',
    authorizerId: '',
    authorizerName: '',
    authorizerRole: 'admin',
    explicitlyAuthorized: false
  });

  // Interaction Note Modal State
  const [viewingNotesBudget, setViewingNotesBudget] = useState<Budget | null>(null);
  const [quickNoteText, setQuickNoteText] = useState('');

  useEffect(() => {
    const unsubB = subscribeToBudgets(setBudgets);
    const unsubC = subscribeToClients(setClients);
    const unsubCo = subscribeToContracts(setContracts);
    const unsubH = subscribeToHouseModels(setHouseModels);
    const unsubU = subscribeToUsers(setUsers);

    const handleSync = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') setStagnationThresholdDays(val);
    };
    window.addEventListener('crm-stagnation-threshold-changed', handleSync);

    return () => {
      unsubB();
      unsubC();
      unsubCo();
      unsubH();
      unsubU();
      window.removeEventListener('crm-stagnation-threshold-changed', handleSync);
    };
  }, []);

  const handleChangeStagnationDays = (days: number) => {
    setStagnationThresholdDays(days);
    setStagnationThresholdDaysPref(days);
  };

  // Set of budget IDs that already have a generated/signed contract
  const contractedBudgetIds = useMemo(() => {
    return new Set(contracts.map(c => c.presupuesto_id));
  }, [contracts]);

  // Compute enriched quotations
  const enrichedQuotations = useMemo(() => {
    return budgets
      .map(b => {
        const client = clients.find(c => c.id === b.cliente_id);
        const model = houseModels.find(m => m.id === b.proyecto_id);
        const hasContract = contractedBudgetIds.has(b.id);
        const refDate = b.ultima_interaccion || b.fecha;
        const daysSince = daysElapsedSince(refDate);
        const isStagnant = daysSince >= stagnationThresholdDays && !hasContract && !b.descartado;
        const currentScore = b.lead_score || getSuggestedLeadScore(b, daysSince, client);
        const seller = users.find(u => u.id === (b.vendedor_id || client?.vendedor_id));

        return {
          budget: b,
          client,
          sellerName: seller?.nombre || client?.vendedor_nombre || 'Sin asignar',
          modelName: model?.nombre || (b.es_combinacion_modelos ? 'Combinación Modular' : 'Modelo Madecas'),
          hasContract,
          daysSince,
          refDate,
          isStagnant,
          score: currentScore,
          isDiscarded: !!b.descartado
        };
      })
      .sort((a, b) => {
        const scoreVal = (s: string) => (s === 'Alta' ? 3 : s === 'Media' ? 2 : 1);
        if (scoreVal(b.score) !== scoreVal(a.score)) return scoreVal(b.score) - scoreVal(a.score);
        return b.budget.monto_total - a.budget.monto_total;
      });
  }, [budgets, clients, houseModels, users, contractedBudgetIds, stagnationThresholdDays]);

  // Apply filters
  const filteredList = useMemo(() => {
    const lower = searchTerm.toLowerCase();

    return enrichedQuotations.filter(item => {
      if (statusFilter === 'pendientes') {
        if (item.hasContract || item.isDiscarded) return false;
      } else if (statusFilter === 'estancadas') {
        if (!item.isStagnant || item.hasContract || item.isDiscarded) return false;
      } else if (statusFilter === 'descartadas') {
        if (!item.isDiscarded) return false;
      } else if (statusFilter === 'todas') {
        if (item.hasContract) return false;
      }

      if (scoreFilter !== 'todos' && item.score !== scoreFilter) {
        return false;
      }

      if (selectedSeller !== 'todos') {
        const itemSellerId = item.budget.vendedor_id || item.client?.vendedor_id;
        if (itemSellerId !== selectedSeller) return false;
      }

      if (lower) {
        const cName = item.client?.nombre.toLowerCase() || '';
        const cRut = item.client?.rut.toLowerCase() || '';
        const mName = item.modelName.toLowerCase();
        const folio = item.budget.id.toLowerCase();
        return cName.includes(lower) || cRut.includes(lower) || mName.includes(lower) || folio.includes(lower);
      }

      return true;
    });
  }, [enrichedQuotations, searchTerm, scoreFilter, statusFilter, selectedSeller]);

  // Metrics & Loss Reason Intelligence
  const metrics = useMemo(() => {
    const active = enrichedQuotations.filter(q => !q.hasContract && !q.isDiscarded);
    const stagnant = active.filter(q => q.isStagnant);
    const highProb = active.filter(q => q.score === 'Alta');
    const discarded = enrichedQuotations.filter(q => q.isDiscarded);
    const totalVolumeActive = active.reduce((s, q) => s + q.budget.monto_total, 0);
    const totalVolumeDiscarded = discarded.reduce((s, q) => s + q.budget.monto_total, 0);

    const lossMap: Record<string, { motivo: string; count: number; totalAmount: number }> = {};
    discarded.forEach(d => {
      const m = d.budget.motivo_descarte || 'Sin motivo registrado';
      if (!lossMap[m]) lossMap[m] = { motivo: m, count: 0, totalAmount: 0 };
      lossMap[m].count += 1;
      lossMap[m].totalAmount += d.budget.monto_total;
    });

    const lossBreakdown = Object.values(lossMap).sort((a, b) => b.count - a.count);

    return {
      activeCount: active.length,
      stagnantCount: stagnant.length,
      highProbCount: highProb.length,
      discardedCount: discarded.length,
      totalVolumeActive,
      totalVolumeDiscarded,
      lossBreakdown
    };
  }, [enrichedQuotations]);

  // Actions
  const handleUpdateLeadScore = async (budget: Budget, newScore: 'Alta' | 'Media' | 'Baja') => {
    try {
      await saveBudget({
        ...budget,
        lead_score: newScore
      });
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `Calificación actualizada a ${newScore} probabilidad`, type: 'success' }
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Error al actualizar probabilidad', type: 'error' }
      }));
    }
  };

  const handleOpenDiscardModal = (budget: Budget) => {
    const client = clients.find(c => c.id === budget.cliente_id) || null;
    const defaultAuth = users.find(u => u.rol === 'admin' && u.activo !== false) || users[0];
    setDiscardModal({
      isOpen: true,
      budget,
      client,
      motivo: MOTIVOS_PERDIDA[0],
      detalle: '',
      authorizerId: defaultAuth?.id || 'admin',
      authorizerName: defaultAuth?.nombre || '',
      authorizerRole: defaultAuth?.rol === 'vendedor' ? 'vendedor' : 'admin',
      explicitlyAuthorized: false,
      error: undefined
    });
  };

  const handleConfirmDiscard = async () => {
    if (!discardModal.budget) return;
    if (!discardModal.motivo) {
      setDiscardModal(prev => ({ ...prev, error: 'Debes seleccionar un motivo de pérdida obligatorio.' }));
      return;
    }
    if (!discardModal.authorizerName.trim()) {
      setDiscardModal(prev => ({ ...prev, error: 'Debes indicar el nombre del vendedor o administrador que autoriza.' }));
      return;
    }
    if (!discardModal.explicitlyAuthorized) {
      setDiscardModal(prev => ({
        ...prev,
        error: 'Se requiere confirmar la autorización explícita del vendedor o administrador antes de descartar.'
      }));
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const updatedBudget: Budget = {
        ...discardModal.budget,
        descartado: true,
        fecha_descarte: nowIso,
        motivo_descarte: discardModal.motivo,
        detalle_descarte: discardModal.detalle.trim(),
        descartado_por: {
          id: discardModal.authorizerId || 'auth-user',
          nombre: discardModal.authorizerName.trim(),
          rol: discardModal.authorizerRole
        }
      };

      await saveBudget(updatedBudget);

      if (discardModal.client) {
        await saveClient({
          ...discardModal.client,
          descartado: true,
          motivo_descarte: discardModal.motivo,
          fecha_descarte: nowIso,
          descartado_por: {
            id: discardModal.authorizerId || 'auth-user',
            nombre: discardModal.authorizerName.trim(),
            rol: discardModal.authorizerRole
          }
        });
      }

      logAuditEvent({
        usuario_id: discardModal.authorizerId || 'admin',
        usuario_nombre: discardModal.authorizerName.trim(),
        accion: 'PRESUPUESTO_DESCARTADO',
        entidad: 'budgets',
        entidad_id: discardModal.budget.id,
        detalles: {
          cliente: discardModal.client?.nombre || discardModal.budget.cliente_id,
          motivo_perdida: discardModal.motivo,
          detalle: discardModal.detalle.trim(),
          monto_perdido: discardModal.budget.monto_total,
          autorizado_por_rol: discardModal.authorizerRole
        }
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Cotización descartada con motivo registrado y autorización verificada.', type: 'info' }
      }));

      setDiscardModal({
        isOpen: false,
        budget: null,
        client: null,
        motivo: MOTIVOS_PERDIDA[0],
        detalle: '',
        authorizerId: '',
        authorizerName: '',
        authorizerRole: 'admin',
        explicitlyAuthorized: false
      });
    } catch {
      setDiscardModal(prev => ({ ...prev, error: 'Error al descartar la cotización.' }));
    }
  };

  const handleReactivateBudget = async (budget: Budget) => {
    try {
      const todayIso = new Date().toISOString().split('T')[0];
      const updatedBudget: Budget = {
        ...budget,
        descartado: false,
        fecha_descarte: undefined,
        motivo_descarte: undefined,
        detalle_descarte: undefined,
        ultima_interaccion: todayIso
      };
      await saveBudget(updatedBudget);

      const client = clients.find(c => c.id === budget.cliente_id);
      if (client) {
        await saveClient({
          ...client,
          descartado: false,
          etapa_venta: 'Cotización',
          ultima_interaccion: todayIso
        });
      }

      logAuditEvent({
        accion: 'PRESUPUESTO_REACTIVADO',
        entidad: 'budgets',
        entidad_id: budget.id,
        detalles: { cliente: client?.nombre || budget.cliente_id, monto: budget.monto_total }
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Cotización reactivada exitosamente para seguimiento.', type: 'success' }
      }));
    } catch {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Error al reactivar cotización.', type: 'error' }
      }));
    }
  };

  const touchInteractionTimestamp = async (item: any, canal: string) => {
    const todayIso = new Date().toISOString().split('T')[0];
    try {
      await saveBudget({
        ...item.budget,
        ultima_interaccion: todayIso
      });
      if (item.client) {
        await saveClient({
          ...item.client,
          ultima_interaccion: todayIso
        });
      }
      logAuditEvent({
        accion: 'SEGUIMIENTO_REGISTRADO',
        entidad: 'budgets',
        entidad_id: item.budget.id,
        detalles: { canal, cliente: item.client?.nombre || 'Cliente', fecha: todayIso }
      }).catch(() => {});
    } catch {
      // non-blocking
    }
  };

  const handleSendWhatsApp = (item: any) => {
    const phone = item.client?.telefono?.replace(/[^0-9]/g, '');
    if (!phone) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: `El cliente ${item.client?.nombre || 'sin nombre'} no tiene teléfono registrado.`, type: 'info' }
      }));
      return;
    }
    const cleanPhone = phone.startsWith('56') ? phone : `56${phone}`;
    const clientName = item.client?.nombre || 'Estimado/a cliente';
    const model = item.modelName;
    const surface = item.budget.superficie_m2 || 36;
    const amount = `$${item.budget.monto_total.toLocaleString('es-CL')} CLP`;

    const message = `Hola ${clientName}, ¿cómo estás? Te escribo de MADECAS Prefabricados respecto a la cotización de tu casa modelo ${model} (${surface} m²) por un total de ${amount}. ¿Pudiste revisarla o te gustaría que ajustemos especificaciones, adicionales o cuotas de pago? Quedo atento a tus dudas o comentarios.`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
    touchInteractionTimestamp(item, 'WhatsApp Web');
  };

  const handleSendEmail = (item: any) => {
    if (!item.client?.correo) {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'El cliente no tiene correo registrado.', type: 'info' }
      }));
      return;
    }
    const subject = `MADECAS Prefabricados - Seguimiento a tu cotización ${item.modelName}`;
    const body = `Hola ${item.client.nombre},\n\nEspero que te encuentres muy bien. Te contacto en relación a la cotización de tu casa modelo ${item.modelName} (${item.budget.superficie_m2 || 36} m²) por un valor de $${item.budget.monto_total.toLocaleString('es-CL')} CLP.\n\nNos encantaría saber si pudiste revisar las especificaciones técnicas o si tienes alguna consulta respecto a materiales, plazos de instalación o formas de pago.\n\nAtentamente,\nEquipo Comercial MADECAS Prefabricados\nOsorno, Región de Los Lagos`;
    window.location.href = `mailto:${item.client.correo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    touchInteractionTimestamp(item, 'Correo Electrónico');
  };

  const handleSaveInteractionNote = async () => {
    if (!viewingNotesBudget || !quickNoteText.trim()) return;
    const todayIso = new Date().toISOString().split('T')[0];
    const stamp = new Date().toLocaleDateString('es-CL');
    const prevNotes = viewingNotesBudget.observaciones_negociacion || viewingNotesBudget.notas_personalizacion || '';
    const updatedNotes = prevNotes
      ? `[${stamp}] ${quickNoteText.trim()}\n${prevNotes}`
      : `[${stamp}] ${quickNoteText.trim()}`;

    try {
      await saveBudget({
        ...viewingNotesBudget,
        ultima_interaccion: todayIso,
        observaciones_negociacion: updatedNotes
      });

      const client = clients.find(c => c.id === viewingNotesBudget.cliente_id);
      if (client) {
        await saveClient({
          ...client,
          ultima_interaccion: todayIso
        });
      }

      logAuditEvent({
        accion: 'SEGUIMIENTO_REGISTRADO',
        entidad: 'budgets',
        entidad_id: viewingNotesBudget.id,
        detalles: { canal: 'Bitácora Manual', nota: quickNoteText.trim(), fecha: todayIso }
      }).catch(() => {});

      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Interacción registrada y reloj de estancamiento reiniciado.', type: 'success' }
      }));
      setQuickNoteText('');
      setViewingNotesBudget(null);
    } catch {
      window.dispatchEvent(new CustomEvent('app-notification', {
        detail: { message: 'Error al guardar nota de seguimiento.', type: 'error' }
      }));
    }
  };

  const handleProceedToContract = (budget: Budget) => {
    window.localStorage.setItem('pending_contract_budget_id', budget.id);
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 md:p-8 rounded-3xl text-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
              CRM Comercial & Pipeline
            </span>
            <span className="bg-white/10 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              Foco en Cierre de Ventas
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="text-emerald-400" />
            Gestión de Cotizaciones y Seguimiento
          </h2>
          <p className="text-slate-300 text-xs md:text-sm font-medium mt-1 max-w-2xl leading-relaxed">
            Filtra prospectos con cotización emitida sin contrato cerrado, califica su probabilidad de cierre,
            detecta estancamientos y gestiona descartes autorizados con motivo obligatorio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowLossAnalytics(v => !v)}
            className={cn(
              'px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 border',
              showLossAnalytics
                ? 'bg-rose-600 text-white border-rose-500'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/15'
            )}
          >
            <BarChart2 size={15} />
            <span>Análisis de Pérdidas ({metrics.discardedCount})</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }))}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2"
          >
            <Calculator size={15} />
            <span>Nueva Cotización</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter('pendientes')}
          className={cn(
            'p-5 rounded-2xl border transition-all cursor-pointer',
            statusFilter === 'pendientes'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">En Negociación</span>
            <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Clock size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-800 tabular-nums">{metrics.activeCount}</p>
          <p className="text-[11px] text-emerald-700 font-bold mt-1 tabular-nums">
            ${metrics.totalVolumeActive.toLocaleString('es-CL')} CLP
          </p>
        </div>

        <div
          onClick={() => setStatusFilter('estancadas')}
          className={cn(
            'p-5 rounded-2xl border transition-all cursor-pointer',
            statusFilter === 'estancadas'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tabular-nums">
              Estancadas (+{stagnationThresholdDays}d)
            </span>
            <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Snowflake size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-700 tabular-nums">{metrics.stagnantCount}</p>
          <p className="text-[11px] text-amber-600 font-bold mt-1">
            Requieren contacto urgente
          </p>
        </div>

        <div
          onClick={() => {
            setScoreFilter(scoreFilter === 'Alta' ? 'todos' : 'Alta');
            setStatusFilter('pendientes');
          }}
          className={cn(
            'p-5 rounded-2xl border transition-all cursor-pointer',
            scoreFilter === 'Alta'
              ? 'bg-green-50 border-green-300 ring-2 ring-green-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Alta Probabilidad</span>
            <span className="w-8 h-8 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-bold">
              <Flame size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-green-700 tabular-nums">{metrics.highProbCount}</p>
          <p className="text-[11px] text-green-600 font-bold mt-1">
            Prospectos prioritarios
          </p>
        </div>

        <div
          onClick={() => setStatusFilter('descartadas')}
          className={cn(
            'p-5 rounded-2xl border transition-all cursor-pointer',
            statusFilter === 'descartadas'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Ventas Descartadas</span>
            <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <Trash2 size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-rose-700 tabular-nums">{metrics.discardedCount}</p>
          <p className="text-[11px] text-rose-600 font-bold mt-1 tabular-nums">
            ${metrics.totalVolumeDiscarded.toLocaleString('es-CL')} CLP perdidos
          </p>
        </div>
      </div>

      {/* Loss Reasons Intelligence Panel */}
      {(showLossAnalytics || statusFilter === 'descartadas') && (
        <div className="bg-white p-6 rounded-2xl border border-rose-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <BarChart2 size={16} className="text-rose-600" />
                Inteligencia Comercial: Motivos de Pérdida de Ventas
              </h3>
              <p className="text-xs text-slate-500">
                Datos recopilados de descartes autorizados para optimizar precios, plazos y argumentación comercial.
              </p>
            </div>
            <span className="text-xs font-black text-rose-700 bg-rose-50 px-3 py-1 rounded-full tabular-nums">
              {metrics.discardedCount} descartes (${metrics.totalVolumeDiscarded.toLocaleString('es-CL')} CLP)
            </span>
          </div>

          {metrics.lossBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Aún no hay cotizaciones descartadas registradas. Cuando un vendedor o administrador descarte una venta con motivo obligatorio, los indicadores aparecerán aquí.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metrics.lossBreakdown.map(item => {
                const pct = metrics.discardedCount > 0 ? Math.round((item.count / metrics.discardedCount) * 100) : 0;
                return (
                  <div key={item.motivo} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 truncate pr-2">{item.motivo}</span>
                      <span className="font-black text-rose-700 shrink-0 tabular-nums">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      Volumen perdido: <strong>${item.totalAmount.toLocaleString('es-CL')} CLP</strong>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Filters, Seller & Stagnation Days */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, RUT, modelo o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
          </div>

          {/* Seller & Stagnation Days */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <UserCheck size={14} className="text-emerald-600 shrink-0" />
              <select
                value={selectedSeller}
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                title="Filtrar por ejecutivo responsable"
              >
                <option value="todos">Todos los Vendedores</option>
                {users.filter(u => !u.eliminado).map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.rol})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-xl">
              <SlidersHorizontal size={14} className="text-amber-600 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900 whitespace-nowrap">Estancada ≥</span>
              <select
                value={stagnationThresholdDays}
                onChange={(e) => handleChangeStagnationDays(Number(e.target.value))}
                className="bg-transparent text-xs font-black text-amber-900 outline-none cursor-pointer tabular-nums"
              >
                <option value={3}>3 días</option>
                <option value={5}>5 días</option>
                <option value={7}>7 días</option>
                <option value={10}>10 días</option>
                <option value={15}>15 días</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Tabs + Score Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1">
            <button
              type="button"
              onClick={() => setStatusFilter('pendientes')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                statusFilter === 'pendientes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              En Seguimiento ({metrics.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('estancadas')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition flex items-center gap-1',
                statusFilter === 'estancadas' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Snowflake size={12} />
              Estancadas ({metrics.stagnantCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('descartadas')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                statusFilter === 'descartadas' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Descartadas ({metrics.discardedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('todas')}
              className={cn(
                'px-3 py-1.5 rounded-lg transition',
                statusFilter === 'todas' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Todas sin contrato
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl text-xs">
            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Semáforo:</span>
            {(['todos', 'Alta', 'Media', 'Baja'] as const).map(sc => (
              <button
                key={sc}
                type="button"
                onClick={() => setScoreFilter(sc)}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[11px] font-black transition',
                  scoreFilter === sc
                    ? sc === 'Alta'
                      ? 'bg-emerald-600 text-white'
                      : sc === 'Media'
                      ? 'bg-amber-500 text-white'
                      : sc === 'Baja'
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                )}
              >
                {sc === 'todos' ? 'Todos' : sc}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Quotations List */}
      <div className="space-y-3.5">
        {filteredList.length === 0 ? (
          <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <Calculator size={32} />
            </div>
            <h4 className="text-slate-800 font-bold text-base">No hay cotizaciones para el filtro seleccionado</h4>
            <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
              Intenta cambiar el criterio de búsqueda o revisa los filtros de estancadas, descartadas, vendedor o semáforo.
            </p>
          </div>
        ) : (
          filteredList.map(item => {
            const b = item.budget;
            const c = item.client;
            const isDiscarded = item.isDiscarded;

            return (
              <div
                key={b.id}
                className={cn(
                  'bg-white p-5 rounded-2xl border transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 hover:border-slate-300',
                  item.isStagnant && !isDiscarded ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                )}
              >
                {/* Left: Lead Score & Client Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {/* Lead Score Traffic Light */}
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <button
                      type="button"
                      className={cn(
                        'w-9 h-9 rounded-2xl flex items-center justify-center text-white font-black text-xs transition-transform hover:scale-105 cursor-pointer',
                        item.score === 'Alta'
                          ? 'bg-emerald-600'
                          : item.score === 'Media'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      )}
                      title={`Probabilidad: ${item.score}. Clic para rotar calificación.`}
                      onClick={() => {
                        const nextScore = item.score === 'Alta' ? 'Media' : item.score === 'Media' ? 'Baja' : 'Alta';
                        handleUpdateLeadScore(b, nextScore);
                      }}
                    >
                      {item.score === 'Alta' ? 'A' : item.score === 'Media' ? 'M' : 'B'}
                    </button>
                    <span className="text-[9px] font-black uppercase text-slate-500">
                      {item.score}
                    </span>
                  </div>

                  {/* Client & Project Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 tabular-nums">
                        Folio: {b.id.slice(0, 8).toUpperCase()}
                      </span>

                      {item.isStagnant && !isDiscarded && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 tabular-nums">
                          <Snowflake size={11} />
                          Estancada ({item.daysSince}d sin avance)
                        </span>
                      )}

                      {!item.isStagnant && item.daysSince <= 2 && !isDiscarded && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-green-100 text-green-800 border border-green-200 flex items-center gap-1 tabular-nums">
                          <Flame size={11} />
                          Activa ({item.daysSince === 0 ? 'Hoy' : `${item.daysSince}d`})
                        </span>
                      )}

                      {isDiscarded && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                          Descartada: {b.motivo_descarte || 'No especificado'}
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-black text-slate-800 leading-tight">
                      {c?.nombre || 'Comprador sin asignar'}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      RUT: {c?.rut || 'N/A'} • Tel: {c?.telefono || 'Sin fono'} {c?.comuna ? `• ${c.comuna}` : ''} • Ejecutivo: <strong className="text-slate-700">{item.sellerName}</strong>
                    </p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 tabular-nums">
                      <span>Modelo: <strong className="text-slate-800">{item.modelName}</strong></span>
                      <span>Superficie: <strong>{b.superficie_m2 || 36} m²</strong></span>
                      <span>Emitida: <strong>{b.fecha}</strong></span>
                      {b.ultima_interaccion && (
                        <span className="text-sky-700 font-bold">Últ. contacto: {b.ultima_interaccion}</span>
                      )}
                    </div>

                    {(b.observaciones_negociacion || b.notas_personalizacion) && !isDiscarded && (
                      <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 p-2 rounded-lg mt-2 line-clamp-2">
                        <strong>Bitácora:</strong> {b.observaciones_negociacion || b.notas_personalizacion}
                      </p>
                    )}

                    {isDiscarded && (
                      <div className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl mt-2 border border-rose-200 space-y-0.5">
                        {b.detalle_descarte && (
                          <p><strong>Detalle de pérdida:</strong> {b.detalle_descarte}</p>
                        )}
                        {b.descartado_por && (
                          <p className="text-[11px] text-rose-600 font-semibold">
                            Autorizado por: {b.descartado_por.nombre} ({b.descartado_por.rol}) el {b.fecha_descarte?.split('T')[0]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Center: Total Amount & Metrics */}
                <div className="text-left lg:text-right border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 w-full lg:w-auto shrink-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Cotizado</span>
                  <p className="text-xl font-black text-slate-900 tabular-nums">
                    ${b.monto_total.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-500">CLP</span>
                  </p>
                  <span className="text-[11px] text-slate-500 font-medium tabular-nums">
                    {b.detalle_items.length} partidas presupuestadas
                  </span>
                </div>

                {/* Right: Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSendWhatsApp(item)}
                    className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    title="Enviar WhatsApp de seguimiento predefinido"
                  >
                    <MessageCircle size={15} />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendEmail(item)}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    title="Enviar correo de seguimiento"
                  >
                    <Mail size={15} />
                    <span className="hidden sm:inline">Correo</span>
                  </button>

                  {!isDiscarded ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setViewingNotesBudget(b);
                          setQuickNoteText('');
                        }}
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Registrar llamada, visita o nota de seguimiento"
                      >
                        <StickyNote size={15} />
                        <span className="hidden xl:inline">Bitácora</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleProceedToContract(b)}
                        className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                        title="Generar contrato oficial a partir de esta cotización"
                      >
                        <FileSignature size={15} />
                        <span>Contratar</span>
                        <ArrowRight size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDiscardModal(b)}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="Descartar cotización (requiere autorización y motivo obligatorio)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReactivateBudget(b)}
                      className="px-3.5 py-2.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-black transition flex items-center gap-1.5"
                      title="Reactivar cotización para continuar el seguimiento"
                    >
                      <RotateCcw size={14} />
                      <span>Reactivar Prospecto</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Interaction / Note Modal */}
      {viewingNotesBudget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          onClick={() => setViewingNotesBudget(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <StickyNote size={20} className="text-emerald-400" />
                <div>
                  <h3 className="text-sm font-black">Bitácora de Seguimiento</h3>
                  <p className="text-[11px] text-slate-400">
                    {clients.find(c => c.id === viewingNotesBudget.cliente_id)?.nombre || 'Cliente'} • Folio {viewingNotesBudget.id.slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
              <button onClick={() => setViewingNotesBudget(null)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {(viewingNotesBudget.observaciones_negociacion || viewingNotesBudget.notas_personalizacion) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto text-xs text-slate-700 whitespace-pre-line">
                  {viewingNotesBudget.observaciones_negociacion || viewingNotesBudget.notas_personalizacion}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Registrar nueva gestión / contacto *
                </label>
                <textarea
                  rows={3}
                  value={quickNoteText}
                  onChange={(e) => setQuickNoteText(e.target.value)}
                  placeholder="Ej: Llamada telefónica confirmando visita a showroom el viernes a las 16:00 hrs..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                  <CheckCircle2 size={12} className="text-emerald-600" />
                  Al guardar, se actualizará la fecha de última interacción y se reiniciará el indicador de estancamiento.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setViewingNotesBudget(null)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={!quickNoteText.trim()}
                onClick={handleSaveInteractionNote}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black"
              >
                Guardar Gestión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Modal with Explicit Authorization & Mandatory Loss Reason */}
      {discardModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={() => setDiscardModal(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 bg-gradient-to-r from-rose-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight text-white">Descartar Cotización Comercial</h3>
                  <p className="text-xs text-rose-200">Requiere autorización explícita y motivo de pérdida</p>
                </div>
              </div>

              <button
                onClick={() => setDiscardModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <p className="font-bold text-slate-800">
                  Cliente: {discardModal.client?.nombre || 'Cliente'} (RUT: {discardModal.client?.rut || 'N/A'})
                </p>
                <p className="text-slate-500 mt-0.5 tabular-nums">
                  Monto Cotizado: ${discardModal.budget?.monto_total.toLocaleString('es-CL')} CLP
                </p>
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Motivo de Pérdida Obligatorio *
                </label>
                <select
                  value={discardModal.motivo}
                  onChange={(e) => setDiscardModal(prev => ({ ...prev, motivo: e.target.value }))}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {MOTIVOS_PERDIDA.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Detail */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1.5">
                  Observaciones / Comentario Comercial
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalla qué comentó el cliente o los factores de pérdida para ajustar estrategias futuras..."
                  value={discardModal.detalle}
                  onChange={(e) => setDiscardModal(prev => ({ ...prev, detalle: e.target.value }))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
              </div>

              {/* Explicit Authorization */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Autorizado Por (Vendedor / Admin) *
                    </label>
                    <select
                      value={discardModal.authorizerId}
                      onChange={(e) => {
                        const chosen = users.find(u => u.id === e.target.value);
                        setDiscardModal(prev => ({
                          ...prev,
                          authorizerId: e.target.value,
                          authorizerName: chosen ? chosen.nombre : prev.authorizerName,
                          authorizerRole: chosen?.rol === 'vendedor' ? 'vendedor' : 'admin'
                        }));
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      {users.filter(u => !u.eliminado).map(u => (
                        <option key={u.id} value={u.id}>
                          {u.nombre} ({u.rol})
                        </option>
                      ))}
                      <option value="custom">Otro autorizador manual...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                      Rol Autorizante
                    </label>
                    <select
                      value={discardModal.authorizerRole}
                      onChange={(e) => setDiscardModal(prev => ({ ...prev, authorizerRole: e.target.value as 'admin' | 'vendedor' }))}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                    >
                      <option value="admin">Administrador</option>
                      <option value="vendedor">Vendedor Responsable</option>
                    </select>
                  </div>
                </div>

                {discardModal.authorizerId === 'custom' && (
                  <input
                    type="text"
                    placeholder="Nombre completo quien autoriza..."
                    value={discardModal.authorizerName}
                    onChange={(e) => setDiscardModal(prev => ({ ...prev, authorizerName: e.target.value }))}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                )}

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/70 border border-rose-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discardModal.explicitlyAuthorized}
                    onChange={(e) => setDiscardModal(prev => ({ ...prev, explicitlyAuthorized: e.target.checked, error: undefined }))}
                    className="mt-0.5 rounded border-rose-400 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-[11px] font-bold text-rose-950 leading-snug">
                    Confirmo autorización explícita del vendedor responsable o administrador para descartar esta oportunidad comercial.
                  </span>
                </label>
              </div>

              {discardModal.error && (
                <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                  {discardModal.error}
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDiscardModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
              >
                Confirmar Descarte
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationTracking;
