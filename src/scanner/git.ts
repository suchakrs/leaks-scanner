// Git operations - clone, commit count, cleanup
import { rm } from 'fs/promises';
import { join } from 'path';

const TEMP_DIR = join(import.meta.dir, '../../temp');

/**
 * Clone a git repository to a temporary directory
 */
export async function cloneRepo(url: string, repoName: string): Promise<string> {
	const targetDir = join(TEMP_DIR, repoName);

	// Clean up if exists
	await cleanupRepo(targetDir);

	console.log(`Cloning ${url} to ${targetDir}...`);

	try {
		const proc = Bun.spawn(['git', 'clone', '-c', 'core.longpaths=true', '--depth=1000', url, targetDir], {
			stdout: 'pipe',
			stderr: 'pipe',
		});

		const exitCode = await proc.exited;

		if (exitCode !== 0) {
			const stderr = await new Response(proc.stderr).text();
			throw new Error(`Failed to clone repository: ${stderr}`);
		}

		console.log(`Cloned ${url} successfully`);
		return targetDir;
	} catch (error) {
		// Cleanup partial clone on failure
		await cleanupRepo(targetDir);
		throw error;
	}
}

/**
 * Get the number of commits in the repository
 */
export async function getCommitCount(repoDir: string, sinceDays?: number): Promise<number> {
	let cmd: string[];

	if (sinceDays) {
		const sinceDate = new Date();
		sinceDate.setDate(sinceDate.getDate() - sinceDays);
		const sinceStr = sinceDate.toISOString().split('T')[0];
		cmd = ['git', 'rev-list', '--count', `--since=${sinceStr}`, 'HEAD'];
	} else {
		cmd = ['git', 'rev-list', '--count', 'HEAD'];
	}

	const proc = Bun.spawn(cmd, { cwd: repoDir });
	const output = await new Response(proc.stdout).text();

	return parseInt(output.trim(), 10) || 0;
}

/**
 * Remove a cloned repository directory
 */
export async function cleanupRepo(repoDir: string): Promise<void> {
	try {
		await rm(repoDir, { recursive: true, force: true });
		console.log(`Cleaned up ${repoDir}`);
	} catch (error) {
		// Ignore if directory doesn't exist
	}
}
