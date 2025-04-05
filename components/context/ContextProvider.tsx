// src/components/context/ContextProvider.tsx
import React, { createContext, useContext as useReactContext, useState, useEffect, ReactNode } from 'react';
import vscode from '../../utils/vscode';
import { Context, ContextItem, ContextOptions } from '../../services/FileContextManager';
import ContextExplorer from './ContextExplorer';

interface ContextProviderProps {
  children: ReactNode;
}

interface ContextContextType {
  context: Context | null;
  isLoading: boolean;
  error: string | null;
  updateContext: (options?: ContextOptions) => void;
  clearContext: () => void;
  selectedItems: Set<string>;
  toggleItem: (id: string) => void;
  selectAllItems: () => void;
  deselectAllItems: () => void;
  showExplorer: boolean;
  setShowExplorer: (show: boolean) => void;
  isContextActive: boolean;
  setIsContextActive: (active: boolean) => void;
  activeContextItems: string[];
  removeContextItem: (id: string) => void;
  tokenBudget: {
    used: number;
    max: number;
    percentage: number;
  };
  refreshContext: () => void;
}

const ContextContext = createContext<ContextContextType | undefined>(undefined);

// Maximum token budget for context
const MAX_TOKEN_BUDGET = 4000;

export function ContextProvider({ children }: ContextProviderProps) {
  const [context, setContext] = useState<Context | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showExplorer, setShowExplorer] = useState<boolean>(false);
  const [isContextActive, setIsContextActive] = useState<boolean>(false);
  const [activeContextItems, setActiveContextItems] = useState<string[]>([]);
  const [tokenBudget, setTokenBudget] = useState<{ used: number; max: number; percentage: number }>({
    used: 0,
    max: MAX_TOKEN_BUDGET,
    percentage: 0
  });

  // Calculate token usage whenever context or selected items change
  useEffect(() => {
    calculateTokenUsage();
  }, [context, selectedItems, activeContextItems]);

  // Calculate token usage based on content length
  const calculateTokenUsage = () => {
    if (!context) {
      setTokenBudget({ used: 0, max: MAX_TOKEN_BUDGET, percentage: 0 });
      return;
    }

    let tokenCount = 0;
    // Count tokens for explorer view (selectedItems)
    if (showExplorer) {
      for (const item of context.items) {
        if (selectedItems.has(item.id) && item.content) {
          // Approximate: 1 token ≈ 4 characters
          tokenCount += Math.ceil(item.content.length / 4);
        }
      }
    } 
    // Count tokens for active context (activeContextItems)
    else {
      for (const item of context.items) {
        if (activeContextItems.includes(item.id) && item.content) {
          tokenCount += Math.ceil(item.content.length / 4);
        }
      }
    }

    const percentage = (tokenCount / MAX_TOKEN_BUDGET) * 100;
    setTokenBudget({
      used: tokenCount,
      max: MAX_TOKEN_BUDGET,
      percentage: percentage > 100 ? 100 : percentage
    });
  };

  const updateContext = (options: ContextOptions = {}) => {
    setIsLoading(true);
    setError(null);
    vscode.postMessage({
      command: 'getContext',
      options
    });
  };

  const refreshContext = () => {
    if (context) {
      updateContext();
    }
  };

  const clearContext = () => {
    setContext(null);
    setSelectedItems(new Set());
    setActiveContextItems([]);
    setIsContextActive(false);
  };

  const toggleItem = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllItems = () => {
    if (!context) return;
    const allIds = new Set<string>();
    const addIds = (items: ContextItem[]) => {
      for (const item of items) {
        allIds.add(item.id);
        if (item.children) {
          addIds(item.children);
        }
      }
    };
    addIds(context.items);
    setSelectedItems(allIds);
  };

  const deselectAllItems = () => {
    setSelectedItems(new Set());
  };

  const handleApplyContext = (items: string[]) => {
    setActiveContextItems(items);
    setIsContextActive(true);
    setShowExplorer(false);
  };

  // Remove a specific item from active context
  const removeContextItem = (id: string) => {
    setActiveContextItems(prev => prev.filter(itemId => itemId !== id));
    if (activeContextItems.length <= 1) {
      setIsContextActive(false);
    }
  };

  // Listen for messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'contextResult') {
        setContext(message.context);
        setIsLoading(false);
        // Auto-select the active file if available
        if (message.context?.items?.length > 0) {
          const activeFile = message.context.items.find((item: ContextItem) =>
            item.type === 'file' && message.activeFilePath === item.path
          );
          if (activeFile) {
            setSelectedItems(new Set([activeFile.id]));
          }
        }
      } else if (message.command === 'contextError') {
        setError(message.error);
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Value object for the context provider
  const value = {
    context,
    isLoading,
    error,
    updateContext,
    clearContext,
    selectedItems,
    toggleItem,
    selectAllItems,
    deselectAllItems,
    showExplorer,
    setShowExplorer,
    isContextActive,
    setIsContextActive,
    activeContextItems,
    removeContextItem,
    tokenBudget,
    refreshContext
  };

  return (
    <ContextContext.Provider value={value}>
      {children}
      {showExplorer && (
        <ContextExplorer
          context={context}
          isLoading={isLoading}
          error={error}
          updateContext={updateContext}
          selectedItems={selectedItems}
          toggleItem={toggleItem}
          selectAllItems={selectAllItems}
          deselectAllItems={deselectAllItems}
          onClose={() => setShowExplorer(false)}
          onApply={handleApplyContext}
          tokenBudget={tokenBudget}
        />
      )}
    </ContextContext.Provider>
  );
}

export const useContext = (): ContextContextType => {
  const context = useReactContext(ContextContext);
  if (context === undefined) {
    throw new Error('useContext must be used within a ContextProvider');
  }
  return context;
};