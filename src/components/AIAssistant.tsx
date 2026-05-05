
import React, { useState, useEffect, useRef } from 'react';
import { getClients, getProjects, getBudgets, getContracts, getVendor } from '@/services/db';
import { generateBusinessAnalysis } from '@/services/geminiService';
import { Send, Mic, BrainCircuit, FileText, PieChart, TrendingUp, Download, Sparkles, StopCircle, RefreshCw, BarChart3, Mail } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: 'Hola, soy tu Analista Virtual de MADECAS. Tengo acceso a todos tus contratos y presupuestos. ¿En qué puedo ayudarte hoy?',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Data Context for AI
  const [dataContext, setDataContext] = useState<any>(null);

  useEffect(() => {
    // Load fresh data every time component mounts
    setDataContext({
        clients: getClients(),
        projects: getProjects(),
        budgets: getBudgets(),
        contracts: getContracts(),
        vendor: getVendor()
    });
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
        const aiResponse = await generateBusinessAnalysis(dataContext, text);
        const botMsg: Message = { role: 'assistant', content: aiResponse, timestamp: new Date().toLocaleTimeString() };
        setMessages(prev => [...prev, botMsg]);
    } catch (error) {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Lo siento, tuve un problema al analizar los datos.', timestamp: new Date().toLocaleTimeString() }]);
    } finally {
        setIsLoading(false);
    }
  };

  // --- Voice Recognition ---
  const toggleRecording = () => {
    if (isRecording) {
        setIsRecording(false);
        return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Tu navegador no soporta reconocimiento de voz.');
        return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CL';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognition.start();
  };

  const downloadReport = (content: string) => {
     const element = document.createElement("a");
     const file = new Blob([content], {type: 'text/plain'});
     element.href = URL.createObjectURL(file);
     element.download = "Reporte_IA_Madecas.md";
     document.body.appendChild(element);
     element.click();
  };

  const quickActions = [
    { label: 'Resumen Financiero Global', icon: PieChart, prompt: 'Genera un resumen financiero detallado: Total de ventas históricas, monto pendiente de cobro, contratos firmados vs borradores y ticket promedio de venta.' },
    { label: 'Análisis por Modelo', icon: BarChart3, prompt: 'Analiza qué modelo de casa es el más vendido y cuál genera más ingresos. Muestra una tabla comparativa.' },
    { label: 'Reporte de Clientes', icon: TrendingUp, prompt: 'Identifica a los mejores clientes o proyectos más grandes. ¿Hay clientes recurrentes o con presupuestos altos pendientes de firma?' },
    { label: 'Redactar Seguimiento', icon: Mail, prompt: 'Redacta un correo plantilla formal para enviar a clientes que tienen presupuestos generados pero no han firmado contrato, ofreciendo un descuento del 5% si cierran este mes.' },
  ];

  // Helper to format Markdown-like AI response to HTML
  const formatAIResponse = (text: string) => {
      let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold text-emerald-700 mt-4 mb-2">$1</h3>') // H3
        .replace(/## (.*?)\n/g, '<h2 class="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1">$1</h2>') // H2
        .replace(/- (.*?)\n/g, '<li class="ml-4 list-disc">$1</li>') // Lists
        .replace(/\n/g, '<br/>'); // Line breaks
      return html;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-6">
       
       {/* Header with Quick Actions */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
          {quickActions.map((action, idx) => (
             <button 
               key={idx}
               onClick={() => handleSend(action.prompt)}
               disabled={isLoading}
               className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-emerald-400 hover:shadow-md transition text-left group"
             >
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg w-fit mb-3 group-hover:scale-110 transition-transform">
                    <action.icon size={20} />
                </div>
                <h4 className="font-bold text-slate-700 text-sm group-hover:text-emerald-700">{action.label}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">Generar reporte automático...</p>
             </button>
          ))}
       </div>

       {/* Chat Area */}
       <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
             {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   <div className={`max-w-[80%] rounded-2xl p-5 shadow-sm ${
                       msg.role === 'user' 
                       ? 'bg-emerald-600 text-white rounded-tr-none' 
                       : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                   }`}>
                      {msg.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100 opacity-70">
                              <BrainCircuit size={16} /> 
                              <span className="text-xs font-bold uppercase">Análisis Madecas AI</span>
                              <span className="ml-auto text-[10px]">{msg.timestamp}</span>
                          </div>
                      )}
                      
                      <div 
                        className={`text-sm leading-relaxed ${msg.role === 'assistant' ? 'markdown-content' : ''}`}
                        dangerouslySetInnerHTML={{ __html: formatAIResponse(msg.content) }} 
                      />

                      {msg.role === 'assistant' && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                              <button 
                                onClick={() => downloadReport(msg.content)}
                                className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-600 transition"
                              >
                                  <Download size={14} /> Descargar Reporte
                              </button>
                          </div>
                      )}
                   </div>
                </div>
             ))}
             {isLoading && (
                 <div className="flex justify-start">
                     <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                         <div className="animate-spin text-emerald-600"><RefreshCw size={18} /></div>
                         <span className="text-sm text-slate-500 font-medium">Analizando base de datos...</span>
                     </div>
                 </div>
             )}
             <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-200 flex gap-3 items-end">
             <button 
               onClick={toggleRecording}
               className={`p-3 rounded-full transition-all shrink-0 ${
                   isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
               }`}
               title="Dictar consulta"
             >
                {isRecording ? <StopCircle size={22} /> : <Mic size={22} />}
             </button>

             <textarea 
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => {
                   if(e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       handleSend();
                   }
               }}
               placeholder={isRecording ? "Escuchando..." : "Escribe tu consulta (ej: ¿Cuál es el proyecto más rentable?)"}
               className="flex-1 resize-none bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 outline-none max-h-32 text-sm"
               rows={1}
             />

             <button 
               onClick={() => handleSend()}
               disabled={isLoading || !input.trim()}
               className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-200 disabled:opacity-50 disabled:shadow-none transition shrink-0"
             >
                <Send size={22} />
             </button>
          </div>
       </div>
    </div>
  );
};

export default AIAssistant;
