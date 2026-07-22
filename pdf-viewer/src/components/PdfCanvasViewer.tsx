import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Minus, Plus, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

// Configure local worker bundled by Vite (works offline)
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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
  const renderedPagesRef = useRef<Set<number>>(new Set());
  const activeRenderTasksRef = useRef<{ [key: number]: any }>({});

  // Load PDF Document
  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setError(null);
    renderedPagesRef.current.clear();

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
          console.error('Error loading PDF document:', err);
          setError(err.message || '加载 PDF 文档解析失败');
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isSubscribed = false;
      // Cancel active renders
      Object.values(activeRenderTasksRef.current).forEach(task => {
        try { task?.cancel?.(); } catch {}
      });
      activeRenderTasksRef.current = {};

      if (pdfDocRef.current) {
        try {
          if (typeof (pdfDocRef.current as any).destroy === 'function') {
            (pdfDocRef.current as any).destroy();
          } else if (typeof pdfDocRef.current.cleanup === 'function') {
            pdfDocRef.current.cleanup();
          }
        } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [blobUrl]);

  // Render a specific page on demand
  const renderPageOnDemand = useCallback(async (pageNumber: number) => {
    if (!pdfDocRef.current) return;
    const container = pageRefs.current[pageNumber];
    if (!container) return;

    // Cancel existing render for this page if any
    if (activeRenderTasksRef.current[pageNumber]) {
      try { activeRenderTasksRef.current[pageNumber].cancel(); } catch {}
    }

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

      // Set container dimensions
      container.style.width = `${Math.floor(viewport.width)}px`;
      container.style.height = `${Math.floor(viewport.height)}px`;

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderContext: any = {
        canvasContext: context,
        canvas,
        transform,
        viewport
      };

      const renderTask = page.render(renderContext);
      activeRenderTasksRef.current[pageNumber] = renderTask;

      await renderTask.promise;
      delete activeRenderTasksRef.current[pageNumber];
      renderedPagesRef.current.add(pageNumber);
    } catch (e: any) {
      if (e?.name !== 'RenderingCancelledException') {
        console.warn(`Failed to render page ${pageNumber}:`, e);
      }
    }
  }, [scale]);

  // When scale changes, re-render all previously rendered pages
  useEffect(() => {
    if (!pdfDocRef.current || loading) return;
    const pagesToReRender = Array.from(renderedPagesRef.current);
    renderedPagesRef.current.clear();
    pagesToReRender.forEach(p => renderPageOnDemand(p));
  }, [scale, loading, renderPageOnDemand]);

  // Setup IntersectionObserver for Lazy Rendering
  useEffect(() => {
    if (loading || numPages === 0 || !containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page-number') || '1', 10);
            if (!renderedPagesRef.current.has(pageNum)) {
              renderPageOnDemand(pageNum);
            }
          }
        });
      },
      {
        root: containerRef.current,
        rootMargin: '300px 0px 300px 0px', // Render pages ahead of scroll
        threshold: 0.01
      }
    );

    // Observe all page wrapper elements
    for (let p = 1; p <= numPages; p++) {
      const el = pageRefs.current[p];
      if (el) observer.observe(el);
    }

    // Force render page 1 immediately
    renderPageOnDemand(1);

    return () => {
      observer.disconnect();
    };
  }, [loading, numPages, renderPageOnDemand]);

  // Scroll handler to track active page
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
      // Ensure target page is rendered
      renderPageOnDemand(targetPage);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(targetPage);
    }
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.2, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const availableWidth = containerRef.current.clientWidth - 48;
      setScale(Math.max(0.6, parseFloat((availableWidth / 612).toFixed(2))));
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
          const estimatedWidth = Math.floor(612 * scale);
          const estimatedHeight = Math.floor(850 * scale);

          return (
            <div 
              key={pageNum} 
              className="pdf-page-wrapper"
              data-page-number={pageNum}
              style={{
                minWidth: `${estimatedWidth}px`,
                minHeight: `${estimatedHeight}px`,
              }}
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
