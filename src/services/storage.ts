/**
 * Local offline & persistent storage service using browser IndexedDB.
 * Ensures the 7,355 fiscalização records and lots fetched by region/filter
 * remain permanently stored in the application without requiring repetitive API calls.
 */

import {
  SiglonFeature,
  BCarProperties,
  FiscalOcorrenciaProperties,
  SiglonFeatureCollection,
} from '../types/siglon';

const DB_NAME = 'GeoLondrinaDB';
const DB_VERSION = 1;

interface StorageStats {
  totalFiscal: number;
  totalLots: number;
  cachedRegions: string[];
  lastSyncFiscal: string | null;
  lastSyncLots: string | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB não suportado'));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Fiscalização store
      if (!db.objectStoreNames.contains('fiscalizacoes')) {
        const fiscalStore = db.createObjectStore('fiscalizacoes', { keyPath: 'id' });
        fiscalStore.createIndex('ocorrencia', 'properties.OCORRÊNCIA', { unique: false });
        fiscalStore.createIndex('status', 'properties.STATUS', { unique: false });
        fiscalStore.createIndex('processo', 'properties.PROCESSO', { unique: false });
      }

      // Lotes store
      if (!db.objectStoreNames.contains('lotes')) {
        const lotStore = db.createObjectStore('lotes', { keyPath: 'id' });
        lotStore.createIndex('nome_lote', 'properties.NOME_LOTE', { unique: false });
        lotStore.createIndex('quadra', 'properties.QUADR_C', { unique: false });
        lotStore.createIndex('lote', 'properties.LOTE_C', { unique: false });
        lotStore.createIndex('cpf_cnpj', 'properties.CPF_CNPJ_PROPR', { unique: false });
        lotStore.createIndex('nome_propr', 'properties.NOME_PROPR', { unique: false });
        lotStore.createIndex('regiao', 'regiao', { unique: false });
      }

      // Metadata store
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Save all 7,355 fiscalização records into IndexedDB
 */
export async function saveFiscalizacoesToStorage(
  features: SiglonFeature<FiscalOcorrenciaProperties>[]
): Promise<number> {
  if (!features || !features.length) return 0;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fiscalizacoes', 'meta'], 'readwrite');
      const store = tx.objectStore('fiscalizacoes');
      const meta = tx.objectStore('meta');

      for (const feat of features) {
        const key = feat.id || feat.properties?.OBJECTID || Math.random();
        store.put({
          id: key,
          ...feat,
        });
      }

      meta.put({ key: 'lastSyncFiscal', value: new Date().toISOString() });
      meta.put({ key: 'fiscalCount', value: features.length });

      tx.oncomplete = () => resolve(features.length);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar fiscalizações no IndexedDB:', err);
    return 0;
  }
}

/**
 * Read all fiscalizações from IndexedDB
 */
export async function getAllFiscalizacoesFromStorage(): Promise<SiglonFeature<FiscalOcorrenciaProperties>[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fiscalizacoes', 'readonly');
      const store = tx.objectStore('fiscalizacoes');
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB read error:', err);
    return [];
  }
}

/**
 * Save lot features into IndexedDB
 */
export async function saveLotsToStorage(
  features: SiglonFeature<BCarProperties>[],
  regionName?: string
): Promise<number> {
  if (!features || !features.length) return 0;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['lotes', 'meta'], 'readwrite');
      const store = tx.objectStore('lotes');
      const meta = tx.objectStore('meta');

      for (const feat of features) {
        const key =
          feat.id ||
          feat.properties?.OBJECTID ||
          feat.properties?.OBJECTID_1 ||
          `${feat.properties?.QUADR_C || ''}-${feat.properties?.LOTE_C || ''}-${feat.properties?.CODLOT || ''}`;

        store.put({
          id: key,
          regiao: regionName || feat.properties?.NOME_LOTE || 'Geral',
          ...feat,
        });
      }

      meta.put({ key: 'lastSyncLots', value: new Date().toISOString() });

      tx.oncomplete = () => {
        // Also sync to backend disk in background
        fetch('/api/data/save-lotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features, region: regionName }),
        }).catch(() => {});

        resolve(features.length);
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao salvar lotes no IndexedDB:', err);
    return 0;
  }
}

/**
 * Initialize storage with server pre-cached datasets (all 7,355 fiscalizações and initial lots)
 */
export async function initStorageWithPrecachedData(): Promise<{ fiscalCount: number; lotsCount: number }> {
  let [fCount, lCount] = await Promise.all([
    countFiscalizacoesInStorage(),
    countLotsInStorage(),
  ]);

  // If fiscalizações not in IndexedDB, load all 7,355
  if (fCount < 100) {
    try {
      const res = await fetch('/api/data/fiscalizacao');
      if (res.ok) {
        const json = await res.json();
        if (json.features?.length) {
          fCount = await saveFiscalizacoesToStorage(json.features);
        }
      }
    } catch (_) {}
  }

  // If lots not in IndexedDB, load pre-cached batch
  if (lCount < 100) {
    try {
      const res = await fetch('/api/data/lotes');
      if (res.ok) {
        const json = await res.json();
        if (json.features?.length) {
          lCount = await saveLotsToStorage(json.features, 'Lotes Iniciais');
        }
      }
    } catch (_) {}
  }

  return { fiscalCount: fCount, lotsCount: lCount };
}

/**
 * Retrieve all lots currently stored in IndexedDB (fast local reading)
 */
export async function getAllStoredLots(limit = 2000): Promise<SiglonFeature<BCarProperties>[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('lotes', 'readonly');
      const store = tx.objectStore('lotes');
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result || [];
        resolve(results.slice(0, limit));
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Query lots from IndexedDB with attribute filtering
 */
export async function queryLotsFromStorage(filters?: {
  regiao?: string;
  nomeLote?: string;
  quadra?: string;
  lote?: string;
  cpfCnpj?: string;
  nomeProprietario?: string;
  limit?: number;
}): Promise<SiglonFeature<BCarProperties>[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('lotes', 'readonly');
      const store = tx.objectStore('lotes');
      const req = store.getAll();

      req.onsuccess = () => {
        let results = (req.result || []) as (SiglonFeature<BCarProperties> & { regiao?: string })[];

        if (filters?.cpfCnpj && filters.cpfCnpj.trim()) {
          const clean = filters.cpfCnpj.trim().replace(/\D/g, '');
          results = results.filter((f) => {
            const cpf = String(f.properties?.CPF_CNPJ_PROPR || f.properties?.cpf_cnpj_propr || '');
            return cpf.includes(clean);
          });
        }

        if (filters?.nomeProprietario && filters.nomeProprietario.trim()) {
          const clean = filters.nomeProprietario.trim().toLowerCase();
          results = results.filter((f) => {
            const propr = String(f.properties?.NOME_PROPR || f.properties?.nome_propr || '').toLowerCase();
            return propr.includes(clean);
          });
        }

        if (filters?.nomeLote && filters.nomeLote.trim()) {
          const clean = filters.nomeLote.trim().toLowerCase();
          results = results.filter((f) => {
            const nome = String(f.properties?.NOME_LOTE || f.properties?.nome_lote || f.regiao || '').toLowerCase();
            return nome.includes(clean);
          });
        }

        if (filters?.quadra && filters.quadra.trim()) {
          const clean = filters.quadra.trim();
          results = results.filter((f) => String(f.properties?.QUADR_C || '') === clean);
        }

        if (filters?.lote && filters.lote.trim()) {
          const clean = filters.lote.trim();
          results = results.filter((f) => String(f.properties?.LOTE_C || '') === clean);
        }

        if (filters?.limit && filters.limit > 0) {
          results = results.slice(0, filters.limit);
        }

        resolve(results);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao consultar lotes no IndexedDB:', err);
    return [];
  }
}

/**
 * Count total lots stored locally in IndexedDB
 */
export async function countLotsInStorage(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('lotes', 'readonly');
      const store = tx.objectStore('lotes');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (_) {
    return 0;
  }
}

/**
 * Count total fiscalizações stored locally in IndexedDB
 */
export async function countFiscalizacoesInStorage(): Promise<number> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('fiscalizacoes', 'readonly');
      const store = tx.objectStore('fiscalizacoes');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  } catch (_) {
    return 0;
  }
}

/**
 * Get distinct regions currently cached in local IndexedDB
 */
export async function getCachedRegions(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('lotes', 'readonly');
      const store = tx.objectStore('lotes');
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const regions = new Set<string>();
        for (const item of items) {
          if (item.regiao) regions.add(item.regiao);
          if (item.properties?.NOME_LOTE) regions.add(item.properties.NOME_LOTE);
        }
        resolve(Array.from(regions).slice(0, 30));
      };
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

/**
 * Get overall storage statistics
 */
export async function getStorageStats(): Promise<StorageStats> {
  const [totalFiscal, totalLots, cachedRegions] = await Promise.all([
    countFiscalizacoesInStorage(),
    countLotsInStorage(),
    getCachedRegions(),
  ]);

  return {
    totalFiscal,
    totalLots,
    cachedRegions,
    lastSyncFiscal: localStorage.getItem('lastSyncFiscal'),
    lastSyncLots: localStorage.getItem('lastSyncLots'),
  };
}

/**
 * Clear all locally stored data in IndexedDB
 */
export async function clearStorage(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['fiscalizacoes', 'lotes', 'meta'], 'readwrite');
      tx.objectStore('fiscalizacoes').clear();
      tx.objectStore('lotes').clear();
      tx.objectStore('meta').clear();
      tx.oncomplete = () => {
        localStorage.removeItem('lastSyncFiscal');
        localStorage.removeItem('lastSyncLots');
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Erro ao limpar IndexedDB:', err);
  }
}
