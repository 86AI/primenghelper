export type Severity = 'error' | 'warning' | 'info';
export type FileType = 'html' | 'ts' | 'scss' | 'css' | 'json';
export type Category =
  | 'component-rename'
  | 'module-import'
  | 'standalone-import'
  | 'type-rename'
  | 'property-rename'
  | 'api-change'
  | 'theme'
  | 'structural';

export interface RuleMatch {
  index: number;
  length: number;
  originalText: string;
  fixedText?: string;
  message: string;
}

export interface Rule {
  id: string;
  description: string;
  category: Category;
  severity: Severity;
  fileTypes: FileType[];
  check: (content: string, filePath: string) => RuleMatch[];
  fix?: (content: string) => string;
  /** Manual steps the developer must take — cannot be auto-fixed */
  manualSteps?: string;
}

export interface Issue {
  file: string;
  line: number;
  column: number;
  ruleId: string;
  category: Category;
  severity: Severity;
  message: string;
  originalText: string;
  fixedText?: string;
  autoFixable: boolean;
  manualSteps?: string;
}

export interface FileScanResult {
  file: string;
  issues: Issue[];
  fixed?: string;
}

export interface MigrationReport {
  scannedFiles: number;
  totalIssues: number;
  autoFixable: number;
  fixedFiles: number;
  issuesByFile: FileScanResult[];
  issuesByCategory: Record<string, Issue[]>;
  issuesByRule: Record<string, Issue[]>;
}
