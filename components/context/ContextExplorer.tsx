// src/components/context/ContextExplorer.tsx
import React, { useState, useMemo } from 'react';
import { useTheme } from '../../styles/ThemeProvider';
import { ContextItem, ContextItemType } from '../../services/FileContextManager';
import path from 'path-browserify'; // Use path-browserify for path operations in browser

interface ContextExplorerProps {
  onClose?: () => void;
  onApply?: (selectedItems: string[]) => void;
  context: {
    items: ContextItem[];
    workspaceName?: string;
  } | null;
  isLoading: boolean;
  error: string | null;
  updateContext: (options: any) => void;
  selectedItems: Set<string>;
  toggleItem: (id: string) => void;
  selectAllItems: () => void;
  deselectAllItems: () => void;
  tokenBudget: {
    used: number;
    max: number;
    percentage: number;
  };
}

// Helper type for file tree structure
interface FileTreeNode {
  id: string;
  name: string;
  type: ContextItemType;
  path?: string;
  children: Record<string, FileTreeNode>;
  item: ContextItem;
}

const ContextExplorer: React.FC<ContextExplorerProps> = ({
  onClose,
  onApply,
  context,
  isLoading,
  error,
  updateContext,
  selectedItems,
  toggleItem,
  selectAllItems,
  deselectAllItems,
  tokenBudget
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [treeView, setTreeView] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState({
    includeActiveFile: true,
    includeSelection: true,
    includeOpenFiles: false,
    includeImports: true,
    includeDependencies: false,
    maxFiles: 5
  });

  // Build a file tree structure for hierarchical view
  const fileTree = useMemo(() => {
    if (!context?.items) return null;
    
    const root: Record<string, FileTreeNode> = {};
    
    // Sort items by path for consistent ordering
    const sortedItems = [...context.items].sort((a, b) => {
      return (a.path || a.name).localeCompare(b.path || b.name);
    });
    
    for (const item of sortedItems) {
      if (!item.path) {
        // Items without a path go directly at the root
        root[item.id] = {
          id: item.id,
          name: item.name,
          type: item.type,
          children: {},
          item
        };
        continue;
      }
      
      // Split the path into segments
      const pathParts = item.path.split(/[/\\]/);
      let currentLevel = root;
      let currentPath = '';
      
      // Build up the tree structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        currentPath = currentPath ? path.join(currentPath, part) : part;
        
        if (!currentLevel[currentPath]) {
          currentLevel[currentPath] = {
            id: currentPath,
            name: part,
            type: 'directory',
            path: currentPath,
            children: {},
            item: { 
              id: currentPath, 
              type: 'directory', 
              name: part,
              path: currentPath
            }
          };
        }
        currentLevel = currentLevel[currentPath].children;
      }
      
      // Add the actual file
      const fileName = pathParts[pathParts.length - 1];
      currentLevel[item.id] = {
        id: item.id,
        name: fileName,
        type: item.type,
        path: item.path,
        children: {},
        item
      };
    }
    
    return root;
  }, [context?.items]);

  const handleOptionChange = (optionName: string, value: boolean | number) => {
    setOptions(prev => ({
      ...prev,
      [optionName]: value
    }));
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleRefresh = () => {
    updateContext(options);
  };

  const handleApplyContext = () => {
    if (onApply && selectedItems.size > 0) {
      onApply(Array.from(selectedItems));
    }
  };

  // Toggle expanded state for a tree node
  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const toggleDirectory = (node: FileTreeNode) => {
    // If directory is already fully selected, deselect it
    const isFullySelected = isDirectoryFullySelected(node);
    
    // Get all descendant file IDs
    const fileIds = getAllFileIds(node);
    
    // Create a new Set based on the current selectedItems
    const newSelectedItems = new Set(selectedItems);
    
    // Update the Set based on current selection state
    fileIds.forEach(id => {
      if (isFullySelected) {
        newSelectedItems.delete(id);
      } else {
        newSelectedItems.add(id);
      }
    });
    
    // Call toggleItem for each file ID to update the parent's state
    fileIds.forEach(id => {
      // Only toggle if the current state differs from the desired state
      if (selectedItems.has(id) !== !isFullySelected) {
        toggleItem(id);
      }
    });
  };

  // Check if all files in a directory are selected
  const isDirectoryFullySelected = (node: FileTreeNode): boolean => {
    // If this is a file, check if it's selected
    if (node.type !== 'directory') {
      return selectedItems.has(node.id);
    }
    
    // If this is a directory, check all children
    return Object.values(node.children).every(child => isDirectoryFullySelected(child));
  };
  
  // Check if any files in a directory are selected
  const isDirectoryPartiallySelected = (node: FileTreeNode): boolean => {
    // If this is a file, check if it's selected
    if (node.type !== 'directory') {
      return selectedItems.has(node.id);
    }
    
    // If no children, return false
    if (Object.keys(node.children).length === 0) {
      return false;
    }
    
    // Check if some (but not all) children are selected
    const childrenStatus = Object.values(node.children).map(child => 
      isDirectoryFullySelected(child) || isDirectoryPartiallySelected(child)
    );
    
    return childrenStatus.some(Boolean) && !childrenStatus.every(Boolean);
  };

  // Get all file IDs from a directory tree
  const getAllFileIds = (node: FileTreeNode): string[] => {
    if (node.type !== 'directory') {
      return [node.id];
    }
    
    return Object.values(node.children).flatMap(child => getAllFileIds(child));
  };

  // Icon mapping for file types
  const getItemIcon = (type: ContextItemType, name: string): string => {
    if (type === 'directory') return '📁';
    // For files, use extension-based icons
    const ext = path.extname(name).toLowerCase();
    switch (ext) {
      case '.js':
      case '.jsx':
      case '.ts':
      case '.tsx':
        return '📄';
      case '.css':
      case '.scss':
      case '.less':
        return '🎨';
      case '.html':
      case '.xml':
        return '🌐';
      case '.json':
        return '📋';
      case '.md':
        return '📝';
      case '.py':
        return '🐍';
      default:
        return '📄';
    }
  };

  // Check if an item matches the search query
  const matchesSearch = (item: ContextItem): boolean => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (typeof item.name === 'string' && item.name.toLowerCase().includes(query)) ||
      (typeof item.path === 'string' && item.path.toLowerCase().includes(query))
    );
  };

  // Render a tree node (file or directory)
  const renderTreeNode = (node: FileTreeNode, depth: number = 0) => {
    // Don't render items that don't match search
    if (searchQuery && !matchesSearch(node.item)) {
      // But still check children for directories
      if (node.type === 'directory') {
        const childrenElements = Object.values(node.children)
          .map(child => renderTreeNode(child, depth + 1))
          .filter(Boolean);
        
        // Only render this directory if it has matching children
        if (childrenElements.length === 0) {
          return null;
        }
        
        // Auto-expand directories with matching children
        if (!expandedNodes.has(node.id)) {
          setExpandedNodes(prev => new Set([...prev, node.id]));
        }
        
        return (
          <div key={node.id}>
            {renderDirectoryNode(node, depth)}
            <div style={{ marginLeft: `${depth * 16 + 24}px` }}>
              {childrenElements}
            </div>
          </div>
        );
      }
      return null;
    }
    
    // Render directory node
    if (node.type === 'directory') {
      const isExpanded = expandedNodes.has(node.id);
      return (
        <div key={node.id}>
          {renderDirectoryNode(node, depth)}
          {isExpanded && (
            <div style={{ marginLeft: `${depth * 16 + 24}px` }}>
              {Object.values(node.children).map(child => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }
    
    // Render file node
    return renderFileNode(node, depth);
  };

  // Render a directory node
  const renderDirectoryNode = (node: FileTreeNode, depth: number) => {
    const isExpanded = expandedNodes.has(node.id);
    const isFullySelected = isDirectoryFullySelected(node);
    const isPartiallySelected = !isFullySelected && isDirectoryPartiallySelected(node);
    
    return (
      <div
        key={node.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          paddingLeft: `${8 + depth * 16}px`,
          backgroundColor: isFullySelected 
            ? `${theme.colors.primary}22` 
            : isPartiallySelected 
              ? `${theme.colors.primary}11`
              : 'transparent',
          borderRadius: '4px',
          marginBottom: '2px',
          cursor: 'pointer',
          borderLeft: isFullySelected 
            ? `2px solid ${theme.colors.primary}`
            : isPartiallySelected
              ? `2px solid ${theme.colors.primary}88`
              : '2px solid transparent',
        }}
      >
        <span
          onClick={() => toggleExpanded(node.id)}
          style={{
            marginRight: '4px',
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            display: 'inline-block',
            userSelect: 'none',
          }}
        >
          ▶
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
          onClick={() => toggleDirectory(node)}
        >
          <span style={{ marginRight: '8px' }}>{getItemIcon(node.type, node.name)}</span>
          <span style={{ fontWeight: isFullySelected || isPartiallySelected ? 'bold' : 'normal' }}>
            {node.name}
          </span>
        </div>
      </div>
    );
  };

  // Render a file node
  const renderFileNode = (node: FileTreeNode, depth: number) => {
    const isSelected = selectedItems.has(node.id);
    
    return (
      <div
        key={node.id}
        style={{
          padding: '6px 8px',
          paddingLeft: `${16 + depth * 16}px`,
          cursor: 'pointer',
          backgroundColor: isSelected ? `${theme.colors.primary}22` : 'transparent',
          borderRadius: '4px',
          marginBottom: '2px',
          display: 'flex',
          alignItems: 'center',
          borderLeft: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
        }}
        onClick={() => toggleItem(node.id)}
      >
        <span style={{ marginRight: '8px' }}>
          {getItemIcon(node.type, node.name)}
        </span>
        <div style={{ 
          flex: 1,
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          fontWeight: isSelected ? 'bold' : 'normal' 
        }}>
          {node.name}
        </div>
      </div>
    );
  };

  // Render a flat list item (alternative to tree view)
  const renderFlatItem = (item: ContextItem) => {
    if (!matchesSearch(item)) return null;
    const isSelected = selectedItems.has(item.id);
    
    return (
      <div
        key={item.id}
        style={{
          padding: '8px 10px',
          cursor: 'pointer',
          backgroundColor: isSelected ? `${theme.colors.primary}22` : 'transparent',
          borderRadius: '4px',
          marginBottom: '4px',
          display: 'flex',
          alignItems: 'center',
          borderLeft: isSelected ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
        }}
        onClick={() => toggleItem(item.id)}
      >
        <span style={{ marginRight: '12px' }}>
          {getItemIcon(item.type, item.name)}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontWeight: isSelected ? 'bold' : 'normal',
            marginBottom: '2px'
          }}>
            {item.name}
          </div>
          {item.path && (
            <div style={{ 
              color: theme.colors.textMuted, 
              fontSize: '12px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {item.path}
            </div>
          )}
        </div>
        <div style={{
          color: isSelected ? theme.colors.primary : theme.colors.textMuted,
          fontSize: '12px',
          padding: '2px 6px',
          backgroundColor: isSelected ? `${theme.colors.primary}11` : 'transparent',
          borderRadius: '4px',
        }}>
          {item.language || item.type}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: '400px',
      height: '100vh',
      backgroundColor: theme.colors.backgroundLight,
      borderLeft: `1px solid ${theme.colors.border}`,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '-4px 0 10px rgba(0, 0, 0, 0.2)'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.colors.backgroundDark,
      }}>
        <h3 style={{ 
          margin: 0, 
          color: theme.colors.primary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔍</span> Context Explorer
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.colors.textMuted,
            cursor: 'pointer',
            fontSize: '20px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
          aria-label="Close context explorer"
        >
          ×
        </button>
      </div>
      
      {/* Context Options */}
      <div style={{ 
        padding: '16px', 
        borderBottom: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundDark,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <h4 style={{ margin: '0', fontSize: '14px' }}>Context Options</h4>
          
          {/* View toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '4px',
            padding: '2px'
          }}>
            <button
              onClick={() => setTreeView(true)}
              style={{
                background: treeView ? theme.colors.primary : 'transparent',
                color: treeView ? '#000' : theme.colors.textSecondary,
                border: 'none',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Tree
            </button>
            <button
              onClick={() => setTreeView(false)}
              style={{
                background: !treeView ? theme.colors.primary : 'transparent',
                color: !treeView ? '#000' : theme.colors.textSecondary,
                border: 'none',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              List
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <input
              type="checkbox"
              checked={options.includeActiveFile}
              onChange={(e) => handleOptionChange('includeActiveFile', e.target.checked)}
            />
            Include active file
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <input
              type="checkbox"
              checked={options.includeSelection}
              onChange={(e) => handleOptionChange('includeSelection', e.target.checked)}
            />
            Use selection only
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <input
              type="checkbox"
              checked={options.includeOpenFiles}
              onChange={(e) => handleOptionChange('includeOpenFiles', e.target.checked)}
            />
            Include all open files
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <input
              type="checkbox"
              checked={options.includeImports}
              onChange={(e) => handleOptionChange('includeImports', e.target.checked)}
            />
            Include related files
          </label>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <input
              type="checkbox"
              checked={options.includeDependencies}
              onChange={(e) => handleOptionChange('includeDependencies', e.target.checked)}
            />
            Include dependencies
          </label>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '14px',
            color: theme.colors.textSecondary
          }}>
            <label>Max files:</label>
            <input
              type="number"
              min="1"
              max="20"
              value={options.maxFiles}
              onChange={(e) => handleOptionChange('maxFiles', parseInt(e.target.value, 10))}
              style={{
                width: '60px',
                padding: '4px 8px',
                backgroundColor: theme.colors.backgroundDark,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: '4px'
              }}
            />
          </div>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            marginTop: '12px',
            padding: '6px 12px',
            backgroundColor: theme.colors.primary,
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            width: '100%'
          }}
        >
          🔄 Update Context
        </button>
      </div>
      
      {/* Search */}
      <div style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${theme.colors.border}`,
      }}>
        <div style={{
          position: 'relative',
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search context..."
            style={{
              width: '100%',
              padding: '8px 8px 8px 32px',
              backgroundColor: theme.colors.backgroundDark,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              fontSize: '14px'
            }}
          />
          <span style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: theme.colors.textMuted,
            fontSize: '14px'
          }}>
            🔍
          </span>
        </div>
      </div>
      
      {/* Context Items */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
      }}>
        {isLoading ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textMuted
          }}>
            <div style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              borderTop: `2px solid ${theme.colors.primary}`,
              borderRight: `2px solid transparent`,
              animation: 'spin 1s linear infinite',
              marginBottom: '10px'
            }}></div>
            <p>Loading context...</p>
          </div>
        ) : error ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.error
          }}>
            <p style={{ marginBottom: '8px', fontSize: '16px' }}>⚠️</p>
            <p>{error}</p>
          </div>
        ) : !context?.items?.length ? (
          <div style={{
            padding: '20px',
            textAlign: 'center',
            color: theme.colors.textMuted
          }}>
            <p>No context available.</p>
            <p>Click "Update Context" to load context from your workspace.</p>
          </div>
        ) : (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              fontSize: '13px'
            }}>
              <div style={{ color: theme.colors.textSecondary }}>
                {selectedItems.size} of {context.items.length} items selected
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={selectAllItems}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.primary,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                    textDecoration: 'underline'
                  }}
                >
                  Select all
                </button>
                <button
                  onClick={deselectAllItems}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.colors.textMuted,
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '13px',
                    textDecoration: 'underline'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            
            {/* Tree or List view based on state */}
            {treeView ? (
              fileTree && (
                <div style={{ paddingTop: '8px' }}>
                  {Object.values(fileTree).map(node => renderTreeNode(node))}
                </div>
              )
            ) : (
              <div style={{ paddingTop: '8px' }}>
                {context.items.map(item => renderFlatItem(item))}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${theme.colors.border}`,
        backgroundColor: theme.colors.backgroundDark,
      }}>
        {/* Token budget indicator */}
        <div style={{
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: theme.colors.textSecondary
          }}>
            <span>Token budget:</span>
            <span className={tokenBudget.used > tokenBudget.max * 0.8 ? 'text-warning' : ''} style={{
              color: tokenBudget.used > tokenBudget.max * 0.8 ? theme.colors.error : theme.colors.textSecondary
            }}>
              {tokenBudget.used} / {tokenBudget.max} tokens ({Math.round(tokenBudget.percentage)}%)
            </span>
          </div>
          <div style={{
            height: '6px',
            backgroundColor: theme.colors.backgroundLight,
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${tokenBudget.percentage}%`,
              backgroundColor: tokenBudget.percentage > 80 ? theme.colors.error : theme.colors.primary,
              borderRadius: '3px'
            }} />
          </div>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: theme.colors.textSecondary,
              border: `1px solid ${theme.colors.border}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleApplyContext}
            disabled={!context || selectedItems.size === 0}
            style={{
              flex: 2,
              padding: '8px 16px',
              backgroundColor: context && selectedItems.size > 0 ? theme.colors.primary : theme.colors.backgroundLight,
              color: context && selectedItems.size > 0 ? '#000' : theme.colors.textMuted,
              border: 'none',
              borderRadius: '4px',
              cursor: context && selectedItems.size > 0 ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Apply Context
          </button>
        </div>
      </div>

      {/* Styles */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default ContextExplorer;