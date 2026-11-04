/**
 * Utility for parsing geographic coordinates from diverse formats:
 * - Direct decimal numbers (-40.3127, -73.4207)
 * - Cardinal directions in Spanish/English (40.3127 s y 73.4207 w, 40.3127 sur / 73.4207 oeste)
 * - WhatsApp shared location links (https://maps.google.com/?q=-40.3127,-73.4207)
 * - Google Maps URLs (short links, place URLs, @lat,lng)
 * - Waze and Apple Maps URLs
 * - DMS (Degrees, Minutes, Seconds: 40°18'45.7"S 73°25'14.5"W)
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
 * Mainland & islands: Lat -56.5 to -17.5, Lng -110.0 to -66.0
 */
export function isWithinChile(lat: number, lng: number): boolean {
  return lat >= -56.5 && lat <= -17.5 && lng >= -110.0 && lng <= -66.0;
}

/**
 * Checks if a positive number falls within Chilean latitude range (17.5° to 56.5°)
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
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Check for DMS format like 40°18'45.7"S
  const dmsMatch = trimmed.match(/(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)"?\s*([sn]|sur|norte)?/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const dir = dmsMatch[4]?.toLowerCase();
    let val = deg + min / 60 + sec / 3600;
    const isSouth = !dir || dir === 's' || dir === 'sur' || isChileanPositiveLatitude(val);
    if (isSouth) val = -Math.abs(val);
    return { value: Number(val.toFixed(6)), wasCorrected: isSouth && !dir, notes: 'Convertido desde formato GMS' };
  }

  // Extract number and direction
  const isSouthIndicator = /s|sur|south/i.test(trimmed);
  const isNorthIndicator = /n|norte|north/i.test(trimmed);
  
  // Extract first floating-point number
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
    // Automatically apply negative for Chilean latitudes if entered as positive
    val = -Math.abs(val);
    wasCorrected = true;
    notes = 'Ajustado automáticamente al Hemisferio Sur (-) para Chile';
  }

  return { value: Number(val.toFixed(6)), wasCorrected, notes };
}

/**
 * Parse a single longitude input string (e.g., "73.4207 w", "-73.4207", "73.4207 oeste", "73.4207")
 */
export function parseSingleLongitude(input: string): { value: number; wasCorrected: boolean; notes?: string } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Check for DMS format like 73°25'14.5"W
  const dmsMatch = trimmed.match(/(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)"?\s*([woe]|west|oeste|este)?/i);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const dir = dmsMatch[4]?.toLowerCase();
    let val = deg + min / 60 + sec / 3600;
    const isWest = !dir || dir === 'w' || dir === 'o' || dir === 'oeste' || dir === 'west' || isChileanPositiveLongitude(val);
    if (isWest) val = -Math.abs(val);
    return { value: Number(val.toFixed(6)), wasCorrected: isWest && !dir, notes: 'Convertido desde formato GMS' };
  }

  // Extract number and direction
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
    // Automatically apply negative for Chilean longitudes if entered as positive
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

  // 1. WhatsApp / Google Maps / Apple Maps / Waze URLs
  // Example: https://maps.google.com/?q=-40.3127,-73.4207
  // Example: https://maps.google.com/maps?q=loc:-40.3127,-73.4207
  // Example: https://www.google.com/maps/place/.../@-40.312700,-73.420700,17z
  // Example: https://waze.com/ul?ll=-40.3127,-73.4207
  // Example: https://maps.apple.com/?ll=-40.3127,-73.4207
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

      // Verify and correct Chile hemispheres if someone sent positive parameters
      let notes: string | undefined;
      if (lat > 0 && isChileanPositiveLatitude(lat)) {
        lat = -lat;
        notes = 'Latitud ajustada al Hemisferio Sur (-)';
      }
      if (lng > 0 && isChileanPositiveLongitude(lng)) {
        lng = -lng;
        notes = (notes ? notes + ', ' : '') + 'Longitud ajustada al Hemisferio Oeste (-)';
      }

      // Check if coordinates were inverted (e.g. lng first, lat second)
      if (isChileanPositiveLongitude(Math.abs(lat)) && isChileanPositiveLatitude(Math.abs(lng))) {
        const temp = lat;
        lat = lng;
        lng = temp;
        notes = 'Coordenadas invertidas detectadas y corregidas (Lat/Lng)';
      }

      const isChile = isWithinChile(lat, lng);

      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: text.toLowerCase().includes('maps') ? 'maps_url' : 'whatsapp_url',
        originalInput: text,
        notes: notes || 'Ubicación extraída desde enlace compartido',
        formattedDisplay: `${lat.toFixed(5)}, ${lng.toFixed(5)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isChile
      };
    }
  }

  // 2. Cardinal text format with S/W/O/Sur/Oeste
  // Example: "40.3127 s y 73.4207 w" or "40.3127 sur, 73.4207 oeste" or "S 40.3127, W 73.4207"
  const cardinalPattern = /(?:lat:?|\bS|\bN)?\s*([+-]?\d+(?:[.,]\d+)?)\s*°?\s*([sSnN]|sur|norte)?\s*(?:[;,/|yY]|\by\b|\band\b)?\s*(?:lng:?|\blong:?|\bW|\bO|\bE)?\s*([+-]?\d+(?:[.,]\d+)?)\s*°?\s*([wWoOeE]|west|oeste|este)?/i;
  const cardMatch = text.match(cardinalPattern);

  if (cardMatch && cardMatch[1] && cardMatch[3]) {
    const rawVal1 = parseFloat(cardMatch[1].replace(',', '.'));
    const dir1 = cardMatch[2]?.toLowerCase();
    const rawVal2 = parseFloat(cardMatch[3].replace(',', '.'));
    const dir2 = cardMatch[4]?.toLowerCase();

    if (!isNaN(rawVal1) && !isNaN(rawVal2)) {
      let lat = rawVal1;
      let lng = rawVal2;
      let notes: string | undefined;

      // Determine hemisphere for first number
      if (dir1 === 's' || dir1 === 'sur' || (!dir1 && isChileanPositiveLatitude(rawVal1))) {
        lat = -Math.abs(rawVal1);
      } else if (dir1 === 'n' || dir1 === 'norte') {
        lat = Math.abs(rawVal1);
      } else if (dir1 === 'w' || dir1 === 'o' || dir1 === 'oeste') {
        // First number is actually longitude!
        lng = -Math.abs(rawVal1);
        lat = (dir2 === 's' || dir2 === 'sur') ? -Math.abs(rawVal2) : Math.abs(rawVal2);
      }

      // Determine hemisphere for second number
      if (dir2 === 'w' || dir2 === 'o' || dir2 === 'oeste' || (!dir2 && isChileanPositiveLongitude(rawVal2))) {
        lng = -Math.abs(rawVal2);
      } else if (dir2 === 'e' || dir2 === 'este') {
        lng = Math.abs(rawVal2);
      } else if (dir2 === 's' || dir2 === 'sur') {
        lat = -Math.abs(rawVal2);
      }

      // If user typed positive coordinates like "40.3127" and "73.4207" without letters
      if (!dir1 && !dir2 && rawVal1 > 0 && rawVal2 > 0) {
        if (isChileanPositiveLatitude(rawVal1) && isChileanPositiveLongitude(rawVal2)) {
          lat = -Math.abs(rawVal1);
          lng = -Math.abs(rawVal2);
          notes = 'Coordenadas convertidas automáticamente a Sur (-) y Oeste (-) para Chile';
        }
      }

      // Check if inverted
      if (isChileanPositiveLongitude(Math.abs(lat)) && isChileanPositiveLatitude(Math.abs(lng))) {
        const temp = lat;
        lat = lng;
        lng = temp;
        notes = 'Orden corregido: primero Latitud, luego Longitud';
      }

      const isChile = isWithinChile(lat, lng);

      return {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        sourceType: 'cardinal_text',
        originalInput: text,
        notes: notes || 'Coordenadas interpretadas con orientación geográfica',
        formattedDisplay: `${lat.toFixed(5)}, ${lng.toFixed(5)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
        isChileanRange: isChile
      };
    }
  }

  // 3. DMS format: 40°18'45.7"S 73°25'14.5"W
  const dmsFullPattern = /(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)"?\s*([sn]|sur|norte)?[,;\s/yY]+(\d+)[°\s]+(\d+)['\s]+(\d+(?:\.\d+)?)"?\s*([woe]|west|oeste|este)?/i;
  const dmsMatch = text.match(dmsFullPattern);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]) + parseFloat(dmsMatch[2]) / 60 + parseFloat(dmsMatch[3]) / 3600;
    const latDir = dmsMatch[4]?.toLowerCase();
    const lat = (!latDir || latDir === 's' || latDir === 'sur') ? -latDeg : latDeg;

    const lngDeg = parseFloat(dmsMatch[5]) + parseFloat(dmsMatch[6]) / 60 + parseFloat(dmsMatch[7]) / 3600;
    const lngDir = dmsMatch[8]?.toLowerCase();
    const lng = (!lngDir || lngDir === 'w' || lngDir === 'o' || lngDir === 'oeste') ? -lngDeg : lngDeg;

    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      sourceType: 'dms',
      originalInput: text,
      notes: 'Coordenadas convertidas desde Grados, Minutos y Segundos (GMS)',
      formattedDisplay: `${lat.toFixed(5)}, ${lng.toFixed(5)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
      isChileanRange: isWithinChile(lat, lng)
    };
  }

  // 4. Decimal pair anywhere in text (e.g. "-40.3127, -73.4207" or "Ubicación: -40.3127 -73.4207")
  const decimalPairPattern = /([+-]?\d{1,2}(?:\.\d+)?)[,\s;/|]+([+-]?\d{1,3}(?:\.\d+)?)/;
  const decMatch = text.match(decimalPairPattern);
  if (decMatch) {
    let lat = parseFloat(decMatch[1]);
    let lng = parseFloat(decMatch[2]);

    if (!isNaN(lat) && !isNaN(lng)) {
      let notes: string | undefined;

      // Inverted order check
      if (Math.abs(lat) > 60 && Math.abs(lng) < 60) {
        const temp = lat;
        lat = lng;
        lng = temp;
        notes = 'Orden corregido (Longitud dada primero, convertida a Lat/Lng)';
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

      // Range validation: Lat between -90 and 90, Lng between -180 and 180
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          sourceType: 'decimal_pair',
          originalInput: text,
          notes: notes || 'Coordenadas decimales detectadas',
          formattedDisplay: `${lat.toFixed(5)}, ${lng.toFixed(5)} (${Math.abs(lat).toFixed(4)}°S, ${Math.abs(lng).toFixed(4)}°O)`,
          isChileanRange: isWithinChile(lat, lng)
        };
      }
    }
  }

  return null;
}
