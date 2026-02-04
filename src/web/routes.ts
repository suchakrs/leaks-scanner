// API routes for the web dashboard
import { Hono } from 'hono';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanRepository, type RepoConfig, type ScanOptions } from '../scanner';
import { getReports, getReport, updateFindingStatus, getStats, clearReports, deleteReport } from '../reports';

const api = new Hono();

// Load repos configuration from repos.txt (one URL per line)
async function loadRepos(): Promise<RepoConfig[]> {
	const reposPath = join(import.meta.dir, '../../repos.txt');
	const content = await readFile(reposPath, 'utf-8');

	const repos: RepoConfig[] = [];
	const lines = content.split('\n');

	for (const line of lines) {
		const url = line.trim();
		if (!url || url.startsWith('#')) continue; // Skip empty lines and comments

		// Extract repo name from URL (last segment without .git)
		const urlPath = url.replace(/\.git$/, '');
		const segments = urlPath.split('/');
		const name = segments[segments.length - 1];

		if (name) {
			repos.push({ name, url: url.endsWith('.git') ? url : `${url}.git` });
		}
	}

	return repos;
}

// Get target repositories
api.get('/repos', async (c) => {
	const repos = await loadRepos();
	return c.json(repos);
});

// Trigger a scan for a single repository
api.post('/scan', async (c) => {
	const body = await c.req.json();
	const { repoName, sinceDays } = body;

	const repos = await loadRepos();
	const repo = repos.find(r => r.name === repoName);

	if (!repo) {
		return c.json({ error: 'Repository not found' }, 404);
	}

	const options: ScanOptions = {};
	if (sinceDays) {
		options.sinceDays = parseInt(sinceDays, 10);
	}

	// Run scan asynchronously 
	scanRepository(repo, options).catch(console.error);

	return c.json({ message: 'Scan started', repoName });
});

// Trigger scan for all repositories
api.post('/scan-all', async (c) => {
	const body = await c.req.json();
	const { sinceDays } = body;

	const repos = await loadRepos();
	const options: ScanOptions = {};
	if (sinceDays) {
		options.sinceDays = parseInt(sinceDays, 10);
	}

	// Run all scans asynchronously
	for (const repo of repos) {
		scanRepository(repo, options).catch(console.error);
	}

	return c.json({ message: 'Scanning all repositories', count: repos.length });
});

// Clear all reports
api.delete('/reports', async (c) => {
	await clearReports();
	return c.json({ message: 'All reports cleared' });
});

// Get all scan reports
api.get('/reports', async (c) => {
	const reports = await getReports();
	return c.json(reports);
});

// Get specific report with findings
api.get('/reports/:id', async (c) => {
	const id = c.req.param('id');
	const report = await getReport(id);

	if (!report) {
		return c.json({ error: 'Report not found' }, 404);
	}

	return c.json(report);
});

// Delete a single report
api.delete('/reports/:id', async (c) => {
	const id = c.req.param('id');
	const success = await deleteReport(id);

	if (!success) {
		return c.json({ error: 'Report not found' }, 404);
	}

	return c.json({ message: 'Report deleted' });
});

// Update finding status
api.patch('/reports/:id/findings/:findingId', async (c) => {
	const { id, findingId } = c.req.param();
	const { reviewStatus } = await c.req.json();

	if (!['pending', 'false_positive', 'confirmed'].includes(reviewStatus)) {
		return c.json({ error: 'Invalid review status' }, 400);
	}

	const success = await updateFindingStatus(id, findingId, reviewStatus);

	if (!success) {
		return c.json({ error: 'Finding not found' }, 404);
	}

	return c.json({ message: 'Updated' });
});

// Get statistics
api.get('/stats', async (c) => {
	const stats = await getStats();
	return c.json(stats);
});

export default api;
