import React, { useEffect, useState } from 'react';
import { 
  X, 
  HardDrive, 
  ShieldCheck, 
  ShieldAlert, 
  Trash2, 
  RefreshCw, 
  FileText, 
  CheckCircle 
} from 'lucide-react';
import { 
  getStorageStats, 
  getAllCachedMeta, 
  removeCachedPdf, 
  clearAllPdfCache, 
  requestStoragePersistence,
  type StorageStats, 
  type CachedFileMeta 
} from '../services/cacheService';

interface StorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCacheChange: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({ isOpen, onClose, onCacheChange }) => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [cachedFiles, setCachedFiles] = useState<CachedFileMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await getStorageStats();
      const files = await getAllCachedMeta();
      setStats(s);
      setCachedFiles(files);
    } catch (e) {
      console.error('Failed to load storage modal data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPersistence = async () => {
    const granted = await requestStoragePersistence();
    if (granted) {
      loadData();
      onCacheChange();
    } else {
      alert('持久化存储未获批准。在部分浏览器中，需要将网站添加至书签或频繁访问后才能自动批准。');
    }
  };

  const handleDeleteSingle = async (path: string) => {
    await removeCachedPdf(path);
    await loadData();
    onCacheChange();
  };

  const handleClearAll = async () => {
    if (window.confirm('确定要清空本地所有已下载的电子书缓存吗？（清空后在线阅读时将重新从网络下载）')) {
      await clearAllPdfCache();
      await loadData();
      onCacheChange();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usedPercentage = stats && stats.quotaBytes > 0 
    ? ((stats.usedBytes / stats.quotaBytes) * 100).toFixed(2)
    : '0';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <HardDrive size={20} color="#60a5fa" />
            <span>本地大容量持久化缓存管理</span>
          </div>
          <button className="icon-btn" onClick={onClose} title="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Persistence status card */}
          <div className={`status-card ${stats?.isPersisted ? 'persisted' : 'not-persisted'}`}>
            <div className="status-card-icon">
              {stats?.isPersisted ? (
                <ShieldCheck size={24} color="#10b981" />
              ) : (
                <ShieldAlert size={24} color="#f59e0b" />
              )}
            </div>
            <div className="status-card-info">
              <div className="status-card-title">
                {stats?.isPersisted ? '持久化保护已开启 (Persistent Storage)' : '最佳努力缓存模式 (Best-Effort Storage)'}
              </div>
              <div className="status-card-desc">
                {stats?.isPersisted 
                  ? '浏览器在系统磁盘空间紧张时不会自动清理本站的电子书缓存。' 
                  : '设备磁盘空间不足时，浏览器可能会自动清理本站缓存。建议申请持久化保护。'}
              </div>
            </div>
            {!stats?.isPersisted && (
              <button className="btn-primary" onClick={handleRequestPersistence}>
                申请持久化
              </button>
            )}
          </div>

          {/* Quota Progress */}
          <div className="storage-quota-section">
            <div className="quota-header">
              <span>已用配额空间</span>
              <span className="quota-text">
                {stats ? `${formatSize(stats.usedBytes)} / ${formatSize(stats.quotaBytes)} (${usedPercentage}%)` : '加载中...'}
              </span>
            </div>
            <div className="quota-bar-bg">
              <div 
                className="quota-bar-fill" 
                style={{ width: `${Math.min(100, Math.max(0.5, parseFloat(usedPercentage)))}%` }} 
              />
            </div>
          </div>

          {/* File list header */}
          <div className="file-list-header">
            <div className="file-list-title">
              <span>已缓存电子书 ({cachedFiles.length} 本)</span>
              <button className="icon-btn" onClick={loadData} title="刷新" disabled={loading}>
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
            {cachedFiles.length > 0 && (
              <button className="btn-danger-link" onClick={handleClearAll}>
                <Trash2 size={14} />
                <span>清空全部缓存</span>
              </button>
            )}
          </div>

          {/* Cached files list */}
          <div className="cached-files-list">
            {cachedFiles.length === 0 ? (
              <div className="empty-files-hint">
                <CheckCircle size={32} color="#9ca3af" />
                <p>暂无缓存的电子书，阅读电子书时会自动离线保存。</p>
              </div>
            ) : (
              cachedFiles.map((file) => (
                <div className="cached-file-item" key={file.path}>
                  <FileText size={16} color="#60a5fa" />
                  <div className="file-info">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-meta">
                      {formatSize(file.size)} • {new Date(file.cachedAt).toLocaleString()}
                    </span>
                  </div>
                  <button 
                    className="icon-btn delete-btn" 
                    onClick={() => handleDeleteSingle(file.path)}
                    title="删除此缓存"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
