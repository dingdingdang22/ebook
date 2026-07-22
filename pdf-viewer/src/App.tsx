import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import type { TreeNode } from './components/Sidebar';
import { PdfViewer } from './components/PdfViewer';
import { StorageModal } from './components/StorageModal';
import { PanelLeft, PanelLeftClose, HardDrive, ShieldCheck } from 'lucide-react';
import treeData from './tree.json';
import { 
  requestStoragePersistence, 
  getStorageStats, 
  getAllCachedPaths, 
  type StorageStats 
} from './services/cacheService';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  // Storage & Cache management states
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [cachedPathsSet, setCachedPathsSet] = useState<Set<string>>(new Set());

  const refreshStorageState = useCallback(async () => {
    try {
      const stats = await getStorageStats();
      const paths = await getAllCachedPaths();
      setStorageStats(stats);
      setCachedPathsSet(new Set(paths));
    } catch (e) {
      console.error('Failed to update storage state:', e);
    }
  }, []);

  // On mount: auto-request persistent storage and load stats
  useEffect(() => {
    const init = async () => {
      await requestStoragePersistence();
      await refreshStorageState();
    };
    init();

    // Check if there's a file in URL params
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) {
      setSelectedFile(file);
    }
  }, [refreshStorageState]);

  // Sync state to URL without reloading
  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
    const url = new URL(window.location.href);
    url.searchParams.set('file', path);
    window.history.pushState({}, '', url);
  };

  const startResizing = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      setSidebarWidth(Math.max(200, Math.min(e.clientX, 800)));
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="app-container" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
      {isSidebarVisible && (
        <>
          <Sidebar 
            tree={treeData as TreeNode[]} 
            selectedFile={selectedFile} 
            cachedPaths={cachedPathsSet}
            onSelectFile={handleSelectFile} 
            width={sidebarWidth}
          />
          <div className="resizer" onMouseDown={startResizing} />
        </>
      )}
      <main className="main-content" style={{ pointerEvents: isResizing ? 'none' : 'auto' }}>
        <div className="top-bar">
          <button onClick={toggleSidebar} className="sidebar-toggle" title="Toggle Sidebar">
            {isSidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
          </button>
          
          {selectedFile ? (
            <div className="breadcrumb">
              {selectedFile.split('/').filter(Boolean).map((segment, index, arr) => (
                <React.Fragment key={index}>
                  <span className="breadcrumb-item">{segment}</span>
                  {index < arr.length - 1 && <span className="breadcrumb-separator">/</span>}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <span className="welcome-text">欢迎使用学习材料阅读器</span>
          )}

          {/* Storage Widget Button */}
          <button 
            className={`storage-widget-btn ${storageStats?.isPersisted ? 'persisted' : ''}`}
            onClick={() => setIsStorageModalOpen(true)}
            title="点击管理本地持久缓存"
          >
            <HardDrive size={16} />
            <span>
              {storageStats ? `${formatSize(storageStats.usedBytes)} (${storageStats.fileCount}本已离线)` : '存储加载中'}
            </span>
            {storageStats?.isPersisted && (
              <span title="持久化存储保护中" style={{ display: 'inline-flex', alignItems: 'center' }}>
                <ShieldCheck size={14} color="#10b981" />
              </span>
            )}
          </button>
        </div>

        <PdfViewer filePath={selectedFile} onCacheUpdate={refreshStorageState} />
      </main>

      {/* Storage Management Modal */}
      <StorageModal 
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        onCacheChange={refreshStorageState}
      />
    </div>
  );
}

export default App;
