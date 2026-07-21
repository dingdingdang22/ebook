import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import type { TreeNode } from './components/Sidebar';
import { PdfViewer } from './components/PdfViewer';
import treeData from './tree.json';

function App() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
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

  return (
    <div className="app-container">
      <Sidebar 
        tree={treeData as TreeNode[]} 
        selectedFile={selectedFile} 
        onSelectFile={handleSelectFile} 
      />
      <main className="main-content">
        <div className="top-bar">
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
