import { Client, Project, Budget, Vendor, PaymentInstallment, Contract, HouseModel, BudgetItem } from "@/types";

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
    const hundreds = ["", "cien", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];
    
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

export const formatBudgetItemForContract = (item: BudgetItem): string => {
  const rawUnidad = item.unidad ? item.unidad.trim() : (item.descripcion.toLowerCase().includes('m2') || item.descripcion.toLowerCase().includes('m²') ? 'm²' : 'un');
  const cantFormatted = Number.isInteger(item.cantidad) ? item.cantidad.toString() : item.cantidad.toFixed(1);
  const cantStr = `${cantFormatted} ${rawUnidad}`;
  const unitPriceStr = `$${item.precio_unitario.toLocaleString('es-CL')} CLP`;
  const totalStr = `$${item.total.toLocaleString('es-CL')} CLP`;
  
  // Format clean uppercase description
  const desc = item.descripcion.trim().toUpperCase();

  if (item.precio_unitario === 0) {
    return `- ${desc} | Cantidad: ${cantStr} | Precio Unitario: INCLUIDO ($0 CLP) | Total: $0 CLP`;
  }
  
  return `- ${desc} | Cantidad: ${cantStr} | Precio Unitario: ${unitPriceStr} | Subtotal: ${totalStr}`;
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

  let specList = '';
  if (budget.detalle_items && budget.detalle_items.length > 0) {
    const formattedItems = budget.detalle_items.map(item => formatBudgetItemForContract(item)).join('\n');
    specList = `DESGLOSE DETALLADO DE PARTIDAS, SUPERFICIES Y VALORES CONTRATADOS:
${formattedItems}

ESPECIFICACIONES TÉCNICAS ESTRUCTURALES Y CONSTRUCTIVAS:
- PISO: RADIER DE CEMENTO CON ENFIERRADURA CADENA PERIMETRAL 15/20, AISLANTE DE HUMEDAD Y ARRANQUES SANITARIOS EN BAÑOS Y COCINA.
- PANELES EXTERIORES: MADERA ESTRUCTURAL 2X3 (O 2X4 SEGÚN PARTIDA CONTRATADA), MEMBRANA HIDRÓFUGA Y REVESTIMIENTO EXTERIOR PERSONALIZADO.
- PANELES INTERIORES: MADERA 2X3 Y REVESTIMIENTO EN VOLCANITA 15MM EN PAREDES DIVISORAS.
- TECHUMBRE: CERCHAS MADERA 1X4, COSTANERAS PINO 2X2 Y CUBIERTA DE ZINC ONDULADO O TIPO TEJA PREPINTADO SEGÚN PARTIDA.
- PUERTAS Y VENTANAS: PUERTAS DE ACCESO Y VENTANAS LÍNEA AMERICANA / TERMOPANEL SEGÚN ESPECIFICACIÓN.`;
  } else {
    specList = `- PISO: RADIER, DE CEMENTO CON ENFIERRADURA CADENA PERIMETRAL 15/20, CAPA DE POLIETILENO COMO AISLANTE DE HUMEDAD, ARRANQUES SANITARIOS EN BAÑOS Y COCINA
- PANELES EXTERIORES MADERA 2X3, MEMBRANA HIDROFUGA, REVESTIMIENTO PERSONALIZADO.
- PANELES INTERIORES MADERA 2X3 y REVESTIMIENTO UNA CARA VOLCANITA 15MM EN PAREDES DIVISORAS
- CERCHAS MADERA 1X4
- COSTANERAS PINO 2X2
- ZINC ONDULADO NATURAL 0.35 PARA TECHUMBRE
- PUERTAS DE ACCESO
- KIT VENTANAS LINEA AMERICANA`;
  }

  const isCombined = budget.es_combinacion_modelos && budget.modelos_combinados && budget.modelos_combinados.length > 1;
  const totalM2Display = budget.superficie_m2 || project.superficie_m2;
  const combinedDesc = isCombined 
    ? `DE VIVIENDA MODULAR COMPUESTA / COMBINACIÓN DE MODELOS: ${budget.modelos_combinados!.map((m, idx) => `MÓDULO ${idx + 1} (${m.rol || 'MÓDULO'}): ${m.nombre.toUpperCase()} (${m.superficie_m2} M2)`).join(' Y ')}, CON UNA SUPERFICIE TOTAL CONSTRUIDA DE ${totalM2Display} M2`
    : `DE UNA CASA MODELO ${uppercaseModelName} ${totalM2Display} M2`;

  const baseItems = (budget.detalle_items || []).filter(i => i.descripcion.includes('CASA MODELO'));
  const adicItems = (budget.detalle_items || []).filter(i => !i.descripcion.includes('CASA MODELO') && i.precio_unitario > 0);
  
  const baseSubtotal = baseItems.length > 0 
    ? baseItems.reduce((s, i) => s + i.total, 0)
    : (budget.monto_base_modelo || (budget.superficie_m2 && budget.valor_m2 ? Math.round(budget.superficie_m2 * budget.valor_m2) : budget.monto_total));
    
  const adicSubtotal = adicItems.length > 0
    ? adicItems.reduce((s, i) => s + i.total, 0)
    : (budget.monto_adicionales || 0);

  let economicSummary = '';
  if (isCombined) {
    const modulesSummary = budget.modelos_combinados!.map((m, i) => `Subtotal Módulo ${i + 1} (${m.nombre}): $${m.subtotal.toLocaleString('es-CL')} CLP`).join(' | ');
    economicSummary = ` (Desglose económico: ${modulesSummary}${adicSubtotal > 0 ? ` | Subtotal Obras y Mejoramientos Adicionales: $${adicSubtotal.toLocaleString('es-CL')} CLP` : ''} | Total Proyecto: $${budget.monto_total.toLocaleString('es-CL')} CLP IVA incluido).`;
  } else if (adicSubtotal > 0) {
    economicSummary = ` (Desglose económico: Subtotal Casa Base: $${baseSubtotal.toLocaleString('es-CL')} CLP | Subtotal Obras y Mejoramientos Adicionales: $${adicSubtotal.toLocaleString('es-CL')} CLP | Total Proyecto: $${budget.monto_total.toLocaleString('es-CL')} CLP IVA incluido).`;
  }

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

PRIMERO: ANTECEDENTES Y PARTIDAS CONTRATADAS
Las partes de mutuo acuerdo convienen e incorporan bajo el amparo de la legislación chilena vigente, las siguientes especificaciones técnicas, obras y/o modificaciones adicionales fuera del alcance originalmente pactado en el contrato principal:

${specList}

SEGUNDO: PRECIO Y FORMA DE PAGO DE LOS ADICIONALES
El valor de las obras y partidas adicionales pactadas en el presente anexo asciende a la suma de ${totalString}, el cual el COMPRADOR pagará de acuerdo a lo siguiente:
${paymentList}

TERCERO: RATIFICACIÓN Y PLENA VIGENCIA
Se deja expresa constancia que las presentes especificaciones pasan a formar parte íntegra del contrato de compraventa individualizado precedentemente. Se mantiene plenamente vigente todo lo no expresamente modificado por el presente instrumento, firmándose dos ejemplares del mismo tenor y fecha en Osorno.`;
  }

  return `CONTRATO DE COMPRAVENTA
INVERSIONES E&E SPA Y ${client.nombre.toUpperCase()}

En Osorno, a ${dateStringLiteral}, entre INVERSIONES E&E , del Giro OTRAS ACTIVIDADES ESPECIALIZADAS DE CONSTRUCCION, R.U.T. 78.210.119-6 representada por SR EDUARDO HUMBERTO SOTO ALVARADO RUT 15.272.818-2 TELEFONO: +569 7777 00 22, domiciliado para estos efectos en RUTA U55V KM 12 ESQUINA CRUCE LA ESTRELLA S/N, Ciudad de Osorno, comuna de Osorno, X REGION, en adelante “EL VENDEDOR”, por una parte; y , por la otra, don (a) ${client.nombre.toUpperCase()} RUT ${client.rut} , DOMICILIADO EN ${client.domicilio.toUpperCase()}, TELÉFONO ${client.telefono}, CORREO ELECTRONICO: ${client.correo}, en adelante “EL COMPRADOR”, han convenido en celebrar el siguiente Contrato de Compraventa:

PRIMERO: EL VENDEDOR es dueño del proyecto ${combinedDesc} EL CUAL SERÁ ADQUIRIDO POR EL COMPRADOR PARA SER INSTALADO EN TERRENO DE SU PROPIEDAD, UBICADO EN SU DOMICILIO.

El proyecto se ajustará estrictamente a las siguientes especificaciones técnicas y desglose de partidas:

${specList}

Del mismo el COMPRADOR declara:
- Estar en conocimiento de las características del proyecto y los materiales a utilizar.
- Haber visitado presencialmente un similar al proyecto señalado, conocer sus características y terminaciones, o en su defecto haber recibido información o planos del proyecto señalado, conociendo sus características externas e internas, tanto como las terminaciones de este.
- Estar en conocimiento de que el servicio señalado no incluye la generación ni trámite de permisos de ninguna especie (construcción, luz, agua, redes sanitarias, etc.), los cuales son de exclusiva responsabilidad del COMPRADOR una vez se le sea entregado el proyecto.
- Estar en conocimiento de que la compraventa señalada que solicita a través de este instrumento, se entrega bajo las condiciones ofrecidas y conocidas por el COMPRADOR, y no responde a la obligación de ajustarse a características exigidas por otros organismos públicos o privados para fines particulares, salvo las características estructurales de construcción acordes a la normativa vigente para este tipo de edificaciones, y siempre considerando un proceso de instalación correcto por parte del VENDEDOR.
- Haber recibido y estar en conocimiento de los planos de distribución del proyecto.
- Ser dueño del TERRENO en donde se llevará a cabo el servicio de INSTALACION o en su defecto contar con la autorización respectiva por parte del dueño.

SEGUNDO: DE LAS OBLIGACIONES DEL COMPRADOR
Por este acto el COMPRADOR se obliga a:
a) Pagar el precio de INSTALACION DE PROYECTO ${combinedDesc} en las fechas y formas estipuladas en el presente contrato.
b) Proporcionar al VENDEDOR, las condiciones necesarias básicas para la recepción de los materiales y demás insumos de proyecto en la fecha convenida; en especial el COMPRADOR debe proveer a la empresa de una entrada adecuada a las características del vehículo que realizará la descarga de MATERIALES, haber gestionado los permisos de paso de camión si se requiriesen, un terreno despejado y lo suficientemente plano para la descarga E INSTALACION de estos.
c) Proporcionar para el montaje del proyecto un TERRENO de su propiedad o en su defecto acompañar al VENDEDOR con la autorización correspondiente del dueño del terreno para poder montar el proyecto en el lugar escogido al efecto. INVERSIONES E&E, no se hace responsable de aquellas contiendas con terceros derivadas de la ejecución del proyecto en terreno ajeno al COMPRADOR.
d) Revisar las características del proyecto, materiales y demás insumos, una vez éstos se encuentren disponibles y previo a proceder a la descarga de estos.

TERCERO: DE LAS CONDICIONES DE INSTALACIÓN Y TRANSPORTE
El precio pactado incluye el transporte de los materiales hasta el lugar de instalación de mutuo acuerdo siempre que este tenga acceso apto para camiones pesados de carga de materiales. El comprador garantiza la libre accesibilidad descrita en el artículo anterior. Cualquier cargo adicional derivado de fletes especiales o transbordos no previstos será de cargo exclusivo del COMPRADOR.

CUARTO: DE LAS OBLIGACIONES DEL VENDEDOR:
Por este acto el VENDEDOR se obliga a:
a) Entregar al COMPRADOR el SERVICIO contratado de acuerdo con las condiciones del contrato.
b) Respetar los plazos de entrega estipulados en el presente contrato, salvo imprevistos de fuerza mayor o imposibles de prever por la empresa.
c) Proporcionar al COMPRADOR toda la información requerida respecto del proyecto contratado.

QUINTO: Por el presente instrumento INVERSIONES E&E, vende al COMPRADOR, la propiedad de los bienes MUEBLES señalados en la cláusula primera precedente, correspondientes a proyecto ${combinedDesc}, quien los compra y adquiere para sí.

SEXTO: El valor es la suma de ${totalString}${economicSummary} Que el COMPRADOR paga de la siguiente forma:
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

// -------------------------------------------------------------
// Client Service Proxies to Server API Endpoints
// -------------------------------------------------------------

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
  const fallbackContractText = getLocalContractFallback(client, vendor, project, budget, payments, startDate, plazoInstalacion, lugarSuscripcion, isAnexo);
  const rawModelName = project?.modelo || (project as any)?.nombre || 'Personalizada';
  const uppercaseModelName = rawModelName.toUpperCase();

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
    2. En la cláusula PRIMERO (o en el desglose de partidas del anexo) debes incluir OBLIGATORIAMENTE todas y cada una de las partidas adicionales y nuevas con su cantidad de m², globales o unidades, precio unitario y total, tal como aparecen en el modelo suministrado.
    3. No omitas ningún párrafo, especialmente los tres párrafos explicativos que se ubican entre SÉPTIMO y OCTAVO. Deben aparecer tal cual están descritos.
    4. No agregues sección de firmas al final.
    5. No uses otra letra o formato en SEXTO que d), e), f), g), h), i).
  `;

  try {
    const res = await fetch('/api/gemini/contract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, fallbackText: fallbackContractText }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.text || fallbackContractText;
    }
    return fallbackContractText;
  } catch (error) {
    console.warn("Usando contrato local fallback debido a error de red:", error);
    return fallbackContractText;
  }
};

export const analyzeBudgetFile = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/analyze-budget-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.text || "{}";
    }
    return JSON.stringify({ items: [] });
  } catch (error: any) {
    console.error("Error in analyzeBudgetFile proxy:", error);
    return JSON.stringify({ items: [], error: error.message });
  }
};

export const suggestCubicacionAI = async (descripcion: string, superficieM2: number): Promise<any[]> => {
  try {
    const res = await fetch('/api/gemini/suggest-cubicacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descripcion, superficieM2 }),
    });

    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    }
    return [];
  } catch (error) {
    console.error("Error in suggestCubicacionAI proxy:", error);
    return [];
  }
};

export const analyzeCommercialAI = async (client: Client, projects: Project[], budgets: Budget[], contracts: Contract[]): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/commercial-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, projects, budgets, contracts }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.text || "Análisis no disponible.";
    }
    return "Análisis no disponible en este momento.";
  } catch (error) {
    console.error("Error in analyzeCommercialAI proxy:", error);
    return "Error al generar el análisis comercial.";
  }
};

export const generateBusinessAnalysis = async (context: any, userPrompt: string): Promise<string> => {
  try {
    const res = await fetch('/api/gemini/business-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, userPrompt }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.text || "No tengo una respuesta para eso en este momento.";
    }
    return "Error al procesar la consulta empresarial.";
  } catch (error) {
    console.error("Error in generateBusinessAnalysis proxy:", error);
    return "Error al procesar la consulta empresarial.";
  }
};

// Streaming support for Business Analysis
export const streamBusinessAnalysis = async (
  context: any, 
  userPrompt: string, 
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (err: any) => void
): Promise<void> => {
  try {
    const response = await fetch('/api/gemini/business-analysis/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, userPrompt }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Error en servidor: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') {
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              onChunk(parsed.text);
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
    }
    onComplete();
  } catch (err) {
    onError(err);
  }
};

export const analyzeHouseModelFile = async (base64Data: string, mimeType: string): Promise<Partial<HouseModel>> => {
  try {
    const res = await fetch('/api/gemini/analyze-house-model', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.model || {};
    }
    return {};
  } catch (error) {
    console.error("Error in analyzeHouseModelFile proxy:", error);
    return {};
  }
};
