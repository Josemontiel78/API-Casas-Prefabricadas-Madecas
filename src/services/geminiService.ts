
import { GoogleGenAI } from "@google/genai";
import { Client, Project, Budget, Vendor, PaymentInstallment, Contract } from "@/types";

const getGeminiClient = () => {
  // Try to get from multiple sources for maximum compatibility across environments (Vite, Vercel, AIS)
  let apiKey = '';
  
  try {
    apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined') 
      ? process.env.GEMINI_API_KEY 
      : (import.meta as any).env?.VITE_GEMINI_API_KEY;
  } catch (e) {
    apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  }
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    console.warn("API Key not found in process.env or import.meta.env");
    throw new Error("ERROR_CONFIG: La API KEY de Gemini no está configurada. En Vercel, añade VITE_GEMINI_API_KEY a las variables de entorno.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- Contract Generation ---

export const generateContractText = async (
  client: Client,
  vendor: Vendor,
  project: Project,
  budget: Budget,
  payments: PaymentInstallment[],
  startDate: string,
  plazoInstalacion: number = 30,
  lugarSuscripcion: string = 'Osorno'
): Promise<string> => {
  try {
    const ai = getGeminiClient();

    const systemInstruction = `
    Eres un abogado experto en contratos inmobiliarios y de construcción para la empresa "MADECAS".
    
    TU OBJETIVO: Redactar un CONTRATO DE COMPRAVENTA DE CASA PREFABRICADA siguiendo estrictamente el formato tradicional de MADECAS.
    
    IMPORTANTE: DEBES INCLUIR LA CLÁUSULA "TERCERO" QUE A MENUDO SE OMITE.
    
    REGLAS DE FORMATO:
    1. Usa formato Markdown limpio.
    2. Mantén un tono legal formal (Chile).
    3. Usa negritas (**texto**) para nombres, RUTs, fechas y montos.
    
    ESTRUCTURA DE CLÁUSULAS OBLIGATORIA:
    
    1. **PRIMERO (Objeto):** Venta de casa prefabricada modelo **${project.modelo}**. Detallar materiales.
    2. **DECLARACIONES DEL COMPRADOR**
    3. **SEGUNDO (Obligaciones Comprador)**
    4. **TERCERO (Obligaciones Vendedor)**
    5. **CUARTO (La Venta)**
    6. **QUINTO (Precio):** Valor total de **$${budget.monto_total.toLocaleString('es-CL')}**.
    7. **SEXTO (Forma de Pago):** Incluir datos bancarios: **${vendor.banco_nombre}**, **${vendor.banco_tipo_cuenta}**, N° **${vendor.banco_numero_cuenta}**. Desglosar hitos de pago.
    8. **SÉPTIMO (Plazos):** Fecha de inicio de obra **${startDate}**. Mencionar que el vendedor tiene un plazo de **${plazoInstalacion} días hábiles** para el montaje.
    9. **OCTAVO (Multa):** 25% del valor total.
    10. **NOVENO (Jurisdicción):** Tribunales de **${lugarSuscripcion}**.
    11. **DÉCIMO (Ejemplares)**
    12. **UNDÉCIMO (Facultad)**
    
    INSTRUCCIONES DE CONTENIDO:
    - La introducción debe decir: "En **${lugarSuscripcion}**, a **${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}**..."
    - Convierte montos a palabras (ej: $1.000.000 (UN MILLÓN DE PESOS)).
    `;

    const prompt = `
    Genera el contrato con los siguientes datos:
    VENDEDOR: ${vendor.nombre}, RUT ${vendor.rut}, Rep: ${vendor.nombre === 'COMERCIALIZADORA MADECAS SPA' ? 'EDUARDO HUMBERTO SOTO ALVARADO' : 'Representante Legal'}, Domicilio: ${vendor.domicilio}.
    COMPRADOR: ${client.nombre}, RUT ${client.rut}, Domicilio: ${client.domicilio}, Tel: ${client.telefono}, Email: ${client.correo}.
    PROYECTO: ${project.modelo}, ${project.superficie_m2} m2.
    MATERIALES: ${project.materiales_principales.join(", ")}. ADICIONALES: ${project.adicionales.join(", ")}.
    PRESUPUESTO TOTAL: $${budget.monto_total.toLocaleString('es-CL')}.
    PAGOS: ${payments.map(p => `- ${p.descripcion}: ${p.porcentaje}% ($${p.monto.toLocaleString('es-CL')})`).join("\n")}
    FECHA INICIO: ${startDate}.
    PLAZO MONTAJE: ${plazoInstalacion} días hábiles.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: systemInstruction + "\n\n" + prompt }] }],
      config: {
        temperature: 0.1,
      }
    });

    return response.text || "Error al generar contrato.";
  } catch (error) {
    console.error("Error generating contract:", error);
    const msg = (error as Error).message;
    return `Error de conexión con IA: ${msg}`;
  }
};

// --- Budget File Analysis ---

export const analyzeBudgetFile = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const ai = getGeminiClient();

    const prompt = "Actúa como un experto en presupuestos de construcción y OCR. Analiza COMPLETAMENTE este documento (PDF o Imagen). Extrae TODOS los ítems, materiales o servicios listados. Retorna EXCLUSIVAMENTE un JSON válido con esta estructura: { \"items\": [ {\"descripcion\": string, \"cantidad\": number, \"unidad\": string, \"precio_unitario\": number} ] }. Asegúrate de que los números sean puros (sin símbolos de moneda). Si el PDF es complejo, identifica los términos clave de construcción.";

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
          parts: [
            {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data
                }
            },
            { text: prompt }
          ]
      }
    });

    let text = response.text || "";
    
    // Extract JSON using regex to handle potential text around the code block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        text = jsonMatch[0];
    }
    
    return text.trim();
  } catch (error: any) {
    console.error("Error in Gemini analyzeBudgetFile:", error);
    if (error.message?.includes('403')) throw new Error("API_KEY_INVALID");
    if (error.message?.includes('429')) throw new Error("QUOTA_EXCEEDED");
    throw error;
  }
};

// --- Advanced Business Analysis (Super AI) ---

export const generateBusinessAnalysis = async (
  contextData: {
    clients: Client[],
    projects: Project[],
    budgets: Budget[],
    contracts: Contract[],
    vendor: Vendor
  },
  userPrompt: string
): Promise<string> => {
  try {
    const ai = getGeminiClient();

    const contextString = JSON.stringify(contextData, null, 2);

    const systemInstruction = `
    Eres un ASESOR ESTRATÉGICO SENIOR con doble perfil: Ingeniero Civil Informático e Ingeniero Comercial especialista en Viviendas Prefabricadas.
    Tu misión es asesorar a MADECAS PREFABRICADOS en su expansión y eficiencia operativa.
    
    Tienes acceso completo a la base de datos de la empresa:
    - Clientes: Análisis de perfiles de compra y RUTs.
    - Proyectos/Catálogo: Análisis de m2, materiales y popularidad.
    - Presupuestos: Flujo de caja proyectado.
    - Contratos: Ingresos reales y legalidad.
    
    ESTILO DE RESPUESTA:
    1. Análisis de Interoperabilidad: Cruza datos entre las tablas para encontrar inconsistencias o prospectos de alto valor.
    2. Enfoque en Georeferencia: Si hay coordenadas, sugiere rutas logísticas o zonificación de ventas.
    3. Ingeniería Comercial: Habla de ROI, Margen Bruto, Pipeline de Ventas, y Tasa de Conversión (Leads a Contratos).
    4. Formato: Markdown técnico y elegante. Usa tablas para comparativas de costos de modelos.
    
    DATOS ACTUALES DE LA EMPRESA (Contexto JSON):
    ${contextString}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.3,
      }
    });

    return response.text || "No se pudo generar el análisis.";

  } catch (error) {
    console.error("Error in AI Analysis:", error);
    return "Error al procesar la solicitud con Inteligencia Artificial.";
  }
};
