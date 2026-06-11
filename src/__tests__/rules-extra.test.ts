import { ALL_RULES } from '../rules';
import { scanContent, fixContent, extractInlineTemplates, scanInlineTemplates, fixInlineTemplates } from '../scanner';

function issues(content: string, filePath: string) {
  return scanContent(content, filePath, ALL_RULES);
}

function fixed(content: string, filePath: string) {
  return fixContent(content, filePath, ALL_RULES);
}

function findIssue(content: string, filePath: string, ruleId: string) {
  return issues(content, filePath).find(i => i.ruleId === ruleId);
}

// ---------------------------------------------------------------------------
// LazyLoadEvent
// ---------------------------------------------------------------------------

describe('LazyLoadEvent renamed', () => {
  test('detects and fixes import from primeng/api', () => {
    const ts = `import { LazyLoadEvent } from 'primeng/api';`;
    const result = fixed(ts, 'comp.ts');
    expect(result).toContain(`import { TableLazyLoadEvent } from 'primeng/table'`);
    expect(result).not.toContain('primeng/api');
  });

  test('keeps other primeng/api imports when removing LazyLoadEvent', () => {
    const ts = `import { LazyLoadEvent, MessageService } from 'primeng/api';`;
    const result = fixed(ts, 'comp.ts');
    expect(result).toContain(`import { TableLazyLoadEvent } from 'primeng/table'`);
    expect(result).toContain('MessageService');
  });

  test('renames type usage in non-import lines', () => {
    const ts = [
      `import { TableLazyLoadEvent } from 'primeng/table';`,
      `onLazyLoad(event: LazyLoadEvent) {}`,
    ].join('\n');
    const result = fixed(ts, 'comp.ts');
    expect(result).toContain('TableLazyLoadEvent');
    expect(result).not.toMatch(/: LazyLoadEvent/);
  });
});

// ---------------------------------------------------------------------------
// Angular version check
// ---------------------------------------------------------------------------

describe('Angular version check', () => {
  test('flags Angular 17 in package.json', () => {
    const json = `{ "dependencies": { "@angular/core": "^17.0.0" } }`;
    const issue = findIssue(json, 'package.json', 'version/angular-peer-dep');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
  });

  test('passes Angular 18', () => {
    const json = `{ "dependencies": { "@angular/core": "^18.0.0" } }`;
    const issue = findIssue(json, 'package.json', 'version/angular-peer-dep');
    expect(issue).toBeUndefined();
  });

  test('fixes Angular 16 to ^18.0.0', () => {
    const json = `{ "dependencies": { "@angular/core": "^16.0.0" } }`;
    const result = fixed(json, 'package.json');
    expect(result).toContain('"@angular/core": "^18.0.0"');
  });
});

// ---------------------------------------------------------------------------
// pTemplate casing
// ---------------------------------------------------------------------------

describe('pTemplate casing', () => {
  test('flags and fixes pTemplate="selectedItem"', () => {
    const html = `<p-select pTemplate="selectedItem"></p-select>`;
    const issue = findIssue(html, 'test.html', 'prop/pTemplate-selectedItem');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');

    const result = fixed(html, 'test.html');
    expect(result).toContain('pTemplate="selecteditem"');
    expect(result).not.toContain('pTemplate="selectedItem"');
  });

  test('flags and fixes pTemplate="selectedItems" (multiselect)', () => {
    const html = `<p-multiselect pTemplate="selectedItems"></p-multiselect>`;
    const result = fixed(html, 'test.html');
    expect(result).toContain('pTemplate="selecteditems"');
  });
});

// ---------------------------------------------------------------------------
// z-index bindings removed
// ---------------------------------------------------------------------------

describe('baseZIndex / autoZIndex removed', () => {
  test('detects and removes [baseZIndex]', () => {
    const html = `<p-toast [baseZIndex]="10000"></p-toast>`;
    const issue = findIssue(html, 'test.html', 'prop/toast-zIndex-removed');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    const result = fixed(html, 'test.html');
    expect(result).not.toContain('baseZIndex');
  });

  test('detects and removes [autoZIndex]', () => {
    const html = `<p-dialog [autoZIndex]="true"></p-dialog>`;
    const result = fixed(html, 'test.html');
    expect(result).not.toContain('autoZIndex');
  });
});

// ---------------------------------------------------------------------------
// MessageService sticky → life: 0
// ---------------------------------------------------------------------------

describe('MessageService sticky', () => {
  test('flags sticky: true and fixes to life: 0', () => {
    const ts = `this.messageService.add({ severity: 'info', sticky: true });`;
    const issue = findIssue(ts, 'comp.ts', 'api/MessageService-sticky');
    expect(issue).toBeDefined();
    const result = fixed(ts, 'comp.ts');
    expect(result).toContain('life: 0');
    expect(result).not.toContain('sticky: true');
  });
});

// ---------------------------------------------------------------------------
// p-steps activeIndex removed
// ---------------------------------------------------------------------------

describe('p-steps activeIndex', () => {
  test('flags [activeIndex] binding', () => {
    const html = `<p-steps [model]="items" [(activeIndex)]="step"></p-steps>`;
    const issue = findIssue(html, 'test.html', 'structural/p-steps-activeIndex');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// FilterMatchMode
// ---------------------------------------------------------------------------

describe('FilterMatchMode', () => {
  test('flags FilterMatchMode enum usage', () => {
    const ts = `filterMatchMode: FilterMatchMode.STARTS_WITH`;
    const issue = findIssue(ts, 'comp.ts', 'api/FilterMatchMode-values-changed');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });
});

// ---------------------------------------------------------------------------
// Dialog position corner values
// ---------------------------------------------------------------------------

describe('dialog position corner values', () => {
  test('flags and fixes topleft', () => {
    const html = `<p-dialog position="topleft"></p-dialog>`;
    const issue = findIssue(html, 'test.html', 'api/dialog-position-values');
    expect(issue).toBeDefined();
    const result = fixed(html, 'test.html');
    expect(result).toContain('position="top-left"');
  });

  test('fixes all four corners', () => {
    const html = [
      `<p-dialog position="topleft"></p-dialog>`,
      `<p-dialog position="topright"></p-dialog>`,
      `<p-dialog position="bottomleft"></p-dialog>`,
      `<p-dialog position="bottomright"></p-dialog>`,
    ].join('\n');
    const result = fixed(html, 'test.html');
    expect(result).toContain('top-left');
    expect(result).toContain('top-right');
    expect(result).toContain('bottom-left');
    expect(result).toContain('bottom-right');
    expect(result).not.toMatch(/topleft|topright|bottomleft|bottomright/);
  });
});

// ---------------------------------------------------------------------------
// DynamicDialog
// ---------------------------------------------------------------------------

describe('DynamicDialog', () => {
  test('flags DynamicDialogRef import with info note', () => {
    const ts = `import { DynamicDialogRef, DialogService } from 'primeng/dynamicdialog';`;
    const issue = findIssue(ts, 'comp.ts', 'api/DynamicDialogConfig-data');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// p-inputtext size class
// ---------------------------------------------------------------------------

describe('inputText size class', () => {
  test('flags p-inputtext-sm class', () => {
    const html = `<input pInputText class="p-inputtext-sm" />`;
    const issue = findIssue(html, 'test.html', 'prop/pInputText-variant');
    expect(issue).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// PrimeIcons v7 renames
// ---------------------------------------------------------------------------

describe('PrimeIcons v7 renames', () => {
  test('flags and fixes pi-circle-on → pi-circle-fill', () => {
    const html = `<i class="pi pi-circle-on"></i>`;
    const issue = findIssue(html, 'test.html', 'theme/primeicons-v7-renames');
    expect(issue).toBeDefined();
    const result = fixed(html, 'test.html');
    expect(result).toContain('pi-circle-fill');
    expect(result).not.toContain('pi-circle-on');
  });
});

// ---------------------------------------------------------------------------
// Inline template scanning
// ---------------------------------------------------------------------------

describe('inline template extraction', () => {
  test('extracts backtick template', () => {
    const ts = `
@Component({
  template: \`
    <p-dropdown [(ngModel)]="val"></p-dropdown>
  \`
})
export class MyComponent {}
`;
    const templates = extractInlineTemplates(ts);
    expect(templates).toHaveLength(1);
    expect(templates[0].content).toContain('p-dropdown');
  });

  test('returns empty for no inline templates', () => {
    const ts = `export class MyComponent {}`;
    expect(extractInlineTemplates(ts)).toHaveLength(0);
  });

  test('detects PrimeNG issues inside inline templates', () => {
    const ts = `
@Component({
  template: \`
    <p-calendar [(ngModel)]="date"></p-calendar>
    <p-dropdown [(ngModel)]="val"></p-dropdown>
  \`
})
export class MyComponent {}
`;
    const foundIssues = scanInlineTemplates(ts, 'mycomp.ts', ALL_RULES);
    const ruleIds = foundIssues.map(i => i.ruleId);
    expect(ruleIds).toContain('selector/p-calendar-to-p-datepicker');
    expect(ruleIds).toContain('selector/p-dropdown-to-p-select');
  });

  test('issues from inline templates are tagged with [inline template]', () => {
    const ts = `
@Component({
  template: \`<p-sidebar [(visible)]="v"></p-sidebar>\`
})
export class C {}
`;
    const foundIssues = scanInlineTemplates(ts, 'comp.ts', ALL_RULES);
    expect(foundIssues.every(i => i.message.startsWith('[inline template]'))).toBe(true);
  });

  test('scanContent on a .ts file includes inline template issues', () => {
    const ts = `
@Component({
  template: \`<p-dropdown [(ngModel)]="val"></p-dropdown>\`
})
export class MyComponent {}
`;
    const allIssues = scanContent(ts, 'mycomp.ts', ALL_RULES);
    expect(allIssues.some(i => i.ruleId === 'selector/p-dropdown-to-p-select')).toBe(true);
  });

  test('fixContent on a .ts file fixes selectors inside inline templates', () => {
    const ts = `
@Component({
  template: \`<p-dropdown [(ngModel)]="val"></p-dropdown>\`
})
export class MyComponent {}
`;
    const result = fixContent(ts, 'mycomp.ts', ALL_RULES);
    expect(result).toContain('<p-select');
    expect(result).toContain('</p-select>');
    expect(result).not.toContain('p-dropdown');
  });

  test('fixContent fixes multiple components in one inline template', () => {
    const ts = `
@Component({
  template: \`
    <p-calendar [(ngModel)]="d"></p-calendar>
    <p-inputswitch [(ngModel)]="on"></p-inputswitch>
    <p-overlaypanel #op></p-overlaypanel>
    <p-sidebar [(visible)]="v"></p-sidebar>
  \`
})
class C {}
`;
    const result = fixContent(ts, 'c.ts', ALL_RULES);
    expect(result).toContain('p-datepicker');
    expect(result).toContain('p-toggleswitch');
    expect(result).toContain('p-popover');
    expect(result).toContain('p-drawer');
  });

  test('inline template line numbers map back to the .ts file', () => {
    const ts = `import { Component } from '@angular/core';\n\n@Component({\n  template: \`\n    <p-dropdown></p-dropdown>\n  \`\n})`;
    const foundIssues = scanContent(ts, 'c.ts', ALL_RULES);
    const dropdownIssue = foundIssues.find(i => i.ruleId === 'selector/p-dropdown-to-p-select');
    expect(dropdownIssue).toBeDefined();
    // The dropdown is on line 5 of the ts file
    expect(dropdownIssue!.line).toBe(5);
  });
});
