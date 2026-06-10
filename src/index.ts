#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import chalk from 'chalk';
import { ALL_RULES } from './rules';
import { scanProject } from './scanner';
import { buildReport, printReport, printCategorySummary, toJson } from './reporter';

const pkg = require('../package.json') as { version: string; description: string };

const program = new Command();

program
  .name('primeng-migrate')
  .description(pkg.description)
  .version(pkg.version);

// ---------------------------------------------------------------------------
// `scan` command — find issues without modifying files
// ---------------------------------------------------------------------------

program
  .command('scan [projectRoot]', { isDefault: true })
  .description('Scan an Angular project for PrimeNG 16 → 20 migration issues')
  .option('-v, --verbose',       'Show before/after snippets and manual-step hints')
  .option('-s, --summary',       'Print a per-category issue summary')
  .option('-j, --json',          'Output results as JSON')
  .option('--include <globs...>', 'Additional glob patterns to include')
  .option('--exclude <globs...>', 'Glob patterns to exclude (merged with defaults)')
  .option('--only-fixable',      'Only report auto-fixable issues')
  .option('--rule <ruleIds...>', 'Run only specific rule IDs')
  .action(async (projectRoot: string | undefined, opts) => {
    const cwd = path.resolve(projectRoot ?? '.');
    console.log(chalk.bold(`\nScanning ${chalk.cyan(cwd)} for PrimeNG 16 → 20 issues...\n`));

    let rules = ALL_RULES;
    if (opts.rule?.length) {
      const ids = new Set<string>(opts.rule);
      rules = rules.filter(r => ids.has(r.id));
      if (rules.length === 0) {
        console.error(chalk.red(`No rules matched: ${opts.rule.join(', ')}`));
        process.exit(1);
      }
    }

    const results = await scanProject({
      projectRoot: cwd,
      rules,
      fix: false,
      include: opts.include,
      exclude: opts.exclude,
    });

    // Count how many files were scanned (including those with no issues)
    // We can't know that number without extra work, so we report files-with-issues
    const report = buildReport(results, results.length, 0);

    if (opts.json) {
      console.log(toJson(report));
      process.exit(report.totalIssues > 0 ? 1 : 0);
    }

    const filtered = opts.onlyFixable
      ? { ...report, issuesByFile: report.issuesByFile.map(f => ({ ...f, issues: f.issues.filter(i => i.autoFixable) })).filter(f => f.issues.length > 0) }
      : report;

    printReport(filtered, cwd, opts.verbose ?? false);

    if (opts.summary) {
      printCategorySummary(report);
    }

    process.exit(report.issuesByFile.some(f => f.issues.some(i => i.severity === 'error')) ? 1 : 0);
  });

// ---------------------------------------------------------------------------
// `fix` command — scan and apply all auto-fixable changes
// ---------------------------------------------------------------------------

program
  .command('fix [projectRoot]')
  .description('Scan and auto-fix PrimeNG 16 → 20 issues (modifies files in place)')
  .option('-v, --verbose',        'Show before/after snippets')
  .option('-d, --dry-run',        'Show what would be changed without writing files')
  .option('-s, --summary',        'Print a per-category issue summary')
  .option('-j, --json',           'Output results as JSON')
  .option('--include <globs...>', 'Additional glob patterns to include')
  .option('--exclude <globs...>', 'Glob patterns to exclude (merged with defaults)')
  .option('--rule <ruleIds...>',  'Fix only specific rule IDs')
  .action(async (projectRoot: string | undefined, opts) => {
    const cwd = path.resolve(projectRoot ?? '.');
    const mode = opts.dryRun ? '(DRY RUN — no files will be written)' : '';
    console.log(chalk.bold(`\nFixing ${chalk.cyan(cwd)} — PrimeNG 16 → 20 migration ${mode}\n`));

    if (!opts.dryRun) {
      console.log(chalk.yellow(
        '  ⚠  Files will be modified. Ensure your working tree is committed before continuing.\n',
      ));
    }

    let rules = ALL_RULES;
    if (opts.rule?.length) {
      const ids = new Set<string>(opts.rule);
      rules = rules.filter(r => ids.has(r.id));
    }

    const results = await scanProject({
      projectRoot: cwd,
      rules,
      fix: true,
      dryRun: opts.dryRun ?? false,
      include: opts.include,
      exclude: opts.exclude,
    });

    const fixedFiles = results.filter(r => r.fixed !== undefined).length;
    const report = buildReport(results, results.length, fixedFiles);

    if (opts.json) {
      console.log(toJson(report));
      process.exit(0);
    }

    printReport(report, cwd, opts.verbose ?? false);

    if (opts.summary) {
      printCategorySummary(report);
    }

    if (opts.dryRun && fixedFiles > 0) {
      console.log(chalk.cyan(`  Re-run without --dry-run to apply ${fixedFiles} file fix(es).\n`));
    }
  });

// ---------------------------------------------------------------------------
// `list-rules` command — show all rules
// ---------------------------------------------------------------------------

program
  .command('list-rules')
  .description('List all available migration rules')
  .option('--category <category>', 'Filter by category')
  .option('-j, --json',            'Output as JSON')
  .action((opts) => {
    let rules = ALL_RULES;
    if (opts.category) {
      rules = rules.filter(r => r.category === opts.category);
    }

    if (opts.json) {
      console.log(JSON.stringify(rules.map(r => ({
        id: r.id,
        description: r.description,
        category: r.category,
        severity: r.severity,
        fileTypes: r.fileTypes,
        autoFixable: !!r.fix,
        manualSteps: r.manualSteps,
      })), null, 2));
      return;
    }

    console.log(chalk.bold('\nPrimeNG 16 → 20 Migration Rules\n'));

    const categories = [...new Set(rules.map(r => r.category))].sort();
    for (const cat of categories) {
      const catRules = rules.filter(r => r.category === cat);
      console.log(chalk.bold(`  ${cat}`));
      for (const rule of catRules) {
        const fixable = rule.fix ? chalk.green('  [auto-fix]') : chalk.dim('  [manual]');
        const sev = rule.severity === 'error'
          ? chalk.red(rule.severity)
          : rule.severity === 'warning'
          ? chalk.yellow(rule.severity)
          : chalk.cyan(rule.severity);
        console.log(`    ${chalk.dim(rule.id.padEnd(50))}  ${sev.padEnd(20)}${fixable}`);
        console.log(`      ${chalk.dim(rule.description)}`);
      }
      console.log();
    }

    console.log(`  ${rules.length} rules total, ${rules.filter(r => r.fix).length} auto-fixable\n`);
  });

program.parse(process.argv);
