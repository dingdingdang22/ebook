import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Minus, Plus, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

// Configure worker for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfCanvasViewerProps {
  blobUrl: string;
  filePath: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({ blobUrl }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Load PDF Document
  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setError(null);

    const loadPdf = async () => {
      try {
        const response = await fetch(blobUrl);
        const arrayBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        if (isSubscribed) {
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          setCurrentPage(1);
          setLoading(false);
        }
      } catch (err: any) {
        if (isSubscribed) {
          console.error('Error loading PDF canvas:', err);
          setError(err.message || '加载 PDF 文档解析失败');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isSubscribed = false;
      if (pdfDocRef.current) {
        if (typeof (pdfDocRef.current as any).destroy === 'function') {
          (pdfDocRef.current as any).destroy();
        } else if (typeof pdfDocRef.current.cleanup === 'function') {
          pdfDocRef.current.cleanup();
        }
        pdfDocRef.current = null;
      }
    };
  }, [blobUrl]);

  // Render individual page onto canvas
  const renderPage = async (pageNumber: number, container: HTMLDivElement) => {
    if (!pdfDocRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      let canvas = container.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        container.appendChild(canvas);
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext: any = {
        canvasContext: context,
        canvas,
        transform,
        viewport
      };

      await page.render(renderContext).promise;
    } catch (e) {
      console.warn(`Failed to render page ${pageNumber}:`, e);
    }
  };

  // Re-render visible pages when scale or numPages changes
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    for (let p = 1; p <= numPages; p++) {
      const el = pageRefs.current[p];
      if (el) {
        renderPage(p, el);
      }
    }
  }, [scale, numPages, loading]);

  // Handle scroll to update current page indicator
  const handleScroll = () => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.scrollTop;
    const containerHeight = containerRef.current.clientHeight;

    for (let p = 1; p <= numPages; p++) {
      const el = pageRefs.current[p];
      if (el) {
        const offsetTop = el.offsetTop;
        const offsetHeight = el.offsetHeight;
        if (offsetTop <= containerTop + containerHeight / 2 && offsetTop + offsetHeight > containerTop) {
          setCurrentPage(p);
          break;
        }
      }
    }
  };

  const scrollToPage = (p: number) => {
    const targetPage = Math.max(1, Math.min(p, numPages));
    const el = pageRefs.current[targetPage];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(targetPage);
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const availableWidth = containerRef.current.clientWidth - 40;
      setScale(Math.max(0.6, availableWidth / 612));
    }
  };

  if (loading) {
    return (
      <div className="pdf-canvas-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>正在渲染 PDF 矢量页面...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-canvas-container">
        <div className="empty-state error-state">
          <p className="error-title">PDF 页面解析失败</p>
          <p className="error-desc">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-canvas-container">
      {/* Floating Toolbar */}
      <div className="pdf-canvas-toolbar">
        <div className="toolbar-group">
          <button 
            className="canvas-btn" 
            onClick={() => scrollToPage(currentPage - 1)} 
            disabled={currentPage <= 1}
            title="上一页"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="page-indicator">
            {currentPage} / {numPages} 页
          </span>
          <button 
            className="canvas-btn" 
            onClick={() => scrollToPage(currentPage + 1)} 
            disabled={currentPage >= numPages}
            title="下一页"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="toolbar-group">
          <button className="canvas-btn" onClick={handleZoomOut} title="缩小">
            <Minus size={14} />
          </button>
          <span className="zoom-indicator">{Math.round(scale * 100)}%</span>
          <button className="canvas-btn" onClick={handleZoomIn} title="放大">
            <Plus size={14} />
          </button>
          <button className="canvas-btn" onClick={handleFitWidth} title="适合宽度">
            <Maximize2 size={14} />
            <span>自适应</span>
          </button>
        </div>
      </div>

      {/* Pages Container with smooth vertical scroll */}
      <div className="pdf-pages-scroll-area" ref={containerRef} onScroll={handleScroll}>
        {Array.from({ length: numPages }, (_, index) => {
          const pageNum = index + 1;
          return (
            <div 
              key={pageNum} 
              className="pdf-page-wrapper"
              ref={(el) => { pageRefs.current[pageNum] = el; }}
            >
              <div className="page-number-tag">Page {pageNum}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
