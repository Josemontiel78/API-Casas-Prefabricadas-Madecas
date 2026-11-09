/**
 * Utility for parsing geographic coordinates from diverse formats:
 * - Negative decimal pairs (-40.821621, -72.650597)
 * - Sexagesimal / DMS (40°49'17.8"S 72°39'02.2"W)
 * - Multi-line WhatsApp copy-pastes (containing both DMS and decimal lines)
 * - Cardinal directions in Spanish/English (40.3127 s y 73.4207 w, 40.3127 sur / 73.4207 oeste)
 * - WhatsApp shared location links (https://maps.google.com/?q=-40.821621,-72.650597)
 * - Google Maps URLs (short links, place URLs, @lat,lng)
 * - Waze and Apple Maps URLs
 * - Chile context auto-correction (auto-negating positive numbers in Chilean latitudes/longitudes)
 */

export interface ParsedLocation {
  lat: number;
  lng: number;
  sourceType: 'whatsapp_url' | 'maps_url' | 'cardinal_text' | 'dms' | 'decimal_pair' | 'single';
  originalInput: string;
  notes?: string;
  formattedDisplay: string;
  isChileanRange: boolean;
}

/**
 * Checks if coordinates are within Chile's approximate geographical bounds
 * Mainland & islands: Lat -56.5 to -17.0, Lng -110.0 to -66.0
 */
export function isWithinChile(lat: number, lng: number): boolean {
  return lat >= -56.5 && lat <= -17.0 && lng >= -110.0 && lng <= -66.0;
}

/**
 * Checks if a positive number falls within Chilean latitude range (17.0° to 56.5°)
 */
export function isChileanPositiveLatitude(val: number): boolean {
  return val >= 17.0 && val <= 56.5;
}

/**
 * Checks if a positive number falls within Chilean longitude range (66.0° to 76.5°)
 */
export function isChileanPositiveLongitude(val: number): boolean {
  return val >= 65.0 && val <= 77.0;
}

/**
 * Parse a single latitude input string (e.g., "40.3127 s", "-40.3127", "40.3127 sur", "40.3127")
 */
export function parseSingleLatitude(input: string): { value: number; wasCorrected: boolean; notes?: string } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. DMS like 40°49'17.8"S
  const dmsMatch = trimmed.match(/(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([sn]|sur|norte)?/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3].replace(',', '.'));
    const dir = dmsMatch[4]?.toLowerCase();
    let val = deg + min / 60 + sec / 3600;
    const isSouth = !dir || dir === 's' || dir === 'sur' || isChileanPositiveLatitude(val);
    if (isSouth) val = -Math.abs(val);
    return { value: Number(val.toFixed(6)), wasCorrected: isSouth && !dir, notes: 'Convertido desde formato GMS (Sur)' };
  }

  // 2. Extract number and direction
  const isSouthIndicator = /s|sur|south/i.test(trimmed);
  const isNorthIndicator = /n|norte|north/i.test(trimmed);
  
  const numMatch = trimmed.match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!numMatch) return null;
  
  const rawNum = parseFloat(numMatch[0].replace(',', '.'));
  if (isNaN(rawNum)) return null;

  let val = rawNum;
  let wasCorrected = false;
  let notes: string | undefined;

  if (isSouthIndicator) {
    val = -Math.abs(val);
  } else if (isNorthIndicator) {
    val = Math.abs(val);
  } else if (val > 0 && isChileanPositiveLatitude(val)) {
    val = -Math.abs(val);
    wasCorrected = true;
    notes = 'Ajustado automáticamente al Hemisferio Sur (-) para Chile';
  }

  return { value: Number(val.toFixed(6)), wasCorrected, notes };
}

/**
 * Parse a single longitude input string (e.g., "72.6505 w", "-72.6505", "72.6505 oeste", "72.6505")
 */
export function parseSingleLongitude(input: string): { value: number; wasCorrected: boolean; notes?: string } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. DMS like 72°39'02.2"W
  const dmsMatch = trimmed.match(/(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([woe]|west|oeste|este)?/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3].replace(',', '.'));
    const dir = dmsMatch[4]?.toLowerCase();
    let val = deg + min / 60 + sec / 3600;
    const isWest = !dir || dir === 'w' || dir === 'o' || dir === 'oeste' || dir === 'west' || isChileanPositiveLongitude(val);
    if (isWest) val = -Math.abs(val);
    return { value: Number(val.toFixed(6)), wasCorrected: isWest && !dir, notes: 'Convertido desde formato GMS (Oeste)' };
  }

  const isWestIndicator = /w|o|oeste|west/i.test(trimmed);
  const isEastIndicator = /e|este|east/i.test(trimmed);

  const numMatch = trimmed.match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!numMatch) return null;

  const rawNum = parseFloat(numMatch[0].replace(',', '.'));
  if (isNaN(rawNum)) return null;

  let val = rawNum;
  let wasCorrected = false;
  let notes: string | undefined;

  if (isWestIndicator) {
    val = -Math.abs(val);
  } else if (isEastIndicator) {
    val = Math.abs(val);
  } else if (val > 0 && isChileanPositiveLongitude(val)) {
    val = -Math.abs(val);
    wasCorrected = true;
    notes = 'Ajustado automáticamente al Hemisferio Oeste (-) para Chile';
  }

  return { value: Number(val.toFixed(6)), wasCorrected, notes };
}

/**
 * Universal Parser for text, links, WhatsApp messages, and coordinate pairs
 */
export function parseGeoInput(rawText: string): ParsedLocation | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = rawText.trim();
  if (!text) return null;

  // 1. Check if input is multi-line (e.g. WhatsApp copied text with DMS line and decimal line)
  // Example:
  // 40°49'17.8"S 72°39'02.2"W
  // -40.821621, -72.650597
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    // If multiple lines, first try lines that have explicit negative decimal numbers
    for (const line of lines) {
      if (line.includes('-') && /-[1-5]\d\.\d+/.test(line)) {
        const res = parseGeoInput(line);
        if (res) return res;
      }
    }
    // Otherwise try parsing each line individually
    for (const line of lines) {
      const res = parseGeoInput(line);
      if (res) return res;
    }
  }

  // 2. URLs (WhatsApp / Google Maps / Apple Maps / Waze)
  // Example: https://maps.google.com/?q=-40.821621,-72.650597
  // Example: https://maps.google.com/maps?q=loc:-40.821621,-72.650597
  // Example: https://www.google.com/maps/place/.../@-40.821621,-72.650597,17z
  const urlRegexPatterns = [
    /[?&]q=(?:loc:)?([+-]?\d+(?:\.\d+)?)[,\s%2C]+([+-]?\d+(?:\.\d+)?)/i,
    /[?&]ll=([+-]?\d+(?:\.\d+)?)[,\s%2C]+([+-]?\d+(?:\.\d+)?)/i,
    /@([+-]?\d+(?:\.\d+)?)[,\s%2C]+([+-]?\d+(?:\.\d+)?)/i,
    /geo:([+-]?\d+(?:\.\d+)?)[,\s%2C]+([+-]?\d+(?:\.\d+)?)/i,
    /maps\?[^"\s]*\bq=([+-]?\d+(?:\.\d+)?)[,\s%2C]+([+-]?\d+(?:\.\d+)?)/i
  ];

  for (const pattern of urlRegexPatterns) {
    const match = text.match(pattern);
    if (match) {
      let lat = parseFloat(match[1]);
      let lng = parseFloat(match[2]);

      let notes: string | undefined;
      if (lat > 0 && isChileanPositiveLatitude(lat)) {
        lat = -lat;
        notes = 'Latitud ajustada al Hemisferio Sur (-)';
      }
      if (lng > 0 && isChileanPositiveLongitude(lng)) {
        lng = -lng;
        notes = (notes ? notes + ', ' : '') + 'Longitud ajustada al Hemisferio Oeste (-)';
      }

      if (isChileanPositiveLongitude(Math.abs(lat)) && isChileanPositiveLatitude(Math.abs(lng))) {
        const temp = lat;
        lat = lng;
        lng = temp;
        notes = 'Orden corregido (Latitud primero, Longitud segundo)';
      }

      const isChile = isWithinChile(lat, lng);

      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: text.toLowerCase().includes('maps') ? 'maps_url' : 'whatsapp_url',
        originalInput: text,
        notes: notes || 'Ubicación extraída desde enlace compartido',
        formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isChile
      };
    }
  }

  // 3. PRIORITY: Negative Decimal Pair (e.g. "-40.821621, -72.650597" or "-40.821621 -72.650597")
  // Match two explicit decimal numbers where either is negative or has commas/spaces
  const negativeDecimalRegex = /(-[1-5]?\d(?:\.\d+)?)[,\s;/|]+(-[6-9]\d(?:\.\d+)?|-1[0-1]\d(?:\.\d+)?)/;
  const negMatch = text.match(negativeDecimalRegex);
  if (negMatch) {
    const lat = parseFloat(negMatch[1]);
    const lng = parseFloat(negMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: 'decimal_pair',
        originalInput: text,
        notes: 'Coordenadas decimales directas de Chile detectadas',
        formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isWithinChile(lat, lng)
      };
    }
  }

  // 4. PRIORITY: Degrees, Minutes, Seconds (DMS)
  // Matches "40°49'17.8\"S 72°39'02.2\"W" or "40°49'17.8\"S, 72°39'02.2\"O" or with spaces
  const dmsFullPattern = /(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([sn]|sur|norte)\b.*?(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([woe]|west|oeste|este)\b/i;
  const dmsMatch = text.match(dmsFullPattern);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3].replace(',', '.')) / 3600;
    const latDir = dmsMatch[4]?.toLowerCase();
    const lat = (latDir === 's' || latDir === 'sur') ? -latDeg : latDeg;

    const lngDeg = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7].replace(',', '.')) / 3600;
    const lngDir = dmsMatch[8]?.toLowerCase();
    const lng = (lngDir === 'w' || lngDir === 'o' || lngDir === 'oeste' || lngDir === 'west') ? -lngDeg : lngDeg;

    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      sourceType: 'dms',
      originalInput: text,
      notes: 'Coordenadas sexagesimales (GMS) convertidas a decimal',
      formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
      isChileanRange: isWithinChile(lat, lng)
    };
  }

  // Also check inverted DMS (Longitude first, then Latitude)
  const dmsInvertedPattern = /(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([woe]|west|oeste|este)\b.*?(\d+)\s*[°º]\s*(\d+)\s*['\u2032]\s*(\d+(?:[.,]\d+)?)\s*["\u2033]?\s*([sn]|sur|norte)\b/i;
  const dmsInvMatch = text.match(dmsInvertedPattern);
  if (dmsInvMatch) {
    const lngDeg = parseFloat(dmsInvMatch[1]) + parseFloat(dmsInvMatch[2]) / 60 + parseFloat(dmsInvMatch[3].replace(',', '.')) / 3600;
    const lngDir = dmsInvMatch[4]?.toLowerCase();
    const lng = (lngDir === 'w' || lngDir === 'o' || lngDir === 'oeste' || lngDir === 'west') ? -lngDeg : lngDeg;

    const latDeg = parseFloat(dmsInvMatch[5]) + parseFloat(dmsInvMatch[6]) / 60 + parseFloat(dmsInvMatch[7].replace(',', '.')) / 3600;
    const latDir = dmsInvMatch[8]?.toLowerCase();
    const lat = (latDir === 's' || latDir === 'sur') ? -latDeg : latDeg;

    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      sourceType: 'dms',
      originalInput: text,
      notes: 'Coordenadas sexagesimales (GMS) invertidas convertidas a decimal',
      formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
      isChileanRange: isWithinChile(lat, lng)
    };
  }

  // 5. Explicit Cardinal Text with letters S and W/O
  // Example: "40.3127 s y 73.4207 w" or "40.3127 sur, 73.4207 oeste"
  const cardinalRegex = /([+-]?\d+(?:[.,]\d+)?)\s*(?:°)?\s*([sS]|sur|south)\b.*?([+-]?\d+(?:[.,]\d+)?)\s*(?:°)?\s*([wWoO]|west|oeste)\b/i;
  const cardMatch = text.match(cardinalRegex);
  if (cardMatch) {
    const lat = -Math.abs(parseFloat(cardMatch[1].replace(',', '.')));
    const lng = -Math.abs(parseFloat(cardMatch[3].replace(',', '.')));
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: 'cardinal_text',
        originalInput: text,
        notes: 'Coordenadas interpretadas con orientación Sur (-) y Oeste (-)',
        formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isWithinChile(lat, lng)
      };
    }
  }

  // Also check inverted: Longitude with W/O, Latitude with S
  const cardinalInvRegex = /([+-]?\d+(?:[.,]\d+)?)\s*(?:°)?\s*([wWoO]|west|oeste)\b.*?([+-]?\d+(?:[.,]\d+)?)\s*(?:°)?\s*([sS]|sur|south)\b/i;
  const cardInvMatch = text.match(cardinalInvRegex);
  if (cardInvMatch) {
    const lng = -Math.abs(parseFloat(cardInvMatch[1].replace(',', '.')));
    const lat = -Math.abs(parseFloat(cardInvMatch[3].replace(',', '.')));
    if (!isNaN(lat) && !isNaN(lng)) {
      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: 'cardinal_text',
        originalInput: text,
        notes: 'Orden invertido detectado: Longitud primero, Latitud segundo',
        formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isWithinChile(lat, lng)
      };
    }
  }

  // 6. Generic Decimal Pair (e.g. "40.821621, 72.650597" or "-40.821621, -72.650597")
  // Only match if separated by comma, semicolon or slash, and not inside words
  const genericDecimalPattern = /\b([+-]?\d{1,2}(?:\.\d{3,}))\s*[,;/]\s*([+-]?\d{1,3}(?:\.\d{3,}))\b/;
  const genMatch = text.match(genericDecimalPattern);
  if (genMatch) {
    let lat = parseFloat(genMatch[1]);
    let lng = parseFloat(genMatch[2]);

    if (!isNaN(lat) && !isNaN(lng)) {
      let notes: string | undefined;

      // Inverted check
      if (Math.abs(lat) > 60 && Math.abs(lng) < 60) {
        const temp = lat;
        lat = lng;
        lng = temp;
        notes = 'Orden corregido (Longitud dada primero)';
      }

      // Auto-correct Chilean positive inputs
      if (lat > 0 && isChileanPositiveLatitude(lat)) {
        lat = -Math.abs(lat);
        notes = 'Ajustado a Hemisferio Sur (-) para Chile';
      }
      if (lng > 0 && isChileanPositiveLongitude(lng)) {
        lng = -Math.abs(lng);
        notes = (notes ? notes + ', ' : '') + 'Ajustado a Hemisferio Oeste (-) para Chile';
      }

      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          sourceType: 'decimal_pair',
          originalInput: text,
          notes: notes || 'Coordenadas decimales detectadas',
          formattedDisplay: `${lat.toFixed(6)}, ${lng.toFixed(6)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
          isChileanRange: isWithinChile(lat, lng)
        };
      }
    }
  }

  return null;
}
