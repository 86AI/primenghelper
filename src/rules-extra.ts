import { Rule, RuleMatch } from './types';
import { fixContent, scanContent } from './scanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scan(content: string, pattern: RegExp, buildMatch: (m: RegExpExecArray) => RuleMatch | null): RuleMatch[] {
  const results: RuleMatch[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `g${pattern.flags}`);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const result = buildMatch(m);
    if (result !== null) results.push(result);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 1. LazyLoadEvent renamed to TableLazyLoadEvent
// ---------------------------------------------------------------------------

export const lazyLoadEventRule: Rule = {
  id: 'api/LazyLoadEvent-renamed',
  description: '`LazyLoadEvent` from `primeng/api` renamed to `TableLazyLoadEvent` from `primeng/table`',
  category: 'module-import',
  severity: 'error',
  fileTypes: ['ts'],
  check(content) {
    const importRe = /import\s*\{([^}]*)\bLazyLoadEvent\b([^}]*)\}\s*from\s*['"]primeng\/api['"]/g;
    const typeRe   = /(?<!['"\/\w])LazyLoadEvent(?!\w)/g;
    const matches: RuleMatch[] = [];

    // Flag the import line
    scan(content, importRe, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: (() => {
        const remaining = (m[1] + m[2]).replace(/\bLazyLoadEvent\b/, '').replace(/,\s*,/, ',').replace(/^\s*,|,\s*$/, '').trim();
        const lazyImport = `import { TableLazyLoadEvent } from 'primeng/table'`;
        if (remaining) {
          return `import {${remaining} } from 'primeng/api'\n${lazyImport}`;
        }
        return lazyImport;
      })(),
      message: '`LazyLoadEvent` was renamed to `TableLazyLoadEvent` in PrimeNG 17. Update the import to `primeng/table`.',
    })).forEach(r => matches.push(r));

    // Flag type usages outside the import (cannot auto-fix reliably without full AST)
    scan(content, typeRe, (m) => {
      // Skip if inside an import statement line
      const lineStart = content.lastIndexOf('\n', m.index) + 1;
      const lineEnd   = content.indexOf('\n', m.index);
      const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      if (line.trimStart().startsWith('import')) return null;
      return {
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        fixedText: 'TableLazyLoadEvent',
        message: '`LazyLoadEvent` was renamed to `TableLazyLoadEvent` in PrimeNG 17.',
      };
    }).forEach(r => matches.push(r));

    return matches;
  },
  fix(content) {
    // Fix import line
    let result = content.replace(
      /import\s*\{([^}]*)\bLazyLoadEvent\b([^}]*)\}\s*from\s*['"]primeng\/api['"]/g,
      (_match, before, after) => {
        const remaining = (before + after).replace(/\bLazyLoadEvent\b/, '').replace(/,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
        const lazyImport = `import { TableLazyLoadEvent } from 'primeng/table'`;
        return remaining ? `import {${remaining} } from 'primeng/api'\n${lazyImport}` : lazyImport;
      },
    );
    // Fix type usages
    result = result.replace(/(?<!['"\/\w])LazyLoadEvent(?!\w)/g, (m, offset) => {
      const lineStart = result.lastIndexOf('\n', offset) + 1;
      const lineEnd   = result.indexOf('\n', offset);
      const line = result.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
      return line.trimStart().startsWith('import') ? m : 'TableLazyLoadEvent';
    });
    return result;
  },
};

// ---------------------------------------------------------------------------
// 2. Angular peer dependency version
// ---------------------------------------------------------------------------

export const angularVersionRule: Rule = {
  id: 'version/angular-peer-dep',
  description: 'PrimeNG 20 requires Angular 18+',
  category: 'api-change',
  severity: 'error',
  fileTypes: ['json'],
  check(content, filePath) {
    if (!filePath.endsWith('package.json')) return [];
    const re = /"@angular\/core"\s*:\s*"([^"]+)"/g;
    return scan(content, re, (m) => {
      const ver = m[1];
      const major = parseInt(ver.replace(/[^0-9]/, ''), 10);
      if (!isNaN(major) && major < 18) {
        return {
          index: m.index,
          length: m[0].length,
          originalText: m[0],
          fixedText: `"@angular/core": "^18.0.0"`,
          message: `@angular/core is \`${ver}\`. PrimeNG 20 requires Angular 18+.`,
        };
      }
      return null;
    });
  },
  fix(content) {
    return content.replace(/"@angular\/core"\s*:\s*"([^"]+)"/g, (_m, ver) => {
      const major = parseInt(ver.replace(/[^0-9]/, ''), 10);
      return (!isNaN(major) && major < 18) ? '"@angular/core": "^18.0.0"' : _m;
    });
  },
};

// ---------------------------------------------------------------------------
// 3. pTemplate name casing (camelCase → lowercase in PrimeNG 17+)
// ---------------------------------------------------------------------------

const PTEMPLATE_RENAMES: Array<{ from: string; to: string; components: string }> = [
  { from: 'selectedItem',  to: 'selecteditem',  components: 'p-select (formerly p-dropdown)' },
  { from: 'selectedItems', to: 'selecteditems', components: 'p-multiselect' },
  { from: 'filtericon',    to: 'filtericon',    components: 'p-select, p-multiselect (verify name)' },
  { from: 'clearicon',     to: 'clearicon',     components: 'p-select, p-datepicker (verify name)' },
  { from: 'dropdownicon',  to: 'dropdownicon',  components: 'p-select (verify name)' },
  { from: 'inputicon',     to: 'inputicon',     components: 'p-datepicker (verify name)' },
];

export const pTemplateRenameRules: Rule[] = PTEMPLATE_RENAMES
  .filter(r => r.from !== r.to)
  .map(({ from, to, components }) => ({
    id: `prop/pTemplate-${from}`,
    description: `pTemplate="${from}" renamed to pTemplate="${to}" in PrimeNG 17+`,
    category: 'property-rename' as const,
    severity: 'error' as const,
    fileTypes: ['html', 'ts'] as Array<'html' | 'ts'>,
    check(content: string): RuleMatch[] {
      const re = new RegExp(`pTemplate\\s*=\\s*["']${from}["']`, 'g');
      return scan(content, re, (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        fixedText: m[0].replace(from, to),
        message: `pTemplate="${from}" should be "${to}" in PrimeNG 17+ (affects ${components}).`,
      }));
    },
    fix(content: string): string {
      return content.replace(new RegExp(`(pTemplate\\s*=\\s*["'])${from}(["'])`, 'g'), `$1${to}$2`);
    },
  }));

// ---------------------------------------------------------------------------
// 4. p-steps API restructure (PrimeNG v19)
// ---------------------------------------------------------------------------

export const pStepsActiveIndexRule: Rule = {
  id: 'structural/p-steps-activeIndex',
  description: '`[activeIndex]` / `(activeIndexChange)` removed from `p-steps` in PrimeNG 19',
  category: 'structural',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    // Matches [activeIndex], [(activeIndex)], and (activeIndexChange)
    const re = /\[?\(activeIndex\)\]?|\[activeIndex\]|\(activeIndexChange\)/g;
    // Only flag in a context near p-steps
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`[activeIndex]` was removed from `p-steps` in PrimeNG 19. ' +
        'Use `[(value)]` and route-based navigation. See https://primeng.org/steps.',
    }));
  },
  manualSteps:
    'Replace `<p-steps [model]="items" [(activeIndex)]="activeStep">` with ' +
    '`<p-steps [value]="activeStep" (valueChange)="onStepChange($event)">` ' +
    'and update the model items to include `routerLink` or handle `(valueChange)` manually.',
};

// ---------------------------------------------------------------------------
// 5. FilterMatchMode moved / value changes
// ---------------------------------------------------------------------------

export const filterMatchModeRule: Rule = {
  id: 'api/FilterMatchMode-values-changed',
  description: '`FilterMatchMode` enum values changed to string literals in PrimeNG 17+',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['ts', 'html'],
  check(content) {
    const re = /FilterMatchMode\.[A-Z_]+/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: `\`${m[0]}\`: The \`FilterMatchMode\` enum is still available in PrimeNG 20 ` +
        'but string literals (e.g., "startsWith") are now preferred and the column `filterMatchMode` ' +
        'input type is `string`. Verify your filter columns still work as expected.',
    }));
  },
  manualSteps:
    'Consider replacing FilterMatchMode.STARTS_WITH with the string "startsWith", etc. ' +
    'String literals are: "startsWith", "contains", "notContains", "endsWith", "equals", ' +
    '"notEquals", "in", "notIn", "lt", "lte", "gt", "gte", "between", "is", "isNot", "before", "after", "dateIs", "dateIsNot", "dateBefore", "dateAfter".',
};

// ---------------------------------------------------------------------------
// 6. DynamicDialog / DialogService
// ---------------------------------------------------------------------------

export const dynamicDialogRule: Rule = {
  id: 'api/DynamicDialogConfig-data',
  description: '`DynamicDialogConfig.data` type changed to `Record<string, unknown>` in PrimeNG 20',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['ts'],
  check(content) {
    const re = /import\s*\{[^}]*\b(DynamicDialogRef|DynamicDialogConfig|DialogService)\b[^}]*\}\s*from\s*['"]primeng\/dynamicdialog['"]/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: 'DynamicDialog API: `DynamicDialogConfig.data` type changed. ' +
        'If you access `config.data.myProp` you may need to cast: `(config.data as MyType).myProp`. ' +
        'Also, `DynamicDialogRef.onClose` is now `DynamicDialogRef.close$` (Observable).',
    }));
  },
  manualSteps:
    '1. `DynamicDialogConfig.data` is now typed as `Record<string, unknown>` — add explicit casts.\n' +
    '2. `DynamicDialogRef.onClose` → use `DynamicDialogRef.close$` (Observable<any>) instead.\n' +
    '3. Ensure DialogService is provided via `providePrimeNG()` or imported in `providers`.',
};

// ---------------------------------------------------------------------------
// 7. Tree / TreeNode leaf property
// ---------------------------------------------------------------------------

export const treeNodeLeafRule: Rule = {
  id: 'api/TreeNode-leaf-property',
  description: '`TreeNode.leaf` default behaviour changed in PrimeNG 17+',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['ts'],
  check(content) {
    // Flag TreeNode interface usages where leaf might be relevant
    const re = /\bleaf\s*:\s*(true|false)/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`TreeNode.leaf` changed default: nodes without `children` are now automatically ' +
        'treated as leaf nodes. Set `leaf: false` explicitly only to show an expand icon on nodes ' +
        'that load children lazily. Verify your tree data still behaves correctly.',
    }));
  },
};

// ---------------------------------------------------------------------------
// 8. p-dialog [position] changes
// ---------------------------------------------------------------------------

export const dialogPositionRule: Rule = {
  id: 'api/dialog-position-values',
  description: '`[position]` values on `p-dialog` changed in PrimeNG 17+',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    // Old values: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'
    // Still the same in v20 but behaviour in RTL / responsive changed
    const re = /\[?position\]?\s*=\s*["'](topleft|topright|bottomleft|bottomright)["']/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: `p-dialog position="${m[1]}": corner position values were renamed in PrimeNG 17. ` +
        'Use "top-left", "top-right", "bottom-left", "bottom-right" (hyphenated).',
      fixedText: m[0].replace('topleft', 'top-left').replace('topright', 'top-right')
        .replace('bottomleft', 'bottom-left').replace('bottomright', 'bottom-right'),
    }));
  },
  fix(content) {
    return content.replace(/\[?position\]?\s*=\s*["'](topleft|topright|bottomleft|bottomright)["']/g, (m) =>
      m.replace('topleft', 'top-left').replace('topright', 'top-right')
       .replace('bottomleft', 'bottom-left').replace('bottomright', 'bottom-right'),
    );
  },
};

// ---------------------------------------------------------------------------
// 9. MessageService sticky → life: 0
// ---------------------------------------------------------------------------

export const messageServiceStickyRule: Rule = {
  id: 'api/MessageService-sticky',
  description: '`MessageService.add({ sticky: true })` replaced by `life: 0` in PrimeNG 17+',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['ts'],
  check(content) {
    const re = /sticky\s*:\s*true/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: 'life: 0',
      message: '`sticky: true` in MessageService.add() was removed. Use `life: 0` to show a persistent toast.',
    }));
  },
  fix(content) {
    return content.replace(/\bsticky\s*:\s*true\b/g, 'life: 0');
  },
};

// ---------------------------------------------------------------------------
// 10. p-password feedback property renamed
// ---------------------------------------------------------------------------

export const passwordFeedbackRule: Rule = {
  id: 'prop/p-password-feedback',
  description: '`p-password` `[feedback]` input still works but `promptLabel`, `weakLabel`, etc. were renamed',
  category: 'property-rename',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\b(promptLabel|weakLabel|mediumLabel|strongLabel)\b/g;
    return scan(content, re, (m) => {
      const map: Record<string, string> = {
        promptLabel: 'placeholder',
        weakLabel:   'weakLabel (verify — may now be a theme token)',
        mediumLabel: 'mediumLabel (verify — may now be a theme token)',
        strongLabel: 'strongLabel (verify — may now be a theme token)',
      };
      return {
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        message: `p-password: \`${m[0]}\` → \`${map[m[1]]}\`. Verify this input still exists in PrimeNG 20.`,
      };
    });
  },
  manualSteps: 'Password strength labels in PrimeNG 20 are controlled via theme tokens. ' +
    'Check https://primeng.org/password for the current API.',
};

// ---------------------------------------------------------------------------
// 11. ConfirmationService accept / reject callback style change
// ---------------------------------------------------------------------------

export const confirmationServiceRule: Rule = {
  id: 'api/ConfirmationService-icon',
  description: '`ConfirmationService` `icon` field changed in PrimeNG 20',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['ts'],
  check(content) {
    // Flag any confirmationService.confirm({ ... }) calls
    const re = /\.confirm\s*\(\s*\{/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`ConfirmationService.confirm()`: In PrimeNG 20 the `icon` field accepts a PrimeIcon ' +
        'string or an object `{ value, class }`. Verify your confirmation dialogs render icons correctly.',
    }));
  },
};

// ---------------------------------------------------------------------------
// 12. PrimeIcons v6 → v7 class name changes
// ---------------------------------------------------------------------------

const ICON_RENAMES: Array<[string, string]> = [
  ['pi-circle-on',  'pi-circle-fill'],
  ['pi-circle-off', 'pi-circle'],
  ['pi-md-',        'pi-'],   // Partial — Material-prefixed icons removed
];

export const primeIconsRenameRule: Rule = {
  id: 'theme/primeicons-v7-renames',
  description: 'PrimeIcons v7 renamed some icon classes',
  category: 'theme',
  severity: 'warning',
  fileTypes: ['html', 'ts', 'scss', 'css'],
  check(content) {
    const matches: RuleMatch[] = [];
    for (const [from, to] of ICON_RENAMES.filter(([f, t]) => f !== t)) {
      scan(content, new RegExp(from.replace('-', '\\-'), 'g'), (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        fixedText: to,
        message: `PrimeIcons v7: \`${from}\` was renamed to \`${to}\`.`,
      })).forEach(r => matches.push(r));
    }
    return matches;
  },
  fix(content) {
    let result = content;
    for (const [from, to] of ICON_RENAMES.filter(([f, t]) => f !== t)) {
      result = result.replace(new RegExp(from.replace('-', '\\-'), 'g'), to);
    }
    return result;
  },
};

// ---------------------------------------------------------------------------
// 13. [disabled] on p-button → deprecated, use pButton directive or [disabled] on <button>
// ---------------------------------------------------------------------------

export const buttonDisabledRule: Rule = {
  id: 'prop/p-button-disabled-binding',
  description: '`[disabled]` on `p-button` is deprecated — use `[disabled]` on the inner `<button>` or the `disabled` attribute',
  category: 'property-rename',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    // Look for [disabled] binding specifically on p-button tags
    const re = /<p-button[^>]*\[disabled\][^>]*>/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`[disabled]` on `<p-button>` is still supported but consider using the `disabled` ' +
        'attribute directly or wrapping with a `<button pButton>` for standard HTML semantics.',
    }));
  },
};

// ---------------------------------------------------------------------------
// 14. inputText / textarea directive changes
// ---------------------------------------------------------------------------

export const inputTextDirectiveRule: Rule = {
  id: 'prop/pInputText-variant',
  description: '`pInputText` directive: `variant` input added in PrimeNG 17+ for filled style',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    // Flag the old pattern of styling with class="p-inputtext-sm" etc.
    const re = /class\s*=\s*["'][^"']*p-inputtext-(?:sm|lg)[^"']*["']/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`p-inputtext-sm` / `p-inputtext-lg` classes were removed in PrimeNG 17. ' +
        'Use the `size="small"` or `size="large"` input on the `pInputText` directive instead.',
    }));
  },
  manualSteps: 'Replace class="p-inputtext-sm" with size="small" on the input element using pInputText directive.',
};

// ---------------------------------------------------------------------------
// 15. p-toast [baseZIndex] and [autoZIndex] removed
// ---------------------------------------------------------------------------

export const toastZIndexRule: Rule = {
  id: 'prop/toast-zIndex-removed',
  description: '`[baseZIndex]` and `[autoZIndex]` removed from `p-toast` and overlay components in PrimeNG 17+',
  category: 'property-rename',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[?(baseZIndex|autoZIndex)\]?\s*=/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: `\`${m[0].trim()}\` was removed in PrimeNG 17. Z-index is now managed via CSS variables (--p-zindex-overlay).`,
    }));
  },
  fix(content) {
    return content.replace(/\s*\[?(baseZIndex|autoZIndex)\]?\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\}|\d+)/g, '');
  },
};
