// Gitleaks command execution
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { LeakFinding, ScanOptions } from './types';

const REPORTS_DIR = join(import.meta.dir, '../../reports');

/**
 * Run gitleaks scan on a repository
 */
export async function runScan(
	repoDir: string,
	repoName: string,
	options: ScanOptions = {}
): Promise<{ reportPath: string; findings: LeakFinding[] }> {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
	const reportPath = join(REPORTS_DIR, `${repoName}_${timestamp}.json`);

	// Build gitleaks command
	const args = [
		'gitleaks',
		'detect',
		'--source', repoDir,
		'--report-path', reportPath,
		'--report-format', 'json',
	];

	// Add since filter if specified
	if (options.sinceDays) {
		args.push('--log-opts', `--since="${options.sinceDays} days ago"`);
	}

	console.log(`Running gitleaks scan: ${args.join(' ')}`);

	const proc = Bun.spawn(args, {
		stdout: 'pipe',
		stderr: 'pipe',
	});

	const exitCode = await proc.exited;
	const stderr = await new Response(proc.stderr).text();

	// Exit code 1 means leaks found, which is expected
	// Exit code 0 means no leaks
	// Other codes are errors
	if (exitCode !== 0 && exitCode !== 1) {
		throw new Error(`Gitleaks scan failed: ${stderr}`);
	}

	// Parse report
	const findings = await parseReport(reportPath);

	return { reportPath, findings };
}

/**
 * Parse gitleaks JSON report
 */
export async function parseReport(reportPath: string): Promise<LeakFinding[]> {
	try {
		const content = await readFile(reportPath, 'utf-8');
		const findings: LeakFinding[] = JSON.parse(content);

		// Add review status to each finding
		return findings.map((finding, index) => ({
			...finding,
			id: `finding-${index}`,
			reviewStatus: 'pending' as const,
		}));
	} catch (error) {
		// No report file means no leaks found
		return [];
	}
}
