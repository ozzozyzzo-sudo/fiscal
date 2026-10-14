import {
  SiglonFeatureCollection,
  BCarProperties,
  FiscalProperties,
  FiscalOcorrenciaProperties,
} from '../types/siglon';

// Use proxy in dev and production to avoid CORS and SSL handshake issues
const BASE_ARCGIS_URL = '/api/arcgis/server/rest/services';

export const FISCAL_COLORS: Record<string, { fill: string; stroke: string; label: string; name: string }> = {
  '1': { fill: '#ef4444', stroke: '#b91c1c', label: 'Área 1', name: 'Centro / Região Central' },
  '2': { fill: '#f97316', stroke: '#c2410c', label: 'Área 2', name: 'Zona Sul / Aeroporto' },
  '3': { fill: '#eab308', stroke: '#a16207', label: 'Área 3', name: 'Zona Oeste / Shangri-lá' },
  '4': { fill: '#10b981', stroke: '#047857', label: 'Área 4', name: 'Zona Norte / Saul Raiz' },
  '5': { fill: '#06b6d4', stroke: '#0e7490', label: 'Área 5', name: 'Zona Leste / Lindóia' },
  '6': { fill: '#6366f1', stroke: '#4338ca', label: 'Área 6', name: 'Distritos Rurais / Warta' },
  '7': { fill: '#ec4899', stroke: '#be185d', label: 'Área 7', name: 'Expansão Urbana / Periferia' },
};

export const OCORRENCIA_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  'Queimada': { color: '#ea580c', bg: '#ffedd5', border: '#fdba74' },
  'Árvores': { color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  'Água Servida - Esgoto': { color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc' },
  'Ocupação Irregular': { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  'Poluição Sonora - Noturna': { color: '#9333ea', bg: '#f3e8ff', border: '#d8b4fe' },
  'Poluição Sonora': { color: '#9333ea', bg: '#f3e8ff', border: '#d8b4fe' },
  'Poluição Atmosférica': { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  'Descarte Irregular - Resíduos': { color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  'Outros': { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

/**
 * Login to SIGLON through local backend proxy
 */
export async function loginSiglon(
  username: string,
  pass: string
): Promise<{ success: boolean; token: string; expires: number; username: string }> {
  const res = await fetch('/api/arcgis-auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: pass }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'Credenciais inválidas no Portal SIGLON.');
  }

  return json;
}

/**
 * Fetch WebAppBuilder 6e505befb3be4535a772c698502233f9 configuration
 */
export async function fetchWebAppConfig(appId = '6e505befb3be4535a772c698502233f9', token?: string | null) {
  const params = new URLSearchParams({ appId });
  if (token) params.set('token', token);

  const res = await fetch(`/api/arcgis-auth/webapp-config?${params.toString()}`);
  return res.json();
}

/**
 * Fetch Fiscalização Ambiental SEMA (Ocorrências e Processos)
 */
export async function fetchFiscalOcorrencias(
  token: string | null,
  params?: {
    tipo?: string;
    status?: string;
    processo?: string;
    bbox?: { west: number; south: number; east: number; north: number };
    limit?: number;
  }
): Promise<SiglonFeatureCollection<FiscalOcorrenciaProperties>> {
  const queryParams = new URLSearchParams({
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: String(params?.limit || 150),
    orderByFields: 'OBJECTID DESC',
  });

  if (token) {
    queryParams.set('token', token);
  }

  const whereClauses: string[] = [];

  if (params?.tipo && params.tipo !== 'all') {
    const clean = params.tipo.replace(/'/g, "''");
    whereClauses.push(`OCORRÊNCIA='${clean}'`);
  }

  if (params?.status && params.status !== 'all') {
    const clean = params.status.replace(/'/g, "''");
    whereClauses.push(`STATUS='${clean}'`);
  }

  if (params?.processo && params.processo.trim()) {
    const clean = params.processo.trim().replace(/'/g, "''");
    whereClauses.push(`PROCESSO LIKE '%${clean}%'`);
  }

  queryParams.set('where', whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1');

  if (params?.bbox) {
    queryParams.set('geometry', `${params.bbox.west},${params.bbox.south},${params.bbox.east},${params.bbox.north}`);
    queryParams.set('geometryType', 'esriGeometryEnvelope');
    queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    queryParams.set('inSR', '4326');
  }

  const url = `${BASE_ARCGIS_URL}/FiscalizacaoAmbientalEdicao/FeatureServer/0/query?${queryParams.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Erro ao buscar Fiscalização Ambiental: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Erro ArcGIS: ${data.error.message || 'Falha na consulta'}`);
  }

  return data as SiglonFeatureCollection<FiscalOcorrenciaProperties>;
}

/**
 * Fetch the 7 official Áreas Fiscais of Londrina (SMF)
 */
export async function fetchFiscalAreas(
  areaFiscal?: string,
  token?: string | null
): Promise<SiglonFeatureCollection<FiscalProperties>> {
  let whereClause = '1=1';
  if (areaFiscal && areaFiscal !== 'all') {
    whereClause = `AREAFISCAL='${areaFiscal}'`;
  }

  const params = new URLSearchParams({
    where: whereClause,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
  });

  if (token) {
    params.set('token', token);
  }

  const servicePath = 'Gerais/LimSmfAbrangFiscal';
  const url = `${BASE_ARCGIS_URL}/${servicePath}/MapServer/0/query?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Erro ao buscar Áreas Fiscais: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Erro ArcGIS: ${data.error.message || 'Falha na consulta'}`);
  }

  return data as SiglonFeatureCollection<FiscalProperties>;
}

/**
 * Fetch automatic active session for oziel.galvao from backend
 */
export async function fetchActiveSession(): Promise<{ success: boolean; token: string; expires: number; username: string }> {
  const res = await fetch('/api/arcgis-auth/session');
  if (!res.ok) {
    throw new Error('Falha ao obter sessão do SIGLON');
  }
  return res.json();
}

/**
 * Build SQL where clauses compatible with ArcGIS ArcSDE
 */
function buildBCarWhereClauses(params: QueryBCarParams): string[] {
  const whereClauses: string[] = [];

  if (params.cpfCnpj && params.cpfCnpj.trim()) {
    const clean = params.cpfCnpj.trim().replace(/\D/g, '');
    if (clean) {
      whereClauses.push(`(CPF_CNPJ_PROPR LIKE '%${clean}%' OR cpf_cnpj_propr LIKE '%${clean}%')`);
    }
  }

  if (params.nomeProprietario && params.nomeProprietario.trim()) {
    const clean = params.nomeProprietario.trim().toUpperCase().replace(/'/g, "''");
    whereClauses.push(`(NOME_PROPR LIKE '%${clean}%' OR nome_propr LIKE '%${clean}%')`);
  }

  if (params.nomeLote && params.nomeLote.trim()) {
    const clean = params.nomeLote.trim().toUpperCase().replace(/'/g, "''");
    whereClauses.push(`(NOME_LOTE LIKE '%${clean}%' OR nome_lote LIKE '%${clean}%')`);
  }

  if (params.quadra && params.quadra.trim()) {
    const clean = params.quadra.trim().replace(/'/g, "''");
    whereClauses.push(`(QUADR_C='${clean}' OR quadr_c='${clean}')`);
  }

  if (params.lote && params.lote.trim()) {
    const clean = params.lote.trim().replace(/'/g, "''");
    whereClauses.push(`(LOTE_C='${clean}' OR lote_c='${clean}')`);
  }

  if (params.codlot && params.codlot.trim()) {
    const clean = params.codlot.trim().replace(/'/g, "''");
    whereClauses.push(`(CODLOT=${clean} OR codlot=${clean})`);
  }

  if (params.inscricao && params.inscricao.trim()) {
    const clean = params.inscricao.trim().replace(/'/g, "''");
    whereClauses.push(`(INSCRICAO_IMOBILIARIA LIKE '%${clean}%' OR inscricao_imobiliaria LIKE '%${clean}%')`);
  }

  return whereClauses;
}

/**
 * Count total lots in Base Cartográfica matching criteria (fast count query)
 */
export async function countBaseCartografica(params: QueryBCarParams): Promise<number> {
  const whereClauses = buildBCarWhereClauses(params);
  const queryParams = new URLSearchParams({
    where: whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1',
    returnCountOnly: 'true',
    f: 'json',
  });

  if (params.token) {
    queryParams.set('token', params.token);
  }

  if (params.point) {
    queryParams.set('geometry', `${params.point.lng},${params.point.lat}`);
    queryParams.set('geometryType', 'esriGeometryPoint');
    queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    queryParams.set('inSR', '4326');
  } else if (params.bbox) {
    queryParams.set('geometry', `${params.bbox.west},${params.bbox.south},${params.bbox.east},${params.bbox.north}`);
    queryParams.set('geometryType', 'esriGeometryEnvelope');
    queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    queryParams.set('inSR', '4326');
  }

  const servicePath = params.token
    ? 'BCIntranet/Base_de_Lotes_Urbanos_com_atualiza%C3%A7%C3%A3o_di%C3%A1ria'
    : 'Gerais/BCarSiglon';
  const url = `${BASE_ARCGIS_URL}/${servicePath}/MapServer/0/query?${queryParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;
    const json = await response.json();
    return typeof json.count === 'number' ? json.count : 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Query Base Cartográfica (quadras e lotes de Londrina com CPF/CNPJ e Proprietário)
 */
export interface QueryBCarParams {
  bbox?: { west: number; south: number; east: number; north: number };
  point?: { lat: number; lng: number };
  nomeLote?: string;
  quadra?: string;
  lote?: string;
  codlot?: string;
  inscricao?: string;
  cpfCnpj?: string;
  nomeProprietario?: string;
  limit?: number;
  offset?: number;
  fetchAll?: boolean;
  maxPages?: number;
  onProgress?: (loaded: number, total?: number) => void;
  token?: string | null;
}

export async function queryBaseCartografica(params: QueryBCarParams): Promise<SiglonFeatureCollection<BCarProperties>> {
  const whereClauses = buildBCarWhereClauses(params);
  const whereStr = whereClauses.length > 0 ? whereClauses.join(' AND ') : '1=1';

  const servicePath = params.token
    ? 'BCIntranet/Base_de_Lotes_Urbanos_com_atualiza%C3%A7%C3%A3o_di%C3%A1ria'
    : 'Gerais/BCarSiglon';

  // If fetchAll is requested, perform paginated querying
  if (params.fetchAll) {
    const pageSize = 2000;
    const maxPages = params.maxPages || 6; // up to 12,000 lots
    let currentOffset = 0;
    const allFeatures: any[] = [];

    // Optional: get total count first for progress
    let totalCount: number | undefined = undefined;
    try {
      totalCount = await countBaseCartografica(params);
    } catch (_) {}

    for (let page = 0; page < maxPages; page++) {
      const queryParams = new URLSearchParams({
        where: whereStr,
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        f: 'geojson',
        resultOffset: String(currentOffset),
        resultRecordCount: String(pageSize),
        orderByFields: 'OBJECTID_1 ASC',
      });

      if (params.token) {
        queryParams.set('token', params.token);
      }

      if (params.bbox) {
        queryParams.set('geometry', `${params.bbox.west},${params.bbox.south},${params.bbox.east},${params.bbox.north}`);
        queryParams.set('geometryType', 'esriGeometryEnvelope');
        queryParams.set('spatialRel', 'esriSpatialRelIntersects');
        queryParams.set('inSR', '4326');
      }

      const url = `${BASE_ARCGIS_URL}/${servicePath}/MapServer/0/query?${queryParams.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        if (allFeatures.length > 0) break;
        throw new Error(`Erro ao buscar lotes: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.error) {
        if (allFeatures.length > 0) break;
        throw new Error(data.error.message || 'Erro ao consultar lotes');
      }

      const features = data.features || [];
      allFeatures.push(...features);

      params.onProgress?.(allFeatures.length, totalCount);

      // If fewer than pageSize records were returned, no more pages exist
      if (features.length < pageSize) {
        break;
      }

      currentOffset += pageSize;
    }

    return {
      type: 'FeatureCollection',
      features: allFeatures,
      properties: {
        totalLoaded: allFeatures.length,
        totalCadastrado: totalCount,
      },
    };
  }

  // Single page query (supports up to 2000 lots)
  const targetLimit = Math.min(2000, Math.max(10, params.limit || 1500));
  const queryParams = new URLSearchParams({
    where: whereStr,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: String(targetLimit),
    orderByFields: 'OBJECTID_1 ASC',
  });

  if (params.offset) {
    queryParams.set('resultOffset', String(params.offset));
  }

  if (params.token) {
    queryParams.set('token', params.token);
  }

  // Spatial query
  if (params.point) {
    queryParams.set('geometry', `${params.point.lng},${params.point.lat}`);
    queryParams.set('geometryType', 'esriGeometryPoint');
    queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    queryParams.set('inSR', '4326');
  } else if (params.bbox) {
    queryParams.set('geometry', `${params.bbox.west},${params.bbox.south},${params.bbox.east},${params.bbox.north}`);
    queryParams.set('geometryType', 'esriGeometryEnvelope');
    queryParams.set('spatialRel', 'esriSpatialRelIntersects');
    queryParams.set('inSR', '4326');
  }

  const url = `${BASE_ARCGIS_URL}/${servicePath}/MapServer/0/query?${queryParams.toString()}`;

  let response = await fetch(url);
  if (!response.ok || response.status === 499) {
    const fallbackUrl = `${BASE_ARCGIS_URL}/Gerais/BCarSiglon/MapServer/0/query?${queryParams.toString()}`;
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    throw new Error(`Erro ao buscar Base Cartográfica: HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Erro ArcGIS Base Cartográfica: ${data.error.message || 'Falha na consulta'}`);
  }

  return data as SiglonFeatureCollection<BCarProperties>;
}

/**
 * Identify feature at a specific coordinate (intersects BCar, Fiscal Areas, and Fiscal Ocorrências)
 */
export async function identifyAtCoordinate(lat: number, lng: number, token?: string | null) {
  const [bcarRes, fiscalRes, ocorrenciasRes] = await Promise.allSettled([
    queryBaseCartografica({ point: { lat, lng }, limit: 5, token }),
    (async () => {
      const params = new URLSearchParams({
        geometry: `${lng},${lat}`,
        geometryType: 'esriGeometryPoint',
        spatialRel: 'esriSpatialRelIntersects',
        inSR: '4326',
        outFields: '*',
        returnGeometry: 'true',
        outSR: '4326',
        f: 'geojson',
      });
      if (token) params.set('token', token);

      const res = await fetch(`${BASE_ARCGIS_URL}/Gerais/LimSmfAbrangFiscal/MapServer/0/query?${params.toString()}`);
      if (!res.ok) return null;
      return res.json() as Promise<SiglonFeatureCollection<FiscalProperties>>;
    })(),
    (async () => {
      if (!token) return null;
      // Search fiscal occurrences in near proximity (buffer ~100m)
      const delta = 0.001;
      return fetchFiscalOcorrencias(token, {
        bbox: { west: lng - delta, south: lat - delta, east: lng + delta, north: lat + delta },
        limit: 5,
      });
    })(),
  ]);

  const lots = bcarRes.status === 'fulfilled' ? bcarRes.value.features : [];
  const fiscalZones = fiscalRes.status === 'fulfilled' && fiscalRes.value ? fiscalRes.value.features : [];
  const ocorrencias =
    ocorrenciasRes.status === 'fulfilled' && ocorrenciasRes.value ? ocorrenciasRes.value.features : [];

  return {
    lots,
    fiscalZone: fiscalZones[0] || null,
    ocorrencias,
  };
}

/**
 * Helper to export features to a downloadable GeoJSON file
 */
export function exportGeoJsonFile(data: unknown, filename = 'londrina_dados_cartograficos.geojson') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Helper to export features properties to CSV
 */
export function exportCsvFile(features: { properties: Record<string, any> }[], filename = 'londrina_lotes.csv') {
  if (!features.length) return;

  const priorityKeys = [
    'CPF_CNPJ_PROPR',
    'NOME_PROPR',
    'INSCRICAO_IMOBILIARIA',
    'NOME_LOTE',
    'QUADR_C',
    'LOTE_C',
    'CODLOT',
    'LOGRADOURO',
    'NUM_END_IMOVEL',
    'BAIRRO',
    'ZONEAMENTO',
    'AREA_TERRENO',
    'AREA_CONSTR',
    'V_VALOR_VENAL',
  ];

  const allKeys = Array.from(
    new Set(features.flatMap((f) => Object.keys(f.properties || {})))
  ).filter((k) => k !== 'SE_ANNO_CAD_DATA' && !priorityKeys.includes(k));

  const finalKeys = [...priorityKeys.filter((pk) => features.some((f) => f.properties[pk] !== undefined)), ...allKeys];

  const headers = finalKeys.map((k) => {
    switch (k) {
      case 'CPF_CNPJ_PROPR':
        return 'CPF_CNPJ_PROPRIETARIO';
      case 'NOME_PROPR':
        return 'NOME_PROPRIETARIO';
      case 'INSCRICAO_IMOBILIARIA':
        return 'INSCRICAO_IMOBILIARIA';
      case 'NOME_LOTE':
        return 'LOTEAMENTO_BAIRRO';
      case 'QUADR_C':
        return 'QUADRA';
      case 'LOTE_C':
        return 'LOTE';
      case 'CODLOT':
        return 'COD_LOTE';
      case 'AREA_TERRENO':
        return 'AREA_TERRENO_M2';
      default:
        return k;
    }
  });

  const rows = [headers.join(';')];

  for (const f of features) {
    const row = finalKeys.map((k) => {
      const val = f.properties[k];
      if (val === null || val === undefined) return '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    rows.push(row.join(';'));
  }

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
