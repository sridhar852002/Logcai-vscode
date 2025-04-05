import * as PHPParser from 'php-parser';

const parser = new PHPParser.Engine({
  parser: {
    extractDoc: true,
    php7: true,
  },
  ast: {
    withPositions: true,
  },
});

/**
 * Parses PHP code and returns structured function and class metadata.
 */
export function parsePhpCode(code: string): {
  functions: PhpFunctionInfo[];
  classes: Record<string, PhpClassInfo>;
} {
    const functions: PhpFunctionInfo[] = [];
  const classes: Record<string, PhpClassInfo> = {};

  const tree = parser.parseCode(code, 'code.php');

  for (const node of tree.children) {
    if (node.kind === 'class') {
      const classInfo = extractClasses(node, code);
      classes[classInfo.name] = classInfo;
    } else if (node.kind === 'function') {
      functions.push(extractFunctions(node, code));
    } else if (
      node.kind === 'expressionstatement' &&
      (node as any)?.expression?.right?.kind === 'closure'
    ) {
      functions.push(extractAnonymousFunction(node as any, code));
    }
  }

  return { functions, classes };
}

function extractFunctions(node: any, code: string): PhpFunctionInfo {
  const name = node.name.name;
  const startLine = node.loc.start.line;
  const endLine = node.loc.end.line;
  const functionCode = code.substring(node.loc.start.offset, node.loc.end.offset);

  return {
    type: 'func',
    name,
    code: functionCode,
    startLine,
    endLine,
  };
}

function extractAnonymousFunction(node: any, code: string): PhpFunctionInfo {
  const name = node.expression.left.name;
  const startLine = node.loc.start.line;
  const endLine = node.loc.end.line;
  const functionCode = code.substring(node.loc.start.offset, node.loc.end.offset);

  return {
    type: 'func',
    name,
    code: functionCode,
    startLine,
    endLine,
  };
}

function extractClasses(node: any, code: string): PhpClassInfo {
  const name = node.name.name;
  const startLine = node.loc.start.line;
  const endLine = node.loc.end.line;
  const classCode = code.substring(node.loc.start.offset, node.loc.end.offset);

  return {
    type: 'class',
    name,
    code: classCode,
    startLine,
    endLine,
  };
}

// Types
export interface PhpFunctionInfo {
  type: 'func';
  name: string;
  code: string;
  startLine: number;
  endLine: number;
}

export interface PhpClassInfo {
  type: 'class';
  name: string;
  code: string;
  startLine: number;
  endLine: number;
}
