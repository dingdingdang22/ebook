const CACHE_NAME = 'ebook-cache-v1';
const DB_NAME = 'ebook_metadata_db';
const DB_VERSION = 1;
const STORE_NAME = 'cached_files';

export interface CachedFileMeta {
  path: string;
  name: string;
  size: number;
  cachedAt: number;
}

export interface StorageStats {
  usedBytes: number;
  quotaBytes: number;
  isPersisted: boolean;
  fileCount: number;
}

// Helper: Open IndexedDB for metadata
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'path' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Request Storage Persistence
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) return true;
      return await navigator.storage.persist();
    } catch (e) {
      console.warn('Failed to request storage persistence:', e);
    }
  }
  return false;
}

// Check if persistence is active
export async function checkStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

// Get storage quota and usage
export async function getStorageStats(): Promise<StorageStats> {
  let usedBytes = 0;
  let quotaBytes = 0;
  let isPersisted = false;
  let fileCount = 0;

  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usedBytes = estimate.usage || 0;
      quotaBytes = estimate.quota || 0;
    } catch (e) {
      console.warn('Failed to estimate storage:', e);
    }
  }

  isPersisted = await checkStoragePersistence();

  try {
    const cachedPaths = await getAllCachedPaths();
    fileCount = cachedPaths.length;
  } catch (e) {
    console.warn('Failed to count cached files:', e);
  }

  return { usedBytes, quotaBytes, isPersisted, fileCount };
}

// Helper: Normalize file path to URL
export function normalizePathToUrl(filePath: string): string {
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const cleanPath = filePath.startsWith('/') ? filePath : '/' + filePath;
  return cleanPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

// Check if a PDF is cached
export async function isPdfCached(filePath: string): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = normalizePathToUrl(filePath);
    const response = await cache.match(url);
    return !!response;
  } catch (e) {
    console.error('Error checking pdf cache:', e);
    return false;
  }
}

// Get ObjectURL from CacheStorage if cached
export async function getCachedPdfBlobUrl(filePath: string): Promise<string | null> {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = normalizePathToUrl(filePath);
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.error('Error getting cached pdf blob:', e);
  }
  return null;
}

// Download and cache PDF with optional progress callback
export async function fetchAndCachePdf(
  filePath: string,
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
): Promise<string> {
  const url = normalizePathToUrl(filePath);

  // Check cache first
  if ('caches' in window) {
    const cache = await caches.open(CACHE_NAME);
    const existing = await cache.match(url);
    if (existing) {
      const blob = await existing.blob();
      if (onProgress) {
        onProgress({ loaded: blob.size, total: blob.size, percentage: 100 });
      }
      return URL.createObjectURL(blob);
    }
  }

  // Fetch with progress tracking
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  let loaded = 0;
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        if (onProgress) {
          const percentage = total > 0 ? Math.round((loaded / total) * 100) : 0;
          onProgress({ loaded, total, percentage });
        }
      }
    }
  }

  // Create combined Blob
  const blob = new Blob(chunks as BlobPart[], { type: 'application/pdf' });

  // Store in CacheStorage
  if ('caches' in window) {
    try {
      const cache = await caches.open(CACHE_NAME);
      const headers = new Headers();
      headers.append('content-type', 'application/pdf');
      headers.append('content-length', blob.size.toString());
      const responseToCache = new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers
      });
      await cache.put(url, responseToCache);

      // Save metadata to IndexedDB
      await saveMeta({
        path: filePath,
        name: filePath.split('/').pop() || filePath,
        size: blob.size,
        cachedAt: Date.now()
      });
    } catch (e) {
      console.warn('Failed to write to CacheStorage:', e);
    }
  }

  return URL.createObjectURL(blob);
}

// Save metadata to IndexedDB
async function saveMeta(meta: CachedFileMeta): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(meta);
  } catch (e) {
    console.warn('Failed to save metadata to IndexedDB:', e);
  }
}

// Get all cached file paths
export async function getAllCachedPaths(): Promise<string[]> {
  if (!('caches' in window)) return [];
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    return requests.map(req => {
      const urlStr = req.url;
      const url = new URL(urlStr);
      return decodeURIComponent(url.pathname);
    });
  } catch (e) {
    console.error('Error getting cached paths:', e);
    return [];
  }
}

// Get all cached files metadata list
export async function getAllCachedMeta(): Promise<CachedFileMeta[]> {
  const cachedPaths = await getAllCachedPaths();
  const pathSet = new Set(cachedPaths);

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const metas: CachedFileMeta[] = request.result || [];
        const validMetas = metas.filter(m => pathSet.has(m.path) || pathSet.has(normalizePathToUrl(m.path)));
        resolve(validMetas);
      };
      request.onerror = () => resolve([]);
    });
  } catch (e) {
    console.warn('Error fetching metadata from IndexedDB:', e);
    return [];
  }
}

// Remove single PDF from cache
export async function removeCachedPdf(filePath: string): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const url = normalizePathToUrl(filePath);
    const deleted = await cache.delete(url);

    // Delete from IndexedDB
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(filePath);
    } catch (e) {
      console.warn('Error deleting meta from IndexedDB:', e);
    }

    return deleted;
  } catch (e) {
    console.error('Error removing cached PDF:', e);
    return false;
  }
}

// Clear all PDF caches
export async function clearAllPdfCache(): Promise<boolean> {
  if (!('caches' in window)) return false;
  try {
    await caches.delete(CACHE_NAME);
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
    } catch (e) {
      console.warn('Error clearing IndexedDB:', e);
    }
    return true;
  } catch (e) {
    console.error('Error clearing all caches:', e);
    return false;
  }
}
