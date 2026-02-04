# 🔍 Git Leaks Scanner

A powerful Bun-based application for scanning git repositories for secrets and credentials using **gitleaks**. Features a web dashboard for report analysis, false positive management, and leak categorization.

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Repository Scanning** | Clone → Scan → Report → Cleanup automated pipeline |
| **Scan All Repos** | Scan all configured repositories with a single click |
| **Since Days Filter** | Limit scans to commits within N days (e.g., `--since=30days`) |
| **Commit Tracking** | Each scan records the total commit count |
| **Report Persistence** | JSON reports saved with metadata and findings |
| **Finding Review** | Mark findings as Confirmed Leak or False Positive |
| **Enhanced Details** | View RuleID, Match, File, Author, Email for each finding |
| **Statistics Dashboard** | Track total scans, commits, findings, and review status |
| **Clear Reports** | Reset and clear all scan reports |

## 📋 Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- [gitleaks](https://github.com/gitleaks/gitleaks) (v8.0+)
- Git

### Install gitleaks

```bash
# Windows (scoop)
scoop install gitleaks

# macOS (brew)
brew install gitleaks

# Linux (snap)
sudo snap install gitleaks
```

## 🚀 Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure target repositories

Edit `repos.txt` to add your target repositories (one URL per line):

```txt
# Comments start with #
https://github.com/org/my-repo
https://github.com/org/another-repo.git
```

The repo name is automatically extracted from the URL.

### 3. Start the dashboard

```bash
bun run dev
```

Open http://localhost:3000 in your browser.

## 📖 Usage Guide

### Single Repository Scan

1. Select a repository from the dropdown
2. Optionally set "Since (days)" to limit the scan
3. Click **Start Scan**

### Scan All Repositories

1. Optionally set "Since (days)" to limit all scans
2. Click **Scan All** to scan all configured repos

### Review Findings

1. Click on a completed scan in the history
2. View finding details: **RuleID**, **Match**, **File**, **Email**
3. Mark findings as:
   - ⚠️ **Confirm Leak** - Verified secret exposure
   - ✓ **False Positive** - Not a real leak
   - ↩ **Reset** - Back to pending

### Clear All Reports

Click **Clear Reports** to delete all scan history and reports.

## 🔧 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/repos` | List configured repositories |
| POST | `/api/scan` | Scan single repo `{ repoName, sinceDays? }` |
| POST | `/api/scan-all` | Scan all repos `{ sinceDays? }` |
| GET | `/api/reports` | List all scan reports |
| GET | `/api/reports/:id` | Get report with findings |
| PATCH | `/api/reports/:id/findings/:fid` | Update finding status |
| DELETE | `/api/reports` | Clear all reports |
| GET | `/api/stats` | Dashboard statistics |

## 📊 Statistics Tracked

- **Total Scans** - Number of completed scans
- **Total Commits** - Sum of all commits scanned
- **Total Findings** - All detected potential leaks
- **Confirmed Leaks** - Verified secret exposures
- **False Positives** - Dismissed findings
- **Pending Review** - Awaiting classification

## 📁 Project Structure

```
leaks-scanner/
├── src/
│   ├── scanner/          # Core scanning logic
│   │   ├── git.ts        # Clone, commit count, cleanup
│   │   ├── gitleaks.ts   # Gitleaks command execution
│   │   └── types.ts      # TypeScript interfaces
│   ├── reports/          # Report storage
│   │   └── storage.ts    # File-based persistence
│   └── web/              # Dashboard
│       ├── server.ts     # Hono web server
│       ├── routes.ts     # REST API endpoints
│       └── static/       # Frontend (HTML/CSS/JS)
├── repos.json            # Target repositories config
├── reports/              # Generated reports (gitignored)
└── temp/                 # Temporary clones (gitignored)
```

## 🛡️ Finding Details

Each finding includes:

| Field | Description |
|-------|-------------|
| **RuleID** | The gitleaks rule that triggered |
| **File** | File path and line number |
| **Match** | The matched pattern |
| **Secret** | The detected secret value |
| **Author** | Git commit author |
| **Email** | Author's email address |
| **Date** | Commit date |
| **Message** | Commit message |

## 🔑 Supported Secret Types

gitleaks detects 150+ types of secrets including:

- AWS Keys, Azure Keys, GCP Keys
- GitHub Tokens, GitLab Tokens
- Slack Webhooks
- Database connection strings
- Private keys (RSA, SSH, PGP)
- API keys for various services
- Passwords and credentials

## 📝 Scripts

```bash
# Development with hot reload
bun run dev

# Production start
bun run start

# Type checking
bun run typecheck
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License
