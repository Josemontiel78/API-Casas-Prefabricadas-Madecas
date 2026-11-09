
import React, { useState, useEffect, useRef } from 'react';
import { Contract, Budget, Client, Project, Vendor, ContractStatus, PaymentInstallment, HouseModel } from '@/types';
import { getContracts, saveContract, getBudgets, getClients, getProjects, getVendor, deleteContract, subscribeToContracts, subscribeToBudgets, subscribeToClients, subscribeToProjects, saveClient, subscribeToHouseModels } from '@/services/db';
import { generateContractText, numberToSpanishWords } from '@/services/gemini';
import { uuid, compressImage } from '@/lib/utils';
import { Sparkles, FileText, CheckCircle, Printer, Plus, PenTool, X, Calendar, Edit3, Eye, FileType, Trash2, Maximize2, AlertCircle, Calculator, ArrowRight, Upload, Image as ImageIcon, DollarSign } from 'lucide-react';

// Input assets provided by the user
const getSafeInputFile = (name: string): string => {
  try {
    return (window as any)[name] || '';
  } catch (e) {
    return '';
  }
};

const getLatestFiles = (): string[] => {
  const files: string[] = [];
  // Increased range to find most recent uploads
  for (let i = 40; i >= 0; i--) {
    const file = getSafeInputFile(`input_file_${i}`);
    if (file) files.push(file);
  }
  return files;
};

const getLogoFile = (): string => {
  const files = getLatestFiles();
  return files[1] || files[0] || '';
};

const getWatermarkFile = (): string => {
  const files = getLatestFiles();
  return files[0] || '';
};

import { MADECAS_LOGO_SVG, MADECAS_LOGO_HEADER_SVG, MADECAS_FOOTER_SVG } from '@/constants/assets';

const ContractManager: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Dependencies for selection
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [houseModels, setHouseModels] = useState<HouseModel[]>([]);
  const [vendor, setVendor] = useState<Vendor | null>(null);

  // Form State
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState('');
  const [plazoInstalacion, setPlazoInstalacion] = useState(30);
  const [lugarSuscripcion, setLugarSuscripcion] = useState('Osorno');
  const [metodoPago, setMetodoPago] = useState<Contract['metodo_pago']>('Transferencia');
  const [payments, setPayments] = useState<PaymentInstallment[]>([
    { descripcion: '30% - FIRMA DE CONTRATO (TRANSFERENCIA)', porcentaje: 30, monto: 0 },
    { descripcion: '30% - ENTREGA DE RADIER CON ARRANQUES SANITARIOS', porcentaje: 30, monto: 0 },
    { descripcion: '30% - MOMENTO DE ENTREGA PANELES Y CERCHAS INSTALADAS', porcentaje: 30, monto: 0 },
    { descripcion: '10% - CONTRA ENTREGA FINAL (MAX 5 DÍAS HÁBILES)', porcentaje: 10, monto: 0 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [expandedPaymentsContractId, setExpandedPaymentsContractId] = useState<string | null>(null);
  const [parentContractId, setParentContractId] = useState<string | null>(null);
  const [isAnexo, setIsAnexo] = useState(false);
  const [m2Warning, setM2Warning] = useState<string | null>(null);

  // Signing State
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [signerRole, setSignerRole] = useState<'cliente' | 'vendedor' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeContractForUpload, setActiveContractForUpload] = useState<string | null>(null);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);
  const [isDeletingContract, setIsDeletingContract] = useState(false);
  
  // Selection Logic Helpers
  const selectedBudget = budgets.find(b => b.id === selectedBudgetId);
  const selectedClient = selectedBudget ? clients.find(c => c.id === selectedBudget.cliente_id) : null;
  const selectedProject = selectedBudget ? (projects.find(p => p.id === selectedBudget.proyecto_id) || houseModels.find(m => m.id === selectedBudget.proyecto_id) as any) : null;

  useEffect(() => {
    if (selectedProject && selectedBudget) {
      const projectM2 = selectedProject.superficie_m2;
      const budgetM2 = selectedBudget.superficie_m2 || 0;
      
      if (budgetM2 > 0 && Math.abs(projectM2 - budgetM2) > 0.01) {
        const modelName = selectedProject.modelo || (selectedProject as any).nombre || 'Personalizada';
        setM2Warning(`Diferencia de m² detectada: El modelo (${modelName}) es de ${projectM2}m², pero el presupuesto indica ${budgetM2}m². El contrato se generará con la superficie del presupuesto.`);
      } else {
        setM2Warning(null);
      }
    } else {
      setM2Warning(null);
    }
  }, [selectedProject, selectedBudget]);

  useEffect(() => {
    const unsubContracts = subscribeToContracts((data) => setContracts(data));
    const unsubBudgets = subscribeToBudgets((data) => setBudgets(data));
    const unsubClients = subscribeToClients((data) => setClients(data));
    const unsubProjects = subscribeToProjects((data) => setProjects(data));
    const unsubHouseModels = subscribeToHouseModels ? (subscribeToHouseModels as any)((data: any) => setHouseModels(data)) : () => {};
    
    getVendor().then(setVendor);

    const timer = setTimeout(() => {
        // Check for pending contract from budget
        const pendingBudgetId = window.localStorage.getItem('pending_contract_budget_id');
        if (pendingBudgetId) {
            window.localStorage.removeItem('pending_contract_budget_id');
            setSelectedBudgetId(pendingBudgetId);
        }
    }, 1000);

    return () => {
        unsubContracts();
        unsubBudgets();
        unsubClients();
        unsubProjects();
        if (typeof unsubHouseModels === 'function') unsubHouseModels();
        clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (selectedBudget) {
      setPayments(prev => prev.map(p => ({
        ...p,
        monto: Math.round(selectedBudget.monto_total * (p.porcentaje / 100))
      })));
      
      // Inherit plazos/locations if budget has them
      if (selectedBudget.plazo_instalacion_dias) setPlazoInstalacion(selectedBudget.plazo_instalacion_dias);
      if (selectedBudget.lugar_suscripcion) setLugarSuscripcion(selectedBudget.lugar_suscripcion);
      if (selectedBudget.fecha_inicio_obra) setStartDate(selectedBudget.fecha_inicio_obra);
    }
  }, [selectedBudget]);

  // Calculations for validation
  const totalPercentage = payments.reduce((sum, p) => sum + p.porcentaje, 0);
  const totalAmount = payments.reduce((sum, p) => sum + p.monto, 0);
  const budgetAmount = selectedBudget ? selectedBudget.monto_total : 0;
  const isTotalValid = Math.abs(totalPercentage - 100) < 0.1; // Float tolerance

  const togglePaymentStatus = async (contract: Contract, paymentIdx: number) => {
    const updatedPayments = [...contract.pautas_pago];
    updatedPayments[paymentIdx] = {
        ...updatedPayments[paymentIdx],
        pagado: !updatedPayments[paymentIdx].pagado,
        fecha_pago: !updatedPayments[paymentIdx].pagado ? new Date().toISOString() : undefined
    };

    const updatedContract = { ...contract, pautas_pago: updatedPayments };
    
    // Check if fully paid
    const allPaid = updatedPayments.every(p => p.pagado);
    if (allPaid) {
        updatedContract.estado = ContractStatus.COMPLETED;
    } else if (contract.estado === ContractStatus.COMPLETED) {
        updatedContract.estado = ContractStatus.SIGNED;
    }

    await saveContract(updatedContract);
  };

  const handleGenerate = async () => {
    if (!selectedClient || !selectedProject || !selectedBudget || !vendor) {
        let missing = [];
        if (!selectedClient) missing.push("Cliente");
        if (!selectedProject) missing.push("Proyecto/Modelo");
        if (!selectedBudget) missing.push("Presupuesto");
        if (!vendor) missing.push("Datos del Vendedor");
        
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `Faltan datos requeridos para generar: ${missing.join(', ')}`, type: 'info' } 
        }));
        return;
    }

    if (!startDate) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Debe ingresar la fecha de inicio de obra', type: 'error' } 
        }));
        return;
    }

    const partsC = contractDate.split('-');
    const partsS = startDate.split('-');
    let dateC = new Date();
    if (partsC.length === 3) {
      dateC = new Date(parseInt(partsC[0], 10), parseInt(partsC[1], 10) - 1, parseInt(partsC[2], 10));
    } else {
      dateC = new Date(contractDate);
    }
    let dateS = new Date();
    if (partsS.length === 3) {
      dateS = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10));
    } else {
      dateS = new Date(startDate);
    }

    dateC.setHours(0, 0, 0, 0);
    dateS.setHours(0, 0, 0, 0);

    if (dateS <= dateC) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'La fecha de inicio de obra debe ser posterior a la fecha del contrato.', type: 'error' } 
        }));
        return;
    }

    if (!isTotalValid) {
      window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `Los porcentajes suman ${totalPercentage}%. Deben sumar exactamente 100%.`, type: 'error' } 
      }));
      return;
    }

    setIsGenerating(true);
    setGeneratedText('');
    
    try {
        const text = await generateContractText(
            selectedClient!, 
            vendor!, 
            selectedProject!, 
            selectedBudget!, 
            payments, 
            startDate,
            plazoInstalacion,
            lugarSuscripcion,
            isAnexo
        );
        
        const contractParts = contractDate.split('-');
        let dateObj: Date;
        if (contractParts.length === 3) {
            dateObj = new Date(parseInt(contractParts[0], 10), parseInt(contractParts[1], 10) - 1, parseInt(contractParts[2], 10));
        } else {
            dateObj = new Date(contractDate);
        }
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const dateStringLiteral = `${dateObj.getDate()} de ${months[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;
        const dateShort = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
        
        let finalText = text;
        if (finalText.includes('[FECHA_LARGA]')) {
            finalText = finalText.replaceAll('[FECHA_LARGA]', `${dateShort} ${dateStringLiteral}`);
        } else if (finalText.includes('[FECHA]')) {
             finalText = finalText.replaceAll('[FECHA]', `${dateShort} ${dateStringLiteral}`);
        }
        
        if (finalText.includes('[FECHA_INICIO]')) {
            const startParts = startDate.split('-');
            let startObj: Date;
            if (startParts.length === 3) {
                startObj = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
            } else {
                startObj = new Date(startDate);
            }
            const startString = `${startObj.getDate()} de ${months[startObj.getMonth()]} de ${startObj.getFullYear()}`;
            finalText = finalText.replaceAll('[FECHA_INICIO]', startString);
        }

        if (text.startsWith("Error de conexión con IA")) {
             window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: 'Error con Gemini. Revise la consola.', type: 'error' } 
            }));
            setViewMode('edit');
        } else {
            window.dispatchEvent(new CustomEvent('app-notification', { 
                detail: { message: 'Contrato generado.', type: 'success' } 
            }));
            setViewMode('preview');
        }
        setGeneratedText(finalText);
    } catch (err) {
        console.error(err);
        setGeneratedText("Error al generar el contrato.");
        setViewMode('edit');
    } finally {
        setIsGenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedClient || !selectedProject || !selectedBudget || !vendor) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: `Faltan datos requeridos para guardar.`, type: 'error' } 
        }));
        return;
    }

    if (!startDate) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Debe ingresar la fecha de inicio de obra', type: 'error' } 
        }));
        return;
    }

    const partsC = contractDate.split('-');
    const partsS = startDate.split('-');
    let dateC = new Date();
    if (partsC.length === 3) {
      dateC = new Date(parseInt(partsC[0], 10), parseInt(partsC[1], 10) - 1, parseInt(partsC[2], 10));
    } else {
      dateC = new Date(contractDate);
    }
    let dateS = new Date();
    if (partsS.length === 3) {
      dateS = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10));
    } else {
      dateS = new Date(startDate);
    }

    dateC.setHours(0, 0, 0, 0);
    dateS.setHours(0, 0, 0, 0);

    if (dateS <= dateC) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'La fecha de inicio de obra debe ser posterior a la fecha del contrato.', type: 'error' } 
        }));
        return;
    }
    
    let deliveryDate: Date;
    if (partsS.length === 3) {
        deliveryDate = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10));
    } else {
        deliveryDate = new Date(startDate);
    }
    let addedDays = 0;
    while (addedDays < plazoInstalacion) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        const day = deliveryDate.getDay();
        if (day !== 0 && day !== 6) addedDays++; // Mon-Fri
    }

    const deliveryYear = deliveryDate.getFullYear();
    const deliveryMonth = String(deliveryDate.getMonth() + 1).padStart(2, '0');
    const deliveryDay = String(deliveryDate.getDate()).padStart(2, '0');
    const deliveryDateStr = `${deliveryYear}-${deliveryMonth}-${deliveryDay}`;

    // Create or update the contract record with SNAPSHOTS
    const contractData: Contract = {
      id: editingContractId || uuid(),
      cliente_id: selectedClient.id,
      vendedor_id: vendor.id,
      proyecto_id: selectedProject.id,
      presupuesto_id: selectedBudget.id,
      fecha_contrato: contractDate,
      monto_total: selectedBudget.monto_total,
      metodo_pago: metodoPago,
      cuotas_pago: payments.length,
      estado_pago: 'Pendiente',
      hitos_pago: payments,
      pautas_pago: payments.map(p => ({ ...p, pagado: false })),
      estado: ContractStatus.GENERATED,
      contenido_texto: generatedText,
      
      // Plazos y Fechas
      plazo_instalacion_dias: plazoInstalacion,
      fecha_inicio_obra: startDate,
      fecha_entrega_estimada: deliveryDateStr,
      lugar_suscripcion: lugarSuscripcion,
      
      cliente_snapshot: selectedClient,
      proyecto_snapshot: selectedProject,
      presupuesto_snapshot: selectedBudget,
      es_anexo: isAnexo,
      parent_contract_id: parentContractId || undefined,
      es_combinacion_modelos: selectedBudget.es_combinacion_modelos,
      modelos_combinados: selectedBudget.modelos_combinados
    };

    await saveContract(contractData);
    
    // Update Client Stage to Cierre
    if (selectedClient) {
      await saveClient({
        ...selectedClient,
        etapa_venta: 'Cierre'
      });
    }

    setIsCreating(false);
    setEditingContractId(null);
    setParentContractId(null);
    setIsAnexo(false);
    setSelectedBudgetId('');
    setGeneratedText('');
    setStartDate('');
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Contrato registrado en base de datos', type: 'success' } 
    }));
  };

  const handleDelete = (id: string) => {
    setContractToDelete(id);
  };

  const confirmDeleteContract = async () => {
    if (!contractToDelete) return;
    setIsDeletingContract(true);
    try {
      await deleteContract(contractToDelete);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Contrato eliminado exitosamente', type: 'info' } 
      }));
      setContractToDelete(null);
    } catch (err) {
      console.error("Error al eliminar contrato:", err);
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'No se pudo eliminar el contrato', type: 'error' } 
      }));
    } finally {
      setIsDeletingContract(false);
    }
  };

  const handleEditSavedContract = (contract: Contract) => {
    setEditingContractId(contract.id);
    setIsAnexo(contract.es_anexo || false);
    setParentContractId(contract.parent_contract_id || null);
    setSelectedBudgetId(contract.presupuesto_id || '');
    setGeneratedText(contract.contenido_texto);
    setContractDate(contract.fecha_contrato);
    setStartDate(contract.fecha_inicio_obra || '');
    setPlazoInstalacion(contract.plazo_instalacion_dias || 30);
    setLugarSuscripcion(contract.lugar_suscripcion || 'Osorno');
    setMetodoPago(contract.metodo_pago);
    setPayments(contract.hitos_pago);
    setIsCreating(true);
    setViewMode('edit');
  };

  const handleCreateAnnex = (contract: Contract) => {
    setParentContractId(contract.id);
    setIsAnexo(true);
    setEditingContractId(null);
    setSelectedBudgetId(contract.presupuesto_id || '');
    
    const sortedContracts = [...contracts].sort((a, b) => a.fecha_contrato.localeCompare(b.fecha_contrato));
    const parentIdx = sortedContracts.findIndex(c => c.id === contract.id) + 1;
    const parentSeqText = parentIdx > 0 ? String(parentIdx).padStart(3, '0') : '001';
    const cli = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const today = new Date();
    const todayStr = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

    const contractBudget = contract.presupuesto_snapshot || budgets.find(b => b.id === contract.presupuesto_id);
    const adicItems = (contractBudget?.detalle_items || []).filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0);
    const adicTotal = adicItems.reduce((s, i) => s + i.total, 0);

    const adicListText = adicItems.length > 0
      ? adicItems.map(i => `- ${i.descripcion.toUpperCase()} | Cantidad: ${i.cantidad} ${i.unidad || 'un'} | Precio Unitario: $${i.precio_unitario.toLocaleString('es-CL')} CLP | Subtotal: $${i.total.toLocaleString('es-CL')} CLP`).join('\n')
      : `- [Indicar obras adicionales solicitadas: Radier reforzado con zapata 40x40, encamisado OSB en paredes o techumbre, vigas a la vista en living-comedor y cocina, o revestimiento exterior en Siding/Norway]
- [Detallar especificaciones de materiales y partidas requeridas con cantidad, precio unitario y total]`;

    const totalText = adicTotal > 0 
      ? `$${adicTotal.toLocaleString('es-CL')} CLP (${numberToSpanishWords(adicTotal)} pesos chilenos)` 
      : `$${contract.monto_total.toLocaleString('es-CL')} CLP`;

    // Formal legal Annex template according to Chilean legislation
    setGeneratedText(`ANEXO N° 01 AL CONTRATO DE COMPRAVENTA E INSTALACIÓN N° ${parentSeqText}
INVERSIONES E&E SPA Y ${(cli?.nombre || 'EL COMPRADOR').toUpperCase()}

En Osorno, a ${todayStr}, entre INVERSIONES E&E SPA, del Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 78.210.119-6 representada por don EDUARDO HUMBERTO SOTO ALVARADO RUT 15.272.818-2, domiciliado para estos efectos en RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Comuna de Osorno, en adelante "EL VENDEDOR", por una parte; y don (a) ${(cli?.nombre || 'COMPRADOR').toUpperCase()}, RUT ${cli?.rut || ''}, domiciliado en ${(cli?.domicilio || '').toUpperCase()}, Teléfono: ${cli?.telefono || ''}, en adelante "EL COMPRADOR", por la otra; se conviene el presente ANEXO ACCESORIO AL CONTRATO PRINCIPAL DE COMPRAVENTA N° ${parentSeqText} de fecha ${contract.fecha_contrato}:

PRIMERO: ANTECEDENTES
Con fecha ${contract.fecha_contrato}, las partes suscribieron contrato de compraventa e instalación de vivienda prefabricada en el terreno ubicado en ${(cli?.domicilio || '').toUpperCase()}${cli?.rol_propiedad ? `, Rol de Avalúo SII N° ${cli.rol_propiedad}` : ''}${cli?.comuna ? `, Comuna de ${cli.comuna}` : ''}.

SEGUNDO: OBRAS Y MEJORAMIENTOS ADICIONALES
A expresa solicitud del COMPRADOR, y fuera del alcance originalmente pactado en el contrato principal, se conviene la ejecución de las siguientes OBRAS Y MEJORAMIENTOS ADICIONALES:
${adicListText}

TERCERO: PRECIO Y FORMA DE PAGO DE LOS ADICIONALES
El valor de las obras adicionales pactadas en el presente anexo asciende a la suma de ${totalText} (IVA incluido), el cual el COMPRADOR pagará de la siguiente forma:
a) 50% al momento de suscripción del presente anexo complementario.
b) 50% una vez finalizada la ejecución de los adicionales pactados a entera satisfacción.

CUARTO: PLAZO DE EJECUCIÓN
Las partes acuerdan que las presentes obras se ejecutarán dentro del plazo estipulado para la obra principal, o con una prórroga de ... días hábiles adicionales si las condiciones técnicas o climáticas lo requiriesen.

QUINTO: RATIFICACIÓN Y PLENA VIGENCIA
En todo lo no expresamente modificado o complementado por el presente anexo, permanecen plenamente vigentes y ratificadas todas las estipulaciones, penalidades, garantías y cláusulas del contrato principal de compraventa N° ${parentSeqText}.

Para constancia de lo acordado, se suscribe en dos ejemplares del mismo tenor y fecha en Osorno.`);
    
    setContractDate(new Date().toISOString().split('T')[0]);
    setStartDate(contract.fecha_inicio_obra || '');
    setPlazoInstalacion(15);
    setLugarSuscripcion(contract.lugar_suscripcion || 'Osorno');
    setMetodoPago(contract.metodo_pago);
    setPayments([
      { descripcion: '50% - AL SUSCRIBIR ESTE ANEXO DE OBRAS ADICIONALES', porcentaje: 50, monto: 0 },
      { descripcion: '50% - CONTRA ENTREGA FINAL DE LAS OBRAS ADICIONALES', porcentaje: 50, monto: 0 }
    ]);
    
    setIsCreating(true);
    setViewMode('edit');
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Creando Anexo al Contrato. Edita las partidas o cuotas según lo acordado.', type: 'info' } 
    }));
  };

  // --- Payment Plan Editing Logic ---
  const updatePayment = (idx: number, field: 'porcentaje' | 'descripcion', value: string | number) => {
    if(!selectedBudget) return;
    setPayments(prev => {
        const next = [...prev];
        const currentItem = { ...next[idx] };
        
        if (field === 'porcentaje') {
            const pct = Number(value);
            currentItem.porcentaje = pct;
            currentItem.monto = Math.round(selectedBudget.monto_total * (pct / 100));
        } else {
            currentItem.descripcion = String(value);
        }
        
        next[idx] = currentItem;
        return next;
    });
  };

  const addPayment = () => {
      setPayments(prev => [...prev, { descripcion: 'Nuevo Pago', porcentaje: 0, monto: 0 }]);
  };

  const removePayment = (idx: number) => {
      setPayments(prev => prev.filter((_, i) => i !== idx));
  };

  const downloadWord = () => {
    if (!generatedText) return;
    const htmlContent = formatTextToHtml(generatedText.replace(/FIRMAS[\s\S]*$/i, '').trim());
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Contrato</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + htmlContent + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `Contrato_${selectedClient?.nombre || 'Borrador'}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  // --- Signature Logic ---
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const openSigningModal = (contract: Contract, role: 'cliente' | 'vendedor') => {
    setSigningContract(contract);
    setSignerRole(role);
    setTimeout(clearCanvas, 100); 
  };

  const saveSignature = async () => {
    if (!signingContract || !signerRole || !canvasRef.current) return;
    const signatureData = canvasRef.current.toDataURL('image/png');
    const updatedContract = { ...signingContract };
    if (signerRole === 'cliente') updatedContract.firma_cliente = signatureData;
    else updatedContract.firma_vendedor = signatureData;

    if (updatedContract.firma_cliente && updatedContract.firma_vendedor) {
      updatedContract.estado = ContractStatus.SIGNED;
      updatedContract.fecha_firma = new Date().toISOString();
    }
    await saveContract(updatedContract);
    setSigningContract(null);
    setSignerRole(null);
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Firma registrada correctamente', type: 'success' } 
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContractForUpload) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      let base64 = event.target?.result as string;
      
      // If image, compress it
      if (file.type.startsWith('image/')) {
        try {
          base64 = await compressImage(base64, 1200, 0.6);
        } catch (err) {
          console.error("Compression error:", err);
        }
      }

      const contract = contracts.find(c => c.id === activeContractForUpload);
      if (contract) {
        const updatedContract = { 
          ...contract, 
          documento_archivo_url: base64,
          documento_archivo_tipo: file.type.includes('pdf') ? 'PDF' : 'PHOTO' as any,
          fecha_escaneo: new Date().toISOString()
        };
        await saveContract(updatedContract);
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Documento cargado correctamente', type: 'success' } 
        }));
      }
      setActiveContractForUpload(null);
    };
    reader.readAsDataURL(file);
  };

  const triggerUpload = (contractId: string) => {
    setActiveContractForUpload(contractId);
    fileInputRef.current?.click();
  };

  const viewDocument = (url: string) => {
    const w = window.open('');
    if (w) {
        w.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  };

  const formatTextToHtml = (text: string) => {
    if (!text) return '';
    
        // Semantic highlighting patterns
        const highlightPatterns = [
            { regex: /R\.?U\.?T\.?:?\s?(\d{1,2}\.?\d{3}\.?\d{3}-[\dkK])/gi, replacement: '<span class="blue-text">$1</span>' },
            { regex: /((\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4}))/gi, replacement: '<strong class="blue-text">$1</strong>' },
            { regex: /(\$\s?\d{1,3}(\.\d{3})*(,\d+)?( \(.*?\))?)/g, replacement: '<strong class="blue-text">$1</strong>' },
            { regex: /(INVERSIONES E&E SPA|INVERSIONES E&E)/g, replacement: '<strong>$1</strong>' },
            { regex: /(SR\/A|don \(a\))\s+([A-ZÁÉÍÓÚÑ\s]{5,})/g, replacement: '$1 <strong class="blue-text underline">$2</strong>' }
        ];

        let processedText = text;
        highlightPatterns.forEach(p => {
            processedText = processedText.replace(p.regex, p.replacement);
        });

        const parts = processedText.split(/\n\n+/);
    
    return parts.map(part => {
        let content = part.trim();
        if (!content) return '';

        // Strip markdown bold markers, headers, or asterisks if they surround a clause name at the start
        content = content.replace(/^\s*\*\*(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SEPTIEMO|SÉPTIMO|OCTAVO|NOVENO|DECIMO|DÉCIMO|DECIMO PRIMERO|DÉCIMO PRIMERO|DECIMO SEGUNDO|DECIMO TERCERO)\s*:\*\*/i, '$1:');
        content = content.replace(/^\s*\*\*(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SEPTIEMO|SÉPTIMO|OCTAVO|NOVENO|DECIMO|DÉCIMO|DECIMO PRIMERO|DÉCIMO PRIMERO|DECIMO SEGUNDO|DECIMO TERCERO)\*\*\s*:/i, '$1:');
        content = content.replace(/^\s*###\s*(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SEPTIEMO|SÉPTIMO|OCTAVO|NOVENO|DECIMO|DÉCIMO|DECIMO PRIMERO|DÉCIMO PRIMERO|DECIMO SEGUNDO|DECIMO TERCERO)\s*:/i, '$1:');

        // Headers
        if (content.startsWith('# ')) {
             return `<h1 style="text-align:center; font-size:16pt; font-weight:bold; text-transform:uppercase; margin-bottom: 25px; text-decoration: underline;">${content.replace(/^# /, '')}</h1>`;
        }

        // Process bold markdown
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Handle lettered lists a) b) c) d) ... to j)
        if (/(^|\n)[a-j]\)/i.test(content)) {
            const items = content.split(/(^|\n)([a-j]\))/i);
            let reconstructed = '';
            let introductoryText = items[0].trim();
            
            for (let i = 1; i < items.length; i += 3) {
                // items structure: [pre, newline_if_any, marker, itemContent, ...]
                const marker = items[i+1];
                let itemContent = (items[i+2] || '').trim();
                itemContent = itemContent.replace(/^\s*[:,-]\s*/, '').trim();
                if (marker && itemContent) {
                    reconstructed += `<div style="margin-bottom: 12px; padding-left: 35px; text-indent: -25px; line-height: 1.6; text-align: justify;"><strong>${marker.toLowerCase()}</strong> ${itemContent}</div>`;
                }
            }
            
            if (reconstructed) {
                return `<div style="margin-bottom: 12px; text-align: justify; line-height: 1.6;">${introductoryText}</div>${reconstructed}`;
            }
        }

        // Technical specs or bullet points with dashes "-"
        if (content.includes('\n- ') || content.startsWith('- ') || content.includes('\n* ') || content.startsWith('* ')) {
            const lines = content.split('\n');
            let intro = [];
            let list = [];
            let inList = false;

            for (const line of lines) {
                if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                    inList = true;
                    list.push(line.trim().replace(/^[-*] /, ''));
                } else if (!inList) {
                    intro.push(line);
                } else {
                    // If we were in list and found a non-list line, add to current list item or start new intro?
                    // For contracts, usually it's intro then list.
                    list[list.length - 1] += ' ' + line.trim();
                }
            }

            const listHtml = list.map(item => `<li style="margin-bottom: 12px; text-align: justify; padding-left: 20px; text-indent: -18px;">- ${item}</li>`).join('');
            const introHtml = intro.length > 0 ? `<div style="margin-bottom: 12px; text-align: justify;">${intro.join(' ')}</div>` : '';
            
            return `${introHtml}<ul style="list-style-type: none; margin-left: 0; padding-left: 10px; text-align: justify; margin-bottom: 22px; line-height: 1.6;">${listHtml}</ul>`;
        }

        // Clause detection with internal list support
        const clausePatterns = [/^\s*(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SEPTIEMO|SÉPTIMO|OCTAVO|NOVENO|DECIMO|DÉCIMO|DECIMO PRIMERO|DÉCIMO PRIMERO|DECIMO SEGUNDO|DECIMO TERCERO)\s*:/i];
        for (const pattern of clausePatterns) {
            const match = content.match(pattern);
            if (match) {
                const clause = match[0].trim();
                let rest = content.substring(match[0].length).trim();
                
                // If there's a list inside the clause rest
                if (rest.includes('\n- ') || rest.includes('\n* ') || rest.match(/\n\d+\.\s/)) {
                    const lines = rest.split('\n');
                    let subIntro = [];
                    let subList = [];
                    let inSubList = false;
                    let isNumbered = false;
                    for (const line of lines) {
                        const numberedMatch = line.trim().match(/^(\d+\.)\s*(.*)/);
                        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                            inSubList = true;
                            subList.push(line.trim().replace(/^[-*] /, ''));
                        } else if (numberedMatch) {
                            inSubList = true;
                            isNumbered = true;
                            subList.push(`<strong>${numberedMatch[1]}</strong> ${numberedMatch[2]}`);
                        } else if (!inSubList) {
                            subIntro.push(line);
                        } else {
                            subList[subList.length - 1] += ' ' + line.trim();
                        }
                    }
                    const listHtml = subList.map(item => `<li style="margin-bottom: 12px; text-align: justify; padding-left: 20px; text-indent: -18px;">${isNumbered ? '' : '- '}${item}</li>`).join('');
                    const introHtml = subIntro.length > 0 ? `<div style="margin-bottom: 12px;">${subIntro.join(' ')}</div>` : '';
                    
                    return `<div style="text-align: justify; margin-bottom: 22px; line-height: 1.6;">
                        <strong style="text-transform: uppercase; font-size: 11.5pt; text-decoration: underline; font-weight: bold;">${clause}</strong> ${introHtml}
                        <ul style="list-style-type: none; margin-left: 0; padding-left: 10px; text-align: justify; margin-top: 10px;">${listHtml}</ul>
                    </div>`;
                }

                return `<div style="text-align: justify; margin-bottom: 14px; line-height: 1.45;">
                    <strong style="text-transform: uppercase; font-size: 11pt; text-decoration: underline; font-weight: bold;">${clause}</strong> ${rest}
                </div>`;
            }
        }

        // Section "SR/A ... Y ... SR/A"
        if (content.includes('SR/A') && content.includes(' Y ')) {
            return `<div style="text-align: center; margin: 20px 0; font-size: 11pt; line-height: 1.5; font-weight: bold;">${content}</div>`;
        }

        return `<p style="text-align: justify; margin-bottom: 12px; line-height: 1.45; font-size: 10.5pt;">${content}</p>`;
    }).join('');
  };

  const printContract = (contract: Contract) => {
    const w = window.open('', '_blank');
    if(w) {
        // Use Snapshot if available, otherwise current DB data
        const client = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
        
        // Dynamically compute the chronological serial/correlative number
        const sorted = [...contracts].sort((a, b) => a.fecha_contrato.localeCompare(b.fecha_contrato));
        const seqNum = sorted.findIndex(c => c.id === contract.id) + 1;
        const seqText = String(seqNum > 0 ? seqNum : contracts.length + 1).padStart(3, '0');
        const fullCleanText = contract.contenido_texto.replace(/FIRMAS[\s\S]*$/i, '').trim();
        const paragraphs = fullCleanText.split(/\n\n+/);
        
        let bodyHtml = '';
        let lastPartHtml = '';
        
        if (paragraphs.length > 1) {
            const bodyParts = paragraphs.slice(0, -1);
            const lastPart = paragraphs[paragraphs.length - 1];
            bodyHtml = formatTextToHtml(bodyParts.join('\n\n'));
            lastPartHtml = formatTextToHtml(lastPart);
        } else {
            bodyHtml = '';
            lastPartHtml = formatTextToHtml(fullCleanText);
        }

        const signaturesTable = `
        <div class="signature-section" style="page-break-inside: avoid !important; break-inside: avoid !important;">
          <table class="sig-table" style="width: 100%; border: 1.5px solid #000; border-collapse: collapse; margin-top: 12px; page-break-inside: avoid !important; break-inside: avoid !important;">
            <tr style="page-break-inside: avoid !important; break-inside: avoid !important;">
              <td class="sig-col" style="width: 50%; vertical-align: top; border-right: 1.5px solid #000; padding: 6px 8px; text-align: center; page-break-inside: avoid !important; break-inside: avoid !important;">
                <div class="sig-type">EL VENDEDOR</div>
                <div class="sig-header">
                  INVERSIONES E&E SPA<br>
                  EDUARDO HUMBERTO SOTO ALVARADO
                </div>
                <div class="sig-role">Representante legal</div>
                <div class="sig-space">
                   ${contract.firma_vendedor ? `<img src="${contract.firma_vendedor}" class="sig-img" />` : '<div style="height: 32px;"></div>'}
                </div>
                <div class="sig-footer">R.U.T.: 78.210.119-6</div>
              </td>
              <td class="sig-col" style="width: 50%; vertical-align: top; padding: 6px 8px; text-align: center; page-break-inside: avoid !important; break-inside: avoid !important;">
                <div class="sig-type">EL COMPRADOR</div>
                <div class="sig-header">
                  COMPRADOR TITULAR<br>
                  ${client?.nombre ? client.nombre.toUpperCase() : 'CLIENTE'}
                </div>
                <div class="sig-role">Comprador Titular</div>
                <div class="sig-space">
                   ${contract.firma_cliente ? `<img src="${contract.firma_cliente}" class="sig-img" />` : '<div style="height: 32px;"></div>'}
                </div>
                <div class="sig-footer">R.U.T : <span class="blue-text">${client?.rut || ''}</span></div>
              </td>
            </tr>
          </table>
        </div>
        `;

        const watermarkToUse = getWatermarkFile(); // No fallback to logo SVG

        w.document.write(`
          <html>
            <head>
              <title>Contrato N° ${seqText}</title>
              <style>
                @page { 
                    size: A4; 
                    margin: 28mm 20mm 24mm 20mm; 
                }
                @media print {
                  @page { margin: 28mm 20mm 24mm 20mm; }
                  body { 
                    margin: 0 !important;
                    padding: 0 !important;
                    width: 100% !important;
                    box-sizing: border-box;
                  }
                  .no-print { display: none !important; }
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    background: transparent !important;
                    color: black !important;
                }
                body { 
                  font-family: 'Times New Roman', Times, serif; 
                  color: #000; 
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  line-height: 1.4;
                  position: relative;
                  box-sizing: border-box;
                  width: 100%;
                  background: transparent !important;
                }
                
                .content {
                    position: relative;
                    z-index: 10;
                    background: transparent !important;
                }

                .content > div:not(.signature-section):not(.closing-section),
                .content p, 
                .content li, 
                .content ul {
                    page-break-inside: auto;
                    break-inside: auto;
                }

                h1 { text-align: center; text-transform: uppercase; font-size: 14pt; margin-bottom: 16px; text-decoration: underline; font-weight: bold; }
                
                p, li { text-align: justify; font-size: 10.5pt; margin-bottom: 12px; background: transparent !important; }
                
                .bg-mark {
                    position: fixed;
                    top: -28mm;
                    left: -20mm;
                    width: 210mm;
                    height: 297mm;
                    z-index: -10;
                    object-fit: fill;
                    pointer-events: none;
                }
                
                .closing-section,
                .signature-section,
                .sig-table,
                .sig-col {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    break-inside: avoid-page !important;
                }

                .signature-section {
                    margin-top: 14px;
                    display: block !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .sig-table {
                    width: 100% !important;
                    border: 1.5px solid #000 !important;
                    border-collapse: collapse !important;
                    box-sizing: border-box !important;
                    background: transparent !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .sig-col {
                    width: 50% !important;
                    box-sizing: border-box !important;
                    padding: 8px 6px 6px 6px !important;
                    text-align: center !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
                .sig-type {
                    font-weight: bold;
                    font-size: 10pt;
                    margin-bottom: 4px;
                    text-decoration: underline;
                    text-transform: uppercase;
                    height: 15px;
                }
                .sig-header { 
                    font-weight: bold; 
                    font-size: 8.5pt; 
                    line-height: 1.2; 
                    min-height: 24px; 
                    text-align: center;
                }
                .sig-role { 
                    font-style: italic; 
                    font-size: 8pt; 
                    height: 13px; 
                    text-align: center;
                    margin-top: 2px;
                    margin-bottom: 2px;
                }
                .sig-space { 
                    height: 40px; 
                    text-align: center;
                    line-height: 40px; 
                    margin: 2px 0;
                    border-top: 1px dashed #ccc;
                    border-bottom: 1px dashed #ccc;
                }
                .sig-img { 
                    max-height: 38px; 
                    max-width: 90%; 
                    object-fit: contain;
                    display: inline-block;
                    vertical-align: middle;
                }
                .sig-footer { 
                    font-size: 9pt; 
                    font-weight: bold; 
                    height: 16px;
                    text-align: center;
                    margin-top: 4px;
                }
                
                .footer-banner {
                    display: none;
                }

                .page-number {
                    position: fixed;
                    bottom: -15mm;
                    right: -8mm;
                    font-size: 9.5pt;
                    font-weight: bold;
                    color: #1a3a1f;
                    z-index: 60;
                }
                .page-number::after {
                    content: counter(page);
                }

                .blue-text { color: #0033bb; font-weight: bold; }
                .underline { text-decoration: underline; }
              </style>
            </head>
            <body>
              ${watermarkToUse ? `<img src="${watermarkToUse}" class="bg-mark" />` : ''}
              <div class="content">
                  <div style="margin-top: 0;">
                    ${bodyHtml}
                  </div>

                  <div class="closing-section" style="margin-top: 16px;">
                    ${lastPartHtml}
                    ${signaturesTable}
                  </div>
              </div>
              
              <script>
                document.title = "";
                window.onload = function() { 
                    setTimeout(function(){ 
                        window.print(); 
                        setTimeout(function(){ window.close(); }, 500);
                    }, 1000); 
                }
              </script>
            </body>
          </html>
        `);
        w.document.close();
    }
  };

  if (isCreating) {
    return (
      <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-6">
        
        {/* Left Panel: Configuration */}
        <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6 overflow-y-auto pr-2 pb-20">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
              <Calculator size={20} className="text-orange-600" /> 1. Presupuesto / Cotización
            </h3>
            <p className="text-xs text-slate-500 mb-4">Selecciona el presupuesto aprobado. Esto cargará automáticamente los montos y datos técnicos.</p>
            
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Presupuesto Vinculado</label>
            <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer" 
              value={selectedBudgetId} onChange={e => setSelectedBudgetId(e.target.value)}>
              <option value="">-- Seleccionar una cotización --</option>
              {budgets.map(b => {
                const c = clients.find(cl => cl.id === b.cliente_id);
                const p = projects.find(pr => pr.id === b.proyecto_id) || houseModels.find(hm => hm.id === b.proyecto_id);
                const modelName = p?.modelo || (p as any)?.nombre || 'Personalizada';
                return (
                  <option key={b.id} value={b.id}>
                    {c?.nombre || 'S/N'} - {modelName} (${b.monto_total.toLocaleString()})
                  </option>
                );
              })}
            </select>

            {selectedBudget && selectedClient && selectedProject && (
              <div className="mt-4 p-4 bg-orange-50 rounded-xl text-xs space-y-2 border border-orange-100 animate-in fade-in zoom-in-95">
                <div className="flex justify-between border-b border-orange-100 pb-1">
                  <span className="text-slate-500">Cliente:</span>
                  <span className="font-bold text-slate-800">{selectedClient.nombre}</span>
                </div>
                <div className="flex justify-between border-b border-orange-100 pb-1">
                  <span className="text-slate-500">Proyecto:</span>
                  <span className="font-bold text-slate-800">{selectedProject.modelo || (selectedProject as any).nombre || 'Personalizada'}</span>
                </div>

                {m2Warning && (
                  <div className="bg-amber-100/50 p-3 rounded-lg border border-amber-200 mt-2">
                    <div className="flex gap-2">
                      <AlertCircle className="text-amber-600 shrink-0" size={14} />
                      <div>
                        <p className="text-[10px] font-bold text-amber-900 uppercase">Inconsistencia de Superficie</p>
                        <p className="text-[11px] text-amber-800 leading-tight my-1">{m2Warning}</p>
                        <div className="mt-2 space-y-1">
                          <p className="text-[9px] font-bold text-amber-900 uppercase">¿Cómo corregir?</p>
                          <ol className="list-decimal list-inside text-[10px] text-amber-800 space-y-0.5">
                            <li>Vaya al menú de <b>Presupuestos</b>.</li>
                            <li>Busque este presupuesto y haga clic en <b>Editar</b>.</li>
                            <li>En <b>Superficie y Radier</b>, ajuste los m² del radier o modelo.</li>
                            <li>Guarde y vuelva aquí para re-seleccionar.</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-1">
                  <span className="text-slate-500">Valor Total:</span>
                  <span className="font-bold text-orange-700 text-sm">${selectedBudget.monto_total.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {selectedBudget && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 animate-in slide-in-from-left-5">
                  <h3 className="text-lg font-bold text-slate-800">2. Fechas y Plazos</h3>
                  <div className="grid grid-cols-1 gap-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                            <Calendar size={16} className="text-emerald-600" /> Inicio de Obra
                          </label>
                          <input 
                            type="date" 
                            required
                            className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Días de Montaje</label>
                              <div className="relative">
                                  <input 
                                    type="number"
                                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                    value={plazoInstalacion}
                                    onChange={(e) => setPlazoInstalacion(parseInt(e.target.value) || 0)}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">HÁBILES</span>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ciudad Suscrip.</label>
                              <input 
                                type="text"
                                className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                                value={lugarSuscripcion}
                                onChange={(e) => setLugarSuscripcion(e.target.value)}
                                placeholder="Ej: Osorno"
                              />
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {selectedBudget && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-left-5">
              <h3 className="text-lg font-bold text-slate-800">2.5 Condiciones de Venta</h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pago Base</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as any)}
                  >
                    <option value="Contado">Contado</option>
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Crédito Directo">Crédito Directo</option>
                    <option value="Crédito Hipotecario">Crédito Hipotecario</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedBudget && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-left-5">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">3. Plan de Pagos</h3>
                  <button onClick={addPayment} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition" title="Agregar Cuota">
                      <Plus size={16} />
                  </button>
              </div>
              
              <div className="space-y-3">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex flex-col gap-2 border-b border-slate-100 pb-3 last:border-0">
                    <div className="flex justify-between items-center gap-2">
                        <input 
                            type="text" 
                            className="flex-1 p-1 border border-transparent hover:border-slate-300 rounded text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 transition"
                            value={p.descripcion}
                            onChange={(e) => updatePayment(idx, 'descripcion', e.target.value)}
                            placeholder="Descripción del pago..."
                        />
                        <button onClick={() => removePayment(idx)} className="text-slate-300 hover:text-red-500">
                            <Trash2 size={14} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <input 
                                type="number" 
                                className="w-16 p-1.5 pl-2 border border-slate-300 rounded text-right text-sm font-bold outline-none focus:border-emerald-500" 
                                value={p.porcentaje} 
                                onChange={e => updatePayment(idx, 'porcentaje', e.target.value)} 
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs text-slate-400 opacity-0">%</span>
                        </div>
                        <span className="text-sm text-slate-500">%</span>
                        <div className="flex-1 text-right text-sm font-mono bg-slate-50 px-2 py-1.5 rounded border border-slate-100 text-slate-700">
                           ${p.monto.toLocaleString()}
                        </div>
                    </div>
                  </div>
                ))}
                
                {/* Footer Validation */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Total Porcentaje</span>
                      <div className={`font-bold px-2 py-0.5 rounded ${isTotalValid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {totalPercentage}%
                      </div>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Suma Total</span>
                      <span className={`font-mono font-bold ${totalAmount === budgetAmount ? 'text-slate-700' : 'text-red-500'}`}>
                          ${totalAmount.toLocaleString()}
                      </span>
                  </div>
                  {!isTotalValid && (
                      <div className="flex items-start gap-2 text-xs text-red-500 bg-red-50 p-2 rounded">
                          <AlertCircle size={14} className="mt-0.5 shrink-0" />
                          <span>La suma debe ser 100%. Ajuste los porcentajes.</span>
                      </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto sticky bottom-0 bg-slate-50 pt-4 pb-2">
            <button 
                disabled={!selectedBudget || isGenerating || !isTotalValid}
                onClick={handleGenerate}
                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95 ${
                !selectedBudget || isGenerating || !isTotalValid ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
            >
                {isGenerating ? (
                <><span className="animate-spin">⏳</span> Redactando...</>
                ) : (
                <><Sparkles size={18} /> {generatedText ? 'Regenerar' : 'Generar Contrato'}</>
                )}
            </button>
            <button 
             onClick={() => setIsCreating(false)}
             className="w-full mt-3 py-2 text-slate-500 text-sm hover:text-slate-800 font-medium"
            >
             Cancelar
            </button>
          </div>
        </div>

        {/* Right Panel: Real Paper Preview */}
        <div className="flex-1 bg-slate-200/50 rounded-2xl border border-slate-300/50 flex flex-col overflow-hidden relative backdrop-blur-sm">
          {/* Toolbar */}
          <div className="bg-white p-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button 
                  onClick={() => setViewMode('edit')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'edit' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Edit3 size={14} /> Editar
                </button>
                <button 
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'preview' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Eye size={14} /> Vista Papel
                </button>
            </div>

            {viewMode === 'preview' && (
                <button 
                  onClick={() => printContract({
                    id: editingContractId || 'PRE-Borrador',
                    cliente_id: selectedClient?.id || '',
                    vendedor_id: vendor?.id || '',
                    proyecto_id: selectedProject?.id || '',
                    presupuesto_id: selectedBudget?.id || '',
                    fecha_contrato: contractDate,
                    monto_total: selectedBudget?.monto_total || 0,
                    metodo_pago: metodoPago,
                    cuotas_pago: payments.length,
                    estado_pago: 'Pendiente',
                    hitos_pago: payments,
                    pautas_pago: payments.map(p => ({ ...p, pagado: false })),
                    estado: ContractStatus.GENERATED,
                    contenido_texto: generatedText,
                    plazo_instalacion_dias: plazoInstalacion,
                    fecha_inicio_obra: startDate,
                    fecha_entrega_estimada: '',
                    lugar_suscripcion: lugarSuscripcion,
                    cliente_snapshot: selectedClient || undefined,
                    es_anexo: isAnexo
                  } as Contract)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition shadow-sm font-bold animate-in bounce-in"
                >
                    <Printer size={16} /> Imprimir PDF
                </button>
            )}

            <div className="flex gap-2">
                 {generatedText && !generatedText.startsWith("Error") && (
                    <button onClick={downloadWord} className="p-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition" title="Descargar Word">
                        <FileType size={18} />
                    </button>
                 )}
                 {generatedText && !generatedText.startsWith("Error") && (
                    <button onClick={handleFinalize} className="px-4 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 flex items-center gap-2 font-medium shadow-md shadow-emerald-200 transition transform active:scale-95">
                        <CheckCircle size={16} /> Guardar Final
                    </button>
                 )}
            </div>
          </div>

          {/* Canvas / Paper Area */}
          <div className="flex-1 overflow-auto p-8 flex justify-center bg-slate-200/50">
            {viewMode === 'edit' ? (
                generatedText && (
                  <div className="w-full max-w-[210mm] animate-in zoom-in-95">
                      <div className="bg-white p-6 mb-4 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div className="flex flex-col">
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Fecha del Contrato</label>
                              <input 
                                type="date" 
                                className="border-none p-0 font-bold text-slate-800 outline-none focus:ring-0" 
                                value={contractDate} 
                                onChange={(e) => setContractDate(e.target.value)} 
                              />
                          </div>
                      </div>
                      <textarea 
                          className="w-full h-full min-h-[850px] p-12 bg-white shadow-2xl rounded-none border-none outline-none font-mono text-sm leading-relaxed resize-none text-slate-800"
                          value={generatedText}
                          onChange={(e) => setGeneratedText(e.target.value)}
                          placeholder="Edita el cuerpo del contrato aquí..."
                      />
                  </div>
                )
            ) : (
              <div className="flex flex-col items-center w-full">
                {!selectedBudgetId && (
                  <div className="flex flex-col items-center justify-center text-slate-400 mt-20 p-8 text-center animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-6">
                        <Calculator size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Paso 1: Selecciona un Presupuesto</h3>
                    <p className="text-sm max-w-xs text-center mt-2 text-slate-500 leading-relaxed mb-6">
                        El contrato se genera a partir de un presupuesto aprobado por el cliente. Selecciona uno a la izquierda para comenzar.
                    </p>
                    <button 
                      onClick={() => window.dispatchEvent(new CustomEvent('app-view-change', { detail: 'budgets' }))}
                      className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition shadow-lg shadow-slate-200"
                    >
                        Ir a Presupuestos <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                {selectedBudgetId && !generatedText && (
                  <div className="flex flex-col items-center justify-center text-slate-400 mt-20 animate-in fade-in duration-700">
                    <FileType size={64} className="mb-4 opacity-20 text-emerald-600" />
                    <p className="text-lg font-bold text-slate-600">Presupuesto Cargado</p>
                    <p className="text-sm max-w-xs text-center mt-2 opacity-70">Revisa los plazos y pagos a la izquierda, luego haz clic en "Generar Contrato".</p>
                  </div>
                )}

                 {generatedText && (() => {
                     const sorted = [...contracts].sort((a, b) => a.fecha_contrato.localeCompare(b.fecha_contrato));
                     const activeIdx = editingContractId 
                         ? sorted.findIndex(c => c.id === editingContractId) + 1 
                         : contracts.length + 1;
                     const activeSeqText = String(activeIdx > 0 ? activeIdx : contracts.length + 1).padStart(3, '0');

                     return (
                         <div className="flex flex-col gap-8 pb-20 printable-area">
                             <div className="paper-a4 animate-in zoom-in-95 duration-300 relative">
                                  {/* Background Image */}
                                  {getWatermarkFile() && (
                                     <img 
                                         src={getWatermarkFile()} 
                                         className="paper-bg" 
                                         alt="Background" 
                                     />
                                  )}
                                  {/* Serial Number */}
                                  <div className="absolute top-[32mm] right-[25mm] text-[11pt] font-serif font-bold text-slate-800 z-20">
                                      N° {activeSeqText}
                                  </div>
                                 <div 
                                     className="contract-content text-[11.5pt] leading-relaxed relative z-10 flex-1"
                                     dangerouslySetInnerHTML={{ __html: formatTextToHtml(generatedText) }}
                                 />
                             </div>
                         </div>
                     );
                 })()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {signingContract && signerRole && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <PenTool className="text-emerald-600" /> Firma Digital
              </h3>
              <button onClick={() => {setSigningContract(null); setSignerRole(null);}} className="text-slate-400 hover:text-red-500 transition">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-2 font-medium">
                Firmando como: <span className="text-slate-900 font-bold uppercase">{signerRole}</span>
            </p>
            <div className="border-2 border-dashed border-slate-300 rounded-xl mb-6 bg-slate-50 touch-none overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                  <p className="text-4xl font-serif italic">Firmar Aquí</p>
              </div>
              <canvas
                ref={canvasRef}
                width={450}
                height={220}
                className="w-full cursor-crosshair active:cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            
            <div className="flex justify-between items-center">
              <button onClick={clearCanvas} className="text-sm text-slate-500 hover:text-red-500 underline font-medium">
                Borrar y Repetir
              </button>
              <button onClick={saveSignature} className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition transform active:scale-95">
                Confirmar Firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Contract Confirmation Modal */}
      {contractToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar contrato?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Esta acción eliminará el registro del contrato y sus pautas de pago de la base de datos de forma permanente.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setContractToDelete(null)}
                disabled={isDeletingContract}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteContract}
                disabled={isDeletingContract}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-200 transition flex items-center gap-2"
              >
                {isDeletingContract ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Sí, eliminar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf" 
        onChange={handleFileUpload}
      />

      <div className="flex justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-slate-800">Contratos y Pagos</h3>
            <p className="text-slate-500 text-sm">Registro de documentos legales y gestión de cuotas.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition font-medium">
          <Plus size={20} /> Nuevo Contrato
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {contracts.length === 0 && (
             <div className="bg-white p-16 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <h4 className="text-slate-600 font-bold">Sin contratos</h4>
                <p className="text-slate-400 text-sm mt-1">Genera el primer contrato usando el botón superior.</p>
             </div>
        )}
        {(() => {
          const sortedContracts = [...contracts].sort((a, b) => a.fecha_contrato.localeCompare(b.fecha_contrato));
          return contracts.map(contract => {
              // Use snapshot if available, otherwise fallback to current data (backward compatibility)
              const cli = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
              const isSigned = contract.estado === ContractStatus.SIGNED;
              
              const seqNum = sortedContracts.findIndex(c => c.id === contract.id) + 1;
              const seqText = String(seqNum).padStart(3, '0');

              let parentSeqText = '';
              if (contract.es_anexo && contract.parent_contract_id) {
                  const pIdx = sortedContracts.findIndex(c => c.id === contract.parent_contract_id) + 1;
                  if (pIdx > 0) parentSeqText = String(pIdx).padStart(3, '0');
              }
              
              return (
                  <div key={contract.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group">
                      <div className="flex items-start gap-4">
                          <div className={`mt-1 p-3 rounded-xl ${isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              <FileText size={24} />
                          </div>
                          <div>
                              <div className="flex items-center gap-3">
                                  <h4 className="font-bold text-slate-800 text-lg">
                                      {contract.es_anexo ? 'Anexo' : 'Contrato'} N° {seqText}
                                  </h4>
                                  {contract.es_anexo && parentSeqText && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded uppercase">Anexo de N° {parentSeqText}</span>
                                  )}
                                  {(contract.es_combinacion_modelos || contract.presupuesto_snapshot?.es_combinacion_modelos) && (
                                      <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black rounded uppercase border border-purple-200">Modular Multi-Modelo</span>
                                  )}
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                      isSigned ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                                  }`}>
                                      {contract.estado}
                                  </span>
                              </div>
                            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                <span className="font-semibold text-slate-700">{cli?.nombre || 'Desconocido'}</span> • Emitido el {contract.fecha_contrato}
                            </p>
                        </div>
                          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
                        {!isSigned && (
                          <div className="flex gap-2">
                             {!contract.firma_cliente && (
                               <button 
                                 onClick={() => openSigningModal(contract, 'cliente')}
                                 className="px-3 py-1.5 text-xs font-bold bg-blue-50 text-blue-700 rounded-lg border border-blue-100 hover:bg-blue-100 flex items-center gap-1.5 transition"
                               >
                                 <PenTool size={12} /> FIRMA CLIENTE
                               </button>
                             )}
                             {!contract.firma_vendedor && (
                               <button 
                                 onClick={() => openSigningModal(contract, 'vendedor')}
                                 className="px-3 py-1.5 text-xs font-bold bg-purple-50 text-purple-700 rounded-lg border border-purple-100 hover:bg-purple-100 flex items-center gap-1.5 transition"
                                >
                                 <PenTool size={12} /> FIRMA VENDEDOR
                               </button>
                             )}
                          </div>
                        )}

                        {isSigned && (
                            <button 
                                onClick={() => handleCreateAnnex(contract)}
                                className="px-3 py-1.5 text-xs font-bold bg-orange-50 text-orange-700 rounded-lg border border-orange-100 hover:bg-orange-100 flex items-center gap-1.5 transition"
                            >
                                <Plus size={12} /> CREAR ANEXO
                            </button>
                        )}
                        
                        <div className="text-right border-l pl-6 border-slate-100 hidden md:block">
                             <p className="text-xs text-slate-400 font-bold uppercase">Monto Total</p>
                             <p className="font-bold text-slate-800 text-lg">${contract.monto_total.toLocaleString()}</p>
                        </div>

                        <div className="flex gap-2 border-l pl-4 border-slate-100 ml-2">
                            {contract.documento_archivo_url && (
                                <div className="flex gap-1 items-center animate-in fade-in">
                                     <button 
                                         className="px-3 py-1.5 text-[10px] font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition uppercase tracking-tighter"
                                         onClick={() => printContract(contract)}
                                     >
                                         Versión Digital
                                     </button>
                                     <button 
                                         className="px-3 py-1.5 text-[10px] font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition uppercase tracking-tighter"
                                         onClick={() => viewDocument(contract.documento_archivo_url!)}
                                     >
                                         Versión Firmada
                                     </button>
                                 </div>
                            )}

                            {contract.documento_archivo_url ? (
                                <button 
                                    className="p-2.5 text-orange-600 hover:bg-orange-50 rounded-xl transition"
                                    onClick={() => triggerUpload(contract.id)}
                                    title="Re-subir Contrato Escaneado"
                                >
                                    <Upload size={20} />
                                </button>
                            ) : (
                                <button 
                                    className="p-2.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition"
                                    onClick={() => triggerUpload(contract.id)}
                                    title="Subir Contrato Escaneado"
                                >
                                    <Upload size={20} />
                                </button>
                            )}
                            <button 
                                onClick={() => setExpandedPaymentsContractId(expandedPaymentsContractId === contract.id ? null : contract.id)}
                                className={`p-2.5 rounded-xl transition flex items-center gap-1.5 ${expandedPaymentsContractId === contract.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                title="Gestionar Pagos"
                            >
                                <DollarSign size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-tight">Pagos</span>
                            </button>
                            <button 
                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                            onClick={() => handleEditSavedContract(contract)}
                            title="Previsualizar / Editar Borrador"
                            >
                                <Edit3 size={20} />
                            </button>
                            <button 
                            className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                            onClick={() => printContract(contract)}
                            title="Imprimir / Ver PDF"
                            >
                                <Printer size={20} />
                            </button>
                            <button 
                            className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition opacity-0 group-hover:opacity-100"
                            onClick={() => handleDelete(contract.id)}
                            title="Eliminar Contrato"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                    {/* Expanded Payment Management Section */}
                    {expandedPaymentsContractId === contract.id && (
                        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="col-span-full mb-2">
                                <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <DollarSign size={14} /> Gestión de Cuotas y Cierre de Pagos
                                </h5>
                            </div>
                            {contract.pautas_pago.map((pauta, pIdx) => (
                                <div 
                                    key={pIdx} 
                                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between h-full ${
                                        pauta.pagado ? 'bg-emerald-50 border-emerald-200 shadow-inner' : 'bg-slate-50 border-slate-200'
                                    }`}
                                >
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase truncate" title={pauta.descripcion}>{pauta.descripcion}</p>
                                        <p className={`font-black text-lg ${pauta.pagado ? 'text-emerald-700' : 'text-slate-700'}`}>
                                            ${pauta.monto.toLocaleString()}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => togglePaymentStatus(contract, pIdx)}
                                        className={`mt-3 w-full py-2 rounded-lg font-bold text-[10px] uppercase flex items-center justify-center gap-2 transition ${
                                            pauta.pagado 
                                            ? 'bg-emerald-600 text-white shadow-md' 
                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {pauta.pagado ? (
                                            <><CheckCircle size={12} /> PAGADO</>
                                        ) : (
                                            "MARCAR PAGADO"
                                        )}
                                    </button>
                                    {pauta.pagado && pauta.fecha_pago && (
                                        <p className="text-[9px] text-emerald-400 font-bold mt-1 text-center italic">
                                            {new Date(pauta.fecha_pago).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
              );
          });
        })()}
      </div>
    </div>
  );
};

export default ContractManager;
