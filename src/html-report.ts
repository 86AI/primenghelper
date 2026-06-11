import { MigrationReport, Issue, Severity } from './types';
import * as path from 'path';

const SEV_COLOR: Record<Severity, string> = {
  error:   '#ef4444',
  warning: '#f59e0b',
  info:    '#3b82f6',
};

const SEV_BG: Record<Severity, string> = {
  error:   '#fef2f2',
  warning: '#fffbeb',
  info:    '#eff6ff',
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function severityBadge(s: Severity): string {
  return `<span style="background:${SEV_COLOR[s]};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase">${s}</span>`;
}

function issueRow(issue: Issue, cwd: string): string {
  const loc = `${issue.line}:${issue.column}`;
  const fixBadge = issue.autoFixable
    ? `<span style="background:#16a34a;color:#fff;padding:1px 6px;border-radius:4px;font-size:10px;margin-left:4px">auto-fix</span>`
    : '';
  const fixedLine = issue.fixedText
    ? `<div style="margin-top:4px;font-size:12px"><span style="color:#6b7280">Before:</span> <code style="background:#f1f5f9;padding:1px 4px;border-radius:3px">${esc(issue.originalText.trim().slice(0, 100))}</code><br>
       <span style="color:#16a34a">After:</span>  <code style="background:#f0fdf4;padding:1px 4px;border-radius:3px">${esc(issue.fixedText.trim().slice(0, 100))}</code></div>`
    : '';
  const manualLine = issue.manualSteps
    ? `<div style="margin-top:4px;font-size:12px;color:#78350f;background:#fef3c7;padding:6px 8px;border-radius:4px"><strong>Manual steps:</strong> ${esc(issue.manualSteps)}</div>`
    : '';

  return `
    <tr style="border-bottom:1px solid #e2e8f0">
      <td style="padding:8px 10px;font-size:12px;color:#6b7280;white-space:nowrap">${esc(loc)}</td>
      <td style="padding:8px 10px">${severityBadge(issue.severity)}</td>
      <td style="padding:8px 10px;font-size:13px">
        ${esc(issue.message)}${fixBadge}
        ${fixedLine}${manualLine}
      </td>
      <td style="padding:8px 10px;font-size:11px;color:#94a3b8;white-space:nowrap">${esc(issue.ruleId)}</td>
    </tr>`;
}

function fileSection(fileResult: { file: string; issues: Issue[]; fixed?: string }, cwd: string): string {
  const rel = path.relative(cwd, fileResult.file);
  const errors   = fileResult.issues.filter(i => i.severity === 'error').length;
  const warnings = fileResult.issues.filter(i => i.severity === 'warning').length;
  const infos    = fileResult.issues.filter(i => i.severity === 'info').length;
  const fixedLabel = fileResult.fixed !== undefined
    ? `<span style="background:#16a34a;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px">FIXED</span>`
    : '';

  const counts = [
    errors   ? `<span style="color:${SEV_COLOR.error}">${errors}e</span>` : '',
    warnings ? `<span style="color:${SEV_COLOR.warning}">${warnings}w</span>` : '',
    infos    ? `<span style="color:${SEV_COLOR.info}">${infos}i</span>` : '',
  ].filter(Boolean).join('  ');

  const rows = fileResult.issues.map(i => issueRow(i, cwd)).join('');

  return `
    <details open style="margin-bottom:16px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      <summary style="padding:10px 14px;background:#f8fafc;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <code style="font-size:13px;font-weight:600">${esc(rel)}</code>${fixedLabel}
        <span style="font-size:12px">${counts}</span>
      </summary>
      <table style="width:100%;border-collapse:collapse;font-family:monospace">
        <colgroup>
          <col style="width:70px">
          <col style="width:90px">
          <col>
          <col style="width:250px">
        </colgroup>
        ${rows}
      </table>
    </details>`;
}

function categoryChart(report: MigrationReport): string {
  const cats = Object.entries(report.issuesByCategory)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  if (cats.length === 0) return '';

  const max = cats[0][1].length;
  const rows = cats.map(([cat, issues]) => {
    const pct = Math.round((issues.length / max) * 100);
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    return `
      <tr>
        <td style="padding:4px 8px;font-size:12px;white-space:nowrap;width:180px">${esc(cat)}</td>
        <td style="padding:4px 8px;width:200px">
          <div style="background:#e2e8f0;border-radius:4px;height:14px;overflow:hidden">
            <div style="background:${errors > 0 ? SEV_COLOR.error : SEV_COLOR.warning};height:100%;width:${pct}%"></div>
          </div>
        </td>
        <td style="padding:4px 8px;font-size:12px">
          ${errors ? `<span style="color:${SEV_COLOR.error}">${errors}e</span>` : ''}
          ${warnings ? `<span style="color:${SEV_COLOR.warning}">${warnings}w</span>` : ''}
        </td>
      </tr>`;
  }).join('');

  return `
    <h3 style="font-size:14px;color:#374151;margin:0 0 8px">Issues by category</h3>
    <table style="border-collapse:collapse;margin-bottom:24px">${rows}</table>`;
}

export function generateHtmlReport(report: MigrationReport, cwd: string, generatedAt: Date = new Date()): string {
  const { scannedFiles, totalIssues, autoFixable, fixedFiles } = report;
  const errors   = report.issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'error').length;
  const warnings = report.issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'warning').length;
  const infos    = report.issuesByFile.flatMap(f => f.issues).filter(i => i.severity === 'info').length;

  const fileSections = report.issuesByFile.map(f => fileSection(f, cwd)).join('');
  const noIssues = totalIssues === 0
    ? `<div style="text-align:center;padding:40px;color:#16a34a;font-size:18px">✔ No PrimeNG 16→20 migration issues found.</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PrimeNG 16→20 Migration Report</title>
  <style>
    * { box-sizing: border-box }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f1f5f9; color: #1e293b }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px }
    h1 { font-size: 20px; margin: 0 0 4px }
    h2 { font-size: 16px; color: #374151; margin: 24px 0 12px }
    .header { background: #1e293b; color: #fff; padding: 20px 24px; border-radius: 10px; margin-bottom: 24px }
    .header p { margin: 4px 0 0; font-size: 13px; color: #94a3b8 }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px }
    .stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; flex: 1; min-width: 100px }
    .stat .num { font-size: 28px; font-weight: 700 }
    .stat .lbl { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em }
    details summary::-webkit-details-marker { display: none }
    details summary::before { content: '▶'; margin-right: 8px; font-size: 10px; transition: transform .15s }
    details[open] summary::before { transform: rotate(90deg) }
  </style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>PrimeNG 16 → 20 Migration Report</h1>
    <p>${esc(cwd)} &middot; ${generatedAt.toLocaleString()}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="num">${scannedFiles}</div>
      <div class="lbl">Files with issues</div>
    </div>
    <div class="stat">
      <div class="num" style="color:${SEV_COLOR.error}">${errors}</div>
      <div class="lbl">Errors</div>
    </div>
    <div class="stat">
      <div class="num" style="color:${SEV_COLOR.warning}">${warnings}</div>
      <div class="lbl">Warnings</div>
    </div>
    <div class="stat">
      <div class="num" style="color:${SEV_COLOR.info}">${infos}</div>
      <div class="lbl">Info</div>
    </div>
    <div class="stat">
      <div class="num" style="color:#16a34a">${autoFixable}</div>
      <div class="lbl">Auto-fixable</div>
    </div>
    ${fixedFiles > 0 ? `<div class="stat"><div class="num" style="color:#16a34a">${fixedFiles}</div><div class="lbl">Fixed</div></div>` : ''}
  </div>

  ${categoryChart(report)}
  ${noIssues}

  ${totalIssues > 0 ? `<h2>Issues by file</h2>${fileSections}` : ''}

  <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:32px">
    Generated by primeng-migration-helper &middot; PrimeNG 16 → 20
  </p>
</div>
</body>
</html>`;
}
