import React, { useState, useEffect, useMemo } from 'react';
import { Budget, BudgetItem, Client, Project, HouseModel, Contract, CombinedModelModule } from '@/types';
import { 
  getBudgets, 
  saveBudget, 
  getClients, 
  getProjects, 
  deleteBudget, 
  subscribeToBudgets, 
  subscribeToClients, 
  subscribeToProjects, 
  saveClient, 
  subscribeToHouseModels,
  getContracts
} from '@/services/db';
import { analyzeBudgetFile, suggestCubicacionAI } from '@/services/gemini';
import { BudgetTable } from './budget/BudgetTable';
import { 
  Plus, 
  Save, 
  Trash2, 
  Calculator, 
  Upload, 
  Loader2, 
  Eye, 
  X, 
  FileText, 
  Search, 
  ArrowRight, 
  Edit3, 
  CheckCircle2, 
  Gift, 
  Layers, 
  Sliders, 
  Wrench,
  HelpCircle,
  FilePlus2,
  DollarSign,
  Home
} from 'lucide-react';
import { uuid, cn } from '@/lib/utils';
import { 
  MADECAS_ADICIONALES, 
  DEFAULT_VALOR_M2_BASE, 
  MADECAS_PROMO_THRESHOLD_M2, 
  MADECAS_PROMO_TEXT, 
  MADECAS_PACK_BASICO_SPECS 
} from '@/constants/catalog';

interface SelectedAdicionalState {
  selected: boolean;
  m2: number;
  precio_m2: number;
  titulo: string;
  total: number;
}

const BudgetManager: React.FC = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [filteredBudgets, setFilteredBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [houseModels, setHouseModels] = useState<HouseModel[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState('');
  const [viewingBudget, setViewingBudget] = useState<Budget | null>(null);

  // Dynamic m2 calculation and additional improvements state
  const [valorM2Input, setValorM2Input] = useState<number>(DEFAULT_VALOR_M2_BASE);
  const [adicionalesState, setAdicionalesState] = useState<Record<string, SelectedAdicionalState>>({});
  
  // Multi-model combination state
  const [isMultiModelMode, setIsMultiModelMode] = useState<boolean>(false);
  const [combinedModules, setCombinedModules] = useState<CombinedModelModule[]>([]);

  const [formData, setFormData] = useState<Budget>({
    id: '', 
    cliente_id: '', 
    vendedor_id: '',
    proyecto_id: '', 
    fecha: new Date().toISOString().split('T')[0], 
    detalle_items: [], 
    monto_total: 0,
    forma_pago: 'Transferencia',
    cuotas: 4,
    estado_pago: 'Pendiente',
    plazo_instalacion_dias: 30,
    lugar_suscripcion: 'Osorno',
    superficie_m2: 36,
    valor_m2: DEFAULT_VALOR_M2_BASE,
    monto_base_modelo: 0,
    monto_adicionales: 0,
    es_anexo: false,
    es_combinacion_modelos: false,
    modelos_combinados: []
  });

  // Temp manual item input
  const [newItem, setNewItem] = useState<BudgetItem>({
    id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0
  });

  useEffect(() => {
    const unsubBudgets = subscribeToBudgets((data) => setBudgets(data));
    const unsubClients = subscribeToClients((data) => setClients(data));
    const unsubProjects = subscribeToProjects((data) => setProjects(data));
    const unsubModels = subscribeToHouseModels ? (subscribeToHouseModels as any)((data: any) => setHouseModels(data)) : () => {};
    getContracts().then(setContracts);

    return () => {
      unsubBudgets();
      unsubClients();
      unsubProjects();
      if (typeof unsubModels === 'function') unsubModels();
    };
  }, []);

  // Check for pre-fills from Design Gallery or Client selection
  useEffect(() => {
    const timer = setTimeout(() => {
      const prefillModelJson = sessionStorage.getItem('prefill_house_model');
      const prefillValorM2 = sessionStorage.getItem('prefill_valor_m2');
      const pendingClientId = window.localStorage.getItem('pending_quote_client_id') || window.localStorage.getItem('selected_client_id');
      const pendingAnexoContractId = window.localStorage.getItem('pending_anexo_contract_id');

      if (pendingAnexoContractId) {
        window.localStorage.removeItem('pending_anexo_contract_id');
        const parentContract = contracts.find(c => c.id === pendingAnexoContractId);
        if (parentContract) {
          setFormData({
            id: uuid(),
            cliente_id: parentContract.cliente_id,
            vendedor_id: parentContract.vendedor_id || '',
            proyecto_id: parentContract.proyecto_id,
            fecha: new Date().toISOString().split('T')[0],
            detalle_items: [],
            monto_total: 0,
            forma_pago: 'Transferencia',
            cuotas: 2,
            estado_pago: 'Pendiente',
            plazo_instalacion_dias: 15,
            lugar_suscripcion: 'Osorno',
            superficie_m2: parentContract.proyecto_snapshot?.superficie_m2 || 36,
            valor_m2: 0,
            es_anexo: true,
            parent_contract_id: parentContract.id,
            tipo_documento: 'PRESUPUESTO_ANEXO',
            notas_personalizacion: `Presupuesto para Anexo Adicional al Contrato Nº ${parentContract.id.slice(0, 8).toUpperCase()}`
          });
          setIsEditing(true);
          return;
        }
      }

      const prefillCombinedJson = sessionStorage.getItem('prefill_combined_models');
      if (prefillCombinedJson) {
        sessionStorage.removeItem('prefill_combined_models');
        try {
          const modules = JSON.parse(prefillCombinedJson) as CombinedModelModule[];
          if (Array.isArray(modules) && modules.length > 0) {
            setIsMultiModelMode(true);
            setCombinedModules(modules);
            
            const totalSurface = modules.reduce((sum, m) => sum + m.superficie_m2, 0);
            const totalBase = modules.reduce((sum, m) => sum + m.subtotal, 0);
            const avgRate = totalSurface > 0 ? Math.round(totalBase / totalSurface) : DEFAULT_VALOR_M2_BASE;
            setValorM2Input(avgRate);

            // Create item lines for each combined module
            const moduleItems: BudgetItem[] = modules.map((m, idx) => ({
              id: uuid(),
              descripcion: `CASA MODELO ${m.nombre.toUpperCase()} [${m.rol ? m.rol.toUpperCase() : `MÓDULO ${idx + 1}`}] (${m.superficie_m2} m² x $${m.valor_m2.toLocaleString('es-CL')}/m²)`,
              cantidad: m.superficie_m2,
              unidad: 'm²',
              precio_unitario: m.valor_m2,
              total: m.subtotal
            }));

            // Check promo item for >= 66 m2
            if (totalSurface >= MADECAS_PROMO_THRESHOLD_M2) {
              moduleItems.push({
                id: uuid(),
                descripcion: 'PROMO MADECAS: Pintura impregnante antihongos y repelente color a elección (Casas ≥ 66 m²)',
                cantidad: 1,
                unidad: 'gl',
                precio_unitario: 0,
                total: 0
              });
            }

            setFormData({
              id: uuid(),
              cliente_id: pendingClientId || '',
              vendedor_id: '',
              proyecto_id: modules[0].model_id,
              fecha: new Date().toISOString().split('T')[0],
              detalle_items: moduleItems,
              monto_total: totalBase,
              monto_base_modelo: totalBase,
              monto_adicionales: 0,
              forma_pago: 'Transferencia',
              cuotas: 4,
              estado_pago: 'Pendiente',
              plazo_instalacion_dias: 35,
              lugar_suscripcion: 'Osorno',
              superficie_m2: totalSurface,
              valor_m2: avgRate,
              notas_personalizacion: `Combinación de ${modules.length} modelos: ${modules.map(m => `${m.nombre} (${m.superficie_m2}m²)`).join(' + ')}`,
              es_anexo: false,
              es_combinacion_modelos: true,
              modelos_combinados: modules
            });
            setIsEditing(true);

            if (pendingClientId) {
              window.localStorage.removeItem('pending_quote_client_id');
              window.localStorage.removeItem('selected_client_id');
            }
            return;
          }
        } catch (e) {
          console.error("Error parsing prefill combined models:", e);
        }
      }

      if (prefillModelJson) {
        sessionStorage.removeItem('prefill_house_model');
        sessionStorage.removeItem('prefill_valor_m2');
        sessionStorage.removeItem('prefill_superficie_m2');
        sessionStorage.removeItem('prefill_monto_base');

        try {
          const model = JSON.parse(prefillModelJson) as HouseModel;
          const rate = prefillValorM2 ? Number(prefillValorM2) : (model.valor_m2_sugerido || DEFAULT_VALOR_M2_BASE);
          setValorM2Input(rate);

          const surface = model.superficie_m2 || 36;
          const baseTotal = surface * rate;

          const baseItem: BudgetItem = {
            id: uuid(),
            descripcion: `CASA MODELO ${model.nombre.toUpperCase()} (${surface} m² x $${rate.toLocaleString('es-CL')}/m²)`,
            cantidad: 1,
            unidad: 'gl',
            precio_unitario: baseTotal,
            total: baseTotal
          };

          const initialItems = [baseItem];

          // Check if promo applies
          if (surface >= MADECAS_PROMO_THRESHOLD_M2) {
            initialItems.push({
              id: uuid(),
              descripcion: 'PROMO MADECAS: Pintura impregnante antihongos y repelente color a elección (Casas ≥ 66 m²)',
              cantidad: 1,
              unidad: 'gl',
              precio_unitario: 0,
              total: 0
            });
          }

          setIsMultiModelMode(false);
          setCombinedModules([]);

          setFormData({
            id: uuid(),
            cliente_id: pendingClientId || '',
            vendedor_id: '',
            proyecto_id: model.id,
            fecha: new Date().toISOString().split('T')[0],
            detalle_items: initialItems,
            monto_total: baseTotal,
            monto_base_modelo: baseTotal,
            monto_adicionales: 0,
            forma_pago: 'Transferencia',
            cuotas: 4,
            estado_pago: 'Pendiente',
            plazo_instalacion_dias: 30,
            lugar_suscripcion: 'Osorno',
            superficie_m2: surface,
            valor_m2: rate,
            notas_personalizacion: `Modelo seleccionado: ${model.nombre}`,
            es_anexo: false,
            es_combinacion_modelos: false,
            modelos_combinados: []
          });
          setIsEditing(true);

          if (pendingClientId) {
            window.localStorage.removeItem('pending_quote_client_id');
            window.localStorage.removeItem('selected_client_id');
          }
        } catch (e) {
          console.error("Error parsing prefill house model:", e);
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [contracts]);

  // Filter budgets list
  useEffect(() => {
    const lower = searchTerm.toLowerCase();
    const filtered = budgets.filter(b => {
      const cName = clients.find(c => c.id === b.cliente_id)?.nombre.toLowerCase() || '';
      const pName = projects.find(p => p.id === b.proyecto_id)?.modelo.toLowerCase() || 
                    houseModels.find(m => m.id === b.proyecto_id)?.nombre.toLowerCase() || '';
      return cName.includes(lower) || pName.includes(lower) || b.fecha.includes(lower) || b.id.toLowerCase().includes(lower);
    });
    setFilteredBudgets(filtered);
  }, [searchTerm, budgets, clients, projects, houseModels]);

  const handleNew = () => {
    setIsMultiModelMode(false);
    setCombinedModules([]);
    setFormData({
      id: uuid(),
      cliente_id: '',
      vendedor_id: '',
      proyecto_id: '',
      fecha: new Date().toISOString().split('T')[0],
      detalle_items: [],
      monto_total: 0,
      monto_base_modelo: 0,
      monto_adicionales: 0,
      forma_pago: 'Transferencia',
      cuotas: 4,
      estado_pago: 'Pendiente',
      plazo_instalacion_dias: 30,
      lugar_suscripcion: 'Osorno',
      superficie_m2: 36,
      valor_m2: DEFAULT_VALOR_M2_BASE,
      es_anexo: false,
      es_combinacion_modelos: false,
      modelos_combinados: []
    });
    setValorM2Input(DEFAULT_VALOR_M2_BASE);
    setAdicionalesState({});
    setIsEditing(true);
  };

  // Function to update multi-model calculation
  const updateCombinedModulesCalculation = (newModules: CombinedModelModule[]) => {
    setCombinedModules(newModules);
    const totalSurface = newModules.reduce((sum, m) => sum + m.superficie_m2, 0);
    const totalBase = newModules.reduce((sum, m) => sum + m.subtotal, 0);
    const avgRate = totalSurface > 0 ? Math.round(totalBase / totalSurface) : valorM2Input;

    setFormData(prev => {
      // Keep only non-base items
      let otherItems = prev.detalle_items.filter(i => !i.descripcion.includes('CASA MODELO'));

      // Generate items for each module
      const moduleItems: BudgetItem[] = newModules.map((m, idx) => ({
        id: uuid(),
        descripcion: `CASA MODELO ${m.nombre.toUpperCase()} [${m.rol ? m.rol.toUpperCase() : `MÓDULO ${idx + 1}`}] (${m.superficie_m2} m² x $${m.valor_m2.toLocaleString('es-CL')}/m²)`,
        cantidad: m.superficie_m2,
        unidad: 'm²',
        precio_unitario: m.valor_m2,
        total: m.subtotal
      }));

      // Check promo item for >= 66 m2
      const promoIdx = otherItems.findIndex(i => i.descripcion.includes('PROMO MADECAS'));
      if (totalSurface >= MADECAS_PROMO_THRESHOLD_M2) {
        if (promoIdx < 0) {
          otherItems.push({
            id: uuid(),
            descripcion: 'PROMO MADECAS: Pintura impregnante antihongos y repelente color a elección (Casas ≥ 66 m²)',
            cantidad: 1,
            unidad: 'gl',
            precio_unitario: 0,
            total: 0
          });
        }
      } else if (promoIdx >= 0) {
        otherItems.splice(promoIdx, 1);
      }

      const allItems = [...moduleItems, ...otherItems];
      const totalAmount = allItems.reduce((sum, item) => sum + item.total, 0);
      const adicAmount = otherItems
        .filter(i => i.precio_unitario > 0)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        ...prev,
        es_combinacion_modelos: true,
        modelos_combinados: newModules,
        superficie_m2: totalSurface,
        valor_m2: avgRate,
        monto_base_modelo: totalBase,
        detalle_items: allItems,
        monto_total: totalAmount,
        monto_adicionales: adicAmount
      };
    });
  };

  // Toggle between single model and multi-model combination
  const handleToggleMultiModelMode = (enable: boolean) => {
    setIsMultiModelMode(enable);
    if (enable) {
      let initialModules = [...combinedModules];
      if (initialModules.length === 0) {
        const curModel = houseModels.find(m => m.id === formData.proyecto_id) || houseModels[0];
        const secondaryModel = houseModels.find(m => m.id !== curModel?.id) || houseModels[1] || curModel;
        
        const m1Rate = curModel?.valor_m2_sugerido || valorM2Input || DEFAULT_VALOR_M2_BASE;
        const m1M2 = curModel?.superficie_m2 || 66;
        
        const m2Rate = secondaryModel?.valor_m2_sugerido || valorM2Input || DEFAULT_VALOR_M2_BASE;
        const m2M2 = secondaryModel?.superficie_m2 || 36;

        initialModules = [
          {
            id: uuid(),
            model_id: curModel ? curModel.id : 'm1',
            nombre: curModel ? curModel.nombre : 'Casa Principal',
            superficie_m2: m1M2,
            valor_m2: m1Rate,
            subtotal: Math.round(m1M2 * m1Rate),
            rol: 'Vivienda Principal',
            categoria: curModel?.categoria,
            imagen_url: curModel?.imagen_url
          },
          {
            id: uuid(),
            model_id: secondaryModel ? secondaryModel.id : 'm2',
            nombre: secondaryModel ? secondaryModel.nombre : 'Cabaña / Módulo 2',
            superficie_m2: m2M2,
            valor_m2: m2Rate,
            subtotal: Math.round(m2M2 * m2Rate),
            rol: 'Cabaña Invitados / Quincho',
            categoria: secondaryModel?.categoria,
            imagen_url: secondaryModel?.imagen_url
          }
        ];
      }
      updateCombinedModulesCalculation(initialModules);
    } else {
      const selectedModel = houseModels.find(m => m.id === formData.proyecto_id) || houseModels[0];
      const surface = selectedModel?.superficie_m2 || 36;
      const rate = selectedModel?.valor_m2_sugerido || valorM2Input || DEFAULT_VALOR_M2_BASE;
      setFormData(prev => ({
        ...prev,
        es_combinacion_modelos: false,
        modelos_combinados: undefined,
        proyecto_id: selectedModel ? selectedModel.id : prev.proyecto_id
      }));
      updateBaseModelCalculation(surface, rate);
    }
  };

  const handleAddCombinedModule = () => {
    const defaultModel = houseModels[0];
    const surface = defaultModel?.superficie_m2 || 36;
    const rate = defaultModel?.valor_m2_sugerido || valorM2Input || DEFAULT_VALOR_M2_BASE;
    const newMod: CombinedModelModule = {
      id: uuid(),
      model_id: defaultModel ? defaultModel.id : uuid(),
      nombre: defaultModel ? defaultModel.nombre : `Módulo ${combinedModules.length + 1}`,
      superficie_m2: surface,
      valor_m2: rate,
      subtotal: Math.round(surface * rate),
      rol: combinedModules.length === 0 ? 'Vivienda Principal' : (combinedModules.length === 1 ? 'Cabaña Invitados' : 'Quincho / Ampliación'),
      categoria: defaultModel?.categoria,
      imagen_url: defaultModel?.imagen_url
    };
    updateCombinedModulesCalculation([...combinedModules, newMod]);
  };

  const handleUpdateCombinedModule = (idx: number, changes: Partial<CombinedModelModule>) => {
    const updated = [...combinedModules];
    const cur = updated[idx];
    if (!cur) return;

    let newModelId = changes.model_id !== undefined ? changes.model_id : cur.model_id;
    let newNombre = changes.nombre !== undefined ? changes.nombre : cur.nombre;
    let newSurface = changes.superficie_m2 !== undefined ? Math.max(1, changes.superficie_m2) : cur.superficie_m2;
    let newRate = changes.valor_m2 !== undefined ? Math.max(0, changes.valor_m2) : cur.valor_m2;
    let newRol = changes.rol !== undefined ? changes.rol : cur.rol;
    let newImg = cur.imagen_url;

    if (changes.model_id && changes.model_id !== cur.model_id) {
      const found = houseModels.find(m => m.id === changes.model_id);
      if (found) {
        newNombre = found.nombre;
        newSurface = found.superficie_m2;
        newRate = found.valor_m2_sugerido || newRate;
        newImg = found.imagen_url;
      }
    }

    const newSubtotal = Math.round(newSurface * newRate);
    updated[idx] = {
      ...cur,
      model_id: newModelId,
      nombre: newNombre,
      superficie_m2: newSurface,
      valor_m2: newRate,
      subtotal: newSubtotal,
      rol: newRol,
      imagen_url: newImg
    };

    updateCombinedModulesCalculation(updated);
  };

  const handleRemoveCombinedModule = (idx: number) => {
    if (combinedModules.length <= 1) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Debe haber al menos un módulo en el presupuesto.', type: 'info' } 
      }));
      return;
    }
    const updated = combinedModules.filter((_, i) => i !== idx);
    updateCombinedModulesCalculation(updated);
  };

  // Recalculate base model item and total whenever surface or valor_m2 changes
  const updateBaseModelCalculation = (newSurface: number, newRate: number) => {
    if (formData.es_anexo) return; // Annexes only quote extra works

    const selectedModel = houseModels.find(m => m.id === formData.proyecto_id) || 
                          projects.find(p => p.id === formData.proyecto_id) as any;
    const modelName = selectedModel ? (selectedModel.nombre || selectedModel.modelo || '').toUpperCase() : 'ESTÁNDAR';
    const baseTotal = Math.round(newSurface * newRate);

    setFormData(prev => {
      // Find or create base model item
      let items = [...prev.detalle_items];
      const baseItemIdx = items.findIndex(i => i.descripcion.includes('CASA MODELO'));

      const newBaseItem: BudgetItem = {
        id: baseItemIdx >= 0 ? items[baseItemIdx].id : uuid(),
        descripcion: `CASA MODELO ${modelName} (${newSurface} m² x $${newRate.toLocaleString('es-CL')}/m²)`,
        cantidad: 1,
        unidad: 'gl',
        precio_unitario: baseTotal,
        total: baseTotal
      };

      if (baseItemIdx >= 0) {
        items[baseItemIdx] = newBaseItem;
      } else {
        items.unshift(newBaseItem);
      }

      // Check promo item for >= 66 m2
      const promoIdx = items.findIndex(i => i.descripcion.includes('PROMO MADECAS'));
      if (newSurface >= MADECAS_PROMO_THRESHOLD_M2) {
        if (promoIdx < 0) {
          items.push({
            id: uuid(),
            descripcion: 'PROMO MADECAS: Pintura impregnante antihongos y repelente color a elección (Casas ≥ 66 m²)',
            cantidad: 1,
            unidad: 'gl',
            precio_unitario: 0,
            total: 0
          });
        }
      } else if (promoIdx >= 0) {
        items.splice(promoIdx, 1);
      }

      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

      return {
        ...prev,
        superficie_m2: newSurface,
        valor_m2: newRate,
        monto_base_modelo: baseTotal,
        detalle_items: items,
        monto_total: totalAmount
      };
    });
  };

  // Handle Model Selection
  const handleModelChange = (modelId: string) => {
    const selected = houseModels.find(m => m.id === modelId) || projects.find(p => p.id === modelId) as any;
    if (!selected) {
      setFormData(prev => ({ ...prev, proyecto_id: '' }));
      return;
    }

    const surface = selected.superficie_m2 || 36;
    const rate = selected.valor_m2_sugerido || valorM2Input || DEFAULT_VALOR_M2_BASE;
    setValorM2Input(rate);

    setFormData(prev => ({
      ...prev,
      proyecto_id: modelId,
      superficie_m2: surface,
      valor_m2: rate
    }));

    updateBaseModelCalculation(surface, rate);
  };

  // Update an Additional Improvement (title, m2, precio_m2, total, selected)
  const handleUpdateAdicional = (
    adicId: string, 
    changes: {
      selected?: boolean;
      m2?: number;
      precio_m2?: number;
      titulo?: string;
      total?: number;
    }
  ) => {
    const adic = MADECAS_ADICIONALES.find(a => a.id === adicId);
    if (!adic) return;

    const current = adicionalesState[adicId] || {
      selected: false,
      m2: formData.superficie_m2 || 36,
      precio_m2: adic.precio_m2,
      titulo: adic.titulo,
      total: Math.round((formData.superficie_m2 || 36) * adic.precio_m2)
    };

    const newSelected = changes.selected !== undefined ? changes.selected : current.selected;
    const newTitulo = changes.titulo !== undefined ? changes.titulo : (current.titulo || adic.titulo);
    const newM2 = changes.m2 !== undefined ? Math.max(0, changes.m2) : (current.m2 || formData.superficie_m2 || 36);
    
    let newPrecioM2 = changes.precio_m2 !== undefined ? Math.max(0, changes.precio_m2) : current.precio_m2;
    let newTotal = changes.total !== undefined ? Math.max(0, changes.total) : Math.round(newM2 * newPrecioM2);

    // If total was explicitly changed, recompute unit price per m2
    if (changes.total !== undefined && changes.precio_m2 === undefined) {
      newTotal = Math.max(0, changes.total);
      newPrecioM2 = newM2 > 0 ? Math.round(newTotal / newM2) : newTotal;
    } else if (changes.precio_m2 !== undefined || changes.m2 !== undefined) {
      newTotal = Math.round(newM2 * newPrecioM2);
    }

    const updatedStateItem: SelectedAdicionalState = {
      selected: newSelected,
      m2: newM2,
      precio_m2: newPrecioM2,
      titulo: newTitulo,
      total: newTotal
    };

    setAdicionalesState(prev => ({
      ...prev,
      [adicId]: updatedStateItem
    }));

    setFormData(prev => {
      let items = [...prev.detalle_items];
      const existingIdx = items.findIndex(i => i.descripcion.includes(`[${adic.codigo}]`));

      if (newSelected) {
        const adicItem: BudgetItem = {
          id: existingIdx >= 0 ? items[existingIdx].id : uuid(),
          descripcion: `[${adic.codigo}] ${newTitulo.toUpperCase()} (${newM2} m² x $${newPrecioM2.toLocaleString('es-CL')}/m²)`,
          cantidad: newM2,
          unidad: 'm2',
          precio_unitario: newPrecioM2,
          total: newTotal
        };

        if (existingIdx >= 0) {
          items[existingIdx] = adicItem;
        } else {
          items.push(adicItem);
        }
      } else if (existingIdx >= 0) {
        items.splice(existingIdx, 1);
      }

      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      const adicAmount = items
        .filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        ...prev,
        detalle_items: items,
        monto_total: totalAmount,
        monto_adicionales: adicAmount
      };
    });
  };

  // Toggle selection shortcut
  const handleToggleAdicional = (adicId: string) => {
    const isCurrentlySelected = !!adicionalesState[adicId]?.selected;
    handleUpdateAdicional(adicId, { selected: !isCurrentlySelected });
  };

  // Reset an item to its original catalog values
  const handleResetAdicional = (adicId: string) => {
    const adic = MADECAS_ADICIONALES.find(a => a.id === adicId);
    if (!adic) return;
    const baseM2 = formData.superficie_m2 || 36;
    handleUpdateAdicional(adicId, {
      selected: true,
      m2: baseM2,
      precio_m2: adic.precio_m2,
      titulo: adic.titulo,
      total: Math.round(baseM2 * adic.precio_m2)
    });
  };

  // Update item directly from the BudgetTable
  const handleUpdateItem = (id: string, updatedProps: Partial<BudgetItem>) => {
    setFormData(prev => {
      const updated = prev.detalle_items.map(item => {
        if (item.id === id) {
          const newItem = { ...item, ...updatedProps };
          if (updatedProps.cantidad !== undefined || updatedProps.precio_unitario !== undefined) {
            if (updatedProps.total === undefined) {
              newItem.total = Math.round(newItem.cantidad * newItem.precio_unitario);
            }
          }
          return newItem;
        }
        return item;
      });

      // Synchronize with adicionalesState if this item corresponds to an official improvement
      const changedItem = updated.find(i => i.id === id);
      if (changedItem) {
        const matchedAdic = MADECAS_ADICIONALES.find(a => changedItem.descripcion.includes(`[${a.codigo}]`));
        if (matchedAdic) {
          const cleanTitle = changedItem.descripcion
            .replace(`[${matchedAdic.codigo}]`, '')
            .replace(/\(.*?\)/g, '')
            .trim();

          setAdicionalesState(curr => ({
            ...curr,
            [matchedAdic.id]: {
              selected: true,
              m2: changedItem.cantidad,
              precio_m2: changedItem.precio_unitario,
              titulo: cleanTitle || matchedAdic.titulo,
              total: changedItem.total
            }
          }));
        }
      }

      const totalAmount = updated.reduce((sum, item) => sum + item.total, 0);
      const adicAmount = updated
        .filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        ...prev,
        detalle_items: updated,
        monto_total: totalAmount,
        monto_adicionales: adicAmount
      };
    });
  };

  // Load existing budget into editing mode with full item mapping
  const loadBudgetToEdit = (b: Budget) => {
    setFormData({ ...b });
    setValorM2Input(b.valor_m2 || DEFAULT_VALOR_M2_BASE);

    if (b.es_combinacion_modelos && b.modelos_combinados && b.modelos_combinados.length > 0) {
      setIsMultiModelMode(true);
      setCombinedModules(b.modelos_combinados);
    } else {
      setIsMultiModelMode(false);
      setCombinedModules([]);
    }

    // Initialize adicionalesState from b.detalle_items
    const newAdicState: Record<string, SelectedAdicionalState> = {};
    MADECAS_ADICIONALES.forEach(adic => {
      const matchedItem = (b.detalle_items || []).find(i => i.descripcion.includes(`[${adic.codigo}]`));
      if (matchedItem) {
        const cleanTitle = matchedItem.descripcion
          .replace(`[${adic.codigo}]`, '')
          .replace(/\(.*?\)/g, '')
          .trim();

        newAdicState[adic.id] = {
          selected: true,
          m2: matchedItem.cantidad,
          precio_m2: matchedItem.precio_unitario,
          titulo: cleanTitle || adic.titulo,
          total: matchedItem.total
        };
      } else {
        newAdicState[adic.id] = {
          selected: false,
          m2: b.superficie_m2 || 36,
          precio_m2: adic.precio_m2,
          titulo: adic.titulo,
          total: Math.round((b.superficie_m2 || 36) * adic.precio_m2)
        };
      }
    });
    setAdicionalesState(newAdicState);
    setIsEditing(true);
  };

  // Add Custom Manual Item
  const handleAddCustomItem = () => {
    if (!newItem.descripcion || newItem.precio_unitario < 0) return;
    const total = newItem.cantidad * newItem.precio_unitario;
    const itemToAdd: BudgetItem = { ...newItem, id: uuid(), total };

    setFormData(prev => {
      const updated = [...prev.detalle_items, itemToAdd];
      return {
        ...prev,
        detalle_items: updated,
        monto_total: updated.reduce((s, i) => s + i.total, 0)
      };
    });

    setNewItem({ id: '', descripcion: '', cantidad: 1, unidad: 'un', precio_unitario: 0, total: 0 });
  };

  // Remove Line Item
  const handleRemoveItem = (id: string) => {
    setFormData(prev => {
      const itemToRemove = prev.detalle_items.find(i => i.id === id);
      const updated = prev.detalle_items.filter(i => i.id !== id);

      if (itemToRemove) {
        const matchedAdic = MADECAS_ADICIONALES.find(a => itemToRemove.descripcion.includes(`[${a.codigo}]`));
        if (matchedAdic) {
          setAdicionalesState(curr => ({
            ...curr,
            [matchedAdic.id]: {
              ...curr[matchedAdic.id],
              selected: false
            }
          }));
        }
      }

      const totalAmount = updated.reduce((s, i) => s + i.total, 0);
      const adicAmount = updated
        .filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0)
        .reduce((sum, item) => sum + item.total, 0);

      return {
        ...prev,
        detalle_items: updated,
        monto_total: totalAmount,
        monto_adicionales: adicAmount
      };
    });
  };

  // Save Budget
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.cliente_id) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Por favor selecciona un cliente para el presupuesto.', type: 'info' } 
      }));
      return;
    }

    const dataToSave: Budget = {
      ...formData,
      es_combinacion_modelos: isMultiModelMode,
      modelos_combinados: isMultiModelMode ? combinedModules : undefined,
      proyecto_id: isMultiModelMode && combinedModules.length > 0 ? (formData.proyecto_id || combinedModules[0].model_id) : formData.proyecto_id
    };

    if (!dataToSave.proyecto_id && !dataToSave.es_anexo) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Por favor selecciona un modelo de casa.', type: 'info' } 
      }));
      return;
    }

    try {
      await saveBudget(dataToSave);
      setIsEditing(false);

      // Update client stage
      const client = clients.find(c => c.id === formData.cliente_id);
      if (client) {
        await saveClient({
          ...client,
          etapa_venta: 'Cotización'
        });
      }

      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Presupuesto guardado correctamente.', type: 'success' } 
      }));
    } catch (err) {
      console.error("Error saving budget:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Error al guardar el presupuesto.', type: 'error' } 
      }));
    }
  };

  // Generate Contract or Anexo with this Budget
  const handleProceedToContract = async () => {
    await handleSave();
    window.localStorage.setItem('pending_contract_budget_id', formData.id);
    if (formData.es_anexo && formData.parent_contract_id) {
      window.localStorage.setItem('pending_anexo_contract_id', formData.parent_contract_id);
    }
    window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
  };

  // Print Budget Sheet
  const handlePrintBudget = (b: Budget) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const client = clients.find(c => c.id === b.cliente_id);
    const model = houseModels.find(m => m.id === b.proyecto_id) || projects.find(p => p.id === b.proyecto_id) as any;
    const modelName = b.es_combinacion_modelos && b.modelos_combinados && b.modelos_combinados.length > 0
      ? `Combinación Modular (${b.modelos_combinados.map(m => `${m.nombre} [${m.rol || 'Módulo'}]`).join(' + ')})`
      : (model ? (model.nombre || model.modelo) : 'Personalizado');

    const itemsHtml = b.detalle_items.map((item, idx) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px;"><strong>${idx + 1}.</strong> ${item.descripcion}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px;">${item.cantidad} ${item.unidad}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px;">$${item.precio_unitario.toLocaleString('es-CL')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px; font-weight: bold;">$${item.total.toLocaleString('es-CL')}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Presupuesto Oficial - ${client?.nombre || 'Cliente'}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #059669; padding-bottom: 20px; margin-bottom: 25px; }
            .header h1 { margin: 0; color: #059669; font-size: 22px; text-transform: uppercase; }
            .header p { margin: 3px 0 0; font-size: 11px; color: #64748b; font-weight: bold; }
            .badge { background: ${b.es_anexo ? '#dbeafe' : '#ecfdf5'}; color: ${b.es_anexo ? '#1e40af' : '#065f46'}; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 800; border: 1px solid ${b.es_anexo ? '#93c5fd' : '#a7f3d0'}; display: inline-block; margin-bottom: 5px; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
            .box { background: #f8fafc; padding: 15px 20px; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 12px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
            .total-card { background: #ecfdf5; border: 2px solid #10b981; padding: 18px 24px; border-radius: 12px; text-align: right; }
            .total-title { font-size: 12px; text-transform: uppercase; color: #065f46; font-weight: bold; }
            .total-val { font-size: 24px; font-weight: 900; color: #065f46; margin-top: 4px; }
            .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <span class="badge">${b.es_anexo ? 'PRESUPUESTO PARA ANEXO DE OBRA' : 'PRESUPUESTO TÉCNICO OFICIAL'}</span>
              <h1>MADECAS PREFABRICADOS</h1>
              <p>RUT: 77.300.759-4 • CASA MATRIZ OSORNO / PURRANQUE</p>
              <p>Fono: +569 7777 00 22 • Correo: obras@madecas.cl</p>
            </div>
            <div style="text-align: right; font-size: 11px;">
              <strong>Folio:</strong> ${b.id.slice(0, 8).toUpperCase()}<br>
              <strong>Fecha:</strong> ${b.fecha}<br>
              <strong>Lugar:</strong> ${b.lugar_suscripcion || 'Osorno'}
            </div>
          </div>

          <div class="details">
            <div class="box">
              <strong style="color: #0f172a; text-transform: uppercase;">Datos del Comprador</strong><br>
              <strong>Nombre:</strong> ${client?.nombre || 'N/A'}<br>
              <strong>RUT:</strong> ${client?.rut || 'N/A'}<br>
              <strong>Dirección / Terreno:</strong> ${client?.domicilio || 'N/A'}<br>
              <strong>Teléfono:</strong> ${client?.telefono || 'N/A'}<br>
              <strong>Correo:</strong> ${client?.correo || 'N/A'}
            </div>
            <div class="box">
              <strong style="color: #0f172a; text-transform: uppercase;">Detalles del Proyecto</strong><br>
              <strong>Modalidad:</strong> ${b.es_combinacion_modelos ? 'Combinación Multi-Modelo Modular' : 'Modelo Individual'}<br>
              <strong>Modelo / Composición:</strong> ${modelName}<br>
              <strong>Superficie Total:</strong> ${b.superficie_m2 || 36} m²<br>
              ${b.es_combinacion_modelos && b.modelos_combinados ? `<strong>Módulos Combinados (${b.modelos_combinados.length}):</strong> ${b.modelos_combinados.map(m => `${m.nombre} (${m.superficie_m2}m² - $${m.valor_m2.toLocaleString('es-CL')}/m²)`).join('; ')}<br>` : ''}
              <strong>Plazo Montaje:</strong> ${b.plazo_instalacion_dias || 30} días hábiles<br>
              <strong>Forma de Pago:</strong> ${b.forma_pago} (${b.cuotas || 4} cuotas)
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Descripción de Partida / Especificación</th>
                <th style="text-align: right;">Cantidad</th>
                <th style="text-align: right;">Unitario</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="total-card">
            <div class="total-title">Total Presupuestado (IVA Incluido)</div>
            <div class="total-val">$${b.monto_total.toLocaleString('es-CL')} CLP</div>
          </div>

          <div class="footer">
            <p>Validez de la cotización: 15 días hábiles a partir de la fecha de emisión. Precios sujetos a verificación de terreno y accesos para descarga de camiones.</p>
          </div>

          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const selectedClient = clients.find(c => c.id === formData.cliente_id);

  if (isEditing) {
    const calculatedBaseTotal = formData.es_anexo ? 0 : Math.round((formData.superficie_m2 || 36) * valorM2Input);
    const calculatedAdicionalesTotal = formData.detalle_items
      .filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0)
      .reduce((sum, item) => sum + item.total, 0);

    return (
      <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-slate-200 animate-in slide-in-from-bottom-4 duration-200 space-y-6">
        {/* Stepper Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border",
                formData.es_anexo 
                  ? "bg-blue-50 text-blue-800 border-blue-200" 
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              )}>
                {formData.es_anexo ? "Anexo Adicional" : "Paso 3: Personalización & Presupuesto"}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mt-1 flex items-center gap-2">
              <Calculator className="text-emerald-600" />
              {formData.es_anexo 
                ? 'Presupuesto de Obras y Modificaciones Adicionales (Anexo)' 
                : 'Cotizador y Presupuesto por Metro Cuadrado'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-2 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <Save size={15} />
              <span>Guardar Borrador</span>
            </button>
          </div>
        </div>

        {/* Project Mode Selector (Single vs Multi-Model Combination) */}
        {!formData.es_anexo && (
          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Home size={15} className="text-emerald-600" />
                Modalidad de Proyecto Prefabricado
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                Permite seleccionar un modelo único o combinar y personalizar múltiples modelos (ej. Casa Principal + Cabaña Invitados o Quincho).
              </p>
            </div>

            <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleToggleMultiModelMode(false)}
                className={cn(
                  "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5",
                  !isMultiModelMode
                    ? "bg-white text-emerald-800 shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Home size={14} />
                <span>Modelo Individual</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleMultiModelMode(true)}
                className={cn(
                  "flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5",
                  isMultiModelMode
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Layers size={14} />
                <span>Combinar Varios Modelos</span>
                {combinedModules.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 bg-emerald-800 text-white text-[10px] font-black rounded-full">
                    {combinedModules.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Client & Model Selection Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-700 mb-1">Cliente *</label>
            <select
              required
              value={formData.cliente_id}
              onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">-- Seleccionar Comprador --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre} (RUT: {c.rut}) {c.comuna ? `- ${c.comuna}` : ''}
                </option>
              ))}
            </select>
            {selectedClient && (
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                📍 Terreno: {selectedClient.domicilio} {selectedClient.rol_propiedad ? `(ROL: ${selectedClient.rol_propiedad})` : ''}
              </p>
            )}
          </div>

          {!isMultiModelMode && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase text-slate-700">
                  {formData.es_anexo ? 'Modelo Asociado al Contrato' : 'Modelo de Casa Seleccionado *'}
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Cambio Rápido de Modelo
                </span>
              </div>
              <select
                required={!formData.es_anexo}
                value={formData.proyecto_id}
                onChange={(e) => handleModelChange(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="">-- Seleccionar o Cambiar Modelo Madecas --</option>
                {houseModels.map(hm => (
                  <option key={hm.id} value={hm.id}>
                    {hm.nombre} ({hm.superficie_m2} m²) - {hm.categoria || 'Catálogo'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isMultiModelMode && (
            <div className="flex flex-col justify-center">
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                Estructura de la Combinación
              </label>
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center justify-between">
                <span>{combinedModules.length} módulos integrados</span>
                <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[11px]">
                  {formData.superficie_m2 || 0} m² totales
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Multi-Model Combination Builder */}
        {!formData.es_anexo && isMultiModelMode && (
          <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/70 border-2 border-emerald-300/80 p-5 rounded-2xl space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-3">
              <div>
                <span className="text-xs font-black uppercase text-emerald-950 flex items-center gap-1.5 tracking-wide">
                  <Layers size={16} className="text-emerald-700" />
                  Módulos y Modelos Combinados para el Proyecto
                </span>
                <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  Personaliza cada modelo, su rol arquitectónico (ej: Principal, Cabaña, Quincho), superficie y valor por metro.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {formData.superficie_m2 && formData.superficie_m2 >= MADECAS_PROMO_THRESHOLD_M2 && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-extrabold shadow-sm">
                    <Gift size={13} />
                    Promo Pintura Gratis ({formData.superficie_m2} m² ≥ 66 m²)
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleAddCombinedModule}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition"
                >
                  <Plus size={14} />
                  <span>+ Agregar Módulo</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {combinedModules.map((mod, idx) => (
                <div
                  key={mod.id || idx}
                  className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  {/* Left: Thumbnail & Model Picker */}
                  <div className="flex items-center gap-3 flex-1 min-w-0 w-full md:w-auto">
                    {mod.imagen_url && (
                      <img
                        src={mod.imagen_url}
                        alt={mod.nombre}
                        className="w-16 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">
                          Módulo {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={mod.rol || ''}
                          placeholder="Rol (ej: Vivienda Principal, Cabaña, Quincho)"
                          onChange={(e) => handleUpdateCombinedModule(idx, { rol: e.target.value })}
                          className="text-xs font-bold text-slate-700 border-b border-dashed border-slate-300 focus:border-emerald-600 outline-none px-1 py-0.5"
                        />
                      </div>
                      <select
                        value={mod.model_id}
                        onChange={(e) => handleUpdateCombinedModule(idx, { model_id: e.target.value })}
                        className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus:ring-1 focus:ring-emerald-500 outline-none"
                      >
                        {houseModels.map(hm => (
                          <option key={hm.id} value={hm.id}>
                            {hm.nombre} ({hm.superficie_m2} m²) - {hm.categoria}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Right: Metrics (m2, valor_m2, subtotal) & Delete */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">m²:</span>
                      <input
                        type="number"
                        min="1"
                        value={mod.superficie_m2}
                        onChange={(e) => handleUpdateCombinedModule(idx, { superficie_m2: Number(e.target.value) })}
                        className="w-16 text-center text-xs font-black text-slate-800 bg-slate-50 border border-slate-300 rounded-lg py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">$/m²:</span>
                      <input
                        type="number"
                        step="1000"
                        min="0"
                        value={mod.valor_m2}
                        onChange={(e) => handleUpdateCombinedModule(idx, { valor_m2: Number(e.target.value) })}
                        className="w-24 text-right text-xs font-black text-slate-800 bg-slate-50 border border-slate-300 rounded-lg py-1.5 px-2 outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="text-right min-w-[110px]">
                      <span className="text-[9px] font-bold uppercase text-slate-400 block">Subtotal</span>
                      <span className="text-sm font-black text-emerald-800">
                        ${mod.subtotal.toLocaleString('es-CL')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveCombinedModule(idx)}
                      disabled={combinedModules.length <= 1}
                      className={cn(
                        "p-1.5 rounded-lg transition",
                        combinedModules.length <= 1
                          ? "text-slate-300 cursor-not-allowed"
                          : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                      )}
                      title={combinedModules.length <= 1 ? "Mínimo 1 módulo" : "Eliminar módulo"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Aggregated Multi-Model Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Superficie Total Combinada</span>
                <p className="text-lg font-black text-slate-800 mt-0.5">
                  {formData.superficie_m2 || 0} <span className="text-xs font-bold text-slate-500">m²</span>
                </p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Valor Promedio por m²</span>
                <p className="text-lg font-black text-slate-800 mt-0.5">
                  ${(formData.valor_m2 || 0).toLocaleString('es-CL')} <span className="text-xs font-bold text-slate-500">CLP</span>
                </p>
              </div>

              <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Subtotal Módulos Base</span>
                <p className="text-xl font-black mt-0.5">
                  ${(formData.monto_base_modelo || 0).toLocaleString('es-CL')} <span className="text-xs font-normal opacity-90">CLP</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Calculation Panel (m2 x valor_m2) for Single Model */}
        {!formData.es_anexo && !isMultiModelMode && (
          <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                  <Sliders size={16} className="text-emerald-700" />
                  Cálculo del Valor Base por Superficie (m²)
                </span>
                <p className="text-[11px] text-emerald-700">El valor se calcula multiplicando los metros cuadrados por el valor por metro convenido.</p>
              </div>

              {formData.superficie_m2 && formData.superficie_m2 >= MADECAS_PROMO_THRESHOLD_M2 && (
                <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-extrabold shadow-sm">
                  <Gift size={14} />
                  Promo: Pintura Antihongos Gratis (≥ 66 m²)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Superficie Total</span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    min="1"
                    value={formData.superficie_m2 || 36}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateBaseModelCalculation(val, valorM2Input);
                    }}
                    className="w-20 text-lg font-black text-slate-800 border-b-2 border-emerald-500 outline-none"
                  />
                  <span className="text-sm font-bold text-slate-500">m²</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-slate-400">Valor Convenido por m²</span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-bold text-slate-400">$</span>
                  <input
                    type="number"
                    step="1000"
                    value={valorM2Input}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setValorM2Input(val);
                      updateBaseModelCalculation(formData.superficie_m2 || 36, val);
                    }}
                    className="w-28 text-lg font-black text-slate-800 border-b-2 border-emerald-500 outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">CLP</span>
                </div>
              </div>

              <div className="bg-emerald-600 text-white p-3 rounded-xl shadow-sm flex flex-col justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Subtotal Casa Base</span>
                <p className="text-xl font-black mt-0.5">
                  ${calculatedBaseTotal.toLocaleString('es-CL')} <span className="text-xs font-normal opacity-90">CLP</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section: Official MADECAS Additional Improvements 2025 */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Wrench size={16} className="text-emerald-600" />
              Mejoramientos Adicionales de Construcción (Catálogo Oficial 2025)
            </h4>
            <span className="text-[11px] text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full w-fit">
              Ítems, m², precio/m² y totales 100% editables
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Marca las mejoras solicitadas para agregarlas automáticamente. Puedes personalizar el nombre de la partida, la cantidad de m², el precio unitario pactado y el monto total en tiempo real.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {MADECAS_ADICIONALES.map(adic => {
              const state = adicionalesState[adic.id];
              const isChecked = !!state?.selected;
              const appliedTitulo = state?.titulo || adic.titulo;
              const appliedM2 = state?.m2 !== undefined ? state.m2 : (formData.superficie_m2 || 36);
              const appliedPrecioM2 = state?.precio_m2 !== undefined ? state.precio_m2 : adic.precio_m2;
              const itemTotal = state?.total !== undefined ? state.total : Math.round(appliedM2 * appliedPrecioM2);

              return (
                <div
                  key={adic.id}
                  className={cn(
                    "p-4 rounded-xl border transition-all flex flex-col justify-between gap-3",
                    isChecked 
                      ? "bg-emerald-50/70 border-emerald-300 shadow-sm ring-1 ring-emerald-400" 
                      : "bg-white border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      id={`chk_${adic.id}`}
                      checked={isChecked}
                      onChange={() => handleToggleAdicional(adic.id)}
                      className="mt-1 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <label 
                          htmlFor={`chk_${adic.id}`} 
                          className="text-xs font-bold text-slate-800 cursor-pointer hover:text-emerald-700 leading-snug"
                        >
                          {adic.titulo}
                        </label>
                        <span className="text-[11px] font-black text-emerald-700 whitespace-nowrap bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                          Catálogo: ${adic.precio_m2.toLocaleString('es-CL')}/m²
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {adic.descripcion}
                      </p>
                    </div>
                  </div>

                  {isChecked && (
                    <div className="mt-1 p-3 bg-white/95 rounded-xl border border-emerald-200 shadow-xs space-y-2.5 text-xs animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase text-emerald-800 border-b border-emerald-100 pb-1.5">
                        <span className="flex items-center gap-1">
                          <Sliders size={13} className="text-emerald-600" />
                          Modificar Valores de la Partida
                        </span>
                        {(appliedPrecioM2 !== adic.precio_m2 || appliedM2 !== (formData.superficie_m2 || 36) || appliedTitulo !== adic.titulo) && (
                          <button
                            type="button"
                            onClick={() => handleResetAdicional(adic.id)}
                            className="text-[10px] text-slate-500 hover:text-emerald-700 underline font-semibold transition"
                          >
                            Restablecer a sugeridos
                          </button>
                        )}
                      </div>

                      {/* Editable Item Title */}
                      <div>
                        <label className="text-[10px] font-bold uppercase text-slate-600 mb-0.5 block">
                          Ítem / Nombre de la Partida
                        </label>
                        <input
                          type="text"
                          value={appliedTitulo}
                          onChange={(e) => handleUpdateAdicional(adic.id, { titulo: e.target.value })}
                          placeholder="Nombre personalizado de la partida..."
                          className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                        />
                      </div>

                      {/* 3 Editable Fields: Cantidad m2, Precio/m2, Total */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 mb-0.5 block">
                            Cantidad (m²)
                          </label>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition">
                            <input
                              type="number"
                              min="0.1"
                              step="any"
                              value={appliedM2}
                              onChange={(e) => handleUpdateAdicional(adic.id, { m2: Number(e.target.value) })}
                              className="w-full text-xs font-black text-slate-800 outline-none bg-transparent"
                            />
                            <span className="text-[10px] font-bold text-slate-400">m²</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 mb-0.5 block">
                            Precio por m² ($)
                          </label>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition">
                            <span className="text-[10px] font-bold text-slate-400">$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={appliedPrecioM2}
                              onChange={(e) => handleUpdateAdicional(adic.id, { precio_m2: Number(e.target.value) })}
                              className="w-full text-xs font-black text-slate-800 outline-none bg-transparent text-right"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-slate-600 mb-0.5 block">
                            Total Partida ($)
                          </label>
                          <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-300 rounded-lg p-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition">
                            <span className="text-[10px] font-bold text-emerald-600">$</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={itemTotal}
                              onChange={(e) => handleUpdateAdicional(adic.id, { total: Number(e.target.value) })}
                              className="w-full text-xs font-black text-emerald-800 outline-none bg-transparent text-right"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                        <span>Fórmula: {appliedM2} m² × ${appliedPrecioM2.toLocaleString('es-CL')}/m²</span>
                        <strong className="text-emerald-700 font-black">= ${itemTotal.toLocaleString('es-CL')} CLP</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Items Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-slate-600" />
              Desglose Completo de Partidas del Presupuesto
            </h4>
            <span className="text-xs font-bold text-slate-500">
              Total Ítems: {formData.detalle_items.length} (Edición directa disponible en cada fila)
            </span>
          </div>

          <BudgetTable
            items={formData.detalle_items}
            isLocked={false}
            onRemove={handleRemoveItem}
            onUpdate={handleUpdateItem}
          />
        </div>

        {/* Add Custom Item Row */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Plus size={15} className="text-emerald-600" />
            Agregar Otra Partida Personalizada (ej: Cerámica, Fosas sépticas, Ventanas termopanel extra, Radier exterior)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Descripción de la partida (ej: Cerámica en pisos, Fosa séptica)..."
              value={newItem.descripcion}
              onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
              className="sm:col-span-5 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
            <input
              type="number"
              min="0.1"
              step="any"
              placeholder="Cant."
              value={newItem.cantidad || ''}
              onChange={(e) => {
                const c = Number(e.target.value);
                setNewItem({ ...newItem, cantidad: c, total: Math.round(c * (newItem.precio_unitario || 0)) });
              }}
              className="sm:col-span-2 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none text-center font-bold"
            />
            <select
              value={newItem.unidad || 'm2'}
              onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
              className="sm:col-span-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none font-bold text-slate-700"
            >
              <option value="m2">m²</option>
              <option value="gl">gl</option>
              <option value="un">un</option>
              <option value="ml">ml</option>
            </select>
            <input
              type="number"
              min="0"
              placeholder="Precio Unitario CLP"
              value={newItem.precio_unitario || ''}
              onChange={(e) => {
                const p = Number(e.target.value);
                setNewItem({ ...newItem, precio_unitario: p, total: Math.round((newItem.cantidad || 1) * p) });
              }}
              className="sm:col-span-3 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none font-bold"
            />
            <button
              type="button"
              onClick={handleAddCustomItem}
              className="sm:col-span-1 p-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center justify-center transition shadow-xs"
              title="Agregar Partida"
            >
              <Plus size={16} />
            </button>
          </div>
          {newItem.cantidad > 0 && newItem.precio_unitario > 0 && (
            <p className="text-[11px] text-emerald-700 font-bold">
              Subtotal calculado: {newItem.cantidad} {newItem.unidad || 'm²'} × ${newItem.precio_unitario.toLocaleString('es-CL')} = ${(newItem.cantidad * newItem.precio_unitario).toLocaleString('es-CL')} CLP
            </p>
          )}
        </div>

        {/* Final Financial Summary & Conversion to Contract */}
        <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-1 text-center md:text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Resumen Final Consolidado
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
              {!formData.es_anexo && (
                <span>Base: <strong>${calculatedBaseTotal.toLocaleString()}</strong></span>
              )}
              <span>Adicionales: <strong>${calculatedAdicionalesTotal.toLocaleString()}</strong></span>
              <span>Plazo: <strong>{formData.plazo_instalacion_dias || 30} días</strong></span>
            </div>
            <p className="text-3xl font-black text-white">
              ${formData.monto_total.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-400">CLP (IVA Incluido)</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={() => handleSave()}
              className="flex-1 md:flex-none px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Save size={16} />
              <span>Guardar Presupuesto</span>
            </button>

            <button
              type="button"
              onClick={handleProceedToContract}
              className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-emerald-900 flex items-center justify-center gap-2"
            >
              <span>{formData.es_anexo ? 'Generar Anexo al Contrato' : 'Avanzar a Contrato Legal'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <Calculator className="text-emerald-600" />
            Cotizaciones y Presupuestos Técnicos
          </h2>
          <p className="text-slate-500 text-xs font-medium mt-1">
            Gestión comercial de presupuestos base calculados por m² y anexos de obras adicionales.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente o folio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <button
            onClick={handleNew}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 transition shadow-sm whitespace-nowrap"
          >
            <Plus size={16} />
            <span>Nuevo Presupuesto</span>
          </button>
        </div>
      </div>

      {/* Budgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredBudgets.map(b => {
          const client = clients.find(c => c.id === b.cliente_id);
          const model = houseModels.find(m => m.id === b.proyecto_id) || projects.find(p => p.id === b.proyecto_id) as any;
          const modelName = model ? (model.nombre || model.modelo) : 'Personalizado';

          return (
            <div
              key={b.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                      "text-[10px] font-black uppercase px-2 py-0.5 rounded-md",
                      b.es_anexo ? "bg-blue-50 text-blue-800 border border-blue-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    )}>
                      {b.es_anexo ? "Anexo Adicional" : `Folio: ${b.id.slice(0, 8).toUpperCase()}`}
                    </span>
                    {b.es_combinacion_modelos && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <Layers size={10} />
                        Modular ({b.modelos_combinados?.length || 2} mód)
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">{b.fecha}</span>
                </div>

                <h3 className="text-base font-black text-slate-800 leading-tight">
                  {client?.nombre || 'Cliente sin asignar'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  RUT: {client?.rut || 'N/A'} • {client?.comuna || 'Los Lagos'}
                </p>

                <div className="mt-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>{b.es_combinacion_modelos ? 'Composición:' : 'Modelo:'}</span>
                    <strong className="text-slate-800 truncate max-w-[160px]">{modelName}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Superficie:</span>
                    <strong>{b.superficie_m2 || 36} m² {b.es_combinacion_modelos ? '(Combinada)' : ''}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Partidas:</span>
                    <span>{b.detalle_items.length} partidas</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between pt-2 border-t border-slate-100 mb-3">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Total Cotizado</span>
                  <span className="text-xl font-black text-slate-800">
                    ${b.monto_total.toLocaleString('es-CL')} <span className="text-xs font-normal text-slate-400">CLP</span>
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintBudget(b)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                    title="Imprimir Presupuesto"
                  >
                    <FileText size={15} />
                  </button>
                  <button
                    onClick={() => loadBudgetToEdit(b)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                  >
                    <Edit3 size={14} />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => {
                      window.localStorage.setItem('pending_contract_budget_id', b.id);
                      if (b.es_anexo && b.parent_contract_id) {
                        window.localStorage.setItem('pending_anexo_contract_id', b.parent_contract_id);
                      }
                      window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'contracts' }));
                    }}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>Generar Contrato</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredBudgets.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Calculator size={36} className="mx-auto text-slate-300 mb-2" />
            <h4 className="text-slate-700 font-bold text-sm">No se encontraron presupuestos</h4>
            <p className="text-slate-400 text-xs mt-1">Crea una nueva cotización calculando por m² o selecciona un modelo del catálogo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetManager;