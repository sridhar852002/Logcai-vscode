export interface SymbolNode {
    type: 'function' | 'class' | 'method';
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    language: string;
    filePath: string;
  }
  