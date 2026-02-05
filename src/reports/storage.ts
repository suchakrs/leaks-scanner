// Report storage - file-based persistence
import { readFile, writeFile, readdir, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import type { ScanResult, ScanReport, LeakFinding } from '../scanner/types';

const REPORTS_DIR = join(import.meta.dir, '../../reports');
const METADATA_FILE = join(REPORTS_DIR, 'metadata.json');

interface ReportsMetadata {
	scans: ScanResult[];
}

/**
 * Ensure reports directory exists
 */
async function ensureDir(): Promise<void> {
	try {
		await mkdir(REPORTS_DIR, { recursive: true });
	} catch { }
}

/**
 * Load reports metadata
 */
async function loadMetadata(): Promise<ReportsMetadata> {
	try {
		const content = await readFile(METADATA_FILE, 'utf-8');
		return JSON.parse(content);
	} catch {
		return { scans: [] };
	}
}

/**
 * Save reports metadata
 */
async function saveMetadata(metadata: ReportsMetadata): Promise<void> {
	await ensureDir();
	await writeFile(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

/**
 * Save or update a scan report
 */
export async function saveReport(
	result: ScanResult,
	findings?: LeakFinding[]
): Promise<void> {
	await ensureDir();

	const metadata = await loadMetadata();

	// Update or add scan result
	const existingIndex = metadata.scans.findIndex(s => s.id === result.id);
	if (existingIndex >= 0) {
		metadata.scans[existingIndex] = result;
	} else {
		metadata.scans.unshift(result);
	}

	await saveMetadata(metadata);

	// Save findings if provided
	if (findings && result.reportPath) {
		const reportData: ScanReport = { ...result, findings };
		const detailPath = join(REPORTS_DIR, `${result.id}-detail.json`);
		await writeFile(detailPath, JSON.stringify(reportData, null, 2));
	}
}

/**
 * Update scan status
 */
export async function updateReportStatus(
	scanId: string,
	status: ScanResult['status'],
	error?: string
): Promise<void> {
	const metadata = await loadMetadata();
	const scan = metadata.scans.find(s => s.id === scanId);
	if (scan) {
		scan.status = status;
		if (error) scan.error = error;
		await saveMetadata(metadata);
	}
}

/**
 * Get all scan results
 */
export async function getReports(): Promise<ScanResult[]> {
	const metadata = await loadMetadata();
	return metadata.scans;
}

/**
 * Get a specific report with findings
 */
export async function getReport(scanId: string): Promise<ScanReport | null> {
	const metadata = await loadMetadata();
	const scan = metadata.scans.find(s => s.id === scanId);
	if (!scan) return null;

	try {
		const detailPath = join(REPORTS_DIR, `${scanId}-detail.json`);
		const content = await readFile(detailPath, 'utf-8');
		return JSON.parse(content);
	} catch {
		return { ...scan, findings: [] };
	}
}

/**
 * Update finding review status
 */
export async function updateFindingStatus(
	scanId: string,
	findingId: string,
	reviewStatus: LeakFinding['reviewStatus']
): Promise<boolean> {
	const report = await getReport(scanId);
	if (!report) return false;

	const finding = report.findings.find(f => f.id === findingId);
	if (!finding) return false;

	finding.reviewStatus = reviewStatus;

	const detailPath = join(REPORTS_DIR, `${scanId}-detail.json`);
	await writeFile(detailPath, JSON.stringify(report, null, 2));

	return true;
}

/**
 * Delete a single report
 */
export async function deleteReport(scanId: string): Promise<boolean> {
	const metadata = await loadMetadata();
	const index = metadata.scans.findIndex(s => s.id === scanId);

	if (index === -1) return false;

	// Remove from metadata
	metadata.scans.splice(index, 1);
	await saveMetadata(metadata);

	// Remove detail file if exists
	try {
		const detailPath = join(REPORTS_DIR, `${scanId}-detail.json`);
		await rm(detailPath, { force: true });
	} catch { }

	return true;
}

/**
 * Clear all reports
 */
export async function clearReports(): Promise<void> {
	try {
		// Remove all files in reports directory
		const files = await readdir(REPORTS_DIR);
		for (const file of files) {
			await rm(join(REPORTS_DIR, file), { force: true });
		}
	} catch {
		// Directory might not exist, that's fine
	}
}

/**
 * Get statistics across all reports
 */
export async function getStats(): Promise<{
	totalScans: number;
	totalCommits: number;
	totalFindings: number;
	confirmedLeaks: number;
	falsePositives: number;
	pendingReview: number;
}> {
	const metadata = await loadMetadata();

	let totalCommits = 0;
	let totalFindings = 0;
	let confirmedLeaks = 0;
	let falsePositives = 0;
	let pendingReview = 0;

	for (const scan of metadata.scans) {
		if (scan.status === 'completed') {
			totalCommits += scan.commitCount || 0;
			const report = await getReport(scan.id);
			if (report) {
				totalFindings += report.findings.length;
				for (const finding of report.findings) {
					if (finding.reviewStatus === 'confirmed') confirmedLeaks++;
					else if (finding.reviewStatus === 'false_positive') falsePositives++;
					else pendingReview++;
				}
			}
		}
	}

	return {
		totalScans: metadata.scans.filter(s => s.status === 'completed').length,
		totalCommits,
		totalFindings,
		confirmedLeaks,
		falsePositives,
		pendingReview,
	};
}

