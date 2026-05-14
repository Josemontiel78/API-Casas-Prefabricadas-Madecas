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
  const match = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    console.error("Error parsing extracted JSON:", e);
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
      Genera un ${isAnexo ? 'ANEXO AL CONTRATO' : 'CONTRATO DE COMPRAVENTA'} detallado y profesional en español.
      
      DATOS DEL VENDEDOR:
      - Nombre/Empresa: ${vendor.nombre}
      - RUT: ${vendor.rut}
      
      DATOS DEL COMPRADOR (CLIENTE):
      - Nombre: ${client.nombre}
      - RUT: ${client.rut}
      - Correo: ${client.correo}
      
      DATOS DEL PROYECTO:
      - Modelo de Casa: ${project.modelo}
      - Superficie: ${project.superficie_m2}m2
      
      DATOS ECONÓMICOS:
      - Precio Total: $${budget.monto_total.toLocaleString()}
      
      PLAZOS Y CONDICIONES:
      - Fecha de Inicio: ${startDate}
      - Plazo de Instalación: ${plazoInstalacion} días
      - Lugar de Suscripción: ${lugarSuscripcion}
      
      ESTRUCTURA DE PAGOS:
      ${payments.map((p, i) => `${i + 1}. ${p.descripcion}: $${p.monto.toLocaleString()} (${p.porcentaje}%)`).join('\n')}
      
      Por favor, genera un documento con cláusulas legales estándar para Chile (o contexto general profesional), numeradas, incluyendo identificación de las partes, objeto, precio y forma de pago, plazos, garantías y resolución de conflictos.
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
    const prompt = `Analiza los planos o especificaciones de este modelo de casa. 
    Extrae el nombre, la superficie total, el precio base aproximado y el detalle de ítems (especificaciones).
    IMPORTANTE: El precio base debe ser un número sin puntos ni comas.
    Responde ÚNICAMENTE con un objeto JSON con este formato exacto: 
    {
      "nombre": "...", 
      "superficie_m2": 0, 
      "preciobase": 0, 
      "especificaciones": [
        {"descripcion": "...", "cantidad": 1, "unidad": "un", "precio_unitario": 0, "total": 0}
      ]
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

    const text = response.text || "{}";
    const parsed = extractJSON(text);
    return parsed || {};
  } catch (error) {
    console.error("Error in analyzeHouseModelFile:", error);
    return {};
  }
};
