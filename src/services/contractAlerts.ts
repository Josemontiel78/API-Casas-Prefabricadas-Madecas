import { Contract, Client, Budget, ContractAlert, ContractStatus } from '@/types';

/**
 * Calculates business or calendar days between two dates.
 */
export const daysDifferenceFromToday = (targetDateStr: string): number => {
  if (!targetDateStr) return 0;
  try {
    const parts = targetDateStr.split('-');
    let target: Date;
    if (parts.length === 3) {
      target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      target = new Date(targetDateStr);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
};

/**
 * Calculates how many days have elapsed since a past date string.
 */
export const daysElapsedSince = (pastDateStr: string): number => {
  if (!pastDateStr) return 0;
  try {
    const parts = pastDateStr.split('-');
    let past: Date;
    if (parts.length === 3) {
      past = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      past = new Date(pastDateStr);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    past.setHours(0, 0, 0, 0);
    const diffMs = today.getTime() - past.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

/**
 * Evaluates all active contracts against execution deadlines and payment schedules.
 */
export const computeContractAlerts = (contracts: Contract[], clients: Client[]): ContractAlert[] => {
  const alerts: ContractAlert[] = [];

  contracts.forEach(contract => {
    // Only analyze active or signed contracts
    if (contract.estado === ContractStatus.COMPLETED || contract.estado === ContractStatus.CANCELLED) {
      return;
    }

    const client = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
    const clientName = client?.nombre || 'Cliente';
    const clientPhone = client?.telefono;

    // 1. Delivery Date Check
    let deliveryDateStr = contract.fecha_entrega_estimada;
    if (!deliveryDateStr && contract.fecha_inicio_obra && contract.plazo_instalacion_dias) {
      const parts = contract.fecha_inicio_obra.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setDate(d.getDate() + contract.plazo_instalacion_dias);
        deliveryDateStr = d.toISOString().split('T')[0];
      }
    }

    if (deliveryDateStr) {
      const daysLeft = daysDifferenceFromToday(deliveryDateStr);

      if (daysLeft < 0) {
        alerts.push({
          id: `vencida-${contract.id}`,
          contract_id: contract.id,
          cliente_id: contract.cliente_id,
          cliente_nombre: clientName,
          cliente_telefono: clientPhone,
          tipo: 'entrega_vencida',
          titulo: `Plazo de Entrega Vencido (${Math.abs(daysLeft)} días)`,
          detalle: `El contrato con ${clientName} tenía fecha estimada para el ${deliveryDateStr}. Se requiere regularización técnica urgente o anexo de ampliación de plazo.`,
          dias_restantes: daysLeft,
          severidad: 'urgente',
          fecha_referencia: deliveryDateStr,
          monto_referencia: contract.monto_total
        });
      } else if (daysLeft <= 5) {
        alerts.push({
          id: `urgente-${contract.id}`,
          contract_id: contract.id,
          cliente_id: contract.cliente_id,
          cliente_nombre: clientName,
          cliente_telefono: clientPhone,
          tipo: 'entrega_urgente',
          titulo: `Entrega Crítica: Quedan ${daysLeft} días`,
          detalle: `Entrega programada para el ${deliveryDateStr}. Verificar avance de cuadrillas de montaje y recepción de terreno.`,
          dias_restantes: daysLeft,
          severidad: 'urgente',
          fecha_referencia: deliveryDateStr,
          monto_referencia: contract.monto_total
        });
      } else if (daysLeft <= 15) {
        alerts.push({
          id: `proxima-${contract.id}`,
          contract_id: contract.id,
          cliente_id: contract.cliente_id,
          cliente_nombre: clientName,
          cliente_telefono: clientPhone,
          tipo: 'entrega_proxima',
          titulo: `Próximo Vencimiento de Plazo (${daysLeft} días)`,
          detalle: `Fecha comprometida de término: ${deliveryDateStr}. Coordinar inspección previa de terminaciones.`,
          dias_restantes: daysLeft,
          severidad: 'alerta',
          fecha_referencia: deliveryDateStr,
          monto_referencia: contract.monto_total
        });
      }
    }

    // 2. Unpaid installments check
    if (contract.pautas_pago && contract.pautas_pago.length > 0) {
      const unpaid = contract.pautas_pago.filter(p => !p.pagado);
      if (unpaid.length > 0) {
        const totalPending = unpaid.reduce((s, p) => s + p.monto, 0);
        alerts.push({
          id: `pago-${contract.id}`,
          contract_id: contract.id,
          cliente_id: contract.cliente_id,
          cliente_nombre: clientName,
          cliente_telefono: clientPhone,
          tipo: 'cuota_impaga',
          titulo: `${unpaid.length} cuota(s) pendiente(s) de cobro`,
          detalle: `Monto pendiente de cobro: $${totalPending.toLocaleString('es-CL')} CLP en contrato N° ${contract.id.slice(0, 6).toUpperCase()}.`,
          dias_restantes: 0,
          severidad: unpaid.length >= 2 ? 'alerta' : 'normal',
          fecha_referencia: contract.fecha_contrato,
          monto_referencia: totalPending
        });
      }
    }
  });

  // Sort by urgency: overdue first, then lowest days left
  return alerts.sort((a, b) => {
    if (a.severidad === 'urgente' && b.severidad !== 'urgente') return -1;
    if (b.severidad === 'urgente' && a.severidad !== 'urgente') return 1;
    return a.dias_restantes - b.dias_restantes;
  });
};

/**
 * Lead scoring recommendation based on commercial signals:
 * - High: high budget amount, recent interaction, or active negotiation
 * - Medium: standard budget, moderate idle days
 * - Low: > 14 days stagnant or low contact response
 */
export const getSuggestedLeadScore = (
  budget: Budget,
  daysSince: number,
  client?: Client
): 'Alta' | 'Media' | 'Baja' => {
  if (budget.lead_score) return budget.lead_score;
  const stage = client?.etapa_venta;
  if (stage === 'Negociación' || stage === 'Cierre') return daysSince > 14 ? 'Media' : 'Alta';
  if (daysSince <= 3 && budget.monto_total >= 10000000) return 'Alta';
  if (daysSince <= 7 && budget.monto_total >= 7000000) return 'Alta';
  if (daysSince > 14) return 'Baja';
  return 'Media';
};

export interface StagnationAlert {
  id: string;
  budget_id: string;
  cliente_id: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  cliente_correo?: string;
  dias_sin_interaccion: number;
  ultima_fecha: string;
  monto_total: number;
  severidad: 'urgente' | 'alerta';
  lead_score: 'Alta' | 'Media' | 'Baja';
}

export const getStagnationThresholdDays = (): number => {
  try {
    const saved = localStorage.getItem('crm_stagnation_days');
    const parsed = saved ? parseInt(saved, 10) : 5;
    return isNaN(parsed) || parsed < 1 ? 5 : parsed;
  } catch {
    return 5;
  }
};

export const setStagnationThresholdDaysPref = (days: number) => {
  try {
    localStorage.setItem('crm_stagnation_days', String(days));
    window.dispatchEvent(new CustomEvent('crm-stagnation-threshold-changed', { detail: days }));
  } catch {
    // ignore
  }
};

export const computeStagnationAlerts = (
  budgets: Budget[],
  clients: Client[],
  contracts: Contract[],
  thresholdDays = 5
): StagnationAlert[] => {
  const contractedBudgetIds = new Set(contracts.map(c => c.presupuesto_id));
  const alerts: StagnationAlert[] = [];

  budgets.forEach(budget => {
    if (budget.descartado || contractedBudgetIds.has(budget.id)) return;
    const refDate = budget.ultima_interaccion || budget.fecha;
    const daysIdle = daysElapsedSince(refDate);
    if (daysIdle >= thresholdDays) {
      const client = clients.find(c => c.id === budget.cliente_id);
      alerts.push({
        id: `stagnant-${budget.id}`,
        budget_id: budget.id,
        cliente_id: budget.cliente_id,
        cliente_nombre: client?.nombre || 'Cliente por asignar',
        cliente_telefono: client?.telefono,
        cliente_correo: client?.correo,
        dias_sin_interaccion: daysIdle,
        ultima_fecha: refDate,
        monto_total: budget.monto_total,
        severidad: daysIdle >= thresholdDays * 2 ? 'urgente' : 'alerta',
        lead_score: getSuggestedLeadScore(budget, daysIdle, client)
      });
    }
  });

  return alerts.sort((a, b) => b.dias_sin_interaccion - a.dias_sin_interaccion);
};

