import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { Rule, Issue, FileScanResult, FileType } from './types';

const EXT_TO_TYPE: Record<string, FileType> = {
  '.html': 'html',
  '.ts':   'ts',
  '.scss': 'scss',
  '.css':  'css',
  '.json': 'json',
};

function extOf(filePath: string): FileType | null {
  return EXT_TO_TYPE[path.extname(filePath).toLowerCase()] ?? null;
}

function lineColumnOf(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

// ---------------------------------------------------------------------------
// Inline template extraction
// ---------------------------------------------------------------------------

interface InlineTemplate {
  /** Byte offset in the .ts file where the template content starts (after opening delimiter). */
  contentStart: number;
  content: string;
}

/**
 * Extract Angular inline template strings from TypeScript source.
 * Handles backtick template literals only (the common multi-line case).
 * Single-quoted / double-quoted templates are too ambiguous to parse without a full AST.
 */
function extractInlineTemplates(tsContent: string): InlineTemplate[] {
  const results: InlineTemplate[] = [];
  // Match:  template  :  `...content...`
  // Use a simple state machine approach instead of regex to handle nested backticks correctly
  const markerRe = /\btemplate\s*:\s*`/g;
  let m: RegExpExecArray | null;

  while ((m = markerRe.exec(tsContent)) !== null) {
    const contentStart = m.index + m[0].length;
    let i = contentStart;
    let escaped = false;
    while (i < tsContent.length) {
      const ch = tsContent[i];
      if (escaped) { escaped = false; i++; continue; }
      if (ch === '\\') { escaped = true; i++; continue; }
      if (ch === '`') break;
      i++;
    }
    results.push({ contentStart, content: tsContent.slice(contentStart, i) });
  }
  return results;
}

/**
 * Apply HTML rules to all inline templates found in a TypeScript file.
 * Returns issues with line/column mapped back to the outer .ts file.
 */
function scanInlineTemplates(tsContent: string, filePath: string, rules: Rule[]): Issue[] {
  const htmlRules = rules.filter(r => r.fileTypes.includes('html'));
  if (htmlRules.length === 0) return [];

  const issues: Issue[] = [];
  for (const tmpl of extractInlineTemplates(tsContent)) {
    for (const rule of htmlRules) {
      const matches = rule.check(tmpl.content, filePath + '#template');
      for (const match of matches) {
        // Map position back to the outer .ts file
        const absoluteIndex = tmpl.contentStart + match.index;
        const { line, column } = lineColumnOf(tsContent, absoluteIndex);
        issues.push({
          file: filePath,
          line,
          column,
          ruleId: rule.id,
          category: rule.category,
          severity: rule.severity,
          message: `[inline template] ${match.message}`,
          originalText: match.originalText,
          fixedText: match.fixedText,
          autoFixable: match.fixedText !== undefined && rule.fix !== undefined,
          manualSteps: rule.manualSteps,
        });
      }
    }
  }
  return issues;
}

/**
 * Apply HTML fix rules to all inline templates inside a TypeScript file.
 * Returns the modified TypeScript source.
 */
function fixInlineTemplates(tsContent: string, filePath: string, rules: Rule[]): string {
  const htmlRules = rules.filter(r => r.fileTypes.includes('html') && r.fix);
  if (htmlRules.length === 0) return tsContent;

  // We need to replace template contents from back to front to keep offsets valid
  const templates = extractInlineTemplates(tsContent).reverse();
  let result = tsContent;

  for (const tmpl of templates) {
    let fixedTmpl = tmpl.content;
    for (const rule of htmlRules) {
      fixedTmpl = rule.fix!(fixedTmpl);
    }
    if (fixedTmpl !== tmpl.content) {
      result =
        result.slice(0, tmpl.contentStart) +
        fixedTmpl +
        result.slice(tmpl.contentStart + tmpl.content.length);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Apply all matching rules to a single file's content (including inline templates in .ts). */
export function scanContent(content: string, filePath: string, rules: Rule[]): Issue[] {
  const fileType = extOf(filePath);
  if (!fileType) return [];

  const issues: Issue[] = [];

  for (const rule of rules) {
    if (!rule.fileTypes.includes(fileType)) continue;

    const matches = rule.check(content, filePath);
    for (const match of matches) {
      const { line, column } = lineColumnOf(content, match.index);
      issues.push({
        file: filePath,
        line,
        column,
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        message: match.message,
        originalText: match.originalText,
        fixedText: match.fixedText,
        autoFixable: match.fixedText !== undefined && rule.fix !== undefined,
        manualSteps: rule.manualSteps,
      });
    }
  }

  // For TypeScript files, also scan any inline HTML templates
  if (fileType === 'ts') {
    issues.push(...scanInlineTemplates(content, filePath, rules));
  }

  return issues;
}

/** Apply all fixing rules to content, returning transformed content. */
export function fixContent(content: string, filePath: string, rules: Rule[]): string {
  const fileType = extOf(filePath);
  if (!fileType) return content;

  let result = content;
  for (const rule of rules) {
    if (!rule.fileTypes.includes(fileType) || !rule.fix) continue;
    result = rule.fix(result);
  }

  // For TypeScript files, also fix inline HTML templates
  if (fileType === 'ts') {
    result = fixInlineTemplates(result, filePath, rules);
  }

  return result;
}

export interface ScanOptions {
  projectRoot: string;
  rules: Rule[];
  fix?: boolean;
  dryRun?: boolean;
  /** Glob patterns to include. Defaults to all supported file types. */
  include?: string[];
  /** Glob patterns to exclude. */
  exclude?: string[];
}

const DEFAULT_INCLUDE = [
  '**/*.html',
  '**/*.ts',
  '**/*.scss',
  '**/*.css',
  '**/angular.json',
  '**/package.json',
];

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.spec.ts',
  '**/*.d.ts',
];

export async function scanProject(options: ScanOptions): Promise<FileScanResult[]> {
  const { projectRoot, rules, fix = false, dryRun = false } = options;

  const includePatterns = options.include ?? DEFAULT_INCLUDE;
  const excludePatterns = options.exclude ?? DEFAULT_EXCLUDE;

  const fileSets = await Promise.all(
    includePatterns.map(pattern =>
      glob(pattern, {
        cwd: projectRoot,
        ignore: excludePatterns,
        absolute: true,
        nodir: true,
      }),
    ),
  );

  const files = [...new Set(fileSets.flat())].sort();

  const results: FileScanResult[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const issues = scanContent(content, filePath, rules);
    const result: FileScanResult = { file: filePath, issues };

    if (fix && issues.some(i => i.autoFixable)) {
      const fixed = fixContent(content, filePath, rules);
      if (fixed !== content) {
        result.fixed = fixed;
        if (!dryRun) {
          fs.writeFileSync(filePath, fixed, 'utf8');
        }
      }
    }

    if (issues.length > 0 || result.fixed) {
      results.push(result);
    }
  }

  return results;
}

// Export for testing
export { extractInlineTemplates, scanInlineTemplates, fixInlineTemplates };
