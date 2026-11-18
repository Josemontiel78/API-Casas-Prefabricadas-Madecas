import {
  Budget,
  BudgetItem,
  Client,
  Contract,
  PaymentInstallment,
  Project,
  HouseModel
} from '@/types';

export const isBaseModelItem = (item: BudgetItem): boolean => {
  return (item.descripcion || '').toUpperCase().includes('CASA MODELO');
};

export const isPromoItem = (item: BudgetItem): boolean => {
  const desc = (item.descripcion || '').toUpperCase();
  return desc.includes('PROMO') && Math.round(Number(item.total) || 0) === 0;
};

export const isPaidAdditionalItem = (item: BudgetItem): boolean => {
  return !isBaseModelItem(item) && !isPromoItem(item) && Math.round(Number(item.total) || 0) > 0;
};

export interface ReconciledBudgetTotals {
  itemsSum: number;
  baseSum: number;
  adicSum: number;
  promoItems: BudgetItem[];
  baseItems: BudgetItem[];
  adicItems: BudgetItem[];
}

export const normalizeBudgetItems = (items: BudgetItem[]): BudgetItem[] => {
  return (items || []).map(item => {
    const cantidad = Number(item.cantidad) || 0;
    const precio_unitario = Math.round(Number(item.precio_unitario) || 0);
    const hasExplicitTotal = typeof item.total === 'number' && !Number.isNaN(item.total);
    const total = hasExplicitTotal
      ? Math.round(item.total)
      : Math.round(cantidad * precio_unitario);
    return {
      ...item,
      cantidad,
      precio_unitario,
      total
    };
  });
};

export const reconcileBudgetTotals = (budget: Partial<Budget>): ReconciledBudgetTotals => {
  const normalizedItems = normalizeBudgetItems(budget.detalle_items || []);
  const baseItems = normalizedItems.filter(isBaseModelItem);
  const promoItems = normalizedItems.filter(isPromoItem);
  const adicItems = normalizedItems.filter(i => !isBaseModelItem(i) && !isPromoItem(i));

  if (normalizedItems.length > 0) {
    const baseSum = baseItems.reduce((sum, item) => sum + item.total, 0);
    const adicSum = adicItems.reduce((sum, item) => sum + item.total, 0);
    const itemsSum = baseSum + adicSum;
    return {
      itemsSum,
      baseSum,
      adicSum,
      promoItems,
      baseItems,
      adicItems
    };
  }

  const fallbackBase = budget.es_anexo
    ? 0
    : Math.round(
        Number(budget.monto_base_modelo) ||
          (budget.superficie_m2 && budget.valor_m2
            ? budget.superficie_m2 * budget.valor_m2
            : Number(budget.monto_total) || 0)
      );
  const fallbackAdic = Math.round(Number(budget.monto_adicionales) || 0);
  const itemsSum = Math.round(Number(budget.monto_total) || fallbackBase + fallbackAdic);

  return {
    itemsSum,
    baseSum: fallbackBase,
    adicSum: fallbackAdic,
    promoItems: [],
    baseItems: [],
    adicItems: []
  };
};

/**
 * Distributes a total CLP amount across installments according to their percentages,
 * ensuring the last non-zero installment absorbs any +-1 CLP rounding remainder
 * whenever percentages sum to 100%.
 */
export const calculateInstallmentsExact = (
  total: number,
  installments: PaymentInstallment[]
): PaymentInstallment[] => {
  const cleanTotal = Math.max(0, Math.round(Number(total) || 0));
  if (!installments || installments.length === 0) return [];

  const next = installments.map(p => {
    const pct = Number(p.porcentaje) || 0;
    return {
      ...p,
      porcentaje: pct,
      monto: Math.round(cleanTotal * (pct / 100))
    };
  });

  const totalPct = next.reduce((sum, p) => sum + p.porcentaje, 0);
  if (Math.abs(totalPct - 100) < 0.05) {
    const currentSum = next.reduce((sum, p) => sum + p.monto, 0);
    const diff = cleanTotal - currentSum;
    if (diff !== 0) {
      let adjustIdx = -1;
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].porcentaje > 0) {
          adjustIdx = i;
          break;
        }
      }
      if (adjustIdx === -1) adjustIdx = next.length - 1;
      next[adjustIdx] = {
        ...next[adjustIdx],
        monto: Math.max(0, next[adjustIdx].monto + diff)
      };
    }
  }

  return next;
};

export const SPANISH_MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

export const parseLocalDate = (dateStr?: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m, d);
    }
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const formatLongSpanishDate = (dateStr?: string): string => {
  const dateObj = parseLocalDate(dateStr);
  return `${dateObj.getDate()} de ${SPANISH_MONTHS[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;
};

export const getEffectiveBudgetTotalForContract = (
  budget: Budget | undefined | null,
  isAnexo: boolean
): number => {
  if (!budget) return 0;
  const reconciled = reconcileBudgetTotals(budget);
  if (isAnexo && !budget.es_anexo) {
    // Creating an annex directly from an existing main contract budget: sum paid adicionales
    return reconciled.adicSum > 0 ? reconciled.adicSum : 0;
  }
  return reconciled.itemsSum;
};

export interface CongruenceCheckItem {
  id: string;
  label: string;
  expectedValue: string;
  status: 'ok' | 'warning' | 'mismatch';
  detail: string;
}

export interface CongruenceReport {
  isFinanciallyCongruent: boolean;
  isDraftPresent: boolean;
  isDraftSynced: boolean;
  itemsSum: number;
  budgetTotal: number;
  effectiveContractTotal: number;
  paymentsSum: number;
  percentagesSum: number;
  checks: CongruenceCheckItem[];
  mismatches: string[];
}

export const verifyBudgetContractCongruence = (params: {
  budget?: Budget | null;
  client?: Client | null;
  project?: (Project | HouseModel | any) | null;
  payments: PaymentInstallment[];
  contractDate: string;
  startDate: string;
  plazoInstalacion: number;
  lugarSuscripcion: string;
  isAnexo: boolean;
  generatedText: string;
}): CongruenceReport => {
  const {
    budget,
    client,
    project,
    payments,
    startDate,
    plazoInstalacion,
    lugarSuscripcion,
    isAnexo,
    generatedText
  } = params;

  const reconciled = budget
    ? reconcileBudgetTotals(budget)
    : { itemsSum: 0, baseSum: 0, adicSum: 0, promoItems: [], baseItems: [], adicItems: [] };

  const budgetTotal = Math.round(Number(budget?.monto_total) || 0);
  const itemsSum = reconciled.itemsSum;
  const effectiveContractTotal = budget
    ? getEffectiveBudgetTotalForContract(budget, isAnexo)
    : 0;
  const paymentsSum = payments.reduce((s, p) => s + Math.round(Number(p.monto) || 0), 0);
  const percentagesSum = payments.reduce((s, p) => s + (Number(p.porcentaje) || 0), 0);

  const isDraftPresent = !!generatedText && generatedText.trim().length > 0;
  const normalizedDraft = (generatedText || '').replace(/\s+/g, ' ').toUpperCase();

  const checks: CongruenceCheckItem[] = [];
  const mismatches: string[] = [];

  // 1. Client data check
  const hasClientBasic = !!(client?.nombre && client?.rut);
  const draftHasClient =
    !isDraftPresent ||
    !client ||
    (normalizedDraft.includes(client.nombre.trim().toUpperCase()) &&
      normalizedDraft.includes(client.rut.trim().toUpperCase()));

  checks.push({
    id: 'client',
    label: 'Datos del Comprador',
    expectedValue: client ? `${client.nombre} (${client.rut})` : 'Sin cliente',
    status: !hasClientBasic ? 'mismatch' : draftHasClient ? 'ok' : 'mismatch',
    detail: !hasClientBasic
      ? 'Falta nombre o RUT del cliente'
      : draftHasClient
        ? `Domicilio: ${client?.domicilio || 'S/D'} • Tel: ${client?.telefono || 'S/T'}`
        : 'El nombre o RUT del borrador no coincide con el cliente seleccionado'
  });
  if (!hasClientBasic || !draftHasClient) {
    mismatches.push('Datos del comprador (Nombre/RUT)');
  }

  // 2. Superficie & Modelo
  const budgetM2 = budget?.superficie_m2 || project?.superficie_m2 || 0;
  const isCombined = !!(budget?.es_combinacion_modelos && budget?.modelos_combinados && budget.modelos_combinados.length > 1);
  const modelLabel = isCombined
    ? budget!.modelos_combinados!.map(m => `${m.nombre} (${m.superficie_m2}m²)`).join(' + ')
    : project?.modelo || project?.nombre || 'Modelo Madecas';

  const draftHasM2 =
    !isDraftPresent ||
    isAnexo ||
    budgetM2 <= 0 ||
    normalizedDraft.includes(`${budgetM2} M2`) ||
    normalizedDraft.includes(`${budgetM2} M²`);

  checks.push({
    id: 'model_m2',
    label: isCombined ? 'Combinación Modular y m²' : 'Modelo y Superficie',
    expectedValue: `${modelLabel} — ${budgetM2} m²`,
    status: draftHasM2 ? 'ok' : 'mismatch',
    detail: draftHasM2
      ? 'Superficie y modelo congruentes con la cotización'
      : `El borrador no refleja los ${budgetM2} m² cotizados`
  });
  if (!draftHasM2) {
    mismatches.push(`Superficie (${budgetM2} m²)`);
  }

  // 3. Budget Line Items (Base + Mejoramientos Adicionales + Personalizados)
  const relevantItems = isAnexo && budget && !budget.es_anexo
    ? reconciled.adicItems.filter(i => i.total > 0)
    : (budget?.detalle_items || []);

  const missingInDraftItems: string[] = [];
  if (isDraftPresent && relevantItems.length > 0) {
    for (const item of relevantItems) {
      const formattedTotal = `$${Math.round(item.total).toLocaleString('es-CL')}`;
      const descSnippet = (item.descripcion || '').trim().toUpperCase().slice(0, 26);
      if (!normalizedDraft.includes(formattedTotal) || (descSnippet && !normalizedDraft.includes(descSnippet))) {
        missingInDraftItems.push(item.descripcion);
      }
    }
  }

  const budgetInternalAligned = isAnexo && budget && !budget.es_anexo ? true : itemsSum === budgetTotal;
  checks.push({
    id: 'items',
    label: `Partidas Cotizadas (${relevantItems.length})`,
    expectedValue: `$${(isAnexo && budget && !budget.es_anexo ? reconciled.adicSum : itemsSum).toLocaleString('es-CL')} CLP`,
    status: !budgetInternalAligned || missingInDraftItems.length > 0 ? 'mismatch' : 'ok',
    detail: !budgetInternalAligned
      ? `Suma de partidas ($${itemsSum.toLocaleString('es-CL')}) difiere del total guardado ($${budgetTotal.toLocaleString('es-CL')})`
      : missingInDraftItems.length > 0
        ? `Falta o difiere en borrador: ${missingInDraftItems.slice(0, 2).join(', ')}${missingInDraftItems.length > 2 ? '...' : ''}`
        : 'Todas las partidas, cantidades, precios unitarios y subtotales coinciden'
  });
  if (!budgetInternalAligned || missingInDraftItems.length > 0) {
    mismatches.push('Desglose de partidas y adicionales');
  }

  // 4. Financial Total vs Payment Installments
  const pctOk = Math.abs(percentagesSum - 100) < 0.05;
  const paySumMatches = paymentsSum === effectiveContractTotal;
  const formattedContractTotal = `$${effectiveContractTotal.toLocaleString('es-CL')}`;
  const draftHasTotal = !isDraftPresent || effectiveContractTotal <= 0 || normalizedDraft.includes(formattedContractTotal);

  const missingInstallmentAmounts = isDraftPresent
    ? payments
        .filter(p => p.monto > 0 && !normalizedDraft.includes(`$${p.monto.toLocaleString('es-CL')}`))
        .map(p => `$${p.monto.toLocaleString('es-CL')}`)
    : [];

  const totalsAllMatch = budgetInternalAligned && pctOk && paySumMatches && draftHasTotal && missingInstallmentAmounts.length === 0;
  checks.push({
    id: 'financial',
    label: 'Cuadre Total y Plan de Pagos',
    expectedValue: `${formattedContractTotal} CLP (${payments.length} cuotas = ${percentagesSum}%)`,
    status: totalsAllMatch ? 'ok' : 'mismatch',
    detail: !pctOk
      ? `Los porcentajes de pago suman ${percentagesSum}% (deben ser 100%)`
      : !paySumMatches
        ? `Suma de cuotas ($${paymentsSum.toLocaleString('es-CL')}) difiere del total contrato (${formattedContractTotal})`
        : !draftHasTotal
          ? `El monto total ${formattedContractTotal} no coincide con el texto del borrador`
          : missingInstallmentAmounts.length > 0
            ? `Cuotas desactualizadas en el borrador: ${missingInstallmentAmounts.join(', ')}`
            : 'Total contrato y cada cuota coinciden al peso exacto'
  });
  if (!totalsAllMatch) {
    mismatches.push('Monto total o cuotas de pago');
  }

  // 5. Terms (Start Date, Days, City)
  const formattedStartLong = startDate ? formatLongSpanishDate(startDate).toUpperCase() : '';
  const draftHasTerms =
    !isDraftPresent ||
    isAnexo ||
    ((!formattedStartLong || normalizedDraft.includes(formattedStartLong)) &&
      normalizedDraft.includes(`${plazoInstalacion} DIAS HABILES`) &&
      (!lugarSuscripcion || normalizedDraft.includes(lugarSuscripcion.trim().toUpperCase())));

  checks.push({
    id: 'terms',
    label: 'Plazos, Fecha y Ciudad',
    expectedValue: `${lugarSuscripcion || 'Osorno'} • ${plazoInstalacion} días hábiles`,
    status: !startDate ? 'warning' : draftHasTerms ? 'ok' : 'mismatch',
    detail: !startDate
      ? 'Selecciona la Fecha de Inicio de Obra para emitir el contrato'
      : draftHasTerms
        ? `Inicio: ${formatLongSpanishDate(startDate)} • Ciudad: ${lugarSuscripcion}`
        : 'Fecha de inicio, días hábiles o ciudad del borrador difieren de la configuración actual'
  });
  if (startDate && !draftHasTerms) {
    mismatches.push('Plazos, fecha de inicio o ciudad');
  }

  const isFinanciallyCongruent = budgetInternalAligned && pctOk && paySumMatches;
  const isDraftSynced = isDraftPresent && mismatches.length === 0;

  return {
    isFinanciallyCongruent,
    isDraftPresent,
    isDraftSynced,
    itemsSum,
    budgetTotal,
    effectiveContractTotal,
    paymentsSum,
    percentagesSum,
    checks,
    mismatches
  };
};
