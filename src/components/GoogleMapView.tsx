import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map, useMap, InfoWindow, AdvancedMarker } from '@vis.gl/react-google-maps';
import {
  SiglonFeatureCollection,
  BCarProperties,
  FiscalProperties,
  FiscalOcorrenciaProperties,
  SelectedFeatureInfo,
} from '../types/siglon';
import { FISCAL_COLORS, OCORRENCIA_COLORS, identifyAtCoordinate } from '../services/arcgis';
import { Layers, Compass, Crosshair, ZoomIn, ShieldCheck, Flame, Trees, ExternalLink } from 'lucide-react';

interface GoogleMapViewProps {
  bcarData: SiglonFeatureCollection<BCarProperties> | null;
  fiscalData: SiglonFeatureCollection<FiscalProperties> | null;
  fiscalOcorrencias: SiglonFeatureCollection<FiscalOcorrenciaProperties> | null;
  bcarVisible: boolean;
  fiscalVisible: boolean;
  ocorrenciasVisible: boolean;
  bcarOpacity: number;
  fiscalOpacity: number;
  selectedFeature: SelectedFeatureInfo | null;
  onSelectFeature: (info: SelectedFeatureInfo | null) => void;
  onLoadCurrentBounds: (bounds: { west: number; south: number; east: number; north: number }) => void;
  isLoadingLots: boolean;
  inspectMode: boolean;
  setInspectMode: (val: boolean) => void;
  token?: string | null;
}

export const GoogleMapView: React.FC<GoogleMapViewProps> = ({
  bcarData,
  fiscalData,
  fiscalOcorrencias,
  bcarVisible,
  fiscalVisible,
  ocorrenciasVisible,
  bcarOpacity,
  fiscalOpacity,
  selectedFeature,
  onSelectFeature,
  onLoadCurrentBounds,
  isLoadingLots,
  inspectMode,
  setInspectMode,
  token,
}) => {
  const map = useMap();
  const fiscalDataLayerRef = useRef<google.maps.Data | null>(null);
  const bcarDataLayerRef = useRef<google.maps.Data | null>(null);
  const [hoveredFeatureId, setHoveredFeatureId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: -23.3103,
    lng: -51.1628,
  });
  const [currentZoom, setCurrentZoom] = useState<number>(13);
  const [infoWindowPos, setInfoWindowPos] = useState<google.maps.LatLngLiteral | null>(null);
  const [mapType, setMapType] = useState<google.maps.MapTypeId | 'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  // Initialize and attach Google Maps Data Layers
  useEffect(() => {
    if (!map) return;

    if (!fiscalDataLayerRef.current) {
      fiscalDataLayerRef.current = new google.maps.Data({ map });
    }
    if (!bcarDataLayerRef.current) {
      bcarDataLayerRef.current = new google.maps.Data({ map });
    }

    const fiscalLayer = fiscalDataLayerRef.current;
    const bcarLayer = bcarDataLayerRef.current;

    // Click on lot
    const bcarClickListener = bcarLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const feat = event.feature;
      const props: Record<string, any> = {};
      feat.forEachProperty((val: unknown, key: string) => {
        props[key] = val;
      });

      const latLng = event.latLng ? { lat: event.latLng.lat(), lng: event.latLng.lng() } : undefined;
      if (latLng) {
        setInfoWindowPos(latLng);
      }

      onSelectFeature({
        layerType: 'base_cartografica',
        properties: props,
        latLng,
      });
    });

    // Mouseover / mouseout on lot
    const bcarOverListener = bcarLayer.addListener('mouseover', (event: google.maps.Data.MouseEvent) => {
      setHoveredFeatureId(Number(event.feature.getProperty('OBJECTID')));
    });
    const bcarOutListener = bcarLayer.addListener('mouseout', () => {
      setHoveredFeatureId(null);
    });

    // Click on fiscal zone
    const fiscalClickListener = fiscalLayer.addListener('click', (event: google.maps.Data.MouseEvent) => {
      const feat = event.feature;
      const props: Record<string, any> = {};
      feat.forEachProperty((val: unknown, key: string) => {
        props[key] = val;
      });

      const latLng = event.latLng ? { lat: event.latLng.lat(), lng: event.latLng.lng() } : undefined;
      if (latLng) {
        setInfoWindowPos(latLng);
      }

      onSelectFeature({
        layerType: 'fiscalizacao',
        properties: props,
        latLng,
        fiscalZone: String(props.AREAFISCAL || ''),
      });
    });

    // Click on raw map canvas
    const mapClickListener = map.addListener('click', async (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      if (inspectMode) {
        setInfoWindowPos({ lat, lng });
        try {
          const res = await identifyAtCoordinate(lat, lng, token);
          if (res.ocorrencias && res.ocorrencias.length > 0) {
            onSelectFeature({
              layerType: 'fiscalizacao_ocorrencia',
              properties: res.ocorrencias[0].properties,
              latLng: { lat, lng },
            });
          } else if (res.lots.length > 0) {
            onSelectFeature({
              layerType: 'base_cartografica',
              properties: res.lots[0].properties,
              latLng: { lat, lng },
              fiscalZone: res.fiscalZone ? String(res.fiscalZone.properties.AREAFISCAL) : undefined,
            });
          } else if (res.fiscalZone) {
            onSelectFeature({
              layerType: 'fiscalizacao',
              properties: res.fiscalZone.properties,
              latLng: { lat, lng },
              fiscalZone: String(res.fiscalZone.properties.AREAFISCAL),
            });
          }
        } catch (err) {
          console.error('Erro na ferramenta de identificação:', err);
        }
      }
    });

    return () => {
      google.maps.event.removeListener(bcarClickListener);
      google.maps.event.removeListener(bcarOverListener);
      google.maps.event.removeListener(bcarOutListener);
      google.maps.event.removeListener(fiscalClickListener);
      google.maps.event.removeListener(mapClickListener);
    };
  }, [map, inspectMode, onSelectFeature, token]);

  // Update Fiscal layer visibility
  useEffect(() => {
    if (!fiscalDataLayerRef.current) return;
    fiscalDataLayerRef.current.setMap(fiscalVisible && map ? map : null);
  }, [fiscalVisible, map]);

  // Update Base Cartográfica visibility
  useEffect(() => {
    if (!bcarDataLayerRef.current) return;
    bcarDataLayerRef.current.setMap(bcarVisible && map ? map : null);
  }, [bcarVisible, map]);

  // Populate Fiscal data
  useEffect(() => {
    const layer = fiscalDataLayerRef.current;
    if (!layer) return;

    layer.forEach((f: google.maps.Data.Feature) => layer.remove(f));

    if (fiscalData && fiscalData.features && fiscalData.features.length > 0) {
      try {
        layer.addGeoJson(fiscalData as any);
      } catch (e) {
        console.error('Erro ao adicionar GeoJSON de Áreas Fiscais:', e);
      }
    }
  }, [fiscalData]);

  // Populate Base Cartográfica (lots) data
  useEffect(() => {
    const layer = bcarDataLayerRef.current;
    if (!layer) return;

    layer.forEach((f: google.maps.Data.Feature) => layer.remove(f));

    if (bcarData && bcarData.features && bcarData.features.length > 0) {
      try {
        layer.addGeoJson(bcarData as any);
      } catch (e) {
        console.error('Erro ao adicionar GeoJSON da Base Cartográfica:', e);
      }
    }
  }, [bcarData]);

  // Apply styling to Fiscal layer
  useEffect(() => {
    const layer = fiscalDataLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature: google.maps.Data.Feature) => {
      const area = String(feature.getProperty('AREAFISCAL') || '1');
      const isSelected =
        selectedFeature?.layerType === 'fiscalizacao' &&
        selectedFeature?.properties?.AREAFISCAL === area;
      const color = FISCAL_COLORS[area] || { fill: '#6366f1', stroke: '#4338ca' };

      return {
        fillColor: color.fill,
        fillOpacity: isSelected ? Math.min(0.5, fiscalOpacity + 0.25) : fiscalOpacity,
        strokeColor: isSelected ? '#1e1b4b' : color.stroke,
        strokeWeight: isSelected ? 4 : 2,
        strokeOpacity: 0.9,
        clickable: true,
        zIndex: isSelected ? 5 : 1,
      };
    });
  }, [fiscalOpacity, selectedFeature]);

  // Apply styling to Base Cartográfica (Lots) layer
  useEffect(() => {
    const layer = bcarDataLayerRef.current;
    if (!layer) return;

    layer.setStyle((feature: google.maps.Data.Feature) => {
      const objectId = Number(feature.getProperty('OBJECTID'));
      const isSelected =
        selectedFeature?.layerType === 'base_cartografica' &&
        Number(selectedFeature?.properties?.OBJECTID) === objectId;
      const isHovered = hoveredFeatureId === objectId;

      return {
        fillColor: isSelected ? '#f59e0b' : isHovered ? '#38bdf8' : '#0284c7',
        fillOpacity: isSelected ? 0.75 : isHovered ? 0.5 : bcarOpacity,
        strokeColor: isSelected ? '#78350f' : isHovered ? '#0284c7' : '#0369a1',
        strokeWeight: isSelected ? 3.5 : isHovered ? 2.5 : 1.2,
        strokeOpacity: 1,
        clickable: true,
        zIndex: isSelected ? 20 : isHovered ? 15 : 2,
      };
    });
  }, [bcarOpacity, selectedFeature, hoveredFeatureId]);

  // When selectedFeature changes with coordinates, center map
  useEffect(() => {
    if (!map || !selectedFeature?.latLng) return;
    map.panTo(selectedFeature.latLng);
    setInfoWindowPos(selectedFeature.latLng);
  }, [selectedFeature, map]);

  // Trigger loading visible bounds
  const handleLoadCurrentViewport = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    onLoadCurrentBounds({
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    });
  }, [map, onLoadCurrentBounds]);

  // Center to Londrina default
  const handleResetView = () => {
    if (!map) return;
    map.panTo({ lat: -23.3103, lng: -51.1628 });
    map.setZoom(13);
  };

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <Map
        mapId="DEMO_MAP_ID"
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        defaultCenter={mapCenter}
        defaultZoom={currentZoom}
        mapTypeId={mapType}
        gestureHandling="greedy"
        disableDefaultUI={false}
        streetViewControl={true}
        mapTypeControl={false}
        zoomControl={true}
        fullscreenControl={false}
        style={{ width: '100%', height: '100%' }}
        onCameraChanged={(ev) => {
          setMapCenter(ev.detail.center);
          setCurrentZoom(ev.detail.zoom);
        }}
      >
        {/* Render Fiscalização Ambiental SEMA (FeatureServer occurrences) */}
        {ocorrenciasVisible &&
          fiscalOcorrencias?.features?.map((f) => {
            const coords = f.geometry?.coordinates;
            if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return null;
            const position = { lat: coords[1], lng: coords[0] };
            const ocorrencia = f.properties['OCORRÊNCIA'] || 'Ocorrência';
            const colors = OCORRENCIA_COLORS[ocorrencia] || OCORRENCIA_COLORS['Outros'];
            const isSelected =
              selectedFeature?.layerType === 'fiscalizacao_ocorrencia' &&
              selectedFeature?.properties?.OBJECTID === f.properties.OBJECTID;

            return (
              <AdvancedMarker
                key={`ocorrencia-${f.properties.OBJECTID}`}
                position={position}
                onClick={() => {
                  setInfoWindowPos(position);
                  onSelectFeature({
                    layerType: 'fiscalizacao_ocorrencia',
                    properties: f.properties,
                    latLng: position,
                  });
                }}
                zIndex={isSelected ? 40 : 30}
              >
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg cursor-pointer transition transform hover:scale-110 border ${
                    isSelected ? 'ring-2 ring-slate-900 scale-110' : ''
                  }`}
                  style={{
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                    color: colors.color,
                  }}
                  title={`${ocorrencia} | Processo: ${f.properties.PROCESSO || '-'}`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: colors.color }}
                  />
                  <span className="text-[10px] font-bold whitespace-nowrap">{ocorrencia}</span>
                </div>
              </AdvancedMarker>
            );
          })}

        {/* InfoWindow for selected item */}
        {selectedFeature && infoWindowPos && (
          <InfoWindow
            position={infoWindowPos}
            onCloseClick={() => onSelectFeature(null)}
          >
            <div className="text-slate-800 p-1 max-w-[300px]">
              {/* Header */}
              <div className="flex items-center gap-1.5 pb-1 mb-1.5 border-b border-slate-200">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    selectedFeature.layerType === 'fiscalizacao_ocorrencia'
                      ? 'bg-amber-500'
                      : selectedFeature.layerType === 'base_cartografica'
                      ? 'bg-sky-500'
                      : 'bg-red-500'
                  }`}
                />
                <span className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                  {selectedFeature.layerType === 'fiscalizacao_ocorrencia'
                    ? 'Fiscalização SEMA (Processo)'
                    : selectedFeature.layerType === 'base_cartografica'
                    ? 'Lote Cadastral SIGLON'
                    : 'Área Fiscal SMF'}
                </span>
              </div>

              {/* Fiscalização Ambiental SEMA Case */}
              {selectedFeature.layerType === 'fiscalizacao_ocorrencia' && (
                <div className="space-y-1.5 text-xs">
                  <div className="font-bold text-sm text-slate-900">
                    {selectedFeature.properties['OCORRÊNCIA'] || 'Fiscalização Ambiental'}
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded p-1.5 text-[11px] space-y-1">
                    <div>
                      Processo:{' '}
                      <strong className="text-slate-900 font-mono">
                        {selectedFeature.properties.PROCESSO || 'Não informado'}
                      </strong>
                    </div>
                    <div>
                      Status:{' '}
                      <span className="inline-block px-1.5 py-0.2 rounded bg-amber-200/80 font-semibold text-amber-950">
                        {selectedFeature.properties.STATUS || 'Em andamento'}
                      </span>
                    </div>
                    {selectedFeature.properties.FISCAL && (
                      <div>
                        Fiscal Responsável: <strong>{selectedFeature.properties.FISCAL}</strong>
                      </div>
                    )}
                    {selectedFeature.properties['ENDEREÇO'] && (
                      <div>
                        Local:{' '}
                        <strong>
                          {selectedFeature.properties['ENDEREÇO']}{' '}
                          {selectedFeature.properties['NÚMERO'] ? `, ${selectedFeature.properties['NÚMERO']}` : ''}
                        </strong>
                      </div>
                    )}
                    {selectedFeature.properties['INSCRIÇÃO'] && (
                      <div>
                        Inscrição Imobiliária:{' '}
                        <span className="font-mono text-sky-800">
                          {selectedFeature.properties['INSCRIÇÃO']}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Base Cartográfica Case */}
              {selectedFeature.layerType === 'base_cartografica' && (
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-slate-900">
                    {selectedFeature.properties.NOME_LOTE || 'Loteamento não identificado'}
                  </div>

                  {selectedFeature.properties.NOME_PROPR && (
                    <div className="text-[11px] text-slate-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                      Proprietário: <strong>{selectedFeature.properties.NOME_PROPR}</strong>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 bg-slate-50 p-1.5 rounded border border-slate-200/80">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Quadra:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFeature.properties.QUADR_C || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Lote:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFeature.properties.LOTE_C || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Cód. Lote:</span>
                      <span className="font-semibold text-sky-700">
                        {selectedFeature.properties.CODLOT || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Área:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFeature.properties.AREA_TERRENO
                          ? `${Number(selectedFeature.properties.AREA_TERRENO).toFixed(0)} m²`
                          : selectedFeature.properties['SHAPE.AREA']
                          ? `${Number(selectedFeature.properties['SHAPE.AREA']).toFixed(1)} m²`
                          : 'Ver planta'}
                      </span>
                    </div>
                    {selectedFeature.properties.INSCRICAO_IMOBILIARIA && (
                      <div className="col-span-2 pt-1 border-t border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Inscrição Imobiliária:</span>
                        <span className="font-mono font-bold text-slate-900">
                          {selectedFeature.properties.INSCRICAO_IMOBILIARIA}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fiscal Zone Case */}
              {selectedFeature.layerType === 'fiscalizacao' && (
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-slate-900">
                    Área Fiscal {selectedFeature.properties.AREAFISCAL}
                  </div>
                  <p className="text-slate-600 text-[11px]">
                    {FISCAL_COLORS[String(selectedFeature.properties.AREAFISCAL)]?.name ||
                      'Jurisdição Fiscal de Londrina'}
                  </p>
                </div>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>

      {/* Floating Map Controls & Inspection HUD */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
        <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/80 p-1.5 flex flex-wrap items-center gap-1.5">
          {/* Base Map Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-700">
            <button
              onClick={() => setMapType('roadmap')}
              className={`px-2.5 py-1 rounded-md transition ${
                mapType === 'roadmap'
                  ? 'bg-white shadow text-sky-700 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Mapa
            </button>
            <button
              onClick={() => setMapType('hybrid')}
              className={`px-2.5 py-1 rounded-md transition ${
                mapType === 'hybrid'
                  ? 'bg-white shadow text-sky-700 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Satélite
            </button>
            <button
              onClick={() => setMapType('terrain')}
              className={`px-2.5 py-1 rounded-md transition ${
                mapType === 'terrain'
                  ? 'bg-white shadow text-sky-700 font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              Relevo
            </button>
          </div>

          <div className="h-4 w-px bg-slate-300 mx-1" />

          {/* Quick Identify / Inspect Toggle */}
          <button
            onClick={() => setInspectMode(!inspectMode)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition shadow-sm ${
              inspectMode
                ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title="Clique em qualquer ponto do mapa para identificar lote e fiscalização"
          >
            <Crosshair className={`w-3.5 h-3.5 ${inspectMode ? 'animate-pulse' : ''}`} />
            <span>{inspectMode ? 'Modo Inspeção Ativo' : 'Inspecionar ao Clicar'}</span>
          </button>

          {/* Load Visible Viewport Lots Button */}
          <button
            onClick={handleLoadCurrentViewport}
            disabled={isLoadingLots}
            className="flex items-center gap-1.5 px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition shadow-sm disabled:opacity-50"
            title="Consulta a base cartográfica para trazer os lotes visíveis nesta área da tela"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{isLoadingLots ? 'Buscando...' : 'Carregar Vista Atual'}</span>
          </button>

          {/* Center Reset */}
          <button
            onClick={handleResetView}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title="Voltar ao Centro de Londrina"
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>

        {/* Quick status toast */}
        {inspectMode && (
          <div className="bg-slate-900/90 text-slate-200 text-xs px-3 py-1.5 rounded-lg shadow backdrop-blur-sm border border-slate-700/80 flex items-center gap-2 max-w-sm">
            <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Clique sobre lotes ou ocorrências no mapa para consultar atributos cadastrais e fiscais do SIGLON.</span>
          </div>
        )}
      </div>

      {/* Mini Legend Overlay on Bottom Right */}
      <div className="absolute bottom-6 right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/90 p-3 max-w-[260px] text-xs space-y-2 pointer-events-auto">
        <div className="flex items-center justify-between font-bold text-slate-800 text-[11px] uppercase tracking-wider pb-1 border-b border-slate-200">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            <span>Camadas Ativas</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold">SIGLON</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-sky-500 border border-sky-700 inline-block" />
              <span>Base Cartográfica</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {bcarVisible ? `${bcarData?.features?.length || 0} lotes` : 'Oculto'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 inline-block" />
              <span>Fiscalização (SEMA)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {ocorrenciasVisible ? `${fiscalOcorrencias?.features?.length || 0} casos` : 'Oculto'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-red-400/80 border border-red-600 inline-block" />
              <span>Áreas Fiscais (SMF)</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {fiscalVisible ? `${fiscalData?.features?.length || 0} zonas` : 'Oculto'}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100 flex items-center justify-between">
          <span>Zoom: {Math.round(currentZoom)}</span>
          <span>Londrina - PR</span>
        </div>
      </div>
    </div>
  );
};
