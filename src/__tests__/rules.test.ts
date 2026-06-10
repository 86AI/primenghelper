import { ALL_RULES } from '../rules';
import { scanContent, fixContent } from '../scanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function issuesFor(content: string, filePath: string) {
  return scanContent(content, filePath, ALL_RULES);
}

function fixedContent(content: string, filePath: string) {
  return fixContent(content, filePath, ALL_RULES);
}

function findIssue(issues: ReturnType<typeof issuesFor>, ruleId: string) {
  return issues.find(i => i.ruleId === ruleId);
}

// ---------------------------------------------------------------------------
// Component selector renames
// ---------------------------------------------------------------------------

describe('component selector renames', () => {
  test('detects p-dropdown and fixes to p-select', () => {
    const html = `<p-dropdown [(ngModel)]="val" [options]="opts"></p-dropdown>`;
    const issues = issuesFor(html, 'app.component.html');
    const openIssue = issues.find(i => i.ruleId === 'selector/p-dropdown-to-p-select' && i.originalText.startsWith('<p-dropdown'));
    const closeIssue = issues.find(i => i.ruleId === 'selector/p-dropdown-to-p-select' && i.originalText === '</p-dropdown>');

    expect(openIssue).toBeDefined();
    expect(closeIssue).toBeDefined();
    expect(openIssue!.severity).toBe('error');

    const fixed = fixedContent(html, 'app.component.html');
    expect(fixed).toContain('<p-select');
    expect(fixed).toContain('</p-select>');
    expect(fixed).not.toContain('p-dropdown');
  });

  test('detects p-calendar and fixes to p-datepicker', () => {
    const html = `<p-calendar [(ngModel)]="date"></p-calendar>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toBe('<p-datepicker [(ngModel)]="date"></p-datepicker>');
  });

  test('detects p-inputswitch and fixes to p-toggleswitch', () => {
    const html = `<p-inputswitch [(ngModel)]="checked"></p-inputswitch>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toBe('<p-toggleswitch [(ngModel)]="checked"></p-toggleswitch>');
  });

  test('detects p-overlaypanel and fixes to p-popover', () => {
    const html = `<p-overlaypanel #op>\n  <p>Content</p>\n</p-overlaypanel>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('<p-popover');
    expect(fixed).toContain('</p-popover>');
  });

  test('detects p-sidebar and fixes to p-drawer', () => {
    const html = `<p-sidebar [(visible)]="show"></p-sidebar>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toBe('<p-drawer [(visible)]="show"></p-drawer>');
  });

  test('detects p-tabview and fixes to p-tabs', () => {
    const html = `<p-tabview><p-tabpanel header="Tab 1">content</p-tabpanel></p-tabview>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('<p-tabs>');
    expect(fixed).toContain('</p-tabs>');
  });

  test('detects p-accordiontab and fixes to p-accordion-panel', () => {
    const html = `<p-accordion><p-accordiontab header="H">body</p-accordiontab></p-accordion>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('<p-accordion-panel');
  });

  test('handles self-closing style tags', () => {
    const html = `<p-dropdown />`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toBe('<p-select />');
  });

  test('does not rename unrelated elements', () => {
    const html = `<p-button label="Click"></p-button>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toBe(html);
  });
});

// ---------------------------------------------------------------------------
// Module import renames
// ---------------------------------------------------------------------------

describe('module import renames', () => {
  test('detects DropdownModule and fixes import', () => {
    const ts = `import { DropdownModule } from 'primeng/dropdown';`;
    const issues = issuesFor(ts, 'app.module.ts');
    const issue = findIssue(issues, 'import/DropdownModule');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');

    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(`import { SelectModule } from 'primeng/select';`);
  });

  test('detects CalendarModule and fixes import', () => {
    const ts = `import { CalendarModule } from 'primeng/calendar';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(`import { DatePickerModule } from 'primeng/datepicker';`);
  });

  test('detects InputSwitchModule and fixes import', () => {
    const ts = `import { InputSwitchModule } from 'primeng/inputswitch';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(`import { ToggleSwitchModule } from 'primeng/toggleswitch';`);
  });

  test('detects OverlayPanelModule and fixes import', () => {
    const ts = `import { OverlayPanelModule } from 'primeng/overlaypanel';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(`import { PopoverModule } from 'primeng/popover';`);
  });

  test('detects SidebarModule and fixes import', () => {
    const ts = `import { SidebarModule } from 'primeng/sidebar';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(`import { DrawerModule } from 'primeng/drawer';`);
  });

  test('handles multi-symbol imports', () => {
    const ts = `import { ButtonModule, DropdownModule, TableModule } from 'primeng/dropdown';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toContain('SelectModule');
    expect(fixed).not.toContain('DropdownModule');
  });

  test('standalone component Dropdown import', () => {
    const ts = `import { Dropdown } from 'primeng/dropdown';`;
    const fixed = fixedContent(ts, 'mycomp.ts');
    expect(fixed).toBe(`import { Select } from 'primeng/select';`);
  });

  test('does not modify ButtonModule (unchanged)', () => {
    const ts = `import { ButtonModule } from 'primeng/button';`;
    const fixed = fixedContent(ts, 'app.module.ts');
    expect(fixed).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// Property renames
// ---------------------------------------------------------------------------

describe('property renames', () => {
  test('flags styleClass', () => {
    const html = `<p-select [styleClass]="'custom-class'"></p-select>`;
    const issues = issuesFor(html, 'test.html');
    const issue = findIssue(issues, 'prop/styleClass-deprecated');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  test('removes showTransitionOptions', () => {
    const html = `<p-select [showTransitionOptions]="'150ms'" [(ngModel)]="val"></p-select>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).not.toContain('showTransitionOptions');
    expect(fixed).toContain('[(ngModel)]');
  });

  test('removes hideTransitionOptions', () => {
    const html = `<p-drawer [hideTransitionOptions]="'300ms ease-in'" [(visible)]="v"></p-drawer>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).not.toContain('hideTransitionOptions');
  });

  test('flags appendTo="body"', () => {
    const html = `<p-select appendTo="body"></p-select>`;
    const issues = issuesFor(html, 'test.html');
    const issue = findIssue(issues, 'prop/appendTo-body-default');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });

  test('fixes [rowTrackBy] to [trackBy]', () => {
    const html = `<p-table [rowTrackBy]="trackFn"></p-table>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('[trackBy]=');
    expect(fixed).not.toContain('[rowTrackBy]');
  });

  test('fixes [filter]="true" to filter', () => {
    const html = `<p-select [filter]="true"></p-select>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain(' filter');
    expect(fixed).not.toContain('[filter]="true"');
  });

  test('fixes inputStyleClass to inputClass', () => {
    const html = `<p-select [inputStyleClass]="'w-full'"></p-select>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('[inputClass]=');
    expect(fixed).not.toContain('inputStyleClass');
  });

  test('fixes panelStyleClass to panelClass', () => {
    const html = `<p-select [panelStyleClass]="'dropdown-panel'"></p-select>`;
    const fixed = fixedContent(html, 'test.html');
    expect(fixed).toContain('[panelClass]=');
    expect(fixed).not.toContain('panelStyleClass');
  });
});

// ---------------------------------------------------------------------------
// Theme / style rules
// ---------------------------------------------------------------------------

describe('theme rules', () => {
  test('flags legacy theme stylesheet in angular.json', () => {
    const json = JSON.stringify({
      projects: {
        app: {
          architect: {
            build: {
              options: {
                styles: [
                  'node_modules/primeng/resources/themes/lara-light-blue/theme.css',
                  'node_modules/primeng/resources/primeng.min.css',
                  'src/styles.scss',
                ],
              },
            },
          },
        },
      },
    }, null, 2);

    const issues = issuesFor(json, 'angular.json');
    const themeIssue = findIssue(issues, 'theme/legacy-stylesheet');
    expect(themeIssue).toBeDefined();
    expect(themeIssue!.severity).toBe('error');
  });

  test('flags primeng.min.css in angular.json', () => {
    const json = `{ "styles": ["node_modules/primeng/primeng.min.css"] }`;
    const issues = issuesFor(json, 'angular.json');
    const issue = findIssue(issues, 'theme/primeng-css-import');
    expect(issue).toBeDefined();
  });

  test('flags @import of primeng/resources in SCSS', () => {
    const scss = `@import 'primeng/resources/themes/lara-light-blue/theme.css';`;
    const issues = issuesFor(scss, 'styles.scss');
    const issue = findIssue(issues, 'theme/legacy-stylesheet');
    expect(issue).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Removed components
// ---------------------------------------------------------------------------

describe('removed / deprecated components', () => {
  test('flags p-datascroller', () => {
    const html = `<p-datascroller [value]="items"></p-datascroller>`;
    const issues = issuesFor(html, 'test.html');
    const issue = findIssue(issues, 'removed/p-datascroller');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
  });

  test('flags p-lightbox', () => {
    const html = `<p-lightbox [images]="imgs"></p-lightbox>`;
    const issues = issuesFor(html, 'test.html');
    expect(findIssue(issues, 'removed/p-lightbox')).toBeDefined();
  });

  test('flags p-chips', () => {
    const html = `<p-chips [(ngModel)]="tags"></p-chips>`;
    const issues = issuesFor(html, 'test.html');
    expect(findIssue(issues, 'api/p-chips-deprecated')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// API changes
// ---------------------------------------------------------------------------

describe('api changes', () => {
  test('flags PrimeNGConfig import', () => {
    const ts = `import { PrimeNGConfig } from 'primeng/api';`;
    const issues = issuesFor(ts, 'app.component.ts');
    expect(findIssue(issues, 'api/PrimeNGConfig-deprecated')).toBeDefined();
  });

  test('flags tabpanel with header input', () => {
    const html = `<p-tabpanel [header]="'Tab 1'">content</p-tabpanel>`;
    const issues = issuesFor(html, 'test.html');
    expect(findIssue(issues, 'structural/tabview-api-change')).toBeDefined();
  });

  test('flags p-accordiontab for structural change', () => {
    const html = `<p-accordiontab header="My Tab">body</p-accordiontab>`;
    const issues = issuesFor(html, 'test.html');
    expect(findIssue(issues, 'structural/accordiontab-api-change')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Multiple issues in one file
// ---------------------------------------------------------------------------

describe('real-world component', () => {
  const realWorldHtml = `
<div class="container">
  <p-dropdown
    [(ngModel)]="selected"
    [options]="options"
    [filter]="true"
    [showTransitionOptions]="'150ms'"
    [styleClass]="'w-full'"
    appendTo="body"
  ></p-dropdown>

  <p-calendar
    [(ngModel)]="date"
    [showTime]="true"
  ></p-calendar>

  <p-inputswitch [(ngModel)]="active"></p-inputswitch>

  <p-sidebar [(visible)]="sidebarVisible">
    <p-chips [(ngModel)]="tags"></p-chips>
  </p-sidebar>
</div>
`;

  test('detects all major issues', () => {
    const issues = issuesFor(realWorldHtml, 'app.component.html');
    const ruleIds = issues.map(i => i.ruleId);

    expect(ruleIds).toContain('selector/p-dropdown-to-p-select');
    expect(ruleIds).toContain('selector/p-calendar-to-p-datepicker');
    expect(ruleIds).toContain('selector/p-inputswitch-to-p-toggleswitch');
    expect(ruleIds).toContain('selector/p-sidebar-to-p-drawer');
    expect(ruleIds).toContain('prop/styleClass-deprecated');
    expect(ruleIds).toContain('prop/transition-options-removed');
    expect(ruleIds).toContain('prop/appendTo-body-default');
    expect(ruleIds).toContain('api/p-chips-deprecated');
  });

  test('fixes all auto-fixable issues', () => {
    const fixed = fixedContent(realWorldHtml, 'app.component.html');
    expect(fixed).toContain('<p-select');
    expect(fixed).toContain('<p-datepicker');
    expect(fixed).toContain('<p-toggleswitch');
    expect(fixed).toContain('<p-drawer');
    expect(fixed).not.toContain('showTransitionOptions');
    expect(fixed).toContain(' filter');
    expect(fixed).not.toContain('[filter]="true"');
  });
});

describe('real-world module file', () => {
  const realWorldTs = `
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputSwitchModule } from 'primeng/inputswitch';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { SidebarModule } from 'primeng/sidebar';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    DropdownModule,
    CalendarModule,
    InputSwitchModule,
    OverlayPanelModule,
    SidebarModule,
    ButtonModule,
    TableModule,
  ],
})
export class AppModule {}
`;

  test('detects all renamed module imports', () => {
    const issues = issuesFor(realWorldTs, 'app.module.ts');
    const ruleIds = issues.map(i => i.ruleId);

    expect(ruleIds).toContain('import/DropdownModule');
    expect(ruleIds).toContain('import/CalendarModule');
    expect(ruleIds).toContain('import/InputSwitchModule');
    expect(ruleIds).toContain('import/OverlayPanelModule');
    expect(ruleIds).toContain('import/SidebarModule');
  });

  test('fixes all renamed module imports', () => {
    const fixed = fixedContent(realWorldTs, 'app.module.ts');

    expect(fixed).toContain(`import { SelectModule } from 'primeng/select'`);
    expect(fixed).toContain(`import { DatePickerModule } from 'primeng/datepicker'`);
    expect(fixed).toContain(`import { ToggleSwitchModule } from 'primeng/toggleswitch'`);
    expect(fixed).toContain(`import { PopoverModule } from 'primeng/popover'`);
    expect(fixed).toContain(`import { DrawerModule } from 'primeng/drawer'`);

    // Unchanged imports should still be there
    expect(fixed).toContain(`import { ButtonModule } from 'primeng/button'`);
    expect(fixed).toContain(`import { TableModule } from 'primeng/table'`);
  });

  test('does not double-rename already-migrated code', () => {
    const alreadyMigrated = `import { SelectModule } from 'primeng/select';`;
    const fixed = fixedContent(alreadyMigrated, 'app.module.ts');
    expect(fixed).toBe(alreadyMigrated);
  });
});
