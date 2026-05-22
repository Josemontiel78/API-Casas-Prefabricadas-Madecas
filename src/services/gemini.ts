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

export const numberToSpanishWords = (num: number): string => {
  if (num === 0) return "cero";
  
  const rules = [
    { value: 1000000, t_sing: "un millón", t_plur: "millones" },
    { value: 1000, t_sing: "mil", t_plur: "mil" }
  ];

  const getHundreds = (n: number): string => {
    const units = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const tens = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    const teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const hundreds = ["", "cien", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "nevecienos"]; // "nevecienos" or "novecientos" -> let's use standard "novecientos"
    
    let res = "";
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (h > 0) {
      if (h === 1 && t === 0 && u === 0) {
        res += "cien";
      } else if (h === 1) {
        res += "ciento";
      } else if (h === 5) {
        res += "quinientos";
      } else if (h === 7) {
        res += "setecientos";
      } else if (h === 9) {
        res += "novecientos";
      } else {
        res += hundreds[h];
      }
    }

    if (t > 0 || u > 0) {
      if (res) res += " ";
      if (t === 1) {
        res += teens[u];
      } else if (t === 2) {
        if (u === 0) res += "veinte";
        else {
          if (u === 1) res += "veintiún";
          else res += "veinti" + units[u];
        }
      } else if (t > 2) {
        res += tens[t];
        if (u > 0) {
          res += " y " + (u === 1 ? "un" : units[u]);
        }
      } else {
        res += (u === 1 ? "un" : units[u]);
      }
    }
    return res;
  };

  let remainder = num;
  let textParts = [];

  for (const rule of rules) {
    const part = Math.floor(remainder / rule.value);
    remainder %= rule.value;

    if (part > 0) {
      if (part === 1) {
        textParts.push(rule.t_sing);
      } else {
        textParts.push(`${getHundreds(part)} ${rule.t_plur}`);
      }
    }
  }

  if (remainder > 0) {
    textParts.push(getHundreds(remainder));
  }

  return textParts.join(" ").trim();
};

export const getBusinessDaysLaterDateString = (startDateStr: string, days: number): string => {
  let date = new Date();
  if (startDateStr) {
    const parts = startDateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      date = new Date(year, month, day);
    } else {
      const parsed = Date.parse(startDateStr);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      }
    }
  }
  
  let count = 0;
  while (count < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${String(date.getDate()).padStart(2, '0')} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
};

export const getLocalContractFallback = (
  client: Client, 
  vendor: Vendor, 
  project: Project, 
  budget: Budget, 
  payments: PaymentInstallment[], 
  startDate: string, 
  plazoInstalacion: number, 
  lugarSuscripcion: string, 
  isAnexo: boolean
): string => {
  const rawModelName = project?.modelo || (project as any)?.nombre || 'Personalizada';
  const uppercaseModelName = rawModelName.toUpperCase();
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const today = new Date();
  const dateStringLiteral = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

  const specList = budget.detalle_items && budget.detalle_items.length > 0 
    ? budget.detalle_items.map(item => `- ${item.descripcion.toUpperCase()}`).join('\n')
    : `- PISO: RADIER, DE CEMENTO CON ENFIERRADURA CADENA PERIMETRAL 15/20, CAPA DE POLIETILENO COMO AISLANTE DE HUMEDAD, ARRANQUES SANITARIOS EN BAÑOS Y COCINA\n- PANELES EXTERIORES MADERA 2X3, MEMBRANA HIDROFUGA, REVESTIMIENTO PERSONALIZADO.\n- PANELES INTERIORES MADERA 2X3 y REVESTIMIENTO UNA CARA VOLCANITA 15MM EN PAREDES DIVISORAS\n- CERCHAS MADERA 1X4\n- COSTANERAS PINO 2X2\n- ZINC ONDULADO NATURAL 0.35 PARA TECHUMBRE\n- PUERTAS DE ACCESO\n- KIT VENTANAS LINEA AMERICANA\n- ADICIONALES SOLICITADOS SI: ☒ NO: ☐\n- VENTANAS TERMO toda la casa: $280.000.-`;

  const totalInWords = numberToSpanishWords(budget.monto_total);
  const totalString = `$${budget.monto_total.toLocaleString('es-CL')} (${totalInWords} pesos chilenos)`;

  const formatPaymentInWords = (p: PaymentInstallment, index: number) => {
    const letter = String.fromCharCode(100 + index); // Starts with 'd'
    const montoText = `$${p.monto.toLocaleString('es-CL')}`;
    const wordsText = `${numberToSpanishWords(p.monto)} pesos chilenos`;
    
    if (index === 0) {
      return `${letter}) En este acto, se recibe el monto correspondiente al ${p.porcentaje} % del total del proyecto por un valor de ${montoText} (${wordsText}) en Transferencia bancaria a Cuenta Corriente 0-000-9960580-4 del Banco Santander, que el vendedor recibe a su entera satisfacción.`;
    } else if (index === 1) {
      return `${letter}) El monto correspondiente al ${p.porcentaje}% del valor del proyecto, por un valor de ${montoText} (${wordsText}) se hará efectivo en el avance ENTREGA DE RADIER CON ARRANQUES SANITARIOS INCLUÍDOS.`;
    } else if (index === 2) {
      return `${letter}) El monto correspondiente al ${p.porcentaje}% del valor del proyecto, por un precio de ${montoText} (${wordsText}) se pagará al momento de entrega de PANELES Y CERCHAS INSTALADAS.`;
    } else if (index === 3) {
      return `${letter}) El monto correspondiente al ${p.porcentaje}% final del valor del proyecto, ${montoText} (${wordsText}) será cancelado a más tardar 5 días hábiles después de la entrega del proyecto contratado.`;
    } else {
      return `${letter}) El monto correspondiente al ${p.porcentaje}% (${p.descripcion}), por un valor de ${montoText} (${wordsText}) se pagará según las condiciones acordadas.`;
    }
  };

  let paymentList = '';
  if (payments && payments.length > 0) {
    paymentList = payments.map((p, i) => formatPaymentInWords(p, i)).join('\n');
    const nextLetter1 = String.fromCharCode(100 + payments.length);
    const nextLetter2 = String.fromCharCode(100 + payments.length + 1);
    paymentList += `\n${nextLetter1}) A modo de incentivo de compra el traslado del proyecto es SIN COSTO para el COMPRADOR`;
    paymentList += `\n${nextLetter2}) Nota: No se aceptará el cheque como medio de pago para cancelar. Los valores detallados incluyen IVA.`;
  } else {
    paymentList = `d) En este acto, se recibe el monto correspondiente al 30 % del total del proyecto por un valor de $2.331.000 (dos millones trescientos treinta y un mil pesos chilenos) en Transferencia bancaria a Cuenta Corriente 0-000-9960580-4 del Banco Santander, que el vendedor recibe a su entera satisfacción.
e) El monto correspondiente al 30% del valor del proyecto, por un valor de $2.331.000 (dos millones trescientos treinta y un mil pesos chilenos) se hará efectivo en el avance ENTREGA DE RADIER CON ARRANQUES SANITARIOS INCLUÍDOS.
f) El monto correspondiente al 30% del valor del proyecto, por un precio de $2.331.000 (dos millones trescientos treinta y un mil pesos chilenos) se pagará al momento de entrega de PANELES Y CERCHAS INSTALADAS.
g) El monto correspondiente al 10% final del valor del proyecto, $777.000 (setecientos setenta y siete mil pesos chilenos) será cancelado a más tardar 5 días hábiles después de la entrega del proyecto contratado.
h) A modo de incentivo de compra el traslado del proyecto es SIN COSTO para el COMPRADOR
i) Nota: No se aceptará el cheque como medio de pago para cancelar. Los valores detallados incluyen IVA.`;
  }

  const finalDateString = getBusinessDaysLaterDateString(startDate, plazoInstalacion);

  if (isAnexo) {
    return `ANEXO AL CONTRATO DE COMPRAVENTA
INVERSIONES E&E SPA Y ${client.nombre.toUpperCase()}

En Osorno, a ${dateStringLiteral}, se acuerda el presente Anexo al Contrato de Compraventa celebrado entre INVERSIONES E&E, del Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 78.210.119-6 representada por SR EDUARDO HUMBERTO SOTO ALVARADO RUT 15.272.818-2 TELEFONO: +569 7777 00 22, domiciliado para estos efectos en RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Ciudad de Osorno, comuna de Osorno, X REGION, en adelante "EL VENDEDOR", por una parte; y, por la otra, don (a) ${client.nombre.toUpperCase()} RUT ${client.rut}, DOMICILIADO EN ${client.domicilio.toUpperCase()}, TELÉFONO ${client.telefono}, CORREO ELECTRONICO: ${client.correo}, en adelante "EL COMPRADOR".

Las partes de mutuo acuerdo convienen e incorporan bajo el amparo de la legislación chilena vigente, las siguientes especificaciones técnicas y/o modificaciones adicionales al contrato principal celebrado el día [FECHA_INICIO]:

${specList}

Se deja constancia que las presentes especificaciones pasan a formar parte integra del contrato de compraventa individualizado precedentemente. Se mantiene plenamente vigente todo lo no expresamente modificado por el presente instrumento, firmándose dos ejemplares del mismo tenor y fecha en Osorno.`;
  }

  return `CONTRATO DE COMPRAVENTA
INVERSIONES E&E SPA Y ${client.nombre.toUpperCase()}

En Osorno, a ${dateStringLiteral}, entre INVERSIONES E&E , del Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 78.210.119-6 representada por SR EDUARDO HUMBERTO SOTO ALVARADO RUT 15.272.818-2 TELEFONO: +569 7777 00 22, domiciliado para estos efectos en RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Ciudad de Osorno, comuna de Osorno, X REGION, en adelante “EL VENDEDOR”, por una parte; y , por la otra, don (a) ${client.nombre.toUpperCase()} RUT ${client.rut} , DOMICILIADO EN ${client.domicilio.toUpperCase()}, TELÉFONO ${client.telefono}, CORREO ELECTRONICO: ${client.correo}, en adelante “EL COMPRADOR”, han convenido en celebrar el siguiente Contrato de Compraventa:

PRIMERO: EL VENDEDOR es dueño del proyecto DE UNA CASA MODELO ${uppercaseModelName} ${project.superficie_m2} M2 EL CUAL SERÁ ADQUIRIDO POR EL COMPRADOR PARA SER INSTALADO EN TERRENO DE SU PROPIEDAD, UBICADO EN SU DOMICILIO.

El proyecto se ajustará estrictamente a las siguientes especificaciones técnicas:

${specList}

Del mismo el COMPRADOR declara:
- Estar en conocimiento de las características del proyecto y los materiales a utilizar.
- Haber visitado presencialmente un similar al proyecto señalado, conocer sus características y terminaciones, o en su defecto haber recibido información o planos del proyecto señalado, conociendo sus características externas e internas, tanto como las terminaciones de este.
- Estar en conocimiento de que el servicio señalado no incluye la generación ni trámite de permisos de ninguna especie (construcción, luz, agua, redes sanitarias, etc.), los cuales son de exclusiva responsabilidad del COMPRADOR una vez se le sea entregado el proyecto.
- Estar en conocimiento de que la compraventa señalada que solicita a través de este instrumento, se entrega bajo las condiciones ofrecidas y conocidas por el COMPRADOR, y no responde a la obligación de ajustarse a características exigidas por otros organismos públicos o privados para fines particulares, salvo las características estructurales de construcción acordes a la normativa vigente para este tipo de edificaciones, y siempre considerando un process de instalación correcto por parte del VENDEDOR.
- Haber recibido y estar en conocimiento de los planos de distribución del proyecto.
- Ser dueño del TERRENO en donde se llevará a cabo el servicio de INSTALACION o en su defecto contar con la autorización respectiva por parte del dueño.

SEGUNDO: DE LAS OBLIGACIONES DEL COMPRADOR
Por este acto el COMPRADOR se obliga a:
a) Pagar el precio de INSTALACION DE PROYECTO CASA MODELO ${uppercaseModelName} ${project.superficie_m2} M2 en las fechas y formas estipuladas en el presente contrato.
b) Proporcionar al VENDEDOR, las conditions necesarias básicas para la recepción de los materiales y demás insumos de proyecto en la fecha convenida; en especial el COMPRADOR debe proveer a la empresa de una entrada adecuada a las características del vehículo que realizará la descarga de MATERIALES, haber gestionado los permisos de paso de camión si se requiriesen, un terreno despejado y lo suficientemente plano para la descarga E INSTALACION de estos.
c) Proporcionar para el montaje del proyecto un TERRENO de su propiedad o en su defecto acompañar al VENDEDOR con la autorización correspondiente del dueño del terreno para poder montar el proyecto en el lugar escogido al efecto. INVERSIONES E&E, no se hace responsable de aquellas contiendas con terceros derivadas de la ejecución del proyecto en terreno ajeno al COMPRADOR.
d) Revisar las características del proyecto, materiales y demás insumos, una vez éstos se encuentren disponibles y previo a proceder a la descarga de estos.

TERCERO: DE LAS CONDICIONES DE INSTALACIÓN Y TRANSPORTE
El precio pactado incluye el transporte de los materiales hasta el lugar de instalación de mutuo acuerdo siempre que este tenga acceso apto para camiones pesados de carga de materiales. El comprador garantiza la libre accesibilidad descrita en el artículo anterior. Cualquier cargo adicional derivado de fletes especiales o transbordos no previstos será de cargo exclusivo del COMPRADOR.

CUARTO: DE LAS OBLIGACIONES DEL VENDEDOR:
Por este acto el VENDEDOR se obliga a:
a) Entregar al COMPRADOR el SERVICIO contratado de acuerdo con las condiciones del contrato.
b) Respetar los plazos de entrega estipulados en el presente contrato, salvo imprevistos de fuerza mayor o imposibles de prever por la empresa.
c) Proporcionar al COMPRADOR toda la información requerida respecto del proyecto contratado.

QUINTO: Por el presente instrumento INVERSIONES E&E, vende al COMPRADOR, la propiedad de los bienes MUEBLES señalados en la cláusula primera precedente, correspondientes a proyecto de CASA Modelo ${uppercaseModelName} ${project.superficie_m2} M2, quien los compra y adquiere para sí.

SEXTO: El valor es la suma de ${totalString} Que el COMPRADOR paga de la siguiente forma:
${paymentList}

SÉPTIMO: EL VENDEDOR se obliga a poner en terreno del COMPRADOR EL PERSONAL E INSUMOS para el servicio el DIA [FECHA_INICIO], pudiendo prorrogar dicho plazo, unilateralmente si las condiciones climáticas no permitieran el inicio de obra.

Una vez el proyecto se encuentre en el terreno del EL COMPRADOR, INVERSIONES E&E, gozará de un plazo de hasta ${plazoInstalacion} DIAS HABILES para proceder al montaje de estos. Es decir, hasta el DIA ${finalDateString}. Dicho plazo contempla contar con las condiciones climáticas adecuadas.

En caso de retardo, postergación de la entrega por razones técnicas, climáticas o de modificación del bien mueble a instalar y que el COMPRADOR decida modificar o postergar su recepción, no se considerará incumplimiento del VENDEDOR, desistiéndose el COMPRADOR desde ya de demandar o requerir indemnización de ninguna especie, incluyendo la compensatoria por retraso en finalización de obra.

En caso de que el COMPRADOR decida cambiar su fecha de INICIO deberá avisar a la empresa con 15 días de anticipación, ya que ésta no se hará responsable por posibles daños o deterioros del proyecto.

OCTAVO: Se deja constancia que, a fin de garantizar la venta, el COMPRADOR no podrá desistir de ella, por lo cual se establece una cláusula penal a favor del CONSTRUCTOR equivalente al 25% del valor total del servicio.

NOVENO: Ante cualquier dificultad que surja respecto de la interpretación o aplicación del presente contrato, las partes prorrogan competencia a los Tribunales Ordinarios de la ciudad de Osorno.

DÉCIMO: El presente instrumento se suscribe en dos ejemplares quedando uno en poder del comprador y uno en poder del vendedor.

DECIMO PRIMERO: EL COMPRADOR por medio de este contrato de compraventa faculta al VENDEDOR a hacer DESARME Y RETIRO del PROYECTO entregado si el comprador no completara los pagos señalados.`;
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
    const apiKey = process.env.GEMINI_API_KEY;
    
    const rawModelName = project?.modelo || (project as any)?.nombre || 'Personalizada';
    const uppercaseModelName = rawModelName.toUpperCase();
    
    // First generate the fallback so we have perfect baseline structures to feed as prompt template or use as fallback
    const fallbackContractText = getLocalContractFallback(client, vendor, project, budget, payments, startDate, plazoInstalacion, lugarSuscripcion, isAnexo);
    
    if (!apiKey) {
      console.warn("La API Key de Gemini no está configurada. Usando el generador local de contratos.");
      return fallbackContractText;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
      Genera un ${isAnexo ? 'ANEXO AL CONTRATO' : 'CONTRATO DE COMPRAVENTA'} formal y detallado siguiendo estrictamente el siguiente modelo de texto continuo para la empresa "INVERSIONES E&E SPA".
      
      Debes sustituir las variables de acuerdo a los datos entregados, pero DEBES mantener el resto del texto LEGAL EXACTO, VERBATIM Y COMPLETO sin omitir ningún párrafo ni palabra.

      DATOS DE VARIABLES COMPRADOR:
      - Nombre Comprador: ${client.nombre.toUpperCase()}
      - RUT Comprador: ${client.rut}
      - Domicilio Comprador: ${client.domicilio.toUpperCase()}
      - Teléfono Comprador: ${client.telefono}
      - Correo Comprador: ${client.correo}

      DATOS DE VARIABLES PROYECTO:
      - Modelo de Casa: ${uppercaseModelName}
      - Superficie: ${project.superficie_m2} m2
      - Precio Total: $${budget.monto_total.toLocaleString('es-CL')} (${numberToSpanishWords(budget.monto_total)} pesos chilenos)
      
      MODELO OBLIGATORIO DE TEXTO COMPLETO A RESPONDER:
      ${fallbackContractText}
      
      REGLAS CRÍTICAS DE RESPUESTA:
      1. Devuelve SOLO el texto completo del contrato generado de acuerdo al modelo obligatorio suministrado. No agregues introducciones, ni comentarios, ni bloques de código de markdown como \`\`\` o similares.
      2. No omitas ningún párrafo, especialmente los tres párrafos explicativos que se ubican entre SÉPTIMO y OCTAVO. Deben aparecer tal cual están descritos.
      3. No agregues sección de firmas al final.
      4. No uses otra letra o formato en SEXTO que d), e), f), g), h), i).
    `;

    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || fallbackContractText;
  } catch (error: any) {
    console.error("Error in generateContractText:", error);
    return getLocalContractFallback(client, vendor, project, budget, payments, startDate, plazoInstalacion, lugarSuscripcion, isAnexo);
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
