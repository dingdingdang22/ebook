import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import type { TreeNode } from './components/Sidebar';
import { PdfViewer } from './components/PdfViewer';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import treeData from './tree.json';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  
  // On mount, check if there's a file in URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get('file');
    if (file) {
      setSelectedFile(file);
    }
  }, []);

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
      // Limit sidebar width between 200px and 800px
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

  return (
    <div className="app-container" style={{ cursor: isResizing ? 'col-resize' : 'default' }}>
      {isSidebarVisible && (
        <>
          <Sidebar 
            tree={treeData as TreeNode[]} 
            selectedFile={selectedFile} 
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
            <span>Welcome to Study Materials Viewer</span>
          )}
        </div>
        <PdfViewer filePath={selectedFile} />
      </main>
    </div>
  );
}

export default App;
