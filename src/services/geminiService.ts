
import { GoogleGenAI } from "@google/genai";
import { Client, Project, Budget, Vendor, PaymentInstallment, Contract } from "@/types";

const getGeminiClient = () => {
  // Try to get from process.env (Vite define) or import.meta.env (Standard Vite)
  const apiKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined') 
    ? process.env.GEMINI_API_KEY 
    : (import.meta as any).env?.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'undefined' || apiKey === '') {
    throw new Error("ERROR: La API KEY de Gemini no está configurada. En Vercel, añade VITE_GEMINI_API_KEY o GEMINI_API_KEY a las variables de entorno.");
  }
  return new GoogleGenAI(apiKey);
};

// --- Contract Generation ---

export const generateContractText = async (
  client: Client,
  vendor: Vendor,
  project: Project,
  budget: Budget,
  payments: PaymentInstallment[],
  startDate: string
): Promise<string> => {
  try {
    const ai = getGeminiClient();

    const systemInstruction = `
    Eres un abogado experto en contratos inmobiliarios y de construcción para la empresa "MADECAS".
    
    TU OBJETIVO: Redactar un CONTRATO DE COMPRAVENTA DE CASA PREFABRICADA siguiendo estrictamente el formato adjunto por el usuario, corrigiendo la numeración de las cláusulas.
    
    IMPORTANTE: DEBES INCLUIR LA CLÁUSULA "TERCERO" QUE A MENUDO SE OMITE. NO SALTES DEL SEGUNDO AL CUARTO.
    
    REGLAS DE FORMATO:
    1. Usa formato Markdown limpio.
    2. NO uses bloques de código.
    3. Mantén un tono legal formal (Chile).
    4. Usa negritas (**texto**) para nombres, RUTs, fechas y montos.
    
    ESTRUCTURA DE CLÁUSULAS OBLIGATORIA:
    
    1. **PRIMERO (Objeto):** "EL VENDEDOR es dueño del proyecto DE UNA CASA MODELO [NOMBRE]..." Detallar materiales y superficie.
    
    2. **DECLARACIONES DEL COMPRADOR:** (Sin número de cláusula, usar subtítulo "Del mismo el COMPRADOR declara:"). Lista de viñetas sobre conocimiento del proyecto, permisos, etc.
    
    3. **SEGUNDO (Obligaciones Comprador):** "Por este acto el COMPRADOR se obliga a...". (Pagos, condiciones terreno, permisos, acceso).
    
    4. **TERCERO (Obligaciones Vendedor):** "Por este acto el VENDEDOR se obliga a: a) Entregar al COMPRADOR el SERVICIO contratado... b) Respetar plazos... c) Proporcionar información...". 
       *ESTA CLÁUSULA ES CRÍTICA. NO LA OMITAS.*
    
    5. **CUARTO (La Venta):** "Por el presente instrumento [EMPRESA] vende al COMPRADOR... la propiedad de los bienes MUEBLES...".
    
    6. **QUINTO (Precio):** "El valor es la suma de [MONTO]...".
    
    7. **SEXTO (Forma de Pago):** Desglose detallado de las cuotas. Incluir nota: "No se aceptará el cheque...". Incentivo traslado SIN COSTO.
    
    8. **SÉPTIMO (Plazos):** "EL VENDEDOR se obliga a poner en terreno... el DIA [FECHA INICIO]...".
    
    9. **OCTAVO (Multa):** "Se establece una cláusula penal equivalente al 25% del valor total...".
    
    10. **NOVENO (Jurisdicción):** Tribunales de Osorno.
    
    11. **DÉCIMO (Ejemplares):** Dos ejemplares.
    
    12. **UNDÉCIMO (Facultad):** Facultad de retiro si no paga.
    
    INSTRUCCIONES DE CONTENIDO:
    - Incluye el detalle técnico completo del proyecto en la cláusula PRIMERO.
    - Convierte todos los montos a palabras y cifras (ej: $1.000.000 (UN MILLÓN DE PESOS)).
    - Asegúrate de que el texto sea fluido y profesional.
    `;

    const prompt = `
    Genera el contrato con los siguientes datos:

    VENDEDOR: ${vendor.nombre}, RUT ${vendor.rut}, Rep: ${vendor.nombre === 'COMERCIALIZADORA MADECAS SPA' ? 'EDUARDO HUMBERTO SOTO ALVARADO' : 'Representante Legal'}, Domicilio: ${vendor.domicilio}.
    COMPRADOR: ${client.nombre}, RUT ${client.rut}, Domicilio: ${client.domicilio}, Tel: ${client.telefono}, Email: ${client.correo}.
    
    PROYECTO: ${project.modelo}, ${project.superficie_m2} m2.
    MATERIALES: ${project.materiales_principales.join(", ")}. ADICIONALES: ${project.adicionales.join(", ")}.
    
    PRESUPUESTO TOTAL: $${budget.monto_total.toLocaleString('es-CL')}.
    PAGOS:
    ${payments.map(p => `- ${p.descripcion}: ${p.porcentaje}% ($${p.monto.toLocaleString('es-CL')})`).join("\n")}
    
    FECHA INICIO: ${startDate}.
    FECHA HOY: ${new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}.
    `;

    const response = await ai.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    }).generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
      }
    });

    return response.response.text() || "Error al generar contrato.";
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
    const model = ai.getGenerativeModel({
        model: "gemini-1.5-flash",
    });

    const prompt = "Actúa como un experto en presupuestos de construcción y OCR. Analiza COMPLETAMENTE este documento (imagen o PDF). Extrae TODOS los ítems, materiales o servicios listados. Retorna EXCLUSIVAMENTE un JSON válido con esta estructura: { \"items\": [ {\"descripcion\": string, \"cantidad\": number, \"unidad\": string, \"precio_unitario\": number} ] }. Asegúrate de que los números sean puros. Si la imagen es borrosa o el PDF es complejo, identifica los términos clave de construcción.";

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    return response.text() || "";
  } catch (error) {
    console.error("Error analyzing file:", error);
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

    const model = ai.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemInstruction,
    });

    const result = await model.generateContent(userPrompt);
    const response = await result.response;

    return response.text() || "No se pudo generar el análisis.";

  } catch (error) {
    console.error("Error in AI Analysis:", error);
    return "Error al procesar la solicitud con Inteligencia Artificial.";
  }
};
