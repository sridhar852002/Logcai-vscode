import { SymbolNode } from './context.types';

const vectorDB: Record<string, SymbolNode[]> = {};

export function addToMemory(filePath: string, symbol: SymbolNode) {
  if (!vectorDB[filePath]) {
    vectorDB[filePath] = [];
  }
  vectorDB[filePath].push(symbol);
}

export function getContextMatches(filePath: string, query: string): SymbolNode[] {
  const symbols = vectorDB[filePath] ?? [];
  return symbols.filter(sym => sym.name.includes(query) || sym.content.includes(query));
}
