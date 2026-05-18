import { GoogleGenAI } from "@google/genai";
import { Client, Project, Budget, Vendor, PaymentInstallment, Contract, HouseModel } from "@/types";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("La API Key de Gemini no está configurada.");
  }
  return new GoogleGenAI({ apiKey });
};

const DEFAULT_MODEL = "gemini-3-flash-preview";

const extractJSON = (text: string) => {
  try {
    // Try to find the last occurrence of { and } to get the main JSON object if there's text around it
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const jsonStr = text.substring(start, end + 1);
      return JSON.parse(jsonStr);
    }
    // Fallback to array match if no object found
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    
    return JSON.parse(text);
  } catch (e) {
    console.error("Error parsing extracted JSON:", e, "Raw text:", text);
    return null;
  }
};

export const generateContractText = async (
  client: Client, 
  vendor: Vendor, 
  project: Project, 
  budget: Budget, 
  payments: PaymentInstallment[], 
  startDate: string, 
  plazoInstalacion: number, 
  lugarSuscripcion: string, 
  isAnexo: boolean
): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const prompt = `
      Genera un ${isAnexo ? 'ANEXO AL CONTRATO' : 'CONTRATO DE COMPRAVENTA'} formal y detallado siguiendo estrictamente este modelo para la empresa "INVERSIONES E&E SPA".
      
      ENCABEZADO:
      CONTRATO DE COMPRAVENTA
      INVERSIONES E&E SPA Y ${client.nombre.toUpperCase()}
      
      DATOS DEL VENDEDOR:
      - Empresa: INVERSIONES E&E SPA, Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 78.210.119-6.
      - Representante: SR EDUARDO HUMBERTO SOTO ALVARADO, RUT 15.272.818-2, TELEFONO: +569 7777 00 22.
      - Domicilio: RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Ciudad de Osorno, comuna de Osorno, X REGION.
      
      DATOS DEL COMPRADOR (CLIENTE):
      - Nombre: ${client.nombre}
      - RUT: ${client.rut}
      - Domicilio: ${client.domicilio}
      - Teléfono: ${client.telefono}
      - Correo: ${client.correo}
      
      DATOS DEL PROYECTO:
      - Modelo de Casa: ${project.modelo}
      - Superficie: ${project.superficie_m2} m2
      - Lugar de Instalación: Domicilio del comprador.
      
      ESPECIFICACIONES TÉCNICAS (DEBEN LISTARSE EN LA CLÁUSULA PRIMERA):
      ${budget.detalle_items.map(i => `- ${i.descripcion.toUpperCase()}`).join('\n')}
      
      DATOS ECONÓMICOS:
      - Precio Total: $${budget.monto_total.toLocaleString()}
      
      PLAZOS Y CONDICIONES:
      - Fecha de Inicio: ${startDate}
      - Plazo de Instalación: ${plazoInstalacion} días hábiles.
      - Lugar de Suscripción: ${lugarSuscripcion}
      
      ESTRUCTURA DE PAGOS (DEBE LISTARSE EN LA CLÁUSULA SEXTA):
      ${payments.map((p, i) => `${String.fromCharCode(97 + i)}) ${p.descripcion}: $${p.monto.toLocaleString()} (${p.porcentaje}%)`).join('\n')}
      
      INSTRUCCIONES DE FORMATO:
      - Usa cláusulas numeradas (PRIMERO, SEGUNDO, TERCERO, CUARTO, QUINTO, SEXTO, SÉPTIMO, OCTAVO, NOVENO, DÉCIMO, DECIMO PRIMERO).
      - La cláusula PRIMERO debe detallar el objeto (casa modelo Contemporáneo ${project.superficie_m2} M2) y listar TODAS LAS ESPECIFICACIONES TÉCNICAS. CADA ESPECIFICACIÓN DEBE ESTAR EN SU PROPIA LÍNEA COMENZANDO CON UN GUION (-) para asegurar que se listen de forma vertical.
      - Posterior a la frase "El proyecto se ajustará estrictamente a las siguientes especificaciones técnicas:", asegúrate de que haya un SALTO DE LÍNEA DOBLE antes de empezar la lista vertical.
      - Incluye la sección "Del mismo el COMPRADOR declara:" con sus puntos correspondientes tras la cláusula primero.
      - La cláusula SEGUNDO debe ser "DE LAS OBLIGACIONES DEL COMPRADOR" y debe contener una lista ordenada con letras a), b), c), d). CADA ITEM DEBE ESTAR EN SU PROPIA LÍNEA.
      - La cláusula CUARTO debe ser "DE LAS OBLIGACIONES DEL VENDEDOR" y debe contener una lista ordenada con letras a), b), c). CADA ITEM DEBE ESTAR EN SU PROPIA LÍNEA.
      - La cláusula QUINTO para la venta de bienes muebles.
      - La cláusula SEXTO detallando el valor total ($${budget.monto_total.toLocaleString()}) y el plan de pagos letra por letra (a, b, c, d) EN FORMATO DE LISTA VERTICAL.
      - IMPORTANTE: Cada ítem de pago (a), b), etc.) debe comenzar en una NUEVA LÍNEA. No los pongas uno tras otro en la misma línea.
      - Asegúrate de que haya un salto de línea claro después de la frase introductoria del precio total.
      - Las cláusulas SÉPTIMO a DECIMO PRIMERO deben seguir el modelo legal proporcionado.
      - IMPORTANTE: NO incluyas la palabra "FIRMAS" ni líneas de firma al final. El contrato termina en el punto final de la cláusula DÉCIMO PRIMERO.
      - Asegúrate de que no haya saltos de línea excesivos entre los ítems de las listas.
      - Utiliza un lenguaje legal chileno formal y asegúrate de que todas las enumeraciones sean estrictamente secuenciales.
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "Error al generar el texto del contrato.";
  } catch (error: any) {
    console.error("Error in generateContractText:", error);
    if (error.message?.includes("API Key")) return "Error: API Key de Gemini no configurada.";
    return `Error en la generación: ${error.message || "Error desconocido"}`;
  }
};

export const analyzeBudgetFile = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const prompt = `Analiza este documento de presupuesto o cubicación. Extrae la información relevante como ítems, cantidades, unidades, precios unitarios y totales. 
    Responde ÚNICAMENTE con un objeto JSON con este formato:
    {
      "items": [{"descripcion": "...", "cantidad": 1, "unidad": "un", "precio_unitario": 100, "total": 100}],
      "superficie_m2": 0
    }`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        { 
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ] 
        }
      ],
    });

    return response.text || "{}";
  } catch (error: any) {
    console.error("Error in analyzeBudgetFile:", error);
    return JSON.stringify({ items: [], error: error.message });
  }
};

export const suggestCubicacionAI = async (descripcion: string, superficieM2: number): Promise<any[]> => {
  try {
    const ai = getGeminiClient();
    const prompt = `Sugiéreme una lista de ítems de construcción para una casa de ${superficieM2}m2 con la siguiente descripción: "${descripcion}".
    Responde ÚNICAMENTE con un array JSON válido de objetos con este formato: 
    [{"item": "Nombre del ítem", "descripcion": "Breve detalle", "cantidad": 10, "unidad": "m2", "precio_unitario": 5000, "total": 50000}]`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "[]";
    const match = text.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (error) {
    console.error("Error in suggestCubicacionAI:", error);
    return [];
  }
};

export const analyzeCommercialAI = async (client: Client, projects: Project[], budgets: Budget[], contracts: Contract[]): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const prompt = `Realiza un análisis comercial estratégico para el cliente ${client.nombre}. 
    Contexto: Compras realizadas: ${contracts.length}, Presupuestos vigentes: ${budgets.length}, Proyectos asociados: ${projects.length}.
    Incluye recomendaciones de fidelización y oportunidades de venta cruzada.`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "Análisis no disponible.";
  } catch (error) {
    console.error("Error in analyzeCommercialAI:", error);
    return "Error al generar el análisis comercial.";
  }
};

export const generateBusinessAnalysis = async (context: any, userPrompt: string): Promise<string> => {
  try {
    const ai = getGeminiClient();
    const prompt = `Contexto del Negocio: ${JSON.stringify(context)}. 
    Usuario pregunta: ${userPrompt}
    Responde como un consultor de negocios experto para Madacas (empresa de casas prefabricadas).`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "No tengo una respuesta para eso en este momento.";
  } catch (error) {
    console.error("Error in generateBusinessAnalysis:", error);
    return "Error al procesar la consulta empresarial.";
  }
};

export const analyzeHouseModelFile = async (base64Data: string, mimeType: string): Promise<Partial<HouseModel>> => {
  try {
    const ai = getGeminiClient();
    const prompt = `Actúa como un experto en arquitectura y construcción modular. 
    Analiza este archivo (imagen o PDF) que contiene la ficha técnica, planos o publicidad de un modelo de casa prefabricada.
    Extrae la siguiente información:
    
    1. nombre: El nombre comercial del modelo.
    2. descripcion: Un resumen persuasivo de 1-2 párrafos sobre características.
    3. superficie_m2: Metraje total en m2 (solo número).
    4. preciobase: Valor de venta base (solo número, sin puntos ni símbolos).
    5. especificaciones: Lista de ítems con {descripcion, cantidad, unidad, precio_unitario, total}.

    IMPORTANTE: Responde EXCLUSIVAMENTE con el objeto JSON. Sin explicaciones previas ni posteriores.
    Si no encuentras un dato, usa valores por defecto (0 para números, "" para strings).`;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [
        { 
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
          ] 
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text || "{}";
    const parsed = extractJSON(text);

    if (!parsed) return {};

    // Standardize price field and ensure numeric types
    return {
      nombre: parsed.nombre || parsed.name || "",
      descripcion: parsed.descripcion || parsed.description || "",
      superficie_m2: Number(parsed.superficie_m2) || Number(parsed.superficie) || 0,
      preciobase: Number(parsed.preciobase) || Number(parsed.precio_base) || Number(parsed.valor_venta) || 0,
      especificaciones: Array.isArray(parsed.especificaciones) ? parsed.especificaciones : []
    };
  } catch (error) {
    console.error("Error in analyzeHouseModelFile:", error);
    return {};
  }
};
