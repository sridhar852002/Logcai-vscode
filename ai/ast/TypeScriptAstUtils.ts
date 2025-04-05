import * as ts from 'typescript';

/**
 * Infers the appropriate ScriptKind from the file extension
 */
function inferScriptKind(fileName: string): ts.ScriptKind {
  if (fileName.endsWith('.ts')) {return ts.ScriptKind.TS;}
  if (fileName.endsWith('.tsx')) {return ts.ScriptKind.TSX;}
  if (fileName.endsWith('.js')) {return ts.ScriptKind.JS;}
  if (fileName.endsWith('.jsx')) {return ts.ScriptKind.JSX;}
  return ts.ScriptKind.Unknown;
}

/**
 * Parses .ts/.tsx/.js/.jsx files into a TypeScript AST
 */
export function parseTsCode(code: string, fileName = 'temp.tsx'): ts.SourceFile {
  return ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true,
    inferScriptKind(fileName)
  );
}

/**
 * Extracts class and function metadata from TypeScript/JavaScript AST
 */
export function extractFunctionsAndClasses(
  sourceFile: ts.SourceFile,
  code: string
): {
  functions: TsFunctionInfo[];
  classes: Record<string, TsClassInfo>;
} {
  const functions: TsFunctionInfo[] = [];
  const classes: Record<string, TsClassInfo> = {};

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      functions.push(extractFunction(node, sourceFile, code));
    }

    if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach(decl => {
        if (
          ts.isIdentifier(decl.name) &&
          decl.initializer &&
          (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
        ) {
          functions.push(extractArrowFunction(decl, sourceFile, code));
        }
      });
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const name = node.name.getText();
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      classes[name] = {
        type: 'class',
        name,
        code: code.slice(node.getStart(), node.getEnd()),
        startLine: start.line + 1,
        endLine: end.line + 1,
      };
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { functions, classes };
}

/**
 * Extracts standard function declaration
 */
function extractFunction(
  node: ts.FunctionDeclaration,
  sourceFile: ts.SourceFile,
  code: string
): TsFunctionInfo {
  const name = node.name!.getText();
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    type: 'func',
    name,
    code: code.slice(node.getStart(), node.getEnd()),
    startLine: start.line + 1,
    endLine: end.line + 1,
  };
}

/**
 * Extracts arrow function or function expression from variable declaration
 */
function extractArrowFunction(
  decl: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
  code: string
): TsFunctionInfo {
  const name = decl.name.getText();
  const start = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());

  return {
    type: 'func',
    name,
    code: code.slice(decl.getStart(), decl.getEnd()),
    startLine: start.line + 1,
    endLine: end.line + 1,
  };
}

// Types
export interface TsFunctionInfo {
  type: 'func';
  name: string;
  code: string;
  startLine: number;
  endLine: number;
}

export interface TsClassInfo {
  type: 'class';
  name: string;
  code: string;
  startLine: number;
  endLine: number;
}
