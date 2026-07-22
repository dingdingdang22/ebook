import React, { useEffect, useState, useRef } from 'react';
import { BookX, DownloadCloud, Zap, AlertCircle } from 'lucide-react';
import { fetchAndCachePdf, isPdfCached } from '../services/cacheService';
import { TxtViewer } from './TxtViewer';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PdfViewerProps {
  filePath: string | null;
  onCacheUpdate?: () => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ filePath, onCacheUpdate }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isInstant, setIsInstant] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<{ loaded: number; total: number; percentage: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const prevObjectUrlRef = useRef<string | null>(null);

  const ext = filePath?.split('.').pop()?.toLowerCase() || '';
  const isTextDoc = ext === 'txt' || ext === 'md';

  useEffect(() => {
    // Clean up previous Object URL to prevent memory leaks
    if (prevObjectUrlRef.current) {
      URL.revokeObjectURL(prevObjectUrlRef.current);
      prevObjectUrlRef.current = null;
    }

    if (!filePath) {
      setBlobUrl(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    const controller = new AbortController();

    const loadDoc = async () => {
      setLoading(true);
      setError(null);
      setDownloadProgress(null);

      // Check if file is already cached
      const cached = await isPdfCached(filePath);
      if (isSubscribed) {
        setIsInstant(cached);
      }

      try {
        const url = await fetchAndCachePdf(
          filePath,
          (progress) => {
            if (isSubscribed) {
              setDownloadProgress(progress);
            }
          },
          controller.signal
        );

        if (isSubscribed) {
          prevObjectUrlRef.current = url;
          setBlobUrl(url);
          setLoading(false);
          if (onCacheUpdate) {
            onCacheUpdate();
          }
        }
      } catch (err: any) {
        if (isSubscribed && err.name !== 'AbortError') {
          console.error('Failed to load document:', err);
          setError(err.message || '加载电子书文档失败，请检查网络或路径');
          setLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [filePath, onCacheUpdate]);

  if (!filePath) {
    return (
      <div className="viewer-container">
        <div className="empty-state">
          <BookX className="empty-state-icon" />
          <p>请在侧边栏选择要阅读的电子书文档 (PDF / TXT / Markdown)</p>
        </div>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="viewer-container">
      {/* Top Overlay Badge */}
      <div className="viewer-status-overlay">
        {isInstant && !loading && (
          <div className="status-badge instant-badge" title="数据直接来源于本地 Cache Storage，实现毫秒级秒开">
            <Zap size={14} />
            <span>本地已缓存 (秒开)</span>
          </div>
        )}
        {!isInstant && !loading && blobUrl && (
          <div className="status-badge downloaded-badge">
            <DownloadCloud size={14} />
            <span>已下载并保存至本地</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>{isInstant ? '正在从本地缓存提取...' : '正在加载并保存至本地持久缓存...'}</p>
          {downloadProgress && downloadProgress.total > 0 && (
            <div className="progress-container">
              <div className="progress-bar-bg">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${downloadProgress.percentage}%` }} 
                />
              </div>
              <div className="progress-text">
                {downloadProgress.percentage}% ({formatSize(downloadProgress.loaded)} / {formatSize(downloadProgress.total)})
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="empty-state error-state">
          <AlertCircle size={48} color="#ef4444" />
          <p className="error-title">文档加载失败</p>
          <p className="error-desc">{error}</p>
        </div>
      )}

      {!loading && !error && blobUrl && (
        isTextDoc ? (
          <TxtViewer blobUrl={blobUrl} filePath={filePath} />
        ) : (
          <PdfCanvasViewer blobUrl={blobUrl} filePath={filePath} />
        )
      )}
    </div>
  );
};
