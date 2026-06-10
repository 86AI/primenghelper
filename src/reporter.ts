import chalk from 'chalk';
import * as path from 'path';
import { FileScanResult, Issue, MigrationReport, Severity } from './types';

// ---------------------------------------------------------------------------
// Build report structure
// ---------------------------------------------------------------------------

export function buildReport(results: FileScanResult[], scannedFiles: number, fixedFiles: number): MigrationReport {
  const allIssues = results.flatMap(r => r.issues);

  const issuesByCategory: Record<string, Issue[]> = {};
  const issuesByRule: Record<string, Issue[]> = {};

  for (const issue of allIssues) {
    (issuesByCategory[issue.category] ??= []).push(issue);
    (issuesByRule[issue.ruleId] ??= []).push(issue);
  }

  return {
    scannedFiles,
    totalIssues: allIssues.length,
    autoFixable: allIssues.filter(i => i.autoFixable).length,
    fixedFiles,
    issuesByFile: results,
    issuesByCategory,
    issuesByRule,
  };
}

// ---------------------------------------------------------------------------
// Console output
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<Severity, chalk.Chalk> = {
  error:   chalk.red,
  warning: chalk.yellow,
  info:    chalk.cyan,
};

const SEVERITY_ICON: Record<Severity, string> = {
  error:   '✖',
  warning: '⚠',
  info:    'ℹ',
};

function formatSeverity(s: Severity): string {
  return SEVERITY_COLOR[s](`${SEVERITY_ICON[s]} ${s.toUpperCase()}`);
}

function formatFilePath(filePath: string, cwd: string): string {
  return chalk.underline(path.relative(cwd, filePath));
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 3) + '...';
}

export function printReport(report: MigrationReport, cwd: string, verbose: boolean): void {
  const { issuesByFile, scannedFiles, totalIssues, autoFixable, fixedFiles } = report;

  if (issuesByFile.length === 0) {
    console.log(chalk.green('\n✔  No PrimeNG 16→20 migration issues found.\n'));
    return;
  }

  console.log();

  for (const fileResult of issuesByFile) {
    const rel = formatFilePath(fileResult.file, cwd);
    const fixedLabel = fileResult.fixed !== undefined ? chalk.green(' [FIXED]') : '';
    console.log(`${chalk.bold(rel)}${fixedLabel}`);

    for (const issue of fileResult.issues) {
      const loc    = chalk.dim(`${issue.line}:${issue.column}`);
      const sev    = formatSeverity(issue.severity);
      const ruleId = chalk.dim(`[${issue.ruleId}]`);
      console.log(`  ${loc}  ${sev}  ${issue.message}  ${ruleId}`);

      if (verbose) {
        console.log(chalk.dim(`         Before: ${truncate(issue.originalText.trim(), 80)}`));
        if (issue.fixedText) {
          console.log(chalk.green(`         After:  ${truncate(issue.fixedText.trim(), 80)}`));
        }
        if (issue.manualSteps) {
          console.log(chalk.yellow(`         Manual: ${issue.manualSteps}`));
        }
      }
    }
    console.log();
  }

  // Summary line
  const errorCount   = issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'error').length;
  const warningCount = issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'warning').length;
  const infoCount    = issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'info').length;

  console.log(chalk.bold('Summary'));
  console.log(`  Scanned files : ${scannedFiles}`);
  console.log(`  Total issues  : ${totalIssues}`);
  console.log(`    ${chalk.red(`${errorCount} errors`)}  ${chalk.yellow(`${warningCount} warnings`)}  ${chalk.cyan(`${infoCount} info`)}`);
  console.log(`  Auto-fixable  : ${autoFixable}`);

  if (fixedFiles > 0) {
    console.log(chalk.green(`  Fixed files   : ${fixedFiles}`));
  }

  console.log();

  if (totalIssues > 0) {
    const notFixed = totalIssues - autoFixable;
    if (autoFixable > 0) {
      console.log(chalk.cyan(`  Run with --fix to automatically apply ${autoFixable} fixable change(s).`));
    }
    if (notFixed > 0) {
      console.log(chalk.yellow(`  ${notFixed} issue(s) require manual review — see messages above.`));
    }
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Category summary (optional --summary flag)
// ---------------------------------------------------------------------------

export function printCategorySummary(report: MigrationReport): void {
  const { issuesByCategory } = report;
  console.log(chalk.bold('\nIssues by category:\n'));

  const entries = Object.entries(issuesByCategory).sort((a, b) => b[1].length - a[1].length);
  for (const [cat, issues] of entries) {
    const errors   = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos    = issues.filter(i => i.severity === 'info').length;
    console.log(
      `  ${chalk.bold(cat.padEnd(22))}  ` +
      `${chalk.red(`${errors}e`)}  ${chalk.yellow(`${warnings}w`)}  ${chalk.cyan(`${infos}i`)}`,
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

export function toJson(report: MigrationReport): string {
  return JSON.stringify(
    {
      ...report,
      issuesByFile: report.issuesByFile.map(r => ({
        file: r.file,
        fixed: r.fixed !== undefined,
        issues: r.issues,
      })),
    },
    null,
    2,
  );
}
