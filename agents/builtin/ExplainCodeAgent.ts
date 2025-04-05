// src/agents/builtin/ExplainCodeAgent.ts

import path from 'path';
import { parseTsCode, extractFunctionsAndClasses } from '@/ai/ast/TypeScriptAstUtils';
import { parsePhpCode } from '@/ai/ast/PhpAstUtils';
import { parseGenericCode } from '@/ai/ast/GenericAstUtils';
import { AgentHandler } from '@/agents/types';

export const ExplainCodeAgent: AgentHandler = {
  id: 'explain-code',
  name: 'Explain Code',
  description: 'Explains structure of a code snippet (functions, classes, etc.)',
  run: async ({ input }) => {
    const code = input?.code;
    const filename = input?.filename || 'input.ts';

    if (!code || typeof code !== 'string') {
      return { output: '❌ Missing or invalid code input.' };
    }

    const ext = path.extname(filename).toLowerCase();
    let functions: any[] = [];
    let classes: Record<string, any> = {};

    try {
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const ast = parseTsCode(code, filename);
        const parsed = extractFunctionsAndClasses(ast, code);
        functions = parsed.functions;
        classes = parsed.classes;
      } else if (ext === '.php') {
        const parsed = parsePhpCode(code);
        functions = parsed.functions;
        classes = parsed.classes;
      } else {
        const parsed = parseGenericCode(code);
        functions = parsed.functions;
        classes = parsed.classes;
      }
    } catch (err) {
      return { output: `❌ Error parsing code: ${(err as Error).message}` };
    }

    if (!functions.length && Object.keys(classes).length === 0) {
      return { output: '⚠️ No functions or classes found in this code.' };
    }

    const summary = [
      `🧠 **Code Summary for \`${filename}\`**`,
      '',
      `### 📦 Classes (${Object.keys(classes).length}):`,
      ...Object.values(classes).map(cls => `- \`${cls.name}\` [Lines ${cls.startLine}–${cls.endLine}]`),
      '',
      `### 🔧 Functions (${functions.length}):`,
      ...functions.map(fn => `- \`${fn.name}\` [Lines ${fn.startLine}–${fn.endLine}]`),
    ].join('\n');

    const fullContext = [...Object.values(classes), ...functions]
      .map(e => `### ${e.type === 'class' ? 'Class' : 'Function'}: ${e.name}\n\`\`\`\n${e.code}\n\`\`\``)
      .join('\n\n');

    return {
      output: `${summary}\n\n${fullContext}`,
    };
  },
};
