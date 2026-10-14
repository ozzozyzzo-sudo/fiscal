export interface BCarProperties {
  OBJECTID?: number;
  OBJECTID_1?: number;
  QUADR_C?: string;
  LOTE_C?: string;
  CODLOT?: number | string;
  NOME_LOTE?: string;
  SE_ANNO_CAD_DATA?: string | null;
  'SHAPE.AREA'?: number;
  'SHAPE.LEN'?: number;
  // BCIntranet cadastral fields
  CPF_CNPJ_PROPR?: string;
  cpf_cnpj_propr?: string;
  NOME_PROPR?: string;
  nome_propr?: string;
  INSCRICAO_IMOBILIARIA?: string;
  inscricao_imobiliaria?: string;
  LOGRADOURO?: string;
  logradouro?: string;
  NUM_END_IMOVEL?: string;
  num_end_imovel?: string;
  COMPL_END_IMOVEL?: string;
  BAIRRO?: string;
  bairro?: string;
  CEP?: string | number;
  ZONEAMENTO?: string;
  zoneamento?: string;
  AREA_TERRENO?: number;
  area_terreno?: number;
  AREA_CONSTR?: number;
  area_constr?: number;
  V_VALOR_VENAL?: number;
  v_valor_venal?: number;
  V_VLR_IMPOSTO?: number;
  v_vlr_imposto?: number;
  USO_IMOVEL?: string;
  uso_imovel?: string;
  LOTE_URBANO?: string;
  [key: string]: unknown;
}

export interface FiscalProperties {
  OBJECTID_1?: number;
  OBJECTID: number;
  AREAFISCAL: string;
  SHAPE_LENG?: number;
  'SHAPE.AREA'?: number;
  'SHAPE.LEN'?: number;
  [key: string]: unknown;
}

export interface FiscalOcorrenciaProperties {
  OBJECTID: number;
  PROCESSO?: string;
  DATA?: number | string | null;
  'OCORRÊNCIA'?: string;
  'INSCRIÇÃO'?: string;
  'ENDEREÇO'?: string;
  'NÚMERO'?: string;
  FISCAL?: string | null;
  STATUS?: string | null;
  'OBSERVAÇÃO'?: string | null;
  [key: string]: unknown;
}

export interface SiglonFeature<P = Record<string, unknown>> {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon' | 'Point' | 'LineString';
    coordinates: any;
  };
  properties: P;
}

export interface SiglonFeatureCollection<P = Record<string, unknown>> {
  type: 'FeatureCollection';
  features: SiglonFeature<P>[];
  properties?: {
    exceededTransferLimit?: boolean;
    [key: string]: unknown;
  };
}

export interface FilterState {
  searchQuery: string;
  areaFiscal: string; // 'all' or '1'..'7'
  selectedLoteamento: string;
  quadra: string;
  lote: string;
  codlot: string;
  cpfCnpj: string;
  nomeProprietario: string;
  limitLots: number;
  autoLoadOnMove: boolean;
  onlyVisibleBounds: boolean;
  // Fiscalização Ambiental filters
  ocorrenciaTipo: string;
  ocorrenciaStatus: string;
  processoNumero: string;
}

export interface SelectedFeatureInfo {
  layerType: 'base_cartografica' | 'fiscalizacao' | 'fiscalizacao_ocorrencia' | 'loteamento';
  properties: Record<string, any>;
  latLng?: { lat: number; lng: number };
  fiscalZone?: string;
  layerTitle?: string;
}

export interface SiglonAuthState {
  isAuthenticated: boolean;
  token: string | null;
  expires: number | null;
  username: string | null;
  portalAppId: string;
}

/**
 * Format string or number as CPF (000.000.000-00) or CNPJ (00.000.000/0000-00)
 */
export function formatCpfCnpj(val?: string | number | null): string {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return String(val);
}
