import React, { useState } from 'react';
import {
  Layers,
  Filter,
  Search,
  Download,
  Building,
  ShieldCheck,
  MapPin,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Sliders,
  FileSpreadsheet,
  FileCode,
  Map as MapIcon,
  Eye,
  EyeOff,
  Key,
  Lock,
  Flame,
  Trees,
  AlertTriangle,
  Copy,
  Check,
  Users,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import {
  SiglonFeatureCollection,
  BCarProperties,
  FiscalProperties,
  FiscalOcorrenciaProperties,
  SelectedFeatureInfo,
  FilterState,
  SiglonAuthState,
  formatCpfCnpj,
} from '../types/siglon';
import { FISCAL_COLORS, OCORRENCIA_COLORS, exportGeoJsonFile, exportCsvFile } from '../services/arcgis';

interface LayerFilterSidebarProps {
  bcarData: SiglonFeatureCollection<BCarProperties> | null;
  fiscalData: SiglonFeatureCollection<FiscalProperties> | null;
  fiscalOcorrencias: SiglonFeatureCollection<FiscalOcorrenciaProperties> | null;
  bcarVisible: boolean;
  setBcarVisible: (v: boolean) => void;
  fiscalVisible: boolean;
  setFiscalVisible: (v: boolean) => void;
  ocorrenciasVisible: boolean;
  setOcorrenciasVisible: (v: boolean) => void;
  bcarOpacity: number;
  setBcarOpacity: (v: number) => void;
  fiscalOpacity: number;
  setFiscalOpacity: (v: number) => void;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  onApplySearch: () => void;
  onClearFilters: () => void;
  selectedFeature: SelectedFeatureInfo | null;
  onSelectFeature: (info: SelectedFeatureInfo | null) => void;
  isLoadingLots: boolean;
  isLoadingFiscal: boolean;
  isLoadingOcorrencias: boolean;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onSelectPresetLoteamento: (name: string) => void;
  authState: SiglonAuthState;
  onOpenAuthModal: () => void;
  totalCadastradoLots?: number | null;
  loadingProgress?: { loaded: number; total?: number } | null;
  onLoadAllLots?: () => void;
}

export const LayerFilterSidebar: React.FC<LayerFilterSidebarProps> = ({
  bcarData,
  fiscalData,
  fiscalOcorrencias,
  bcarVisible,
  setBcarVisible,
  fiscalVisible,
  setFiscalVisible,
  ocorrenciasVisible,
  setOcorrenciasVisible,
  bcarOpacity,
  setBcarOpacity,
  fiscalOpacity,
  setFiscalOpacity,
  filterState,
  setFilterState,
  onApplySearch,
  onClearFilters,
  selectedFeature,
  onSelectFeature,
  isLoadingLots,
  isLoadingFiscal,
  isLoadingOcorrencias,
  isOpen,
  setIsOpen,
  onSelectPresetLoteamento,
  authState,
  onOpenAuthModal,
  totalCadastradoLots,
  loadingProgress,
  onLoadAllLots,
}) => {
  const [activeTab, setActiveTab] = useState<'layers' | 'data' | 'details'>('layers');
  const [tableFilter, setTableFilter] = useState('');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Popular loteamentos presets in Londrina
  const PRESET_LOTEAMENTOS = [
    { label: 'Centro', query: 'CENTRO' },
    { label: 'Gleba Palhano', query: 'GLEBA PALHANO' },
    { label: 'Cj. Hab. Violin', query: 'JACOMO VIOLIN' },
    { label: 'Jd. Shangri-lá', query: 'SHANGRI-LA' },
    { label: 'Parque Guanabara', query: 'GUANABARA' },
    { label: 'Vila Ernest', query: 'VILA ERNEST' },
    { label: 'Cj. Cafezal', query: 'CAFEZAL' },
    { label: 'Bandeirantes', query: 'BANDEIRANTES' },
  ];

  // Types of occurrence from SEMA
  const TIPOS_OCORRENCIA = [
    'Todas as Ocorrências',
    'Queimada',
    'Árvores',
    'Água Servida - Esgoto',
    'Ocupação Irregular',
    'Poluição Sonora - Noturna',
    'Poluição Atmosférica',
    'Descarte Irregular - Resíduos',
  ];

  // Filtered lots for the Data Table tab
  const displayedLots = (bcarData?.features || []).filter((f) => {
    if (!tableFilter) return true;
    const term = tableFilter.toLowerCase();
    const nome = String(f.properties?.NOME_LOTE || '').toLowerCase();
    const quadra = String(f.properties?.QUADR_C || '').toLowerCase();
    const lote = String(f.properties?.LOTE_C || '').toLowerCase();
    const cod = String(f.properties?.CODLOT || '').toLowerCase();
    const inscr = String(f.properties?.INSCRICAO_IMOBILIARIA || '').toLowerCase();
    return (
      nome.includes(term) ||
      quadra.includes(term) ||
      lote.includes(term) ||
      cod.includes(term) ||
      inscr.includes(term)
    );
  });

  return (
    <>
      {/* Sidebar toggle button (visible when closed) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-14 left-4 z-30 bg-slate-900/95 text-white p-2.5 rounded-xl shadow-xl hover:bg-slate-800 transition flex items-center gap-2 border border-slate-700/80 backdrop-blur-md"
          title="Abrir painel de camadas e filtros"
        >
          <Layers className="w-5 h-5 text-sky-400" />
          <span className="text-xs font-semibold pr-1">Painel SIGLON</span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`absolute top-0 left-0 bottom-0 z-30 w-full sm:w-[440px] bg-white border-r border-slate-200/90 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <MapIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm tracking-tight text-white">GeoLondrina</h1>
                <span className="bg-emerald-500/30 text-emerald-300 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                  SIG SEMA
                </span>
              </div>
              <p className="text-[11px] text-slate-300">Base Cartográfica & Fiscalização Ambiental</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <a
              href="https://geo.londrina.pr.gov.br/portal/apps/webappviewer/index.html?id=6e505befb3be4535a772c698502233f9"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-sky-300 transition"
              title="Abrir WebApp original no portal da Prefeitura"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
              title="Recolher painel"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 shrink-0">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold transition ${
              activeTab === 'layers'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Camadas & Filtros</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold transition ${
              activeTab === 'data'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Lotes ({bcarData?.features?.length || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 text-xs font-semibold transition ${
              activeTab === 'details'
                ? 'border-sky-600 text-sky-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Inspeção {selectedFeature ? '•' : ''}</span>
          </button>
        </div>

        {/* Body content based on Active Tab */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-700">
          {/* TAB 1: LAYERS & FILTERS */}
          {activeTab === 'layers' && (
            <>
              {/* SIGLON Auth Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-3.5 rounded-xl border border-slate-700/80 shadow-md space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`w-4 h-4 ${
                        authState.isAuthenticated ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="font-bold text-xs">
                      {authState.isAuthenticated
                        ? `Sessão SIGLON: ${authState.username || 'oziel.galvao'}`
                        : 'Portal SIGLON (App 6e505bef)'}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      authState.isAuthenticated
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {authState.isAuthenticated ? 'Conectado / Token Válido' : 'Público'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {authState.isAuthenticated
                    ? 'Acesso direto liberado às camadas restritas de Fiscalização Ambiental (SEMA) e Base Cadastral Urbanística (BCIntranet).'
                    : 'Conecte seu usuário ou token para desbloquear os dados protegidos do WebApp municipal.'}
                </p>
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-1.5 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>
                    {authState.isAuthenticated
                      ? 'Gerenciar Conexão / Token'
                      : 'Autenticar com Usuário e Senha'}
                  </span>
                </button>
              </div>

              {/* Layer 1: Fiscalização Ambiental (SEMA / Ocorrências) */}
              <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xs text-slate-900">Fiscalização Ambiental (SEMA)</h2>
                      <p className="text-[11px] text-slate-500">
                        Processos, Queimadas, Árvores e Ocorrências ({fiscalOcorrencias?.features?.length || 0})
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setOcorrenciasVisible(!ocorrenciasVisible)}
                    className={`p-1.5 rounded-lg border transition ${
                      ocorrenciasVisible
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white text-slate-400 border-slate-300 hover:text-slate-700'
                    }`}
                    title={ocorrenciasVisible ? 'Ocultar camada' : 'Exibir camada'}
                  >
                    {ocorrenciasVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {ocorrenciasVisible && (
                  <div className="space-y-2 pt-1 border-t border-amber-200/60">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          Tipo de Ocorrência:
                        </label>
                        <select
                          value={filterState.ocorrenciaTipo}
                          onChange={(e) =>
                            setFilterState((prev) => ({ ...prev, ocorrenciaTipo: e.target.value }))
                          }
                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="all">Todas ({TIPOS_OCORRENCIA.length - 1} tipos)</option>
                          {TIPOS_OCORRENCIA.slice(1).map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          Status:
                        </label>
                        <select
                          value={filterState.ocorrenciaStatus}
                          onChange={(e) =>
                            setFilterState((prev) => ({ ...prev, ocorrenciaStatus: e.target.value }))
                          }
                          className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          <option value="all">Todos os Status</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                      </div>
                    </div>

                    {/* Occurrence legend */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(OCORRENCIA_COLORS).map(([name, styling]) => (
                        <span
                          key={name}
                          onClick={() =>
                            setFilterState((prev) => ({
                              ...prev,
                              ocorrenciaTipo: prev.ocorrenciaTipo === name ? 'all' : name,
                            }))
                          }
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold cursor-pointer border ${
                            filterState.ocorrenciaTipo === name
                              ? 'ring-2 ring-slate-800 scale-105'
                              : ''
                          }`}
                          style={{
                            backgroundColor: styling.bg,
                            borderColor: styling.border,
                            color: styling.color,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: styling.color }} />
                          <span>{name}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Layer 2: Base Cartográfica */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xs text-slate-900">Base Cartográfica (Lotes)</h2>
                      <p className="text-[11px] text-slate-500">
                        {authState.isAuthenticated
                          ? 'BCIntranet (Lotes Urbanos com Inscrição e Proprietário)'
                          : 'Quadras, Lotes e Loteamentos'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setBcarVisible(!bcarVisible)}
                    className={`p-1.5 rounded-lg border transition ${
                      bcarVisible
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-white text-slate-400 border-slate-300 hover:text-slate-700'
                    }`}
                    title={bcarVisible ? 'Ocultar camada' : 'Exibir camada'}
                  >
                    {bcarVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {bcarVisible && (
                  <div className="space-y-2 pt-1 border-t border-slate-200/70">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Opacidade do preenchimento:</span>
                      <span className="font-semibold text-slate-800">{Math.round(bcarOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.05"
                      value={bcarOpacity}
                      onChange={(e) => setBcarOpacity(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                    />
                  </div>
                )}
              </div>

              {/* Layer 3: Áreas Fiscais SMF */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-xs text-slate-900">Áreas Fiscais (SMF)</h2>
                      <p className="text-[11px] text-slate-500">Zonas Fiscais 1 a 7 da Fazenda</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFiscalVisible(!fiscalVisible)}
                    className={`p-1.5 rounded-lg border transition ${
                      fiscalVisible
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-slate-400 border-slate-300 hover:text-slate-700'
                    }`}
                    title={fiscalVisible ? 'Ocultar camada' : 'Exibir camada'}
                  >
                    {fiscalVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                {fiscalVisible && (
                  <div className="space-y-2.5 pt-1 border-t border-slate-200/70">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Filtrar por Área Fiscal:
                      </label>
                      <select
                        value={filterState.areaFiscal}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, areaFiscal: e.target.value }))
                        }
                        className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      >
                        <option value="all">Todas as 7 Áreas Fiscais</option>
                        <option value="1">Área 1 - Centro / Região Central</option>
                        <option value="2">Área 2 - Zona Sul / Aeroporto</option>
                        <option value="3">Área 3 - Zona Oeste / Shangri-lá</option>
                        <option value="4">Área 4 - Zona Norte / Saul Raiz</option>
                        <option value="5">Área 5 - Zona Leste / Lindóia</option>
                        <option value="6">Área 6 - Distritos Rurais</option>
                        <option value="7">Área 7 - Expansão Urbana</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Search & Spatial Filters Section */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs pb-1 border-b border-slate-100">
                  <Filter className="w-4 h-4 text-sky-600" />
                  <span>Filtro e Busca Cadastral</span>
                </div>

                {/* Preset Bookmarks */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                    Regiões e Loteamentos Frequentes:
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_LOTEAMENTOS.map((p) => (
                      <button
                        key={p.query}
                        type="button"
                        onClick={() => onSelectPresetLoteamento(p.query)}
                        className={`text-[10px] px-2 py-1 rounded-md border transition ${
                          filterState.selectedLoteamento === p.query
                            ? 'bg-sky-600 text-white border-sky-600 font-semibold'
                            : 'bg-slate-50 hover:bg-sky-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onApplySearch();
                  }}
                  className="space-y-2.5 pt-1"
                >
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Nome do Loteamento / Bairro:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: Centro, Violin, Guanabara..."
                        value={filterState.selectedLoteamento}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, selectedLoteamento: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* CPF / CNPJ do Proprietário Search */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      CPF ou CNPJ do Proprietário:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: 36041602949 ou 000.000.000-00"
                        value={filterState.cpfCnpj}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, cpfCnpj: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                      />
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Nome do Proprietário Search */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Nome do Proprietário:
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ex: Antonio da Silva, Jose..."
                        value={filterState.nomeProprietario}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, nomeProprietario: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                      <Users className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                        Quadra:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 33"
                        value={filterState.quadra}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, quadra: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                        Lote:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 4"
                        value={filterState.lote}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, lote: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                        Cód. Lote:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 5126"
                        value={filterState.codlot}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, codlot: e.target.value }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                  </div>

                  {/* Quantity selector & Load All Button */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-600 mb-0.5">
                        Limite por Busca:
                      </label>
                      <select
                        value={filterState.limitLots || 1500}
                        onChange={(e) =>
                          setFilterState((prev) => ({ ...prev, limitLots: parseInt(e.target.value, 10) }))
                        }
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      >
                        <option value={250}>250 lotes (Rápido)</option>
                        <option value={500}>500 lotes</option>
                        <option value={1000}>1.000 lotes</option>
                        <option value={2000}>2.000 lotes (Máx página)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-end">
                      {onLoadAllLots && (
                        <button
                          type="button"
                          onClick={onLoadAllLots}
                          disabled={isLoadingLots}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-2 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50"
                          title="Carregar todos os lotes desta região via paginação"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Carregar Todos</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Total found status badge */}
                  {totalCadastradoLots !== null && totalCadastradoLots !== undefined && (
                    <div className="bg-emerald-50 border border-emerald-200/90 rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between text-emerald-900">
                      <span className="text-[11px]">Total no cadastro municipal:</span>
                      <span className="font-mono font-bold text-emerald-800">
                        {totalCadastradoLots.toLocaleString('pt-BR')} lotes
                      </span>
                    </div>
                  )}

                  {loadingProgress && (
                    <div className="bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between text-sky-900 animate-pulse">
                      <span className="text-[11px]">Carregando lotes...</span>
                      <span className="font-mono font-bold text-sky-800">
                        {loadingProgress.loaded}{loadingProgress.total ? ` / ${loadingProgress.total}` : ''}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={isLoadingLots || isLoadingOcorrencias}
                      className="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-3 rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>{isLoadingLots ? 'Consultando...' : 'Aplicar Filtro'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClearFilters}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-3 rounded-lg text-xs transition"
                    >
                      Limpar
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Export section */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">Exportar Dados Cadastrais:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bcarData && exportGeoJsonFile(bcarData)}
                    disabled={!bcarData?.features?.length}
                    className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg py-1.5 text-[11px] font-semibold text-slate-700 transition disabled:opacity-40"
                    title="Exportar polígonos como GeoJSON compatível com QGIS e SIGs"
                  >
                    <FileCode className="w-3.5 h-3.5 text-sky-600" />
                    <span>GeoJSON</span>
                  </button>
                  <button
                    onClick={() => bcarData && exportCsvFile(bcarData.features)}
                    disabled={!bcarData?.features?.length}
                    className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg py-1.5 text-[11px] font-semibold text-slate-700 transition disabled:opacity-40"
                    title="Exportar planilha de lotes para Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV / Excel</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: DATA TABLE / LOTS LIST */}
          {activeTab === 'data' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  {displayedLots.length} lotes exibidos
                </span>
                {bcarData?.properties?.exceededTransferLimit && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Limite atingido
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Filtrar por nome, quadra, lote ou inscrição..."
                  value={tableFilter}
                  onChange={(e) => setTableFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {displayedLots.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Nenhum lote encontrado com os filtros atuais.
                  </div>
                ) : (
                  displayedLots.map((feat) => {
                    const isSelected = selectedFeature?.properties?.OBJECTID === feat.properties.OBJECTID;
                    return (
                      <div
                        key={feat.properties.OBJECTID}
                        onClick={() => {
                          let latLng: { lat: number; lng: number } | undefined = undefined;
                          try {
                            if (feat.geometry.coordinates?.[0]?.[0]) {
                              const coord = feat.geometry.coordinates[0][0];
                              latLng = { lat: coord[1], lng: coord[0] };
                            }
                          } catch (_) {}

                          onSelectFeature({
                            layerType: 'base_cartografica',
                            properties: feat.properties,
                            latLng,
                          });
                          setActiveTab('details');
                        }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition text-xs space-y-1 ${
                          isSelected
                            ? 'bg-sky-50 border-sky-500 shadow-sm ring-1 ring-sky-500'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span className="truncate">{feat.properties.NOME_LOTE || 'Sem Nome'}</span>
                          <span className="text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded font-mono">
                            Cód: {feat.properties.CODLOT || '-'}
                          </span>
                        </div>
                        {feat.properties.NOME_PROPR && (
                          <div className="text-[11px] text-slate-600 truncate">
                            Propr: {String(feat.properties.NOME_PROPR)}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-slate-600 text-[11px]">
                          <span>
                            Quadra: <strong>{feat.properties.QUADR_C || '-'}</strong>
                          </span>
                          <span>
                            Lote: <strong>{feat.properties.LOTE_C || '-'}</strong>
                          </span>
                          {feat.properties.AREA_TERRENO ? (
                            <span>
                              Área: <strong>{Number(feat.properties.AREA_TERRENO).toFixed(0)} m²</strong>
                            </span>
                          ) : feat.properties['SHAPE.AREA'] ? (
                            <span>
                              Área: <strong>{Number(feat.properties['SHAPE.AREA']).toFixed(0)} m²</strong>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: FEATURE DETAILS & INSPECTION */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {selectedFeature ? (
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          selectedFeature.layerType === 'fiscalizacao_ocorrencia'
                            ? 'bg-amber-500'
                            : selectedFeature.layerType === 'base_cartografica'
                            ? 'bg-sky-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <span className="font-bold text-xs uppercase text-slate-600 tracking-wider">
                        {selectedFeature.layerType === 'fiscalizacao_ocorrencia'
                          ? 'Fiscalização Ambiental SEMA'
                          : selectedFeature.layerType === 'base_cartografica'
                          ? 'Detalhamento do Lote Cadastral'
                          : 'Detalhamento da Área Fiscal'}
                      </span>
                    </div>
                    <button
                      onClick={() => onSelectFeature(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fiscalização Ambiental Details */}
                  {selectedFeature.layerType === 'fiscalizacao_ocorrencia' && (
                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Tipo da Ocorrência:</span>
                        <div className="font-bold text-base text-slate-900">
                          {selectedFeature.properties['OCORRÊNCIA'] || 'Fiscalização Ambiental'}
                        </div>
                      </div>

                      <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[10px]">Processo SEMA:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {selectedFeature.properties.PROCESSO || 'Não informado'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-[10px]">Status:</span>
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-amber-200 text-amber-950">
                            {selectedFeature.properties.STATUS || 'Em andamento'}
                          </span>
                        </div>
                        {selectedFeature.properties.FISCAL && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 text-[10px]">Fiscal Responsável:</span>
                            <span className="font-semibold text-slate-800">
                              {selectedFeature.properties.FISCAL}
                            </span>
                          </div>
                        )}
                        {selectedFeature.properties['ENDEREÇO'] && (
                          <div className="pt-1 border-t border-amber-200/60">
                            <span className="text-slate-500 block text-[10px]">Endereço / Local:</span>
                            <span className="font-semibold text-slate-900">
                              {selectedFeature.properties['ENDEREÇO']}{' '}
                              {selectedFeature.properties['NÚMERO'] ? `, ${selectedFeature.properties['NÚMERO']}` : ''}
                            </span>
                          </div>
                        )}
                        {selectedFeature.properties['INSCRIÇÃO'] && (
                          <div className="pt-1 border-t border-amber-200/60">
                            <span className="text-slate-500 block text-[10px]">Inscrição Imobiliária:</span>
                            <span className="font-mono font-bold text-sky-800">
                              {selectedFeature.properties['INSCRIÇÃO']}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Base Cartográfica Lot Details */}
                  {selectedFeature.layerType === 'base_cartografica' && (
                    <>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Loteamento / Bairro:</span>
                        <div className="font-bold text-base text-slate-900">
                          {selectedFeature.properties.NOME_LOTE || 'Não Informado'}
                        </div>
                      </div>

                      {selectedFeature.properties.NOME_PROPR && (
                        <div className="p-2.5 bg-sky-50/80 border border-sky-100 rounded-lg text-xs space-y-0.5">
                          <span className="text-sky-700 text-[10px] block font-semibold uppercase tracking-wider">
                            Proprietário Registrado (BCIntranet):
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {selectedFeature.properties.NOME_PROPR}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs">
                        <div>
                          <span className="text-slate-500 block text-[10px]">Quadra:</span>
                          <span className="font-bold text-slate-900">
                            {selectedFeature.properties.QUADR_C || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Lote:</span>
                          <span className="font-bold text-slate-900">
                            {selectedFeature.properties.LOTE_C || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">Código do Lote:</span>
                          <span className="font-mono font-bold text-sky-700">
                            {selectedFeature.properties.CODLOT || '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px]">OBJECTID:</span>
                          <span className="font-mono text-slate-700">
                            {selectedFeature.properties.OBJECTID}
                          </span>
                        </div>

                        {selectedFeature.properties.INSCRICAO_IMOBILIARIA && (
                          <div className="col-span-2 pt-1 border-t border-slate-200">
                            <span className="text-slate-500 block text-[10px]">Inscrição Imobiliária Municipal:</span>
                            <span className="font-mono font-bold text-slate-900">
                              {selectedFeature.properties.INSCRICAO_IMOBILIARIA}
                            </span>
                          </div>
                        )}

                        {selectedFeature.properties.ZONEAMENTO && (
                          <div className="col-span-2">
                            <span className="text-slate-500 block text-[10px]">Zoneamento:</span>
                            <span className="font-semibold text-slate-800">
                              {selectedFeature.properties.ZONEAMENTO}
                            </span>
                          </div>
                        )}

                        {selectedFeature.properties.AREA_TERRENO && (
                          <div className="col-span-2 pt-1 border-t border-slate-200">
                            <span className="text-slate-500 block text-[10px]">Área do Terreno (Oficial):</span>
                            <span className="font-bold text-slate-900 text-sm">
                              {Number(selectedFeature.properties.AREA_TERRENO).toLocaleString('pt-BR', {
                                maximumFractionDigits: 2,
                              })}{' '}
                              m²
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Actions & Street View */}
                  {selectedFeature.latLng && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                      <a
                        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedFeature.latLng.lat},${selectedFeature.latLng.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg py-2 text-xs font-semibold transition shadow-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir no Google Street View</span>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800">Nenhum elemento selecionado</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Clique em qualquer lote cadastral ou ponto de fiscalização no mapa para examinar os atributos detalhados.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
          <span>Fonte: Prefeitura do Município de Londrina (SIGLON)</span>
          <span className="font-medium text-emerald-700 font-mono">
            {authState.isAuthenticated ? 'Sessão oziel.galvao Ativa' : 'Público'}
          </span>
        </div>
      </aside>
    </>
  );
};
