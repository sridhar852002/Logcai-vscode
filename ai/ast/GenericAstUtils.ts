/**
 * Fallback parser for plain-text or non-AST-supported languages.
 * Works on Python, Shell, plain text, unknown formats.
 */

export function parseGenericCode(
    code: string
  ): {
    functions: GenericFunctionInfo[];
    classes: Record<string, GenericClassInfo>;
  } {
    const lines = code.split('\n');
    const functions: GenericFunctionInfo[] = [];
    const classes: Record<string, GenericClassInfo> = {};
  
    const funcRegex = /^\s*(def|function)\s+([\w\d_]+)\s*\(/; // Python or JS-style
    const classRegex = /^\s*class\s+([\w\d_]+)/;
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
  
      const funcMatch = funcRegex.exec(line);
      if (funcMatch) {
        const name = funcMatch[2];
        const startLine = i + 1;
        const codeSnippet = extractBlock(lines, i);
        functions.push({
          type: 'func',
          name,
          startLine,
          endLine: startLine + codeSnippet.length - 1,
          code: codeSnippet.join('\n'),
        });
      }
  
      const classMatch = classRegex.exec(line);
      if (classMatch) {
        const name = classMatch[1];
        const startLine = i + 1;
        const codeSnippet = extractBlock(lines, i);
        classes[name] = {
          type: 'class',
          name,
          startLine,
          endLine: startLine + codeSnippet.length - 1,
          code: codeSnippet.join('\n'),
        };
      }
    }
  
    return { functions, classes };
  }
  
  /**
   * Naively extract an indented block following a function/class line.
   */
  function extractBlock(lines: string[], start: number): string[] {
    const block: string[] = [lines[start]];
    const indentMatch = /^(\s+)/.exec(lines[start + 1] || '');
    const indent = indentMatch ? indentMatch[1].length : 2;
  
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        block.push(line);
        continue;
      }
      const currentIndent = line.search(/\S/);
      if (currentIndent >= indent) {
        block.push(line);
      } else {
        break;
      }
    }
  
    return block;
  }
  
  // Types
  export interface GenericFunctionInfo {
    type: 'func';
    name: string;
    code: string;
    startLine: number;
    endLine: number;
  }
  
  export interface GenericClassInfo {
    type: 'class';
    name: string;
    code: string;
    startLine: number;
    endLine: number;
  }
  