import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, BookOpen, CheckCircle } from 'lucide-react';

export type TreeNode = {
  type: 'directory' | 'file';
  name: string;
  path: string;
  children?: TreeNode[];
};

interface SidebarProps {
  tree: TreeNode[];
  selectedFile: string | null;
  cachedPaths?: Set<string>;
  onSelectFile: (path: string) => void;
  width?: number;
}

const TreeNodeItem: React.FC<{
  node: TreeNode;
  level: number;
  selectedFile: string | null;
  cachedPaths?: Set<string>;
  onSelectFile: (path: string) => void;
}> = ({ node, level, selectedFile, cachedPaths, onSelectFile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedFile === node.path;
  const isDir = node.type === 'directory';
  const isCached = !isDir && cachedPaths?.has(node.path);

  const handleClick = () => {
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      onSelectFile(node.path);
    }
  };

  return (
    <div className="tree-node">
      <div 
        className={`tree-item ${isSelected ? 'active' : ''}`}
        style={{ paddingLeft: `${level * 16 + 12}px` }}
        onClick={handleClick}
      >
        <div className="tree-item-icon">
          {isDir ? (
            isOpen ? <FolderOpen size={16} /> : <Folder size={16} />
          ) : (
            <FileText size={16} />
          )}
        </div>
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={node.name}>
          {node.name}
        </span>
        
        {/* Cached indicator */}
        {isCached && (
          <div className="cached-badge" title="已离线缓存（秒开）">
            <CheckCircle size={12} color="#10b981" />
          </div>
        )}

        {isDir && (
          <div style={{ opacity: 0.5, marginLeft: 4 }}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </div>
      
      {isDir && isOpen && node.children && (
        <div className="tree-children-container">
          {node.children.map((child, idx) => (
            <TreeNodeItem 
              key={`${child.path}-${idx}`}
              node={child} 
              level={level + 1} 
              selectedFile={selectedFile}
              cachedPaths={cachedPaths}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ tree, selectedFile, cachedPaths, onSelectFile, width }) => {
  return (
    <aside 
      className="sidebar" 
      style={width ? { width: `${width}px`, minWidth: `${width}px` } : undefined}
    >
      <div className="sidebar-header">
        <BookOpen size={24} color="#60a5fa" />
        <h1>Study Materials</h1>
      </div>
      <div style={{ padding: '12px 0' }}>
        {tree.map((node, idx) => (
          <TreeNodeItem 
            key={`${node.path}-${idx}`}
            node={node} 
            level={0} 
            selectedFile={selectedFile}
            cachedPaths={cachedPaths}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </aside>
  );
};
