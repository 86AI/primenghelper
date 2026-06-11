import { Rule, RuleMatch } from './types';

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

/** Build a simple global replace rule for `fix`. */
function globalReplace(from: RegExp, to: string | ((m: string, ...g: string[]) => string)): (content: string) => string {
  return (content) => content.replace(new RegExp(from.source, from.flags.includes('g') ? from.flags : `g${from.flags}`), to as string);
}

// ---------------------------------------------------------------------------
// 1. HTML COMPONENT SELECTOR RENAMES
// ---------------------------------------------------------------------------

interface SelectorRename {
  from: string;   // PrimeNG 16 selector
  to: string;     // PrimeNG 20 selector
  note?: string;
}

const SELECTOR_RENAMES: SelectorRename[] = [
  // Core renames (breaking changes)
  { from: 'p-dropdown',          to: 'p-select',            note: 'Renamed in v18. Also update DropdownModule → SelectModule.' },
  { from: 'p-calendar',          to: 'p-datepicker',        note: 'Renamed in v17. Also update CalendarModule → DatePickerModule.' },
  { from: 'p-inputswitch',       to: 'p-toggleswitch',      note: 'Renamed in v17. Also update InputSwitchModule → ToggleSwitchModule.' },
  { from: 'p-overlaypanel',      to: 'p-popover',           note: 'Renamed in v17. Also update OverlayPanelModule → PopoverModule.' },
  { from: 'p-sidebar',           to: 'p-drawer',            note: 'Renamed in v17. Also update SidebarModule → DrawerModule.' },
  { from: 'p-tabview',           to: 'p-tabs',              note: 'Renamed in v19. TabPanel API also changed — see structural rule.' },
  { from: 'p-accordiontab',      to: 'p-accordion-panel',   note: 'Renamed in v19. Must be a direct child of <p-accordion>.' },

  // Casing normalisation (were already lowercase in v16 but sometimes written wrong)
  { from: 'p-colorpicker',       to: 'p-colorpicker' },
  { from: 'p-treetable',         to: 'p-treetable' },
  { from: 'p-scrolltop',         to: 'p-scrolltop' },
  { from: 'p-scrollpanel',       to: 'p-scrollpanel' },
  { from: 'p-splitbutton',       to: 'p-splitbutton' },
  { from: 'p-progressbar',       to: 'p-progressbar' },
  { from: 'p-progressspinner',   to: 'p-progressspinner' },
  { from: 'p-radiobutton',       to: 'p-radiobutton' },
  { from: 'p-selectbutton',      to: 'p-selectbutton' },
  { from: 'p-togglebutton',      to: 'p-togglebutton' },
  { from: 'p-inputnumber',       to: 'p-inputnumber' },
  { from: 'p-inputmask',         to: 'p-inputmask' },
  { from: 'p-listbox',           to: 'p-listbox' },
  { from: 'p-multiselect',       to: 'p-multiselect' },
  { from: 'p-treeselect',        to: 'p-treeselect' },
  { from: 'p-cascadeselect',     to: 'p-cascadeselect' },
  { from: 'p-orderlist',         to: 'p-orderlist' },
  { from: 'p-picklist',          to: 'p-picklist' },
  { from: 'p-virtualscroller',   to: 'p-virtualscroller' },
  { from: 'p-organizationchart', to: 'p-organizationchart' },
  { from: 'p-blockui',           to: 'p-blockui' },
  { from: 'p-confirmdialog',     to: 'p-confirmdialog' },
  { from: 'p-confirmpopup',      to: 'p-confirmpopup' },
  { from: 'p-fileupload',        to: 'p-fileupload' },
  { from: 'p-avatargroup',       to: 'p-avatargroup' },
  { from: 'p-panelmenu',         to: 'p-panelmenu' },
  { from: 'p-tieredmenu',        to: 'p-tieredmenu' },
  { from: 'p-contextmenu',       to: 'p-contextmenu' },
  { from: 'p-breadcrumb',        to: 'p-breadcrumb' },
  { from: 'p-tabmenu',           to: 'p-tabmenu' },
  { from: 'p-megamenu',          to: 'p-megamenu' },
  { from: 'p-inputgroup',        to: 'p-inputgroup' },
  { from: 'p-inputgroupaddon',   to: 'p-inputgroupaddon' },
  { from: 'p-tristatecheckbox',  to: 'p-tristatecheckbox' },
  { from: 'p-dataview',          to: 'p-dataview' },
];

/** Only include renames where from !== to (real changes). */
const REAL_SELECTOR_RENAMES = SELECTOR_RENAMES.filter(r => r.from !== r.to);

function makeSelectorRule(rename: SelectorRename): Rule {
  const { from, to, note } = rename;

  // Matches <p-foo, </p-foo, and <p-foo/ (self-closing) — captures trailing char
  const openTagRe  = new RegExp(`<(${from})(\\s|>|/)`, 'gi');
  const closeTagRe = new RegExp(`</(${from})>`, 'gi');

  return {
    id: `selector/${from}-to-${to}`,
    description: `Rename <${from}> → <${to}>`,
    category: 'component-rename',
    severity: 'error',
    fileTypes: ['html', 'ts'],
    check(content) {
      const matches: RuleMatch[] = [];
      const check = (re: RegExp, buildFixed: (m: RegExpExecArray) => string) => {
        scan(content, re, (m) => ({
          index: m.index,
          length: m[0].length,
          originalText: m[0],
          fixedText: buildFixed(m),
          message: note
            ? `Replace <${from}> with <${to}>. ${note}`
            : `Replace <${from}> with <${to}>`,
        })).forEach(r => matches.push(r));
      };
      check(openTagRe,  m => `<${to}${m[2]}`);
      check(closeTagRe, _m => `</${to}>`);
      return matches;
    },
    fix(content) {
      return content
        .replace(new RegExp(`<(${from})(\\s|>|/)`, 'gi'), `<${to}$2`)
        .replace(new RegExp(`</(${from})>`, 'gi'), `</${to}>`);
    },
  };
}

// ---------------------------------------------------------------------------
// 2. TYPESCRIPT MODULE IMPORT RENAMES
// ---------------------------------------------------------------------------

interface ModuleRename {
  oldSymbol: string;
  newSymbol: string;
  oldPath: string;
  newPath: string;
  note?: string;
}

const MODULE_RENAMES: ModuleRename[] = [
  // Major renames
  {
    oldSymbol: 'DropdownModule', newSymbol: 'SelectModule',
    oldPath: 'primeng/dropdown', newPath: 'primeng/select',
    note: 'Dropdown was renamed to Select in PrimeNG 18.',
  },
  {
    oldSymbol: 'CalendarModule', newSymbol: 'DatePickerModule',
    oldPath: 'primeng/calendar', newPath: 'primeng/datepicker',
    note: 'Calendar was renamed to DatePicker in PrimeNG 17.',
  },
  {
    oldSymbol: 'InputSwitchModule', newSymbol: 'ToggleSwitchModule',
    oldPath: 'primeng/inputswitch', newPath: 'primeng/toggleswitch',
    note: 'InputSwitch was renamed to ToggleSwitch in PrimeNG 17.',
  },
  {
    oldSymbol: 'OverlayPanelModule', newSymbol: 'PopoverModule',
    oldPath: 'primeng/overlaypanel', newPath: 'primeng/popover',
    note: 'OverlayPanel was renamed to Popover in PrimeNG 17.',
  },
  {
    oldSymbol: 'SidebarModule', newSymbol: 'DrawerModule',
    oldPath: 'primeng/sidebar', newPath: 'primeng/drawer',
    note: 'Sidebar was renamed to Drawer in PrimeNG 17.',
  },
  {
    oldSymbol: 'TabViewModule', newSymbol: 'TabsModule',
    oldPath: 'primeng/tabview', newPath: 'primeng/tabs',
    note: 'TabView was renamed to Tabs in PrimeNG 19. TabPanel API also changed.',
  },
];

// Standalone component class renames (used in standalone component `imports`)
const STANDALONE_RENAMES: ModuleRename[] = [
  { oldSymbol: 'Dropdown',     newSymbol: 'Select',       oldPath: 'primeng/dropdown',   newPath: 'primeng/select' },
  { oldSymbol: 'Calendar',     newSymbol: 'DatePicker',   oldPath: 'primeng/calendar',   newPath: 'primeng/datepicker' },
  { oldSymbol: 'InputSwitch',  newSymbol: 'ToggleSwitch', oldPath: 'primeng/inputswitch', newPath: 'primeng/toggleswitch' },
  { oldSymbol: 'OverlayPanel', newSymbol: 'Popover',      oldPath: 'primeng/overlaypanel', newPath: 'primeng/popover' },
  { oldSymbol: 'Sidebar',      newSymbol: 'Drawer',       oldPath: 'primeng/sidebar',    newPath: 'primeng/drawer' },
  { oldSymbol: 'TabView',      newSymbol: 'Tabs',         oldPath: 'primeng/tabview',    newPath: 'primeng/tabs' },
];

// Combine all TS renames for unified detection
const ALL_TS_RENAMES = [...MODULE_RENAMES, ...STANDALONE_RENAMES];

function makeModuleImportRule(rename: ModuleRename): Rule {
  const { oldSymbol, newSymbol, oldPath, newPath, note } = rename;
  // Matches: import { ..., OldSymbol, ... } from 'primeng/old-path'
  // The symbol may appear anywhere inside the braces, with commas/spaces/newlines around it
  const importRe = new RegExp(
    `import\\s*\\{([^}]*)\\b(${oldSymbol})\\b([^}]*)\\}\\s*from\\s*['"]${oldPath.replace('/', '\\/')}['"]`,
    'g',
  );

  return {
    id: `import/${oldSymbol}`,
    description: `Rename ${oldSymbol} → ${newSymbol} (${oldPath} → ${newPath})`,
    category: MODULE_RENAMES.some(r => r.oldSymbol === oldSymbol) ? 'module-import' : 'standalone-import',
    severity: 'error',
    fileTypes: ['ts'],
    check(content) {
      return scan(content, importRe, (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        fixedText: m[0]
          .replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol)
          .replace(new RegExp(`['"]${oldPath.replace('/', '\\/')}['"]`), `'${newPath}'`),
        message: note
          ? `Replace ${oldSymbol} with ${newSymbol} and update import path to '${newPath}'. ${note}`
          : `Replace ${oldSymbol} with ${newSymbol} (path: '${newPath}').`,
      }));
    },
    fix(content) {
      return content.replace(importRe, (match) =>
        match
          .replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol)
          .replace(new RegExp(`['"]${oldPath.replace('/', '\\/')}['"]`), `'${newPath}'`),
      );
    },
  };
}

// ---------------------------------------------------------------------------
// 3. TYPE / CLASS RENAMES in TS (ViewChild, property types, etc.)
// ---------------------------------------------------------------------------

interface TypeRename {
  oldType: string;
  newType: string;
  oldPath: string;
  newPath: string;
}

const TYPE_RENAMES: TypeRename[] = [
  { oldType: 'Dropdown',     newType: 'Select',       oldPath: 'primeng/dropdown',    newPath: 'primeng/select' },
  { oldType: 'Calendar',     newType: 'DatePicker',   oldPath: 'primeng/calendar',    newPath: 'primeng/datepicker' },
  { oldType: 'InputSwitch',  newType: 'ToggleSwitch', oldPath: 'primeng/inputswitch', newPath: 'primeng/toggleswitch' },
  { oldType: 'OverlayPanel', newType: 'Popover',      oldPath: 'primeng/overlaypanel', newPath: 'primeng/popover' },
  { oldType: 'Sidebar',      newType: 'Drawer',       oldPath: 'primeng/sidebar',     newPath: 'primeng/drawer' },
  { oldType: 'TabView',      newType: 'Tabs',         oldPath: 'primeng/tabview',     newPath: 'primeng/tabs' },
];

function makeTypeRenameRule(rename: TypeRename): Rule {
  const { oldType, newType } = rename;
  // Match type usage that is NOT inside an import statement (to avoid double-fixing)
  // Look for: : OldType, <OldType>, OldType[ (array), new OldType(, as OldType
  const typeRe = new RegExp(
    `(?<!import[^;]{0,200})(?::\\s*|<|new\\s+|\\bas\\s+)(${oldType})(?=[\\s,;>()\\[\\]])`,
    'g',
  );

  return {
    id: `type/${oldType}-to-${newType}`,
    description: `Rename type ${oldType} → ${newType}`,
    category: 'type-rename',
    severity: 'warning',
    fileTypes: ['ts'],
    check(content) {
      return scan(content, typeRe, (m) => ({
        index: m.index + m[0].indexOf(m[1]),
        length: oldType.length,
        originalText: m[1],
        fixedText: newType,
        message: `Type reference ${oldType} should be renamed to ${newType}.`,
      }));
    },
    // Type rename without import line — handled separately via import rule + manual review
  };
}

// ---------------------------------------------------------------------------
// 4. PROPERTY / API RENAMES IN TEMPLATES
// ---------------------------------------------------------------------------

/** styleClass → class migration (used in many PrimeNG components) */
const styleClassRule: Rule = {
  id: 'prop/styleClass-deprecated',
  description: '`styleClass` input is deprecated — use `class` instead',
  category: 'property-rename',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    // Match [styleClass]="..." or styleClass="..."
    const re = /\[?styleClass\]?\s*=\s*["'][^"']*["']/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`styleClass` is deprecated in PrimeNG 20. Use the standard `class` attribute instead.',
    }));
  },
  manualSteps: 'Replace [styleClass]="expr" with [class]="expr" (or class="literal"). ' +
    'Check whether the component still applies the class correctly.',
};

/** showTransitionOptions / hideTransitionOptions removed in many overlay components */
const transitionOptionsRule: Rule = {
  id: 'prop/transition-options-removed',
  description: '`showTransitionOptions` and `hideTransitionOptions` are removed in PrimeNG 20',
  category: 'property-rename',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[?(show|hide)TransitionOptions\]?\s*=/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: `\`${m[0].trim()}\` was removed in PrimeNG 17+. Remove this binding entirely.`,
    }));
  },
  fix(content) {
    // Remove the full attribute from the tag; handles both [show/hideTransitionOptions]="..." and unbound
    return content.replace(/\s*\[?(show|hide)TransitionOptions\]?\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, '');
  },
  manualSteps: 'Remove showTransitionOptions and hideTransitionOptions bindings. ' +
    'Transition timing is now controlled via CSS / theme variables.',
};

/** appendTo="body" still works but body is now the default; flag it as info */
const appendToBodyRule: Rule = {
  id: 'prop/appendTo-body-default',
  description: '`appendTo="body"` is now the default behaviour in PrimeNG 20',
  category: 'property-rename',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /appendTo\s*=\s*["']body["']/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`appendTo="body"` is the default in PrimeNG 20. You may safely remove it.',
    }));
  },
};

/** p-tabView / p-tabPanel structural changes */
const tabViewStructureRule: Rule = {
  id: 'structural/tabview-api-change',
  description: '`p-tabview` / `p-tabpanel` API changed in PrimeNG 19 — now uses `p-tabs` / `p-tabpanel` with new inputs',
  category: 'structural',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<p-tabpanel\s[^>]*\[?header\]?\s*=/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: 'p-tabpanel `header` input was removed in PrimeNG 19. ' +
        'Use the new `value` input and a `ng-template #header` or `<p-tab>` for the header.',
    }));
  },
  manualSteps:
    'PrimeNG 19 replaced `<p-tabview>` / `<p-tabpanel header="...">` with ' +
    '`<p-tabs>` / `<p-tabpanels>` / `<p-tabpanel value="...">`. ' +
    'See https://primeng.org/tabs for the new API.',
};

/** AccordionTab structural changes */
const accordionTabStructureRule: Rule = {
  id: 'structural/accordiontab-api-change',
  description: '`p-accordionTab` replaced by `p-accordion-panel` in PrimeNG 19',
  category: 'structural',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<p-accordiontab\b/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`p-accordionTab` was replaced by `p-accordion-panel` in PrimeNG 19. ' +
        'The `header` attribute moved to a `<ng-template #accordionheader>` or a `<p-accordion-header>` child.',
    }));
  },
  manualSteps:
    'Replace <p-accordiontab header="..."> with <p-accordion-panel value="...">' +
    ' and move the header into <ng-template #accordionheader>. ' +
    'See https://primeng.org/accordion for the new API.',
};

// ---------------------------------------------------------------------------
// 5. PRIMENGCONFIG / PROVIDER API CHANGES
// ---------------------------------------------------------------------------

const primeNGConfigRule: Rule = {
  id: 'api/PrimeNGConfig-deprecated',
  description: 'Direct injection of `PrimeNGConfig` replaced by `providePrimeNG()` in PrimeNG 17+',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['ts'],
  check(content) {
    const re = /import\s*\{[^}]*\bPrimeNGConfig\b[^}]*\}\s*from\s*['"]primeng\/api['"]/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`PrimeNGConfig` from `primeng/api` is deprecated. ' +
        'Configure PrimeNG via `providePrimeNG()` from `primeng/config` in your `app.config.ts`.',
    }));
  },
  manualSteps:
    'In app.config.ts, add `providePrimeNG({ theme: { preset: Aura } })` to the providers array. ' +
    'Remove direct PrimeNGConfig injection from your components. ' +
    'See https://primeng.org/configuration for details.',
};

/** BrowserAnimationsModule → provideAnimationsAsync */
const browserAnimationsRule: Rule = {
  id: 'api/BrowserAnimationsModule-to-provideAnimationsAsync',
  description: 'PrimeNG 20 works best with `provideAnimationsAsync()` rather than `BrowserAnimationsModule`',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['ts'],
  check(content) {
    const re = /import\s*\{[^}]*\bBrowserAnimationsModule\b[^}]*\}\s*from\s*['"]@angular\/platform-browser\/animations['"]/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: 'Consider replacing `BrowserAnimationsModule` with `provideAnimationsAsync()` ' +
        'from `@angular/platform-browser/animations/async` for better initial load performance.',
    }));
  },
  manualSteps:
    '1. In app.config.ts add `provideAnimationsAsync()` to providers.\n' +
    '2. Remove BrowserAnimationsModule from AppModule imports.',
};

// ---------------------------------------------------------------------------
// 6. THEME / STYLE CHANGES
// ---------------------------------------------------------------------------

const legacyThemeStylesheetRule: Rule = {
  id: 'theme/legacy-stylesheet',
  description: 'Legacy PrimeNG CSS files no longer exist in PrimeNG 17+',
  category: 'theme',
  severity: 'error',
  fileTypes: ['json', 'scss', 'css'],
  check(content, filePath) {
    const matches: RuleMatch[] = [];

    // angular.json / package.json styles arrays
    if (filePath.endsWith('.json')) {
      const re = /"(node_modules\/primeng\/resources\/[^"]+)"/g;
      scan(content, re, (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        message: `Legacy stylesheet \`${m[1]}\` no longer exists in PrimeNG 17+. ` +
          'Remove this entry and configure theming via providePrimeNG().',
      })).forEach(r => matches.push(r));
    }

    // SCSS / CSS @import of old primeng resources
    if (filePath.endsWith('.scss') || filePath.endsWith('.css')) {
      const re = /@import\s+['"](?:~)?primeng\/resources\/[^'"]+['"]/g;
      scan(content, re, (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        message: `@import of \`primeng/resources\` no longer exists in PrimeNG 17+. ` +
          'Remove this import and configure theming via providePrimeNG().',
      })).forEach(r => matches.push(r));
    }

    return matches;
  },
  manualSteps:
    '1. Remove all primeng/resources stylesheet entries from angular.json.\n' +
    '2. Install a theme preset: `npm install @primeng/themes`.\n' +
    '3. Configure theme in app.config.ts:\n' +
    '   import { providePrimeNG } from \'primeng/config\';\n' +
    '   import Aura from \'@primeng/themes/aura\';\n' +
    '   providers: [providePrimeNG({ theme: { preset: Aura } })]',
};

const primengCssImportRule: Rule = {
  id: 'theme/primeng-css-import',
  description: '`primeng/primeng.min.css` / `primeng/primeng.css` no longer needed in PrimeNG 17+',
  category: 'theme',
  severity: 'error',
  fileTypes: ['json', 'scss', 'css'],
  check(content, filePath) {
    const matches: RuleMatch[] = [];
    const patterns = [
      /"node_modules\/primeng\/primeng(?:\.min)?\.css"/g,
      /@import\s+['"](?:~)?primeng\/primeng(?:\.min)?\.css['"]/g,
    ];
    for (const re of patterns) {
      scan(content, re, (m) => ({
        index: m.index,
        length: m[0].length,
        originalText: m[0],
        message: 'primeng.min.css is no longer needed. PrimeNG 17+ uses a CSS-variable-based theme system.',
      })).forEach(r => matches.push(r));
    }
    return matches;
  },
  manualSteps: 'Remove primeng.min.css imports. The new theme system injects styles automatically.',
};

const primeIconsImportRule: Rule = {
  id: 'theme/primeicons-npm-path',
  description: 'PrimeIcons import path changed in v7 (now bundled differently)',
  category: 'theme',
  severity: 'info',
  fileTypes: ['json', 'scss', 'css'],
  check(content, filePath) {
    const re = /"node_modules\/primeicons\/primeicons\.css"|@import\s+['"](?:~)?primeicons\/primeicons\.css['"]/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: 'Ensure you have `primeicons` v7+ installed alongside PrimeNG 20. ' +
        'The CSS path is still valid but verify the version.',
    }));
  },
};

// ---------------------------------------------------------------------------
// 7. REMOVED / DEPRECATED COMPONENTS
// ---------------------------------------------------------------------------

const dataScrollerRule: Rule = {
  id: 'removed/p-datascroller',
  description: '`p-dataScroller` was removed in PrimeNG 17',
  category: 'api-change',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<\/?p-datascroller\b/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`p-dataScroller` was removed in PrimeNG 17. Use `p-virtualscroller` or a plain `*ngFor` with virtual scrolling.',
    }));
  },
  manualSteps: 'Replace p-dataScroller with p-virtualscroller or implement custom infinite scroll.',
};

const lightboxRule: Rule = {
  id: 'removed/p-lightbox',
  description: '`p-lightbox` was removed — use `p-galleria` in lightbox mode',
  category: 'api-change',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<\/?p-lightbox\b/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`p-lightbox` was removed. Use `p-galleria` with `[fullScreen]="true"` instead.',
    }));
  },
  manualSteps: 'Replace p-lightbox with p-galleria. See https://primeng.org/galleria for the API.',
};

const terminalServiceRule: Rule = {
  id: 'api/TerminalService-moved',
  description: 'TerminalService import path changed',
  category: 'api-change',
  severity: 'warning',
  fileTypes: ['ts'],
  check(content) {
    const re = /import\s*\{[^}]*\bTerminalService\b[^}]*\}\s*from\s*['"]primeng\/terminal['"]/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: 'TerminalService is imported from `primeng/terminal`. Verify this path still exists in PrimeNG 20.',
    }));
  },
};

// ---------------------------------------------------------------------------
// 8. CHIPS → AUTOCOMPLETE MIGRATION
// ---------------------------------------------------------------------------

const chipsRule: Rule = {
  id: 'api/p-chips-deprecated',
  description: '`p-chips` is deprecated — use `p-autocomplete` with `[multiple]="true"` in PrimeNG 20',
  category: 'component-rename',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<\/?p-chips\b/gi;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      message: '`p-chips` is deprecated in PrimeNG 20. Replace with `<p-autocomplete [multiple]="true">` or `<p-multiselect>` depending on your use case.',
    }));
  },
  manualSteps:
    'Replace <p-chips [(ngModel)]="values"> with ' +
    '<p-autocomplete [(ngModel)]="values" [multiple]="true"> ' +
    'or <p-multiselect [(ngModel)]="values"> for option-based selection.',
};

// ---------------------------------------------------------------------------
// 9. ANGULAR.JSON — primeng package version check
// ---------------------------------------------------------------------------

const packageVersionRule: Rule = {
  id: 'version/primeng-package',
  description: 'Ensure `primeng` dependency is set to version 20.x in package.json',
  category: 'api-change',
  severity: 'error',
  fileTypes: ['json'],
  check(content, filePath) {
    if (!filePath.endsWith('package.json')) return [];
    const re = /"primeng"\s*:\s*"([^"]+)"/g;
    const matches: RuleMatch[] = [];
    scan(content, re, (m) => {
      const version = m[1];
      const major = parseInt(version.replace(/[^0-9].*/, ''), 10);
      if (!isNaN(major) && major < 17) {
        return {
          index: m.index,
          length: m[0].length,
          originalText: m[0],
          fixedText: `"primeng": "^20.0.0"`,
          message: `primeng version is \`${version}\`. Update to \`^20.0.0\`.`,
        };
      }
      return null;
    }).filter((m): m is RuleMatch => m !== null).forEach(r => matches.push(r));
    return matches;
  },
};

// ---------------------------------------------------------------------------
// 10. MISCELLANEOUS API CHANGES
// ---------------------------------------------------------------------------

/** p-message / p-messages: `severity` still valid, but `closable` input changed */
const messageClosableRule: Rule = {
  id: 'api/message-closable-default',
  description: '`p-message` `closable` default changed to `false` in PrimeNG 20',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<p-message[^>]*>/gi;
    return scan(content, re, (m) => {
      if (!/\bclosable\b/.test(m[0])) {
        return {
          index: m.index,
          length: m[0].length,
          originalText: m[0],
          message: '`p-message` `closable` now defaults to `false` in PrimeNG 20. ' +
            'Add `[closable]="true"` explicitly if you want a close button.',
        };
      }
      return null;
    }).filter((m): m is RuleMatch => m !== null);
  },
};

/** Dialog: blockScroll default changed */
const dialogBlockScrollRule: Rule = {
  id: 'api/dialog-blockScroll-default',
  description: '`p-dialog` `blockScroll` default changed to `false` in PrimeNG 20',
  category: 'api-change',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /<p-dialog\b[^>]*>/gi;
    return scan(content, re, (m) => {
      if (!/\bblockScroll\b/.test(m[0])) {
        return {
          index: m.index,
          length: m[0].length,
          originalText: m[0],
          message: '`p-dialog` `blockScroll` now defaults to `false`. ' +
            'Add `[blockScroll]="true"` if you need to prevent background scrolling.',
        };
      }
      return null;
    }).filter((m): m is RuleMatch => m !== null);
  },
};

/** Table: rowTrackBy renamed to trackBy */
const tableRowTrackByRule: Rule = {
  id: 'prop/table-rowTrackBy-to-trackBy',
  description: '`p-table` `rowTrackBy` input renamed to `trackBy`',
  category: 'property-rename',
  severity: 'error',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[rowTrackBy\]\s*=/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: '[trackBy]=',
      message: '`[rowTrackBy]` was renamed to `[trackBy]` in PrimeNG 18.',
    }));
  },
  fix: globalReplace(/\[rowTrackBy\]\s*=/g, '[trackBy]='),
};

/** Dropdown / Select: `filter` boolean input changed to attribute */
const dropdownFilterRule: Rule = {
  id: 'prop/select-filter-binding',
  description: '`[filter]="true"` on p-select can be simplified to just `filter`',
  category: 'property-rename',
  severity: 'info',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[filter\]\s*=\s*["']true["']/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: 'filter',
      message: '`[filter]="true"` can be simplified to the `filter` attribute in PrimeNG 20.',
    }));
  },
  fix: globalReplace(/\[filter\]\s*=\s*["']true["']/g, 'filter'),
};

/** inputStyleClass → inputClass */
const inputStyleClassRule: Rule = {
  id: 'prop/inputStyleClass-to-inputClass',
  description: '`inputStyleClass` renamed to `inputClass` in several components',
  category: 'property-rename',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[?inputStyleClass\]?\s*=/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: m[0].replace('inputStyleClass', 'inputClass'),
      message: '`inputStyleClass` was renamed to `inputClass` in PrimeNG 18.',
    }));
  },
  fix: globalReplace(/\[?(inputStyleClass)\]?\s*=/g, (m) => m.replace('inputStyleClass', 'inputClass')),
};

/** panelStyleClass → panelClass */
const panelStyleClassRule: Rule = {
  id: 'prop/panelStyleClass-to-panelClass',
  description: '`panelStyleClass` renamed to `panelClass` in overlay components',
  category: 'property-rename',
  severity: 'warning',
  fileTypes: ['html', 'ts'],
  check(content) {
    const re = /\[?panelStyleClass\]?\s*=/g;
    return scan(content, re, (m) => ({
      index: m.index,
      length: m[0].length,
      originalText: m[0],
      fixedText: m[0].replace('panelStyleClass', 'panelClass'),
      message: '`panelStyleClass` was renamed to `panelClass` in PrimeNG 18.',
    }));
  },
  fix: globalReplace(/\[?(panelStyleClass)\]?\s*=/g, (m) => m.replace('panelStyleClass', 'panelClass')),
};

// ---------------------------------------------------------------------------
// EXPORT ALL RULES
// ---------------------------------------------------------------------------

import {
  lazyLoadEventRule,
  angularVersionRule,
  pTemplateRenameRules,
  pStepsActiveIndexRule,
  filterMatchModeRule,
  dynamicDialogRule,
  treeNodeLeafRule,
  dialogPositionRule,
  messageServiceStickyRule,
  passwordFeedbackRule,
  confirmationServiceRule,
  primeIconsRenameRule,
  buttonDisabledRule,
  inputTextDirectiveRule,
  toastZIndexRule,
} from './rules-extra';

export const ALL_RULES: Rule[] = [
  // Component selector renames
  ...REAL_SELECTOR_RENAMES.map(makeSelectorRule),
  // Module import renames
  ...ALL_TS_RENAMES.map(makeModuleImportRule),
  // Type renames
  ...TYPE_RENAMES.map(makeTypeRenameRule),
  // Property / API renames
  styleClassRule,
  transitionOptionsRule,
  appendToBodyRule,
  tabViewStructureRule,
  accordionTabStructureRule,
  tableRowTrackByRule,
  dropdownFilterRule,
  inputStyleClassRule,
  panelStyleClassRule,
  messageClosableRule,
  dialogBlockScrollRule,
  toastZIndexRule,
  // pTemplate name casing
  ...pTemplateRenameRules,
  // High-level API changes
  primeNGConfigRule,
  browserAnimationsRule,
  lazyLoadEventRule,
  filterMatchModeRule,
  dynamicDialogRule,
  treeNodeLeafRule,
  dialogPositionRule,
  messageServiceStickyRule,
  passwordFeedbackRule,
  confirmationServiceRule,
  pStepsActiveIndexRule,
  buttonDisabledRule,
  inputTextDirectiveRule,
  // Theme
  legacyThemeStylesheetRule,
  primengCssImportRule,
  primeIconsImportRule,
  primeIconsRenameRule,
  // Removed components
  dataScrollerRule,
  lightboxRule,
  chipsRule,
  terminalServiceRule,
  // Version check
  packageVersionRule,
  angularVersionRule,
];

export { REAL_SELECTOR_RENAMES, ALL_TS_RENAMES, TYPE_RENAMES };
