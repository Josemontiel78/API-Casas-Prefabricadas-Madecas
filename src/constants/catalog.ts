import { HouseModel } from '@/types';

export interface AdditionalImprovement {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  precio_m2: number;
  unidad: 'm2' | 'global';
  categoria: 'fundacion' | 'aislacion' | 'techumbre' | 'terminaciones' | 'estructura';
  beneficio: string;
  imagen_url?: string;
}

export interface SelectedImprovement {
  improvement_id: string;
  codigo: string;
  titulo: string;
  m2: number;
  precio_m2: number;
  total: number;
  nota?: string;
}

// Default base construction value per m2 in southern Chile (can be adjusted by seller)
export const DEFAULT_VALOR_M2_BASE = 195000;

// Official Pack Básico specifications shared by all MADECAS Prefabricados houses
export const MADECAS_PACK_BASICO_SPECS = [
  'Piso de concreto de 40 cms perimetral (20 cms sobre y 20 cms bajo el nivel del suelo) + 7 cms de losa',
  'Enfierradura cadena 15/20',
  'Arranques sanitarios de lavaplatos, lavamanos, lavadora, WC y duchas',
  'Paredes exteriores panel en pino 2x3',
  'Membrana hidrófuga como aislante de humedad',
  'Revestimiento exterior traslapo liso o SmartPanel',
  'Paredes interiores madera pino 2x3',
  'Papel fieltro en paredes interiores',
  'Revestimiento una cara paredes interiores en volcanita',
  'Cerchas 1x4 pulgadas y costaneras 2x2',
  'Membrana hidrófuga para techumbre y Zinc acanalado 0.35',
  'Ventanas PVC línea americana con vidrio 4mm',
  'Puertas de acceso principal e interior'
];

// Official Additional Improvements Catalog (From MADECAS 2025 Flyer)
export const MADECAS_ADICIONALES: AdditionalImprovement[] = [
  {
    id: 'adic_radier_reforzado',
    codigo: 'AD-01',
    titulo: 'Piso de concreto reforzado con zapata perimetral',
    descripcion: 'Piso de concreto con zapata perimetral de 40 x 40, losa perimetral de 20 cm, enfierradura 15/20 + losa interior de 10 cm de espesor y malla acma 10 x 10 enfierradura.',
    precio_m2: 54900,
    unidad: 'm2',
    categoria: 'fundacion',
    beneficio: 'Mayor firmeza de base de su casa, permite ampliación a 2° piso y resistencia superior.'
  },
  {
    id: 'adic_osb_muros',
    codigo: 'AD-02',
    titulo: 'Encamisado de OSB en paredes exteriores',
    descripcion: 'Instalación de planchas de OSB estructural en todo el perímetro exterior de paneles antes del revestimiento final.',
    precio_m2: 19000,
    unidad: 'm2',
    categoria: 'aislacion',
    beneficio: 'Mejoramiento de aislación termoacústica y máxima rigidez estructural ante vientos.'
  },
  {
    id: 'adic_osb_techo',
    codigo: 'AD-03',
    titulo: 'Encamisado de OSB en techumbre',
    descripcion: 'Base continua de placas de OSB bajo la membrana hidrófuga y la cubierta de techumbre.',
    precio_m2: 18000,
    unidad: 'm2',
    categoria: 'techumbre',
    beneficio: 'Aislación termoacústica superior en cubierta y soporte continuo de tejado.'
  },
  {
    id: 'adic_zinc_prepintado',
    codigo: 'AD-04',
    titulo: 'Techumbre Zinc acanalado o tipo teja prepintado',
    descripcion: 'Cubierta de techumbre en planchas de zinc con pintura termoesmaltada color (negro, terracota, verde o gris grafito).',
    precio_m2: 19000,
    unidad: 'm2',
    categoria: 'techumbre',
    beneficio: 'Mayor vida útil, protección anticorrosiva extrema y alto embellecimiento estético.'
  },
  {
    id: 'adic_vigas_vista',
    codigo: 'AD-05',
    titulo: 'Vigas a la vista con aislación y conductos eléctricos',
    descripcion: 'Cielo en vigas a la vista de madera seleccionada con aislación térmica y canalización eléctrica embutida en living-comedor y cocina.',
    precio_m2: 65000,
    unidad: 'm2',
    categoria: 'terminaciones',
    beneficio: 'Amplitud visual imponente, calidez de madera noble y reducción de tiempos en terminaciones.'
  },
  {
    id: 'adic_siding_exterior',
    codigo: 'AD-06',
    titulo: 'Revestimiento exterior de Siding, Fibrocemento o Metal Siding',
    descripcion: 'Revestimiento exterior en siding PVC de alta durabilidad, fibrocemento texturado tipo madera o metal siding norway.',
    precio_m2: 38000,
    unidad: 'm2',
    categoria: 'terminaciones',
    beneficio: 'Cero mantenimiento de pintura, máxima vida útil y resistencia contra lluvias del sur.'
  },
  {
    id: 'adic_paredes_2x4',
    codigo: 'AD-07',
    titulo: 'Construcción paredes exteriores en madera 2x4',
    descripcion: 'Estructura de tabiquería perimetral exterior reforzada en escuadría de 2x4 pulgadas (en reemplazo de 2x3).',
    precio_m2: 9899,
    unidad: 'm2',
    categoria: 'estructura',
    beneficio: 'Robustez estructural reforzada, permite ampliación a 2° piso y mayor masa aislante.'
  }
];

// Promotion details
export const MADECAS_PROMO_THRESHOLD_M2 = 66;
export const MADECAS_PROMO_TEXT = 'TODAS NUESTRAS CASAS SOBRE 66 M2 SE ENTREGAN PINTADAS CON IMPREGNANTE ANTIHONGOS Y REPELENTE (COLOR A ELECCIÓN DEL CLIENTE) TOTALMENTE GRATIS.';

// The 11 Official MADECAS House Models from User Attachments
export const MADECAS_OFFICIAL_MODELS: HouseModel[] = [
  {
    id: 'model_madecas_36_basico_2aguas',
    nombre: 'Casa 36 m² Modelo Básico (2 Aguas)',
    descripcion: 'Modelo clásico de 36 m² diseñado para optimizar espacios y costo. Cuenta con 2 dormitorios, baño, cocina y living comedor integrado. Ideal para parcelas de agrado o primera vivienda compacta.',
    superficie_m2: 36,
    preciobase: 0, // Dynamic calculated: superficie_m2 * valor_m2
    valor_m2_sugerido: 195000,
    categoria: 'Básico 2 Aguas',
    dormitorios: '2 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_36_m2_b_sico_5750273d.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_36_basico_4aguas',
    nombre: 'Casa 36 m² Modelo Básico (4 Aguas)',
    descripcion: 'Diseño tradicional sureño con cubierta en 4 caídas de agua que favorece el rápido escurrimiento de lluvias. Distribución eficiente con 2 dormitorios, 1 baño, cocina y estar comedor.',
    superficie_m2: 36,
    preciobase: 0,
    valor_m2_sugerido: 198000,
    categoria: 'Básico 4 Aguas',
    dormitorios: '2 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_36_m2_b_sico_4_aguas_924a4580.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_36_contemporaneo',
    nombre: 'Casa 36 m² Modelo Contemporáneo',
    descripcion: 'Línea de arquitectura moderna con aleros rectos, amplio porche frontal y grandes ventanales. Disponible en variantes de 2 y 3 dormitorios, 1 baño, comedor y cocina americana.',
    superficie_m2: 36,
    preciobase: 0,
    valor_m2_sugerido: 205000,
    categoria: 'Contemporáneo',
    dormitorios: '2 a 3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_36_m2_Contemporaneo_b82cb27d.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_42_contemporaneo',
    nombre: 'Casa 42 m² Modelo Contemporáneo',
    descripcion: 'Vivienda contemporánea de 42 m² con excelente iluminación natural, porche techado de acceso, 2 a 3 dormitorios, 1 baño completo y cocina americana integrada.',
    superficie_m2: 42,
    preciobase: 0,
    valor_m2_sugerido: 205000,
    categoria: 'Contemporáneo',
    dormitorios: '2 a 3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_42_m2_Contemporaneo_40313c4f.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_54_basico_4aguas',
    nombre: 'Casa 54 m² Modelo Básico (4 Aguas)',
    descripcion: 'Espaciosa casa familiar de 54 m² con techumbre a 4 aguas. Ofrece distribuciones de 2 o 3 dormitorios, 1 baño amplio, cocina y cómodo comedor americano.',
    superficie_m2: 54,
    preciobase: 0,
    valor_m2_sugerido: 198000,
    categoria: 'Básico 4 Aguas',
    dormitorios: '2 a 3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_54_m2_modelo_b_sico_094fd139.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_54_contemporaneo',
    nombre: 'Casa 54 m² Modelo Contemporáneo',
    descripcion: 'Diseño vanguardista de 54 m² con fachada frontal en terraza integrada, amplias áreas comunes, configuración adaptable para 2 o 3 dormitorios y baño central.',
    superficie_m2: 54,
    preciobase: 0,
    valor_m2_sugerido: 208000,
    categoria: 'Contemporáneo',
    dormitorios: '2 a 3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_54_m2_Contemporaneo_cd856417.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_66_4aguas',
    nombre: 'Casa 66 m² Modelo 4 Aguas',
    descripcion: 'Vivienda de 66 m² con armónica techumbre a 4 caídas. Incluye 3 dormitorios, 1 baño, living, comedor y cocina. ¡Aplica a la promoción de regalo: pintura impregnante antihongos!',
    superficie_m2: 66,
    preciobase: 0,
    valor_m2_sugerido: 199000,
    categoria: 'Básico 4 Aguas',
    dormitorios: '3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_66_m2_4_aguas_928f9554.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_66_premium',
    nombre: 'Casa 66 m² Modelo Premium',
    descripcion: 'Modelo Premium con imponente terraza frontal con vigas a la vista rústicas, 3 dormitorios, 1 baño amplio, cocina americana y finas terminaciones en madera.',
    superficie_m2: 66,
    preciobase: 0,
    valor_m2_sugerido: 220000,
    categoria: 'Premium',
    dormitorios: '3 dormitorios',
    banos: 1,
    imagen_url: '/assets/aistudio/Casa_modelo_66_m2_premium__7e2bd0db.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_72_premium',
    nombre: 'Casa 72 m² Modelo Premium',
    descripcion: 'Imponente casa campestre de 72 m² con porche frontal en madera nativa, distribución de 3 dormitorios, 2 baños completos, amplio estar familiar y cocina integrada.',
    superficie_m2: 72,
    preciobase: 0,
    valor_m2_sugerido: 225000,
    categoria: 'Premium',
    dormitorios: '3 dormitorios',
    banos: 2,
    imagen_url: '/assets/aistudio/Casa_modelo_72_m2_premium__59cacd02.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_84_premium',
    nombre: 'Casa 84 m² Modelo Premium',
    descripcion: 'Gran residencia familiar de 84 m² con hermosa terraza techada con vigas a la vista. Dispone de 3 a 4 dormitorios, 2 baños, living y comedor independientes y amplia cocina.',
    superficie_m2: 84,
    preciobase: 0,
    valor_m2_sugerido: 228000,
    categoria: 'Premium',
    dormitorios: '3 a 4 dormitorios',
    banos: 2,
    imagen_url: '/assets/aistudio/Casa_modelo_84_m2_premium__2ac512c8.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'model_madecas_120_basico_6aguas',
    nombre: 'Casa 120 m² Modelo Básico (6 Aguas)',
    descripcion: 'Nuestra residencia más espaciosa con majestuosa techumbre a 6 aguas. Cuenta con 4 a 5 dormitorios, 2 a 3 baños, gran hall y living comedor, cocina de grandes dimensiones y excelente circulación.',
    superficie_m2: 120,
    preciobase: 0,
    valor_m2_sugerido: 215000,
    categoria: 'Básico 6 Aguas',
    dormitorios: '4 a 5 dormitorios',
    banos: 2,
    imagen_url: '/assets/aistudio/Casa_120m2_modelo_b_sico_6_aguas_a31a8560.png',
    caracteristicas_pack_basico: MADECAS_PACK_BASICO_SPECS,
    fecha_creacion: '2025-01-01T00:00:00.000Z'
  }
];
