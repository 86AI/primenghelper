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

/** Apply all matching rules to a single file's content. */
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

  // Collect all files matching include patterns, minus excludes
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

  // Deduplicate
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
