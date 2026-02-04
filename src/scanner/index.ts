// Scanner module - main export
import { cloneRepo, getCommitCount, cleanupRepo } from './git';
import { runScan } from './gitleaks';
import { saveReport } from '../reports/storage';
import type { RepoConfig, ScanOptions, ScanResult } from './types';

export * from './types';
export { cloneRepo, getCommitCount, cleanupRepo } from './git';
export { runScan, parseReport } from './gitleaks';

/**
 * Full scan pipeline: clone -> scan -> save report -> cleanup
 */
export async function scanRepository(
	repo: RepoConfig,
	options: ScanOptions = {}
): Promise<ScanResult> {
	const scanId = `${repo.name}-${Date.now()}`;

	// Create initial scan result
	let result: ScanResult = {
		id: scanId,
		repoName: repo.name,
		repoUrl: repo.url,
		timestamp: new Date().toISOString(),
		commitCount: 0,
		sinceDays: options.sinceDays,
		reportPath: '',
		findingsCount: 0,
		status: 'pending',
	};

	let repoDir: string | null = null;

	try {
		// Update status to scanning
		result.status = 'scanning';
		await saveReport(result);

		// Clone repository
		repoDir = await cloneRepo(repo.url, repo.name);

		// Get commit count
		result.commitCount = await getCommitCount(repoDir, options.sinceDays);
		console.log(`Repository has ${result.commitCount} commits`);

		// Run gitleaks scan
		const { reportPath, findings } = await runScan(repoDir, repo.name, options);

		// Update result
		result.reportPath = reportPath;
		result.findingsCount = findings.length;
		result.status = 'completed';

		// Save final report with findings
		await saveReport(result, findings);

		console.log(`Scan completed: ${findings.length} findings`);

	} catch (error) {
		result.status = 'failed';
		result.error = error instanceof Error ? error.message : String(error);
		await saveReport(result);
		console.error(`Scan failed:`, error);
	} finally {
		// Cleanup cloned repository
		if (repoDir) {
			await cleanupRepo(repoDir);
		}
	}

	return result;
}
