import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, BookOpen } from 'lucide-react';

export type TreeNode = {
  type: 'directory' | 'file';
  name: string;
  path: string;
  children?: TreeNode[];
};

interface SidebarProps {
  tree: TreeNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

const TreeNodeItem: React.FC<{
  node: TreeNode;
  level: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}> = ({ node, level, selectedFile, onSelectFile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isSelected = selectedFile === node.path;
  const isDir = node.type === 'directory';

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
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </span>
        {isDir && (
          <div style={{ opacity: 0.5 }}>
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
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ tree, selectedFile, onSelectFile }) => {
  return (
    <aside className="sidebar">
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
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </aside>
  );
};
