import TreeSitter from 'web-tree-sitter';
import { SymbolNode } from './context.types';

// We’ll keep a reference to the parser globally
let parser: any = null;

/**
 * Initializes Tree-sitter with a WASM language file.
 */
export async function initTreeSitter(wasmPath: string): Promise<any> {
  if (parser) {
    return parser;
  }

  await (TreeSitter as any).init(); // TreeSitter is a class, init is on the class, not the instance
  const Lang = await (TreeSitter as any).Language.load(wasmPath);
  parser = new (TreeSitter as any)();
  parser.setLanguage(Lang);
  return parser;
}

/**
 * Extracts top-level function or class blocks for context injection.
 */
export function extractFunctions(
  sourceCode: string,
  tree: any,
  language: string,
  filePath: string
): SymbolNode[] {
  const symbols: SymbolNode[] = [];

  function walk(node: any) {
    const isFunction = ['function_definition', 'function', 'method_definition'].includes(node.type);
    const isClass = ['class_definition', 'class'].includes(node.type);

    if (isFunction || isClass) {
      const nameNode = node.namedChildren.find((c: any) => c.type === 'identifier');
      const name = nameNode?.text ?? '<anonymous>';
      const content = sourceCode.substring(node.startIndex, node.endIndex);

      symbols.push({
        type: isFunction ? 'function' : 'class',
        name,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        content,
        language,
        filePath,
      });
    }

    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return symbols;
}
