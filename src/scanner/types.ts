// Scanner types for git leaks scanner

export interface RepoConfig {
  name: string;
  url: string;
}

export interface ScanOptions {
  sinceDays?: number;
  reportFormat?: 'json' | 'csv' | 'sarif';
}

export interface ScanResult {
  id: string;
  repoName: string;
  repoUrl: string;
  timestamp: string;
  commitCount: number;
  sinceDays?: number;
  reportPath: string;
  findingsCount: number;
  status: 'pending' | 'scanning' | 'completed' | 'failed';
  error?: string;
}

export interface LeakFinding {
  id: string;
  Description: string;
  StartLine: number;
  EndLine: number;
  StartColumn: number;
  EndColumn: number;
  Match: string;
  Secret: string;
  File: string;
  Commit: string;
  Entropy: number;
  Author: string;
  Email: string;
  Date: string;
  Message: string;
  Tags: string[];
  RuleID: string;
  Fingerprint: string;
  // Custom status for false positive tracking
  reviewStatus?: 'pending' | 'false_positive' | 'confirmed';
}

export interface ScanReport extends ScanResult {
  findings: LeakFinding[];
}
