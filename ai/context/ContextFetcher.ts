//src/si/context/ContextFetcher.ts
import * as vscode from 'vscode';
import { SymbolNode } from './context.types';
import { initTreeSitter, extractFunctions } from './astUtils';

export async function fetchCodeContext(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<SymbolNode | null> {
  const language = document.languageId;
  const filePath = document.uri.fsPath;

  const wasmMap: Record<string, string> = {
    python: 'tree-sitter-python.wasm',
    javascript: 'tree-sitter-javascript.wasm',
    typescript: 'tree-sitter-typescript.wasm',
  };

  const wasmFile = wasmMap[language];
  if (!wasmFile) {
    return null;
  }

  const wasmPath = vscode.Uri.joinPath(
    vscode.extensions.getExtension('your.publisher.logcai')!.extensionUri,
    'resources',
    'parsers',
    wasmFile
  ).fsPath;

  const parser = await initTreeSitter(wasmPath);
  const source = document.getText();
  const tree = parser.parse(source);
  if (!tree) {
    return null;
  }

  const symbols = extractFunctions(source, tree, language, filePath);
  const line = position.line;

  for (const symbol of symbols) {
    if (line >= symbol.startLine && line <= symbol.endLine) {
      return symbol;
    }
  }

  return null;
}
