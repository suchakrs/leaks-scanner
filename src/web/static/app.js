// Git Leaks Scanner Dashboard App
const API_BASE = '/api';

// State
let repos = [];
let selectedRepos = new Set(); // Track selected repository names
let reports = [];
let reportsCache = {}; // Cache detailed reports by ID
let selectedReport = null;
let findingsFilter = 'all';
let statsDaysFilter = 730; // Days slider filter for stats (0-730, over 2 years)

// DOM Elements
const repoListContainer = document.getElementById('repo-list');
const repoCountEl = document.getElementById('repo-count');
const selectAllBtn = document.getElementById('select-all-repos');
const deselectAllBtn = document.getElementById('deselect-all-repos');
const sinceDaysInput = document.getElementById('since-days');
const scanBtn = document.getElementById('scan-btn');
const scanAllBtn = document.getElementById('scan-all-btn');
const clearBtn = document.getElementById('clear-btn');
const reportsContainer = document.getElementById('reports-container');
const reportContent = document.getElementById('report-content');
const statsDaysSlider = document.getElementById('stats-days-slider');
const statsDaysValue = document.getElementById('stats-days-value');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
	loadRepos();
	loadReports();
	loadStats();

	// Auto-refresh reports every 5 seconds
	setInterval(() => {
		loadReports();
		loadStats();
	}, 5000);

	// Event listeners
	scanBtn.addEventListener('click', startScan);
	scanAllBtn.addEventListener('click', scanAll);
	clearBtn.addEventListener('click', clearReports);
	selectAllBtn.addEventListener('click', selectAllRepos);
	deselectAllBtn.addEventListener('click', deselectAllRepos);

	// Days slider
	statsDaysSlider.addEventListener('input', (e) => {
		statsDaysFilter = parseInt(e.target.value, 10);
		statsDaysValue.textContent = statsDaysFilter >= 730 ? 'over 2 Years' : (statsDaysFilter === 0 ? 'Today' : statsDaysFilter);
		loadStats();
		loadReports();
		if (selectedReport) {
			renderReportDetail(selectedReport);
		}
	});
});

// API Functions
async function api(endpoint, options = {}) {
	const res = await fetch(`${API_BASE}${endpoint}`, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	});
	return res.json();
}

// Load repositories
async function loadRepos() {
	repos = await api('/repos');

	// Select all repos by default
	repos.forEach(repo => selectedRepos.add(repo.name));

	renderRepoList();
	updateRepoCount();
}

// Render repository checkbox list
function renderRepoList() {
	if (repos.length === 0) {
		repoListContainer.innerHTML = '<div class="empty-state">No repositories configured</div>';
		return;
	}

	repoListContainer.innerHTML = repos.map(repo => `
		<div class="repo-checkbox-item ${selectedRepos.has(repo.name) ? 'checked' : ''}" data-repo="${escapeHtml(repo.name)}">
			<input type="checkbox" 
				id="repo-${escapeHtml(repo.name)}" 
				${selectedRepos.has(repo.name) ? 'checked' : ''}
				onchange="toggleRepo('${escapeHtml(repo.name)}')">
			<label for="repo-${escapeHtml(repo.name)}">${escapeHtml(repo.name)}</label>
		</div>
	`).join('');
}

// Toggle repo selection
function toggleRepo(repoName) {
	if (selectedRepos.has(repoName)) {
		selectedRepos.delete(repoName);
	} else {
		selectedRepos.add(repoName);
	}
	renderRepoList();
	updateRepoCount();
	loadReports();
	loadStats();
}

// Select all repos
function selectAllRepos() {
	repos.forEach(repo => selectedRepos.add(repo.name));
	renderRepoList();
	updateRepoCount();
	loadReports();
	loadStats();
}

// Deselect all repos
function deselectAllRepos() {
	selectedRepos.clear();
	renderRepoList();
	updateRepoCount();
	loadReports();
	loadStats();
}

// Update repo count display
function updateRepoCount() {
	repoCountEl.textContent = `${selectedRepos.size} / ${repos.length} selected`;
}

// Load stats (filtered by selected repos and days slider)
async function loadStats() {
	const allReports = await api('/reports');

	// Calculate cutoff date based on days slider
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - statsDaysFilter);

	// Filter reports by selected repos only (not date - we filter findings by date)
	const filteredReports = allReports.filter(r => selectedRepos.has(r.repoName));

	// Calculate stats from filtered reports
	let totalScans = 0;
	let totalCommits = 0;
	let totalFindings = 0;
	let confirmedLeaks = 0;
	let falsePositives = 0;
	let pendingReview = 0;

	for (const report of filteredReports) {
		// Check if report is within date range
		const reportDate = new Date(report.timestamp);
		const reportInRange = statsDaysFilter >= 730 || reportDate >= cutoffDate;

		if (reportInRange) {
			totalScans++;
			totalCommits += report.commitCount || 0;
		}

		// Get detailed report for finding stats if completed
		if (report.status === 'completed' && report.id) {
			try {
				const detailed = await api(`/reports/${report.id}`);
				if (detailed.findings) {
					for (const f of detailed.findings) {
						// Filter findings by their Date field
						if (f.Date && statsDaysFilter < 730) {
							const findingDate = new Date(f.Date);
							if (findingDate < cutoffDate) continue;
						}

						totalFindings++;
						if (f.reviewStatus === 'confirmed') confirmedLeaks++;
						else if (f.reviewStatus === 'false_positive') falsePositives++;
						else pendingReview++;
					}
				}
			} catch (e) {
				// Fallback: count all as pending if report in range
				if (reportInRange) {
					totalFindings += report.findingsCount || 0;
					pendingReview += report.findingsCount || 0;
				}
			}
		}
	}

	document.getElementById('stat-scans').textContent = totalScans;
	document.getElementById('stat-commits').textContent = totalCommits;
	document.getElementById('stat-findings').textContent = totalFindings;
	document.getElementById('stat-confirmed').textContent = confirmedLeaks;
	document.getElementById('stat-false-positives').textContent = falsePositives;
	document.getElementById('stat-pending').textContent = pendingReview;
}

// Load reports
async function loadReports() {
	const allReports = await api('/reports');

	// Calculate cutoff date based on days slider
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - statsDaysFilter);

	// Filter reports by selected repos and date
	reports = allReports.filter(r => {
		if (!selectedRepos.has(r.repoName)) return false;
		if (statsDaysFilter < 730) {
			const reportDate = new Date(r.timestamp);
			return reportDate >= cutoffDate;
		}
		return true;
	});

	renderReports();

	// Refresh selected report if it's still scanning
	if (selectedReport && selectedReport.status === 'scanning') {
		const updated = reports.find(r => r.id === selectedReport.id);
		if (updated && updated.status !== 'scanning') {
			selectReport(updated.id);
		}
	}

	// Clear selection if the selected report is no longer visible
	if (selectedReport && !reports.find(r => r.id === selectedReport.id)) {
		selectedReport = null;
		reportContent.innerHTML = '<div class="empty-state">Select a report to view details</div>';
	}
}

// Render reports list with filtered stats
async function renderReports() {
	if (reports.length === 0) {
		if (selectedRepos.size === 0) {
			reportsContainer.innerHTML = '<div class="empty-state">Select repositories to view scans</div>';
		} else {
			reportsContainer.innerHTML = '<div class="empty-state">No scans yet. Start a scan above!</div>';
		}
		return;
	}

	// Calculate cutoff date based on global slider
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - statsDaysFilter);

	// Pre-compute filtered stats for each report
	const reportsWithStats = await Promise.all(reports.map(async (report) => {
		let filteredFindings = 0, confirmed = 0, falsePositives = 0;

		if (report.status === 'completed' && report.id) {
			try {
				// Use cache if available
				let detailed = reportsCache[report.id];
				if (!detailed) {
					detailed = await api(`/reports/${report.id}`);
					reportsCache[report.id] = detailed;
				}

				if (detailed.findings) {
					for (const f of detailed.findings) {
						// Filter by date
						if (f.Date && statsDaysFilter < 730) {
							const findingDate = new Date(f.Date);
							if (findingDate < cutoffDate) continue;
						}
						filteredFindings++;
						if (f.reviewStatus === 'confirmed') confirmed++;
						else if (f.reviewStatus === 'false_positive') falsePositives++;
					}
				}
			} catch (e) {
				filteredFindings = report.findingsCount || 0;
			}
		}

		return { ...report, filteredFindings, confirmed, falsePositives };
	}));

	reportsContainer.innerHTML = reportsWithStats.map(report => `
    <div class="report-item ${selectedReport?.id === report.id ? 'active' : ''}">
      <div class="report-header" onclick="selectReport('${report.id}')">
        <span class="report-name">${escapeHtml(report.repoName)}</span>
        <span class="badge badge-${report.status}">${report.status}</span>
      </div>
      <div class="report-meta" onclick="selectReport('${report.id}')">
        <span>📅 ${formatDate(report.timestamp)}</span>
        <span>📊 ${report.commitCount}</span>
        <span>⚠️ ${report.filteredFindings}</span>
        <span style="color: var(--danger)">❌ ${report.confirmed}</span>
        <span style="color: var(--success)">✓ ${report.falsePositives}</span>
      </div>
      <div class="report-actions">
        <button class="btn btn-sm btn-outline" onclick="copyRepoUrl(event, '${escapeHtml(report.repoUrl)}')" title="Copy repo URL">
          📋 Copy URL
        </button>
        <button class="btn btn-sm btn-outline-danger" onclick="removeReport('${report.id}')" title="Remove this report">
          🗑 Remove
        </button>
      </div>
    </div>
  `).join('');
}

// Select a report (using cache for speed)
async function selectReport(id) {
	// Use cache if available, otherwise fetch
	let report = reportsCache[id];
	if (!report) {
		report = await api(`/reports/${id}`);
		reportsCache[id] = report;
	}
	selectedReport = report;
	renderReports();
	renderReportDetail(report);
}

// Render report detail
function renderReportDetail(report) {
	if (!report) {
		reportContent.innerHTML = '<div class="empty-state">Select a report to view details</div>';
		return;
	}

	if (report.status === 'scanning') {
		reportContent.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
        <p>Scan in progress...</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">This will refresh automatically</p>
      </div>
    `;
		return;
	}

	if (report.status === 'failed') {
		reportContent.innerHTML = `
      <div class="empty-state">
        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
        <p>Scan failed</p>
        <p style="font-size: 0.875rem; color: var(--danger); margin-top: 0.5rem;">${report.error || 'Unknown error'}</p>
      </div>
    `;
		return;
	}

	const findings = report.findings || [];

	// Calculate cutoff date based on global slider
	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - statsDaysFilter);

	// Filter all findings by date first (using global slider)
	let dateFilteredFindings = findings;
	if (statsDaysFilter < 730) {
		dateFilteredFindings = findings.filter(f => {
			if (!f.Date) return true;
			const findingDate = new Date(f.Date);
			return findingDate >= cutoffDate;
		});
	}

	const confirmed = dateFilteredFindings.filter(f => f.reviewStatus === 'confirmed').length;
	const falsePositives = dateFilteredFindings.filter(f => f.reviewStatus === 'false_positive').length;
	const pending = dateFilteredFindings.filter(f => f.reviewStatus === 'pending').length;

	// Filter findings by status
	let filteredFindings = dateFilteredFindings;
	if (findingsFilter !== 'all') {
		filteredFindings = filteredFindings.filter(f => f.reviewStatus === findingsFilter);
	}

	reportContent.innerHTML = `
    <div class="report-summary">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-value">${report.commitCount}</div>
          <div class="summary-label">Commits Scanned</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--warning)">${dateFilteredFindings.length}</div>
          <div class="summary-label">Total Findings</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--danger)">${confirmed}</div>
          <div class="summary-label">Confirmed</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--success)">${falsePositives}</div>
          <div class="summary-label">False Positives</div>
        </div>
        <div class="summary-item">
          <div class="summary-value">${pending}</div>
          <div class="summary-label">Pending</div>
        </div>
      </div>
    </div>
    
    <div class="filter-tabs">
      <button class="filter-tab ${findingsFilter === 'all' ? 'active' : ''}" onclick="setFilter('all')">
        All (${dateFilteredFindings.length})
      </button>
      <button class="filter-tab ${findingsFilter === 'pending' ? 'active' : ''}" onclick="setFilter('pending')">
        Pending (${pending})
      </button>
      <button class="filter-tab ${findingsFilter === 'confirmed' ? 'active' : ''}" onclick="setFilter('confirmed')">
        Confirmed (${confirmed})
      </button>
      <button class="filter-tab ${findingsFilter === 'false_positive' ? 'active' : ''}" onclick="setFilter('false_positive')">
        False Positives (${falsePositives})
      </button>
    </div>
    
    <div class="findings-list">
      ${filteredFindings.length === 0 ?
			'<div class="empty-state">No findings match this filter</div>' :
			filteredFindings.map(finding => renderFinding(finding, report.id)).join('')
		}
    </div>
  `;
}

// Render a single finding with enhanced details
function renderFinding(finding, reportId) {
	return `
    <div class="finding-item ${finding.reviewStatus}">
      <div class="finding-header">
        <span class="finding-rule">🔑 ${escapeHtml(finding.RuleID || 'Unknown Rule')}</span>
        <span class="finding-status-badge ${finding.reviewStatus}">${finding.reviewStatus}</span>
      </div>
      
      <div class="finding-details">
        <div class="finding-detail-row">
          <span class="detail-label">📁 File:</span>
          <span class="detail-value file-path">${escapeHtml(finding.File || 'N/A')}:${finding.StartLine || 0}</span>
        </div>
        <div class="finding-detail-row">
          <span class="detail-label">🎯 Match:</span>
          <span class="detail-value match-text">${escapeHtml(maskSecret(finding.Match || finding.Secret || 'N/A'))}</span>
        </div>
        <div class="finding-detail-row">
          <span class="detail-label">👤 Author:</span>
          <span class="detail-value">${escapeHtml(finding.Author || 'N/A')}</span>
        </div>
        <div class="finding-detail-row">
          <span class="detail-label">📧 Email:</span>
          <span class="detail-value">${escapeHtml(finding.Email || 'N/A')}</span>
        </div>
        <div class="finding-detail-row">
          <span class="detail-label">📅 Date:</span>
          <span class="detail-value">${escapeHtml(finding.Date || 'N/A')}</span>
        </div>
        <div class="finding-detail-row">
          <span class="detail-label">💬 Commit:</span>
          <span class="detail-value commit-msg">${escapeHtml(finding.Message || 'N/A')}</span>
        </div>
      </div>

      <div class="finding-secret-box">
        <span class="secret-label">🔐 Secret:</span>
        <code class="secret-value">${escapeHtml(maskSecret(finding.Secret || 'N/A'))}</code>
      </div>

      <div class="finding-actions">
        ${finding.reviewStatus !== 'confirmed' ?
			`<button class="btn btn-sm btn-danger" onclick="updateFinding('${reportId}', '${finding.id}', 'confirmed')">
            ⚠️ Confirm Leak
          </button>` : ''
		}
        ${finding.reviewStatus !== 'false_positive' ?
			`<button class="btn btn-sm btn-success" onclick="updateFinding('${reportId}', '${finding.id}', 'false_positive')">
            ✓ False Positive
          </button>` : ''
		}
        ${finding.reviewStatus !== 'pending' ?
			`<button class="btn btn-sm btn-outline" onclick="updateFinding('${reportId}', '${finding.id}', 'pending')">
            ↩ Reset
          </button>` : ''
		}
      </div>
    </div>
  `;
}

// Start a scan for selected repos
async function startScan() {
	const sinceDays = sinceDaysInput.value;

	if (selectedRepos.size === 0) {
		alert('Please select at least one repository');
		return;
	}

	scanBtn.disabled = true;
	scanBtn.innerHTML = '<span class="btn-icon">⏳</span> Starting...';

	try {
		// Scan each selected repo
		for (const repoName of selectedRepos) {
			await api('/scan', {
				method: 'POST',
				body: JSON.stringify({ repoName, sinceDays }),
			});
		}

		// Refresh reports
		setTimeout(() => {
			loadReports();
			loadStats();
		}, 1000);
	} catch (error) {
		alert('Failed to start scan: ' + error.message);
	} finally {
		scanBtn.disabled = false;
		scanBtn.innerHTML = '<span class="btn-icon">▶</span> Scan Selected';
	}
}

// Scan all repositories (ignores selection, scans everything)
async function scanAll() {
	const sinceDays = sinceDaysInput.value;

	if (!confirm(`Scan all ${repos.length} repositories?`)) {
		return;
	}

	scanAllBtn.disabled = true;
	scanAllBtn.innerHTML = '<span class="btn-icon">⏳</span> Starting...';

	try {
		await api('/scan-all', {
			method: 'POST',
			body: JSON.stringify({ sinceDays }),
		});

		// Refresh reports
		setTimeout(() => {
			loadReports();
			loadStats();
		}, 1000);
	} catch (error) {
		alert('Failed to start scans: ' + error.message);
	} finally {
		scanAllBtn.disabled = false;
		scanAllBtn.innerHTML = '<span class="btn-icon">⚡</span> Scan All';
	}
}

// Clear all reports
async function clearReports() {
	if (!confirm('Are you sure you want to clear all reports? This action cannot be undone.')) {
		return;
	}

	clearBtn.disabled = true;
	clearBtn.innerHTML = '<span class="btn-icon">⏳</span> Clearing...';

	try {
		await api('/reports', {
			method: 'DELETE',
		});

		reportsCache = {}; // Clear cache
		selectedReport = null;
		loadReports();
		loadStats();
		reportContent.innerHTML = '<div class="empty-state">Select a report to view details</div>';
	} catch (error) {
		alert('Failed to clear reports: ' + error.message);
	} finally {
		clearBtn.disabled = false;
		clearBtn.innerHTML = '<span class="btn-icon">🗑</span> Clear Reports';
	}
}

// Update finding status
async function updateFinding(reportId, findingId, status) {
	await api(`/reports/${reportId}/findings/${findingId}`, {
		method: 'PATCH',
		body: JSON.stringify({ reviewStatus: status }),
	});

	// Invalidate cache for this report
	delete reportsCache[reportId];

	// Refresh the report
	selectReport(reportId);
	loadStats();
	loadReports();
}

// Set filter
function setFilter(filter) {
	findingsFilter = filter;
	renderReportDetail(selectedReport);
}

// Utilities
function formatDate(isoString) {
	const date = new Date(isoString);
	return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
}

// Copy repo URL to clipboard
async function copyRepoUrl(evt, url) {
	evt.stopPropagation();
	try {
		await navigator.clipboard.writeText(url);
		// Brief visual feedback
		const btn = evt.target.closest('button');
		const originalText = btn.innerHTML;
		btn.innerHTML = '✓ Copied!';
		setTimeout(() => { btn.innerHTML = originalText; }, 1500);
	} catch (err) {
		// Fallback for older browsers or http
		prompt('Copy this URL:', url);
	}
}

// Remove a single report
async function removeReport(reportId) {
	if (!confirm('Remove this report?')) return;

	try {
		await api(`/reports/${reportId}`, { method: 'DELETE' });

		// Invalidate cache for this report
		delete reportsCache[reportId];

		// Clear selection if this was the selected report
		if (selectedReport && selectedReport.id === reportId) {
			selectedReport = null;
			reportContent.innerHTML = '<div class="empty-state">Select a report to view details</div>';
		}

		loadReports();
		loadStats();
	} catch (err) {
		alert('Failed to remove report');
	}
}

// Mask secret - show only first 4 and last 4 characters
function maskSecret(text) {
	if (!text || text === 'N/A') return text;
	if (text.length <= 12) {
		// Short secrets: show first 2 and last 2, mask rest
		if (text.length <= 4) return '****';
		return text.slice(0, 2) + '*'.repeat(text.length - 4) + text.slice(-2);
	}
	// Longer secrets: show first 4 and last 4
	return text.slice(0, 4) + '*'.repeat(Math.min(text.length - 8, 20)) + text.slice(-4);
}
