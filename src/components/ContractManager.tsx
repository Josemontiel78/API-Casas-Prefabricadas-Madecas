
import React, { useState, useEffect, useRef } from 'react';
import { Contract, Budget, Client, Project, Vendor, ContractStatus, PaymentInstallment } from '@/types';
import { getContracts, saveContract, getBudgets, getClients, getProjects, getVendor, deleteContract } from '@/services/db';
import { generateContractText } from '@/services/geminiService';
import { Sparkles, FileText, CheckCircle, Printer, Plus, PenTool, X, Calendar, Edit3, Eye, FileType, Trash2, Maximize2, AlertCircle, Calculator, ArrowRight, Upload, Image as ImageIcon } from 'lucide-react';

// Input assets provided by the user
declare const input_file_0: string;
declare const input_file_1: string;

// --- MADECAS LOGO SVG ---
const MADECAS_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="w-full h-full">
  <circle cx="50" cy="50" r="48" fill="none" stroke="#143e18" stroke-width="1" opacity="0.2"/>
  <text x="50" y="52" font-family="Times New Roman, serif" font-size="12" font-weight="bold" fill="#143e18" text-anchor="middle" letter-spacing="1" opacity="0.3">MADECAS</text>
</svg>
`;

const MADECAS_LOGO_HEADER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 140">
  <circle cx="200" cy="50" r="45" fill="#fff" stroke="#143e18" stroke-width="2" />
  <text x="200" y="55" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#143e18" text-anchor="middle">MADECAS</text>
  <text x="200" y="85" font-family="Arial, sans-serif" font-size="6" fill="#143e18" text-anchor="middle">PREFABRICADOS</text>
  
  <text x="200" y="125" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#143e18" text-anchor="middle" letter-spacing="1">CONTRATO DE COMPRAVENTA</text>
  <rect x="100" y="132" width="200" height="1" fill="#143e18" />
</svg>
`;

const MADECAS_FOOTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 60" preserveAspectRatio="none">
  <rect x="0" y="0" width="800" height="60" fill="#143e18" />
  <path d="M0 0 L800 0 L800 5 L0 5 Z" fill="#1b5e20" />
  <text x="400" y="32" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="4">MADECAS</text>
  <text x="400" y="48" font-family="Arial, sans-serif" font-size="8" font-weight="400" fill="#fff" text-anchor="middle" letter-spacing="6" text-transform="uppercase">CALIDAD Y CONFIANZA EN SU HOGAR</text>
</svg>
`;

const ContractManager: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  
  // Dependencies for selection
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
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

  // Signing State
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [signerRole, setSignerRole] = useState<'cliente' | 'vendedor' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeContractForUpload, setActiveContractForUpload] = useState<string | null>(null);
  
  // Selection Logic Helpers
  const selectedBudget = budgets.find(b => b.id === selectedBudgetId);
  const selectedClient = selectedBudget ? clients.find(c => c.id === selectedBudget.cliente_id) : null;
  const selectedProject = selectedBudget ? projects.find(p => p.id === selectedBudget.proyecto_id) : null;

  useEffect(() => {
    setContracts(getContracts());
    setBudgets(getBudgets());
    setClients(getClients());
    setProjects(getProjects());
    setVendor(getVendor());

    // Check for pending contract from budget
    const pendingBudgetId = window.localStorage.getItem('pending_contract_budget_id');
    if (pendingBudgetId) {
        window.localStorage.removeItem('pending_contract_budget_id');
        setSelectedBudgetId(pendingBudgetId);
    }
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

  const handleGenerate = async () => {
    if (!selectedClient || !selectedProject || !selectedBudget || !vendor) return;

    if (!startDate) {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Debe ingresar la fecha de inicio de obra', type: 'error' } 
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
    setViewMode('preview');
    
    // Pass the payments exactly as configured
    const text = await generateContractText(
        selectedClient, 
        vendor, 
        selectedProject, 
        selectedBudget, 
        payments, 
        startDate,
        plazoInstalacion,
        lugarSuscripcion
    );
    
    // Add date line at the top if missing or adjust it
    const dateObj = new Date(contractDate);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dateStringLiteral = `${dateObj.getDate()} de ${months[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;
    const dateShort = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    
    let finalText = text;
    if (finalText.includes('[FECHA_LARGA]')) {
        finalText = finalText.replace('[FECHA_LARGA]', `${dateShort} ${dateStringLiteral}`);
    } else if (finalText.includes('[FECHA]')) {
         finalText = finalText.replace('[FECHA]', `${dateShort} ${dateStringLiteral}`);
    }
    
    if (finalText.includes('[FECHA_INICIO]')) {
        const startObj = new Date(startDate);
        const startString = `${startObj.getDate()} de ${months[startObj.getMonth()]} de ${startObj.getFullYear()}`;
        finalText = finalText.replace('[FECHA_INICIO]', startString);
    }

    if (text.startsWith("Error de conexión con IA")) {
        let msg = 'Error al generar contrato con IA';
        if (text.includes('ERROR_CONFIG')) msg = 'API KEY de Gemini no configurada en el servidor.';
        
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: msg, type: 'error' } 
        }));
    } else {
        window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Borrador generado. Verifique la cláusula TERCERO.', type: 'success' } 
        }));
    }
    
    setGeneratedText(text);
    setIsGenerating(false);
  };

  const handleFinalize = () => {
    if (!selectedClient || !selectedProject || !selectedBudget || !vendor) return;
    
    const deliveryDate = new Date(startDate);
    let addedDays = 0;
    while (addedDays < plazoInstalacion) {
        deliveryDate.setDate(deliveryDate.getDate() + 1);
        const day = deliveryDate.getDay();
        if (day !== 0 && day !== 6) addedDays++; // Mon-Fri
    }

    // Create or update the contract record with SNAPSHOTS
    const contractData: Contract = {
      id: editingContractId || crypto.randomUUID(),
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
      estado: ContractStatus.GENERATED,
      contenido_texto: generatedText,
      
      // Plazos y Fechas
      plazo_instalacion_dias: plazoInstalacion,
      fecha_inicio_obra: startDate,
      fecha_entrega_estimada: deliveryDate.toISOString().split('T')[0],
      lugar_suscripcion: lugarSuscripcion,
      
      cliente_snapshot: selectedClient,
      proyecto_snapshot: selectedProject,
      presupuesto_snapshot: selectedBudget
    };

    saveContract(contractData);
    setContracts(getContracts());
    setIsCreating(false);
    setEditingContractId(null);
    setSelectedBudgetId('');
    setGeneratedText('');
    setStartDate('');
    
    window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message: 'Contrato registrado en base de datos', type: 'success' } 
    }));
  };

  const handleDelete = (id: string) => {
      if(window.confirm("¿Está seguro de eliminar este contrato? Esta acción no se puede deshacer.")) {
          deleteContract(id);
          setContracts(getContracts());
          window.dispatchEvent(new CustomEvent('app-notification', { 
            detail: { message: 'Contrato eliminado', type: 'info' } 
          }));
      }
  };

  const handleEditSavedContract = (contract: Contract) => {
    setEditingContractId(contract.id);
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
    const htmlContent = formatTextToHtml(generatedText);
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

  const saveSignature = () => {
    if (!signingContract || !signerRole || !canvasRef.current) return;
    const signatureData = canvasRef.current.toDataURL('image/png');
    const updatedContract = { ...signingContract };
    if (signerRole === 'cliente') updatedContract.firma_cliente = signatureData;
    else updatedContract.firma_vendedor = signatureData;

    if (updatedContract.firma_cliente && updatedContract.firma_vendedor) {
      updatedContract.estado = ContractStatus.SIGNED;
      updatedContract.fecha_firma = new Date().toISOString();
    }
    saveContract(updatedContract);
    setContracts(getContracts());
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
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const contract = contracts.find(c => c.id === activeContractForUpload);
      if (contract) {
        const updatedContract = { 
          ...contract, 
          documento_archivo_url: base64,
          documento_archivo_tipo: file.type.includes('pdf') ? 'PDF' : 'PHOTO' as any,
          fecha_escaneo: new Date().toISOString()
        };
        saveContract(updatedContract);
        setContracts(getContracts());
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
    
    // Split text into paragraphs based on double newlines
    const parts = text.split(/\n\n+/);
    
    return parts.map(part => {
        let content = part.trim();
        if (!content) return '';

        // Process bold markdown
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Headers
        if (content.startsWith('# ')) {
             return `<h1 style="text-align:center; font-size:14pt; font-weight:bold; text-transform:uppercase; margin-bottom: 20px; text-decoration: underline; page-break-after: avoid;">${content.replace(/^# /, '')}</h1>`;
        }
        if (content.startsWith('## ')) {
             return `<h2 style="text-align:justify; font-size:12pt; font-weight:bold; text-transform:uppercase; margin-top: 20px; margin-bottom: 10px; page-break-after: avoid;">${content.replace(/^## /, '')}</h2>`;
        }

        // Bullet Lists
        if (content.startsWith('- ') || content.startsWith('* ')) {
            const listItems = content.split('\n').map(line => {
                return `<li style="margin-bottom: 5px; text-align: justify;">${line.replace(/^[-*] /, '')}</li>`;
            }).join('');
            return `<ul style="list-style-type: disc; margin-left: 25px; text-align: justify; margin-bottom: 15px; page-break-inside: avoid;">${listItems}</ul>`;
        }

        // Standard Paragraphs - JUSTIFIED
        // We replace single newlines within a paragraph with a space to let the browser justify the full block
        const cleanContent = content.replace(/\n/g, ' ');
        
        // Detect headers like "PRIMERO:", "SEGUNDO:", etc. and make them bold+large
        if (/^(PRIMERO|SEGUNDO|TERCERO|CUARTO|QUINTO|SEXTO|SÉPTIMO|OCTAVO|NOVENO|DÉCIMO|DECIMO PRIMERO):/.test(cleanContent)) {
             return `<p style="text-align: justify; margin-bottom: 15px; line-height: 1.6; font-weight: bold; font-size: 12pt; text-transform: uppercase;">${cleanContent}</p>`;
        }

        return `<p style="text-align: justify; margin-bottom: 12px; line-height: 1.6; text-justify: inter-word; page-break-inside: auto;">${cleanContent}</p>`;
    }).join('');
  };

  const printContract = (contract: Contract) => {
    const w = window.open('', '_blank');
    if(w) {
        // Use Snapshot if available, otherwise current DB data
        const client = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
        const vend = vendor; // Vendor usually static in this app, but could also be snapshot

        // Construct layout strictly based on image provided by user
        // Table with black borders
        const signaturesTable = `
        <div class="signature-section">
          <table class="sig-table">
            <tr>
              <td class="sig-cell">
                <div class="sig-header">
                  <span class="underline">COMERCIALIZADORA MADECAS SPA</span><br>
                  <span class="underline">EDUARDO HUMBERTO SOTO ALVARADO</span>
                </div>
                <div class="sig-role">
                  <span class="underline">Representante legal</span>
                </div>
                <div class="sig-space">
                   ${contract.firma_vendedor ? `<img src="${contract.firma_vendedor}" class="sig-img" />` : ''}
                </div>
                <div class="sig-footer">
                  R.U.T.: 77.300.759-4
                </div>
              </td>
              <td class="sig-cell">
                <div class="sig-header">
                  <span class="underline text-blue">${client?.nombre || 'CLIENTE'}</span>
                </div>
                <div class="sig-space" style="margin-top: 30px;">
                   ${contract.firma_cliente ? `<img src="${contract.firma_cliente}" class="sig-img" />` : ''}
                </div>
                <div class="sig-footer">
                   R.U.T : <span class="text-blue">${client?.rut}</span>
                </div>
              </td>
            </tr>
          </table>
        </div>
        `;

        let htmlContent = formatTextToHtml(contract.contenido_texto);

        // Encode graphics
        const encodedLogo = 'data:image/svg+xml;base64,' + btoa(MADECAS_LOGO_HEADER_SVG);
        const encodedWatermark = 'data:image/svg+xml;base64,' + btoa(MADECAS_LOGO_SVG);
        const encodedFooter = 'data:image/svg+xml;base64,' + btoa(MADECAS_FOOTER_SVG);

        w.document.write(`
          <html>
            <head>
              <title>Contrato ${contract.id.slice(0,6)}</title>
              <style>
                @page { 
                    size: A4; 
                    /* CRITICAL: Physical margins to prevent text overlapping with header/footer */
                    margin-top: 35mm; 
                    margin-bottom: 30mm; 
                    margin-left: 20mm; 
                    margin-right: 20mm; 
                }
                body { 
                  font-family: 'Times New Roman', serif; 
                  color: #000; 
                  -webkit-print-color-adjust: exact;
                  background: white;
                  margin: 0;
                  padding: 0;
                }
                
                .bg-image {
                    position: fixed;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    object-fit: cover;
                    opacity: 0.12; /* Adjusting visibility */
                    filter: saturate(0.5) brightness(1.1);
                    z-index: -20;
                }
                
                /* Content Styles */
                .content {
                    position: relative;
                    z-index: 10;
                }

                .document-logo-start {
                    display: block;
                    margin: 0 auto 30px;
                    width: 130mm;
                    height: auto;
                }

                .document-logo-end {
                    display: block;
                    margin: 40px auto 0;
                    width: 100%;
                    max-width: 180mm;
                    height: auto;
                }

                p { 
                    margin-bottom: 12px; line-height: 1.6; 
                    text-align: justify; text-justify: inter-word; font-size: 11.5pt;
                    page-break-inside: auto;
                    widows: 3; orphans: 3;
                }
                .page-counter {
                    position: fixed;
                    bottom: -15mm;
                    right: 0;
                    font-size: 9pt;
                    color: #888;
                    z-index: 150;
                }
                .page-counter:after {
                    content: "Página " counter(page);
                }
                li { text-align: justify; text-justify: inter-word; page-break-inside: avoid; }
                h1 { text-align: center; text-transform: uppercase; font-size: 14pt; margin-bottom: 20px; page-break-after: avoid; }
                h2 { font-weight: bold; text-transform: uppercase; font-size: 12pt; margin-top: 20px; margin-bottom: 10px; text-align: justify; page-break-after: avoid; }
                ul { page-break-inside: auto; }

                /* Signature Table Styles */
                .signature-section {
                    margin-top: 100px;
                    page-break-inside: avoid; /* Keep signatures together */
                    width: 100%;
                }
                .sig-table {
                    width: 100%;
                    border-collapse: collapse;
                    border: 2px solid #000;
                }
                .sig-cell {
                    width: 50%;
                    border: 1px solid #000;
                    vertical-align: top;
                    padding: 0;
                    position: relative;
                }
                .sig-header {
                    text-align: center;
                    font-weight: bold;
                    padding: 10px 5px;
                    font-size: 10pt;
                }
                .sig-role {
                    text-align: center;
                    font-weight: bold;
                    margin-top: 5px;
                    font-size: 10pt;
                }
                .underline {
                    text-decoration: underline;
                }
                .text-blue {
                    color: blue;
                }
                .sig-space {
                    height: 120px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .sig-img {
                    max-height: 100px;
                    max-width: 90%;
                }
                .sig-footer {
                    border-top: 2px solid #000;
                    text-align: center;
                    font-weight: bold;
                    padding: 5px;
                    font-size: 11pt;
                }
              </style>
            </head>
            <body>
              <div class="bg-image">
                 <img src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2000" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div class="page-counter"></div>

              <div class="content">
                 <img src="${input_file_1}" class="document-logo-start" />
                 ${htmlContent}
                 ${signaturesTable}
                 <img src="${input_file_0}" class="document-logo-end" />
              </div>
              
              <script>
                window.onload = function() { setTimeout(function(){ window.print(); }, 800); }
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
                const p = projects.find(pr => pr.id === b.proyecto_id);
                return (
                  <option key={b.id} value={b.id}>
                    {c?.nombre || 'S/N'} - {p?.modelo || 'Personalizada'} (${b.monto_total.toLocaleString()})
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
                  <span className="font-bold text-slate-800">{selectedProject.modelo}</span>
                </div>
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
                        Ir a Análisis de Costos <ArrowRight size={18} />
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

                {generatedText && (
                    <div className="flex flex-col gap-8 pb-20 printable-area">
                        <div className="paper-a4 animate-in zoom-in-95 duration-300">
                             {/* Background Image softened but visible */}
                            <img 
                                src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=2000" 
                                className="paper-bg-image" 
                                style={{ opacity: 0.1, filter: 'saturate(0.5) brightness(1.1)' }}
                                alt="Background"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                            
                            {/* Round Logo at Start */}
                            <div className="flex justify-center mb-10 relative z-10">
                                 <img src={input_file_1} className="w-64 h-auto" alt="Logo Start" />
                            </div>

                            <div 
                                className="contract-content text-[11.5pt] leading-relaxed relative z-10 flex-1"
                                dangerouslySetInnerHTML={{ __html: formatTextToHtml(generatedText) }}
                            />

                            {/* Green Logo at End */}
                            <div className="mt-10 relative z-10 border-t pt-10">
                                <img src={input_file_0} className="w-full h-auto rounded-lg shadow-sm" alt="Logo End" />
                            </div>

                            {/* Pagination Placeholder */}
                            <div className="contract-page-footer relative z-10 mt-8">
                                <div className="font-bold text-slate-400">MADECAS PREFABRICADOS</div>
                                <div className="font-mono text-slate-400">Página 1 de 1</div>
                            </div>
                        </div>
                    </div>
                )}
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

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*,application/pdf" 
        onChange={handleFileUpload}
      />

      <div className="flex justify-between items-center gap-4">
        <div>
            <h3 className="text-2xl font-bold text-slate-800">Contratos Legales</h3>
            <p className="text-slate-500 text-sm">Documentos generados y firmados.</p>
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
        {contracts.map(contract => {
            // Use snapshot if available, otherwise fallback to current data (backward compatibility)
            const cli = contract.cliente_snapshot || clients.find(c => c.id === contract.cliente_id);
            const isSigned = contract.estado === ContractStatus.SIGNED;
            
            return (
                <div key={contract.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group">
                    <div className="flex items-start gap-4">
                        <div className={`mt-1 p-3 rounded-xl ${isSigned ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            <FileText size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h4 className="font-bold text-slate-800 text-lg">Contrato #{contract.id.slice(0,6)}</h4>
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
                        
                        <div className="text-right border-l pl-6 border-slate-100 hidden md:block">
                             <p className="text-xs text-slate-400 font-bold uppercase">Monto Total</p>
                             <p className="font-bold text-slate-800 text-lg">${contract.monto_total.toLocaleString()}</p>
                        </div>

                        <div className="flex gap-2 border-l pl-4 border-slate-100 ml-2">
                            {contract.documento_archivo_url ? (
                                <button 
                                    className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
                                    onClick={() => viewDocument(contract.documento_archivo_url!)}
                                    title="Ver Escaneo / PDF"
                                >
                                    {contract.documento_archivo_tipo === 'PDF' ? <FileText size={20} /> : <ImageIcon size={20} />}
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
                            className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition"
                            onClick={() => handleEditSavedContract(contract)}
                            title="Editar Datos"
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
            );
        })}
      </div>
    </div>
  );
};

export default ContractManager;
