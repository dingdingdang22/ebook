import React, { useEffect, useState } from 'react';
import { Sun, Moon, BookOpen, Minus, Plus } from 'lucide-react';

interface TxtViewerProps {
  blobUrl: string;
  filePath: string;
}

type ThemeMode = 'dark' | 'sepia' | 'light';

export const TxtViewer: React.FC<TxtViewerProps> = ({ blobUrl, filePath }) => {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Customization controls
  const [fontSize, setFontSize] = useState<number>(16);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isSerif, setIsSerif] = useState<boolean>(false);

  const isMarkdown = filePath.toLowerCase().endsWith('.md');

  useEffect(() => {
    let isSubscribed = true;
    setLoading(true);
    setError(null);

    const loadTextContent = async () => {
      try {
        const response = await fetch(blobUrl);
        const buffer = await response.arrayBuffer();
        
        let text = '';
        // Try UTF-8 decoding first with fatal option
        try {
          const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
          text = utf8Decoder.decode(buffer);
        } catch {
          // If UTF-8 fails, fallback to GBK / GB2312 (common for Chinese Windows TXT files)
          try {
            const gbkDecoder = new TextDecoder('gbk');
            text = gbkDecoder.decode(buffer);
          } catch {
            const fallbackDecoder = new TextDecoder('utf-8');
            text = fallbackDecoder.decode(buffer);
          }
        }

        if (isSubscribed) {
          setContent(text);
          setLoading(false);
        }
      } catch (err: any) {
        if (isSubscribed) {
          setError(err.message || '解密或读取文本文档失败');
          setLoading(false);
        }
      }
    };

    loadTextContent();

    return () => {
      isSubscribed = false;
    };
  }, [blobUrl, filePath]);

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 2, 32));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 2, 12));

  if (loading) {
    return (
      <div className="txt-container dark">
        <div className="loading-state">
          <div className="spinner" />
          <p>正在读取并排版文本内容...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="txt-container dark">
        <div className="empty-state error-state">
          <p className="error-title">文本加载失败</p>
          <p className="error-desc">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`txt-container ${theme} ${isSerif ? 'serif-font' : 'sans-font'}`}>
      {/* Control bar */}
      <div className="txt-toolbar">
        <div className="txt-toolbar-group">
          <button className="txt-btn" onClick={handleZoomOut} title="缩小字体 (A-)">
            <Minus size={14} />
          </button>
          <span className="font-size-indicator">{fontSize}px</span>
          <button className="txt-btn" onClick={handleZoomIn} title="放大字体 (A+)">
            <Plus size={14} />
          </button>
        </div>

        <div className="txt-toolbar-group">
          <button 
            className={`txt-btn ${!isSerif ? 'active' : ''}`} 
            onClick={() => setIsSerif(false)} 
            title="无衬线黑体"
          >
            黑体
          </button>
          <button 
            className={`txt-btn ${isSerif ? 'active' : ''}`} 
            onClick={() => setIsSerif(true)} 
            title="衬线宋体/楷体"
          >
            宋体
          </button>
        </div>

        <div className="txt-toolbar-group">
          <button 
            className={`txt-btn ${theme === 'dark' ? 'active' : ''}`} 
            onClick={() => setTheme('dark')} 
            title="暗黑模式"
          >
            <Moon size={14} />
            <span>暗黑</span>
          </button>
          <button 
            className={`txt-btn ${theme === 'sepia' ? 'active' : ''}`} 
            onClick={() => setTheme('sepia')} 
            title="羊皮纸护眼"
          >
            <BookOpen size={14} />
            <span>护眼</span>
          </button>
          <button 
            className={`txt-btn ${theme === 'light' ? 'active' : ''}`} 
            onClick={() => setTheme('light')} 
            title="明亮模式"
          >
            <Sun size={14} />
            <span>明亮</span>
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="txt-content-wrapper">
        <div 
          className="txt-paper" 
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
        >
          {isMarkdown ? (
            <div className="markdown-body">
              {content.split('\n').map((line, idx) => {
                if (line.startsWith('# ')) return <h1 key={idx}>{line.replace(/^#\s+/, '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={idx}>{line.replace(/^##\s+/, '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={idx}>{line.replace(/^###\s+/, '')}</h3>;
                if (line.startsWith('> ')) return <blockquote key={idx}>{line.replace(/^>\s+/, '')}</blockquote>;
                if (line.startsWith('- ') || line.startsWith('* ')) return <li key={idx}>{line.replace(/^[-*]\s+/, '')}</li>;
                if (line.trim() === '') return <div key={idx} style={{ height: '1em' }} />;
                return <p key={idx}>{line}</p>;
              })}
            </div>
          ) : (
            <div className="plain-text-body">
              {content.split('\n').map((paragraph, index) => (
                <p key={index}>{paragraph || '\u00A0'}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer bar */}
      <div className="txt-footer font-size-indicator">
        <span>全书约 {content.length.toLocaleString()} 字</span>
        <span>•</span>
        <span>格式: {isMarkdown ? 'Markdown (.md)' : '文本文件 (.txt)'}</span>
      </div>
    </div>
  );
};
