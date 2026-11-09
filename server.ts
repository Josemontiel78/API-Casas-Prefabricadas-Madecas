import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Recommended default text/multimodal model from @google/genai skill
const GEMINI_MODEL = 'gemini-3.8-flash';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Shared server-side Gemini client with required User-Agent header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY no configurada en el servidor.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const extractJSON = (text: string) => {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(text.substring(start, end + 1));
    }
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return JSON.parse(text);
  } catch (e) {
    console.error('Error parsing JSON from Gemini response:', e);
    return null;
  }
};

// -------------------------------------------------------------
// REST API Routes for Gemini
// -------------------------------------------------------------

// 1. Generate Legal Contract / Annex
app.post('/api/gemini/contract', async (req: Request, res: Response) => {
  const { prompt, fallbackText } = req.body;
  try {
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || fallbackText || '';
    res.json({ text, success: true });
  } catch (error: any) {
    console.warn('Fallback triggered in /api/gemini/contract:', error?.message || error);
    res.json({ text: fallbackText || '', fallbackUsed: true, error: error?.message });
  }
});

// 2. Analyze Budget / Cubicación Document (Multimodal base64)
app.post('/api/gemini/analyze-budget-file', async (req: Request, res: Response) => {
  const { base64Data, mimeType } = req.body;
  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: 'Faltan parámetros base64Data o mimeType' });
  }

  try {
    const ai = getGeminiClient();
    const prompt = `Analiza este documento de presupuesto o cubicación. Extrae la información relevante como ítems, cantidades, unidades, precios unitarios y totales. 
    Responde ÚNICAMENTE con un objeto JSON con este formato:
    {
      "items": [{"descripcion": "...", "cantidad": 1, "unidad": "un", "precio_unitario": 100, "total": 100}],
      "superficie_m2": 0
    }`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    res.json({ text: response.text || '{}', success: true });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-budget-file:', error);
    res.status(500).json({ error: error?.message || 'Error al procesar archivo de cubicación' });
  }
});

// 3. Suggest Cubicación Items
app.post('/api/gemini/suggest-cubicacion', async (req: Request, res: Response) => {
  const { descripcion, superficieM2 } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `Sugiéreme una lista de ítems de construcción para una casa de ${superficieM2 || 36}m2 con la siguiente descripción: "${descripcion || 'Casa prefabricada estándar'}".
    Responde ÚNICAMENTE con un array JSON válido de objetos con este formato: 
    [{"item": "Nombre del ítem", "descripcion": "Breve detalle", "cantidad": 10, "unidad": "m2", "precio_unitario": 5000, "total": 50000}]`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = extractJSON(response.text || '[]');
    res.json({ items: Array.isArray(parsed) ? parsed : [], success: true });
  } catch (error: any) {
    console.error('Error in /api/gemini/suggest-cubicacion:', error);
    res.json({ items: [], error: error?.message });
  }
});

// 4. Strategic Commercial Analysis
app.post('/api/gemini/commercial-analysis', async (req: Request, res: Response) => {
  const { client, projects, budgets, contracts } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `Realiza un análisis comercial estratégico para el cliente ${client?.nombre || 'Comprador'}. 
    Contexto: Compras realizadas: ${contracts?.length || 0}, Presupuestos vigentes: ${budgets?.length || 0}, Proyectos asociados: ${projects?.length || 0}.
    Incluye recomendaciones de fidelización y oportunidades de venta cruzada para casas prefabricadas Madecas.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    res.json({ text: response.text || 'Análisis no disponible.', success: true });
  } catch (error: any) {
    console.error('Error in /api/gemini/commercial-analysis:', error);
    res.json({ text: 'Error al generar el análisis comercial.', error: error?.message });
  }
});

// 5. Business Consultant Analysis (supports both one-shot and streaming)
app.post('/api/gemini/business-analysis', async (req: Request, res: Response) => {
  const { context, userPrompt } = req.body;
  try {
    const ai = getGeminiClient();
    const prompt = `Contexto del Negocio: ${JSON.stringify(context || {})}. 
Usuario pregunta: ${userPrompt}
Responde como un consultor de negocios y ventas experto para Madecas (empresa chilena líder en casas prefabricadas).`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    res.json({ text: response.text || 'No tengo una respuesta para eso en este momento.', success: true });
  } catch (error: any) {
    console.error('Error in /api/gemini/business-analysis:', error);
    res.status(500).json({ error: error?.message || 'Error al procesar consulta' });
  }
});

// 5b. Streaming SSE for Business Analysis
app.post('/api/gemini/business-analysis/stream', async (req: Request, res: Response) => {
  const { context, userPrompt } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const ai = getGeminiClient();
    const prompt = `Contexto del Negocio: ${JSON.stringify(context || {})}. 
Usuario pregunta: ${userPrompt}
Responde como un consultor de negocios y ventas experto para Madecas (empresa chilena de casas prefabricadas).`;

    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
    });

    for await (const chunk of stream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Error in business analysis stream:', error);
    res.write(`data: ${JSON.stringify({ error: error?.message || 'Error en streaming' })}\n\n`);
    res.end();
  }
});

// 6. Analyze Architectural House Model File (Multimodal base64)
app.post('/api/gemini/analyze-house-model', async (req: Request, res: Response) => {
  const { base64Data, mimeType } = req.body;
  if (!base64Data || !mimeType) {
    return res.status(400).json({ error: 'Faltan parámetros base64Data o mimeType' });
  }

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
      model: GEMINI_MODEL,
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = extractJSON(response.text || '{}');
    if (!parsed) {
      return res.json({ model: {} });
    }

    const model = {
      nombre: parsed.nombre || parsed.name || '',
      descripcion: parsed.descripcion || parsed.description || '',
      superficie_m2: Number(parsed.superficie_m2) || Number(parsed.superficie) || 0,
      preciobase: Number(parsed.preciobase) || Number(parsed.precio_base) || Number(parsed.valor_venta) || 0,
      especificaciones: Array.isArray(parsed.especificaciones) ? parsed.especificaciones : [],
    };

    res.json({ model, success: true });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-house-model:', error);
    res.json({ model: {}, error: error?.message });
  }
});

// -------------------------------------------------------------
// Live API WebSocket Bridge
// -------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY no disponible en el servidor.' }));
      clientWs.close();
      return;
    }

    const ai = getGeminiClient();
    const session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: ['AUDIO' as any],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: 'Eres un consultor experto en casas prefabricadas de MADECAS.',
      },
      callbacks: {
        onmessage: (message: any) => {
          for (const part of message.serverContent?.modelTurn?.parts ?? []) {
            if (part.inlineData?.data) {
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
          }
          if (message.serverContent?.interrupted) {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          }
        },
      },
    });

    clientWs.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      } catch (err) {
        console.error('Error processing client audio:', err);
      }
    });

    clientWs.on('close', () => {
      try {
        session.close();
      } catch (e) {
        // session cleanup
      }
    });
  } catch (err: any) {
    console.error('Error in WebSocket live connection:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ error: err?.message || 'Error de conexión Live API' }));
    }
  }
});

// -------------------------------------------------------------
// Vite Middlewares in Dev / Static Dist in Production
// -------------------------------------------------------------
async function setupViteOrStatic() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.use((req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
}

setupViteOrStatic().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
});
