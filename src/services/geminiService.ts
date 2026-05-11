
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
  lugarSuscripcion: string = 'Osorno',
  isAnexo: boolean = false
): Promise<string> => {
  try {
    const ai = getGeminiClient();    const systemInstruction = `
    Eres un abogado experto en contratos inmobiliarios y de construcción para la empresa "MADECAS".
    
    TU OBJETIVO: Redactar un ${isAnexo ? '"ANEXO DE CONTRATO"' : '"CONTRATO DE COMPRAVENTA"'} siguiendo estrictamente el tono y estructura observada en los documentos oficiales de la empresa.
    
    ${isAnexo ? 'Este es un ANEXO, por lo tanto debe referenciar que modifica un contrato previo y detallar los cambios en presupuesto o plazos manteniendo la validez del contrato original.' : ''}
    
    ESTRUCTURA OBLIGATORIA DEL DOCUMENTO:
    
    1. **ENCABEZADO:** 
       - Título: ${isAnexo ? '"ANEXO DE CONTRATO"' : '"CONTRATO DE COMPRAVENTA"'} (Centrado).
       - Línea de Identificación de Partes: "COMERCIALIZADORA MADECAS SPA Y SR/A [NOMBRE CLIENTE]"
    
    2. **PÁRRAFO DE INTRODUCCIÓN:**
       - Formato: "En [LUGAR], a [FECHA_LARGA], entre COMERCIALIZADORA MADECAS SPA, del Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 77.300.759-4 representada por SR EDUARDO HUMBERTO SOTO ALVARADO RUT 15.272.818-2 TELEFONO: +569 7777 00 22, domiciliado para estos efectos en RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Ciudad de Osorno, comuna de Osorno, X REGION, en adelante “EL VENDEDOR”, por una parte; y , por la otra, don (a) [NOMBRE CLIENTE] RUT: [RUT CLIENTE], DOMICILIADO EN [DOMICILIO], TELÉFONO: [TELEFONO], CORREO ELECTRONICO: [CORREO], en adelante “EL COMPRADOR”, han convenido en celebrar el siguiente Contrato de Compraventa:"
    
    3. **CLÁUSULAS (Usar números ordinales en mayúsculas: PRIMERO, SEGUNDO, etc.):**
       - **PRIMERO:** "EL VENDEDOR es dueño del proyecto DE UNA CASA MODELO [MODELO] DE [M2] MT2 EL CUAL SERÁ ADQUIRIDO POR EL COMPRADOR PARA SER INSTALADO EN TERRENO DE SU PROPIEDAD, UBICADO EN SU DOMICILIO."
       - **ESPECIFICACIONES TÉCNICAS (Basadas en el proyecto):** Listar con guiones (-) según el PDF de muestra: PISO, PANELES EXTERIORES, PANELES INTERIORES, CERCHAS, COSTANERAS, TECHUMBRE, PUERTAS, VENTANAS, ADICIONALES.
       - **DECLARACIONES DEL COMPRADOR:** Incluir la sección "Del mismo el COMPRADOR declara" con los puntos sobre conocimiento de materiales, visita a piloto, permisos (responsabilidad del cliente), planos, propiedad del terreno.
       - **SEGUNDO (Obligaciones Comprador):** Pago del precio, condiciones de recepción de materiales, entrada adecuada para camiones, nivelación de terreno.
       - **CUARTO (Obligaciones Vendedor):** Entrega de servicio según contrato, respeto a plazos.
       - **QUINTO:** Transferencia de propiedad de bienes muebles.
       - **SEXTO (Precio y Pago - CRÍTICO):** Valor total en números y palabras. Detalle de HITOS de pago según el 30%-30%-30%-10% observado:
         d) 30% a la firma (Transferencia CTA CTE 81500255536 Banco Estado).
         e) 30% avance ENTREGA DE RADIER CON ARRANQUES SANITARIOS.
         f) 30% entrega de PANELES Y CERCHAS INSTALADAS.
         g) 10% final máximo 5 días hábiles después de la entrega.
       - **SÉPTIMO:** Inicio de obra en fecha [FECHA_INICIO].
       - **OCTAVO:** Cláusula penal (25%).
       - **NOVENO, DÉCIMO, DECIMO PRIMERO:** Jurisdicción, ejemplares y facultad de desarme por falta de pago.
    
    REGLAS DE FORMATO:
    - Markdown limpio. NO enumerar automáticamente (usa PRIMERO, SEGUNDO).
    - El texto de los adicionales (SI/NO) debe imitar el formato del PDF (SI: ☒ NO: ☐).
    - Montos siempre en números y palabras.
    `;
    const prompt = `
    Genera el contrato con los siguientes datos:
    VENDEDOR: ${vendor.nombre}, RUT ${vendor.rut}, Rep: ${vendor.nombre === 'COMERCIALIZADORA MADECAS SPA' ? 'EDUARDO HUMBERTO SOTO ALVARADO' : 'Representante Legal'}, Domicilio: ${vendor.domicilio}.
    COMPRADOR: ${client.nombre}, RUT ${client.rut}, Domicilio: ${client.domicilio}, Tel: ${client.telefono}, Email: ${client.correo}.
    PROYECTO: ${project.modelo}, ${budget.superficie_m2 || project.superficie_m2} m2.
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

    const prompt = "Actúa como un experto en presupuestos de construcción y OCR. Analiza COMPLETAMENTE este documento (PDF o Imagen). Extrae TODOS los ítems, materiales o servicios listados. También busca si se menciona la superficie total en m2 o las dimensiones del radier/base. Retorna EXCLUSIVAMENTE un JSON válido con esta estructura: { \"items\": [ {\"descripcion\": string, \"cantidad\": number, \"unidad\": string, \"precio_unitario\": number} ], \"superficie_m2\": number | null }. Asegúrate de que los números sean puros (sin símbolos de moneda).";

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
