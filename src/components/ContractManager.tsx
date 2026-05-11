
import React, { useState, useEffect, useRef } from 'react';
import { Contract, Budget, Client, Project, Vendor, ContractStatus, PaymentInstallment } from '@/types';
import { getContracts, saveContract, getBudgets, getClients, getProjects, getVendor, deleteContract } from '@/services/db';
import { generateContractText } from '@/services/geminiService';
import { Sparkles, FileText, CheckCircle, Printer, Plus, PenTool, X, Calendar, Edit3, Eye, FileType, Trash2, Maximize2, AlertCircle } from 'lucide-react';

// --- MADECAS LOGO SVG ---
const MADECAS_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" class="w-full h-full">
  <g fill="none" stroke="#e2e8f0" stroke-width="2">
     <circle cx="150" cy="50" r="45" fill="none" stroke="#e2e8f0" stroke-width="2" />
     <path d="M150 15 L180 40 L120 40 Z" fill="none" stroke="#e2e8f0" />
     <rect x="130" y="40" width="40" height="30" fill="none" stroke="#e2e8f0" />
  </g>
  <text x="150" y="55" font-family="Times New Roman, serif" font-size="20" font-weight="bold" fill="#cbd5e1" text-anchor="middle" letter-spacing="1">MADECAS</text>
  <text x="150" y="85" font-family="Times New Roman, serif" font-size="12" fill="#cbd5e1" text-anchor="middle" letter-spacing="2" text-transform="uppercase">Prefabricados</text>
</svg>
`;

const MADECAS_LOGO_HEADER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100">
  <circle cx="150" cy="50" r="48" fill="none" stroke="#000" stroke-width="1.5" />
  <path d="M150 20 L180 45 L120 45 Z" fill="#fff" stroke="#000" stroke-width="1.5"/>
  <rect x="130" y="45" width="40" height="30" fill="#fff" stroke="#000" stroke-width="1.5"/>
  <text x="150" y="40" font-family="Times New Roman, serif" font-size="8" font-weight="bold" fill="#000" text-anchor="middle">11.11.11.11</text>
  <text x="150" y="65" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#000" text-anchor="middle">MADECAS</text>
  <text x="150" y="80" font-family="Arial, sans-serif" font-size="5" fill="#000" text-anchor="middle" letter-spacing="1">WWW.MADECAS.CL</text>
  <text x="150" y="88" font-family="Arial, sans-serif" font-size="4" fill="#000" text-anchor="middle">2013</text>
</svg>
`;

const MADECAS_FOOTER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 60" preserveAspectRatio="none">
  <rect x="0" y="0" width="800" height="60" fill="#143e18" />
  <text x="400" y="35" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="2">MADECAS</text>
  <text x="400" y="52" font-family="Arial, sans-serif" font-size="10" font-weight="400" fill="#fff" text-anchor="middle" letter-spacing="8" text-transform="uppercase">PREFABRICADOS</text>
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
  const [startDate, setStartDate] = useState('');
  const [metodoPago, setMetodoPago] = useState<Contract['metodo_pago']>('Transferencia');
  const [numCuotas, setNumCuotas] = useState(1);
  const [payments, setPayments] = useState<PaymentInstallment[]>([
    { descripcion: 'Firma de Contrato (Transferencia)', porcentaje: 30, monto: 0 },
    { descripcion: 'Entrega Radier y Arranques', porcentaje: 30, monto: 0 },
    { descripcion: 'Paneles y Cerchas Instaladas', porcentaje: 30, monto: 0 },
    { descripcion: 'Contra Entrega (5 días hábiles)', porcentaje: 10, monto: 0 },
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');

  // Signing State
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [signerRole, setSignerRole] = useState<'cliente' | 'vendedor' | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
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
  }, []);

  useEffect(() => {
    if (selectedBudget) {
      setPayments(prev => prev.map(p => ({
        ...p,
        monto: Math.round(selectedBudget.monto_total * (p.porcentaje / 100))
      })));
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
    const text = await generateContractText(selectedClient, vendor, selectedProject, selectedBudget, payments, startDate);
    
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
    
    // Create the contract record with SNAPSHOTS to ensure historical data integrity
    const newContract: Contract = {
      id: crypto.randomUUID(),
      cliente_id: selectedClient.id,
      vendedor_id: vendor.id,
      proyecto_id: selectedProject.id,
      presupuesto_id: selectedBudget.id,
      fecha_contrato: new Date().toISOString().split('T')[0],
      monto_total: selectedBudget.monto_total,
      metodo_pago: metodoPago,
      cuotas_pago: numCuotas,
      estado_pago: 'Pendiente',
      hitos_pago: payments,
      estado: ContractStatus.GENERATED,
      contenido_texto: generatedText,
      
      // Saving snapshots: If the client changes address later, the contract remains valid with original data
      cliente_snapshot: selectedClient,
      proyecto_snapshot: selectedProject,
      presupuesto_snapshot: selectedBudget
    };

    saveContract(newContract);
    setContracts(getContracts());
    setIsCreating(false);
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
        // Added page-break-inside: avoid to prevent cutting
        return `<p style="text-align: justify; margin-bottom: 12px; line-height: 1.5; text-justify: inter-word; page-break-inside: avoid;">${cleanContent}</p>`;
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
                
                .header {
                    position: fixed; 
                    /* Negative top to move into margin area */
                    top: -30mm; 
                    left: 0; 
                    right: 0; 
                    height: 25mm;
                    display: flex; justify-content: center; align-items: center;
                    z-index: 20;
                }
                .footer {
                    position: fixed; 
                    /* Negative bottom to move into margin area */
                    bottom: -25mm; 
                    left: 0; 
                    right: 0; 
                    height: 20mm;
                    z-index: 20;
                    display: flex;
                    align-items: flex-end;
                }
                .watermark {
                    position: fixed; 
                    /* Compensate for @page margins to center on physical page */
                    top: -35mm; 
                    left: -20mm; 
                    width: 210mm; 
                    height: 297mm;
                    z-index: -10;
                    display: flex; justify-content: center; align-items: center;
                    opacity: 0.1;
                }
                
                /* Content Styles */
                p { 
                    margin-bottom: 12px; line-height: 1.5; 
                    text-align: justify; text-justify: inter-word; font-size: 11pt;
                    page-break-inside: avoid;
                    widows: 3; orphans: 3;
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
              <div class="watermark">
                 <img src="${encodedWatermark}" style="width: 80%; opacity: 0.5;" />
              </div>

              <div class="header">
                 <img src="${encodedLogo}" height="70" />
              </div>
              
              <div class="content">
                 ${htmlContent}
                 ${signaturesTable}
              </div>

              <div class="footer">
                 <img src="${encodedFooter}" width="100%" height="100%" style="object-fit:cover;" />
              </div>
              
              <script>
                // Wait slightly for images to render
                window.onload = function() { setTimeout(function(){ window.print(); }, 500); }
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
            <h3 className="text-lg font-bold mb-4 text-slate-800">1. Configuración Base</h3>
            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Presupuesto</label>
            <select className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" 
              value={selectedBudgetId} onChange={e => setSelectedBudgetId(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {budgets.map(b => {
                const c = clients.find(cl => cl.id === b.cliente_id);
                return <option key={b.id} value={b.id}>#{b.id.slice(0,4)} - {c?.nombre} - ${b.monto_total.toLocaleString()}</option>;
              })}
            </select>

            {selectedBudget && selectedClient && selectedProject && (
              <div className="mt-4 p-4 bg-emerald-50 rounded-lg text-sm space-y-2 border border-emerald-100">
                <p><strong className="text-emerald-800">Cliente:</strong> {selectedClient.nombre}</p>
                <p><strong className="text-emerald-800">Modelo:</strong> {selectedProject.modelo}</p>
                <p><strong className="text-emerald-800">Total:</strong> ${selectedBudget.monto_total.toLocaleString()}</p>
              </div>
            )}
          </div>

          {selectedBudget && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 animate-in slide-in-from-left-5">
                  <h3 className="text-lg font-bold text-slate-800">2. Fechas Clave</h3>
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
              </div>
          )}

          {selectedBudget && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 animate-in slide-in-from-left-5">
              <h3 className="text-lg font-bold text-slate-800">2.5 Condiciones de Venta</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pago</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    value={metodoPago}
                    onChange={(e) => setMetodoPago(e.target.value as any)}
                  >
                    <option value="Contado">Contado</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Crédito Directo">Crédito Directo</option>
                    <option value="Crédito Hipotecario">Crédito Hipotecario</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">N° Cuotas</label>
                  <input 
                    type="number"
                    min="1"
                    max="120"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    value={numCuotas}
                    onChange={(e) => setNumCuotas(parseInt(e.target.value) || 1)}
                  />
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
            {!generatedText && (
              <div className="flex flex-col items-center justify-center text-slate-400 mt-20">
                <FileText size={64} className="mb-4 opacity-20" />
                <p className="text-lg font-medium text-slate-500">Área de Previsualización</p>
                <p className="text-sm max-w-xs text-center mt-2 opacity-70">El contrato generado aparecerá aquí.</p>
              </div>
            )}

            {generatedText && viewMode === 'edit' && (
                <div className="w-full max-w-[210mm] h-full bg-white shadow-sm border border-slate-300 rounded-lg overflow-hidden">
                    <textarea 
                        className="w-full h-full p-8 font-mono text-sm leading-relaxed outline-none resize-none text-slate-800 bg-white"
                        value={generatedText}
                        onChange={(e) => setGeneratedText(e.target.value)}
                        placeholder="Edición manual..."
                    />
                </div>
            )}

            {generatedText && viewMode === 'preview' && (
                <div className="paper-a4 animate-in zoom-in-95 duration-300">
                    <div className="watermark-container">
                        <div dangerouslySetInnerHTML={{ __html: MADECAS_LOGO_SVG }} />
                    </div>
                    
                    {/* Header for preview only */}
                    <div className="flex justify-center mb-8">
                         <div className="h-20 w-64" dangerouslySetInnerHTML={{ __html: MADECAS_LOGO_HEADER_SVG }} />
                    </div>

                    <div 
                        className="contract-content text-[11pt] leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: formatTextToHtml(generatedText) }}
                    />

                    {/* Footer for preview only */}
                    <div className="mt-16">
                        <div className="h-10 w-full" dangerouslySetInnerHTML={{ __html: MADECAS_FOOTER_SVG }} />
                    </div>
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
