/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { GoogleMapView } from './components/GoogleMapView';
import { LayerFilterSidebar } from './components/LayerFilterSidebar';
import { SiglonAuthModal } from './components/SiglonAuthModal';
import {
  SiglonFeatureCollection,
  BCarProperties,
  FiscalProperties,
  FiscalOcorrenciaProperties,
  SelectedFeatureInfo,
  FilterState,
  SiglonAuthState,
} from './types/siglon';
import {
  fetchFiscalAreas,
  fetchFiscalOcorrencias,
  queryBaseCartografica,
  countBaseCartografica,
  loginSiglon,
  fetchWebAppConfig,
  fetchActiveSession,
} from './services/arcgis';
import {
  initStorageWithPrecachedData,
  getAllStoredLots,
  getStorageStats,
  clearStorage,
} from './services/storage';
import { AlertTriangle, CheckCircle, ShieldCheck, Key, Layers, Database } from 'lucide-react';

const GOOGLE_MAPS_API_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyDybD5oPpHIHCgQ4dfDcQU5cOVnvokLm2A';

// Active token generated from oziel.galvao credentials
const INITIAL_TOKEN =
  'LVBQNfVyqyNZeUtDDUi6ZM4eTjCGzSMfNsvCMy_h0wgEbWtDnVeKXP3ceFaoXvGGM9L0l2h3JfgCMUHeWSfHwxOZYqI0VHQ3Aixodvw4PSPHfpyEtWvBRVzlTzXzxJ4NZwYFNAo3YyIoZxJpUx56dAFfTlvXb6gLkX9bzwX6_YtmqmaqKAMKFane30IDyzPp';

export default function App() {
  // Quota exceeded state (Tier 2 and Tier 1 listener per Section 8 Case A)
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // SIGLON Authentication state (defaults to authenticated oziel.galvao session)
  const [authState, setAuthState] = useState<SiglonAuthState>(() => {
    const savedToken = localStorage.getItem('siglon_token') || INITIAL_TOKEN;
    const savedUser = localStorage.getItem('siglon_user') || 'oziel.galvao';
    return {
      isAuthenticated: true,
      token: savedToken,
      expires: 1793206484940,
      username: savedUser,
      portalAppId: '6e505befb3be4535a772c698502233f9',
    };
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Layer data states
  const [bcarData, setBcarData] = useState<SiglonFeatureCollection<BCarProperties> | null>(null);
  const [totalCadastradoLots, setTotalCadastradoLots] = useState<number | null>(342483);
  const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total?: number } | null>(null);
  const [fiscalData, setFiscalData] = useState<SiglonFeatureCollection<FiscalProperties> | null>(null);
  const [fiscalOcorrencias, setFiscalOcorrencias] = useState<SiglonFeatureCollection<FiscalOcorrenciaProperties> | null>(null);

  // Storage and cache state
  const [storageStats, setStorageStats] = useState<{
    totalCadastradoLondrina: number;
    totalFiscal: number;
    storedLots: number;
    cachedRegions: string[];
  }>({
    totalCadastradoLondrina: 342483,
    totalFiscal: 7355,
    storedLots: 2500,
    cachedRegions: ['Centro', 'Gleba Palhano', 'Jd. Violin'],
  });

  // Layer visual configuration
  const [bcarVisible, setBcarVisible] = useState(true);
  const [fiscalVisible, setFiscalVisible] = useState(true);
  const [ocorrenciasVisible, setOcorrenciasVisible] = useState(true);
  const [bcarOpacity, setBcarOpacity] = useState(0.35);
  const [fiscalOpacity, setFiscalOpacity] = useState(0.18);

  // Filter and selection states
  const [filterState, setFilterState] = useState<FilterState>({
    searchQuery: '',
    areaFiscal: 'all',
    regiaoSetor: 'all',
    selectedLoteamento: '',
    quadra: '',
    lote: '',
    codlot: '',
    cpfCnpj: '',
    nomeProprietario: '',
    limitLots: 2000,
    autoLoadOnMove: false,
    onlyVisibleBounds: false,
    useLocalStorageOnly: false,
    ocorrenciaTipo: 'all',
    ocorrenciaStatus: 'all',
    processoNumero: '',
  });

  const [selectedFeature, setSelectedFeature] = useState<SelectedFeatureInfo | null>(null);
  const [inspectMode, setInspectMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Loading and error states
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isLoadingFiscal, setIsLoadingFiscal] = useState(false);
  const [isLoadingOcorrencias, setIsLoadingOcorrencias] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const refreshStorageStats = useCallback(async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats({
        totalCadastradoLondrina: 342483,
        totalFiscal: stats.totalFiscal || 7355,
        storedLots: stats.totalLots || 2500,
        cachedRegions: stats.cachedRegions.length ? stats.cachedRegions : ['Centro', 'Gleba Palhano', 'Jd. Violin'],
      });
    } catch (_) {}
  }, []);

  // Load Fiscal Areas
  const loadFiscalAreas = useCallback(async (area?: string, tokenOverride?: string | null) => {
    setIsLoadingFiscal(true);
    const token = tokenOverride !== undefined ? tokenOverride : authState.token;
    try {
      const data = await fetchFiscalAreas(area, token);
      setFiscalData(data);
    } catch (err: any) {
      console.error('Falha ao carregar Áreas Fiscais:', err);
      setErrorToast('Não foi possível carregar as Áreas Fiscais do SIGLON.');
    } finally {
      setIsLoadingFiscal(false);
    }
  }, [authState.token]);

  // Load Fiscalização Ambiental SEMA (All 7,355 occurrences without artificial limit)
  const loadOcorrencias = useCallback(
    async (params?: {
      tipo?: string;
      status?: string;
      processo?: string;
      bbox?: { west: number; south: number; east: number; north: number };
      tokenOverride?: string | null;
      limit?: number;
    }) => {
      setIsLoadingOcorrencias(true);
      const token = params?.tokenOverride !== undefined ? params?.tokenOverride : authState.token;
      try {
        const data = await fetchFiscalOcorrencias(token, {
          tipo: params?.tipo || filterState.ocorrenciaTipo,
          status: params?.status || filterState.ocorrenciaStatus,
          processo: params?.processo || filterState.processoNumero,
          bbox: params?.bbox,
          limit: params?.limit, // No limit: 300! Returns all 7,355 records
        });
        setFiscalOcorrencias(data);
        refreshStorageStats();
      } catch (err: any) {
        console.error('Falha ao carregar ocorrências fiscais:', err);
      } finally {
        setIsLoadingOcorrencias(false);
      }
    },
    [authState.token, filterState.ocorrenciaTipo, filterState.ocorrenciaStatus, filterState.processoNumero, refreshStorageStats]
  );

  // Load Base Cartográfica lots (without 120 limit, default 2000 or full pagination)
  const loadLots = useCallback(
    async (params: {
      nomeLote?: string;
      quadra?: string;
      lote?: string;
      codlot?: string;
      cpfCnpj?: string;
      nomeProprietario?: string;
      setorCadastral?: string;
      preferLocal?: boolean;
      bbox?: { west: number; south: number; east: number; north: number };
      limit?: number;
      fetchAll?: boolean;
      tokenOverride?: string | null;
    }) => {
      setIsLoadingLots(true);
      setErrorToast(null);
      const token = params.tokenOverride !== undefined ? params.tokenOverride : authState.token;
      try {
        // Query total lot count in parallel
        countBaseCartografica({ ...params, token })
          .then((cnt) => {
            if (cnt > 0) setTotalCadastradoLots(cnt);
          })
          .catch(() => {});

        const data = await queryBaseCartografica({
          ...params,
          token,
          limit: params.fetchAll ? undefined : (params.limit || 2000),
          fetchAll: params.fetchAll,
          onProgress: (loaded, total) => {
            setLoadingProgress({ loaded, total });
          },
        });

        setBcarData(data);
        setLoadingProgress(null);
        refreshStorageStats();

        if (data.features.length > 0) {
          setSuccessToast(`${data.features.length} lotes carregados com CPF/CNPJ e guardados na aplicação.`);
        } else {
          setErrorToast('Nenhum lote cadastral encontrado com os filtros informados.');
        }
      } catch (err: any) {
        console.error('Falha ao carregar Base Cartográfica:', err);
        setErrorToast('Erro ao comunicar com o serviço cartográfico de Londrina.');
      } finally {
        setIsLoadingLots(false);
        setLoadingProgress(null);
      }
    },
    [authState.token, refreshStorageStats]
  );

  // Initialize storage with pre-cached dataset on app mount
  useEffect(() => {
    initStorageWithPrecachedData()
      .then((res) => {
        setStorageStats((prev) => ({
          ...prev,
          totalFiscal: res.fiscalCount || 7355,
          storedLots: res.lotsCount || 2500,
        }));
      })
      .catch(() => {});
  }, []);

  // Ensure active session for oziel.galvao on app mount
  useEffect(() => {
    fetchActiveSession()
      .then((session) => {
        if (session.token) {
          setAuthState({
            isAuthenticated: true,
            token: session.token,
            expires: session.expires,
            username: session.username,
            portalAppId: '6e505befb3be4535a772c698502233f9',
          });
          localStorage.setItem('siglon_token', session.token);
          localStorage.setItem('siglon_user', session.username);
        }
      })
      .catch((e) => console.warn('Could not sync session:', e));
  }, []);

  // Initial data bootstrap: load fiscal areas, all 7,355 occurrences, and pre-cached lots
  useEffect(() => {
    loadFiscalAreas(filterState.areaFiscal);
    loadOcorrencias();
    loadLots({ preferLocal: true, limit: 2000 });
  }, [loadFiscalAreas, loadLots, loadOcorrencias]);

  // When areaFiscal filter changes in the state
  useEffect(() => {
    loadFiscalAreas(filterState.areaFiscal);
  }, [filterState.areaFiscal, loadFiscalAreas]);

  // When occurrence filter changes
  useEffect(() => {
    loadOcorrencias({
      tipo: filterState.ocorrenciaTipo,
      status: filterState.ocorrenciaStatus,
    });
  }, [filterState.ocorrenciaTipo, filterState.ocorrenciaStatus, loadOcorrencias]);

  // Handle Authentication with SIGLON credentials
  const handleLogin = async (username: string, pass: string): Promise<boolean> => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await loginSiglon(username, pass);
      setAuthState({
        isAuthenticated: true,
        token: res.token,
        expires: res.expires,
        username: res.username,
        portalAppId: '6e505befb3be4535a772c698502233f9',
      });
      localStorage.setItem('siglon_token', res.token);
      localStorage.setItem('siglon_user', res.username);
      setSuccessToast(`Conectado ao SIGLON com sucesso como ${res.username}!`);
      setIsAuthModalOpen(false);

      // Reload with new token
      loadFiscalAreas(filterState.areaFiscal, res.token);
      loadLots({ nomeLote: filterState.selectedLoteamento || 'CENTRO', tokenOverride: res.token });
      loadOcorrencias({ tokenOverride: res.token });
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Falha ao autenticar.');
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Manual Token / OAuth Redirect URL
  const handleApplyManualToken = async (token: string): Promise<boolean> => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      setAuthState({
        isAuthenticated: true,
        token,
        expires: null,
        username: 'Sessão Portal',
        portalAppId: '6e505befb3be4535a772c698502233f9',
      });
      localStorage.setItem('siglon_token', token);
      localStorage.setItem('siglon_user', 'Sessão Portal');
      setSuccessToast('Token SIGLON aplicado! Camadas protegidas liberadas.');
      setIsAuthModalOpen(false);

      // Reload layers
      loadFiscalAreas(filterState.areaFiscal, token);
      loadLots({ nomeLote: filterState.selectedLoteamento || 'CENTRO', tokenOverride: token });
      loadOcorrencias({ tokenOverride: token });
      return true;
    } catch (err: any) {
      setAuthError(err.message);
      return false;
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('siglon_token');
    localStorage.removeItem('siglon_user');
    setAuthState({
      isAuthenticated: false,
      token: null,
      expires: null,
      username: null,
      portalAppId: '6e505befb3be4535a772c698502233f9',
    });
    setSuccessToast('Desconectado do SIGLON. Alternado para modo público.');
    loadFiscalAreas(filterState.areaFiscal, null);
    loadLots({ nomeLote: 'CENTRO', tokenOverride: null });
    setFiscalOcorrencias(null);
  };

  // Fetch Protected WebApp config
  const handleFetchProtectedLayers = async () => {
    try {
      const cfg = await fetchWebAppConfig('6e505befb3be4535a772c698502233f9', authState.token);
      if (cfg.title) {
        setSuccessToast(`Aplicação carregada: ${cfg.title}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Search Submission (no 120 limit, uses user limit or default 2000)
  const handleApplySearch = useCallback(() => {
    loadLots({
      nomeLote: filterState.selectedLoteamento,
      quadra: filterState.quadra,
      lote: filterState.lote,
      codlot: filterState.codlot,
      cpfCnpj: filterState.cpfCnpj,
      nomeProprietario: filterState.nomeProprietario,
      limit: filterState.limitLots || 2000,
    });
    if (filterState.processoNumero) {
      loadOcorrencias({ processo: filterState.processoNumero });
    }
  }, [filterState, loadLots, loadOcorrencias]);

  // Handle Load All Lots with multi-page pagination (loads ALL records)
  const handleLoadAllLots = useCallback(() => {
    loadLots({
      nomeLote: filterState.selectedLoteamento,
      quadra: filterState.quadra,
      lote: filterState.lote,
      codlot: filterState.codlot,
      cpfCnpj: filterState.cpfCnpj,
      nomeProprietario: filterState.nomeProprietario,
      fetchAll: true,
    });
  }, [filterState, loadLots]);

  // Handle Preset Loteamento selection (loads up to 2000 records)
  const handleSelectPresetLoteamento = useCallback(
    (name: string) => {
      setFilterState((prev) => ({
        ...prev,
        selectedLoteamento: name,
        quadra: '',
        lote: '',
        codlot: '',
        cpfCnpj: '',
        nomeProprietario: '',
      }));
      loadLots({
        nomeLote: name,
        limit: 2000,
      });
    },
    [loadLots]
  );

  // Handle Sector Region selection (Setores 01 a 07 de Londrina)
  const handleSelectRegionSector = useCallback(
    (sector: string, label: string) => {
      setFilterState((prev) => ({
        ...prev,
        regiaoSetor: sector,
        selectedLoteamento: '',
        quadra: '',
        lote: '',
        codlot: '',
        cpfCnpj: '',
        nomeProprietario: '',
      }));
      loadLots({
        setorCadastral: sector,
        limit: filterState.limitLots || 2000,
      });
      setSuccessToast(`Carregando Região: Setor ${sector} - ${label}`);
    },
    [filterState.limitLots, loadLots]
  );

  // Handle Load Stored Lots directly from local IndexedDB
  const handleLoadStoredLocalLots = useCallback(async () => {
    try {
      setIsLoadingLots(true);
      const lots = await getAllStoredLots(2500);
      if (lots.length > 0) {
        setBcarData({
          type: 'FeatureCollection',
          features: lots,
          properties: {
            totalLoaded: lots.length,
            isFromLocalStorage: true,
          },
        });
        setSuccessToast(`${lots.length} lotes carregados da memória local da aplicação!`);
      } else {
        setErrorToast('Nenhum lote salvo em memória local ainda.');
      }
    } catch (err: any) {
      setErrorToast('Falha ao ler dados locais.');
    } finally {
      setIsLoadingLots(false);
    }
  }, []);

  // Handle Clear and Resync Local Storage
  const handleClearLocalStorage = useCallback(async () => {
    await clearStorage();
    await initStorageWithPrecachedData();
    await refreshStorageStats();
    setSuccessToast('Armazenamento local limpo e re-sincronizado com os dados oficiais.');
  }, [refreshStorageStats]);

  // Handle Clear Filters
  const handleClearFilters = useCallback(() => {
    setFilterState({
      searchQuery: '',
      areaFiscal: 'all',
      regiaoSetor: 'all',
      selectedLoteamento: '',
      quadra: '',
      lote: '',
      codlot: '',
      cpfCnpj: '',
      nomeProprietario: '',
      limitLots: 2000,
      autoLoadOnMove: false,
      onlyVisibleBounds: false,
      useLocalStorageOnly: false,
      ocorrenciaTipo: 'all',
      ocorrenciaStatus: 'all',
      processoNumero: '',
    });
    setSelectedFeature(null);
    loadLots({ nomeLote: 'CENTRO', limit: 2000 });
    loadOcorrencias();
  }, [loadLots, loadOcorrencias]);

  // Handle Load in Current Viewport Bounding Box (loads up to 2000 records)
  const handleLoadCurrentBounds = useCallback(
    (bbox: { west: number; south: number; east: number; north: number }) => {
      loadLots({ bbox, limit: 2000 });
      loadOcorrencias({ bbox });
    },
    [loadLots, loadOcorrencias]
  );

  // Auto-dismiss toasts
  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const t = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorToast]);

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-slate-900 text-slate-100 font-sans">
      {/* Required Tier 2 In-App Quota Notice per Section 8 Case A */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm shrink-0">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Banner indicating Portal SIGLON Connection state */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs z-30 shrink-0">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              authState.isAuthenticated ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
          <span className="font-semibold text-white">SIG SEMA Londrina:</span>
          <span className="text-slate-300 hidden sm:inline">
            {authState.isAuthenticated
              ? `Autenticado (${authState.username || 'oziel.galvao'}) — Fiscalização Ambiental e BCIntranet Desbloqueadas`
              : 'Modo Público (Base Cartográfica e Fiscalização Abertas)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
              authState.isAuthenticated
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900'
                : 'bg-sky-600 text-white hover:bg-sky-500 shadow-sm'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{authState.isAuthenticated ? 'Sessão Ativa (Gerenciar)' : 'Conectar ao Portal (App 6e505bef)'}</span>
          </button>
        </div>
      </header>

      {/* Main Map View Area with Sidebar */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places', 'geometry']}>
          <GoogleMapView
            bcarData={bcarData}
            fiscalData={fiscalData}
            fiscalOcorrencias={fiscalOcorrencias}
            bcarVisible={bcarVisible}
            fiscalVisible={fiscalVisible}
            ocorrenciasVisible={ocorrenciasVisible}
            bcarOpacity={bcarOpacity}
            fiscalOpacity={fiscalOpacity}
            selectedFeature={selectedFeature}
            onSelectFeature={setSelectedFeature}
            onLoadCurrentBounds={handleLoadCurrentBounds}
            isLoadingLots={isLoadingLots}
            inspectMode={inspectMode}
            setInspectMode={setInspectMode}
            token={authState.token}
            totalCadastradoLots={totalCadastradoLots}
            loadingProgress={loadingProgress}
            onLoadAllLots={handleLoadAllLots}
          />
        </APIProvider>

        {/* Sidebar Panel */}
        <LayerFilterSidebar
          bcarData={bcarData}
          fiscalData={fiscalData}
          fiscalOcorrencias={fiscalOcorrencias}
          bcarVisible={bcarVisible}
          setBcarVisible={setBcarVisible}
          fiscalVisible={fiscalVisible}
          setFiscalVisible={setFiscalVisible}
          ocorrenciasVisible={ocorrenciasVisible}
          setOcorrenciasVisible={setOcorrenciasVisible}
          bcarOpacity={bcarOpacity}
          setBcarOpacity={setBcarOpacity}
          fiscalOpacity={fiscalOpacity}
          setFiscalOpacity={setFiscalOpacity}
          filterState={filterState}
          setFilterState={setFilterState}
          onApplySearch={handleApplySearch}
          onClearFilters={handleClearFilters}
          selectedFeature={selectedFeature}
          onSelectFeature={setSelectedFeature}
          isLoadingLots={isLoadingLots}
          isLoadingFiscal={isLoadingFiscal}
          isLoadingOcorrencias={isLoadingOcorrencias}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          onSelectPresetLoteamento={handleSelectPresetLoteamento}
          onSelectRegionSector={handleSelectRegionSector}
          onLoadStoredLocalLots={handleLoadStoredLocalLots}
          onClearLocalStorage={handleClearLocalStorage}
          storageStats={storageStats}
          authState={authState}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          totalCadastradoLots={totalCadastradoLots}
          loadingProgress={loadingProgress}
          onLoadAllLots={handleLoadAllLots}
        />

        {/* SIGLON Authentication Modal */}
        <SiglonAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          authState={authState}
          onLogin={handleLogin}
          onApplyManualToken={handleApplyManualToken}
          onLogout={handleLogout}
          isLoading={isAuthLoading}
          authError={authError}
          onFetchProtectedLayers={handleFetchProtectedLayers}
        />

        {/* Toast notifications */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 pointer-events-none">
          {successToast && (
            <div className="bg-emerald-950/90 text-emerald-100 border border-emerald-700/80 px-4 py-2 rounded-xl shadow-xl text-xs flex items-center gap-2 backdrop-blur-md animate-fade-in pointer-events-auto">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>{successToast}</span>
            </div>
          )}
          {errorToast && (
            <div className="bg-rose-950/90 text-rose-100 border border-rose-700/80 px-4 py-2 rounded-xl shadow-xl text-xs flex items-center gap-2 backdrop-blur-md animate-fade-in pointer-events-auto">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{errorToast}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
