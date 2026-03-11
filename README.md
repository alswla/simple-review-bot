# 🔍 simple-review-bot

> AI Code Review Bot — Multi-perspective review + Voting + Cross-review debate

📖 [한국어 문서 (Korean)](./README_KO.md)

Four expert agents review your PR **in parallel**, then cross-validate each other's findings to deliver high-confidence code reviews.

## ✨ Features

### 🤖 4 Agent Perspectives

| Agent          | Role                  | Focus                                          |
| -------------- | --------------------- | ---------------------------------------------- |
| 🔒 Security    | Security Engineer     | Hardcoded secrets, injection, XSS, auth gaps   |
| ⚡ Performance | Performance Engineer  | O(n²), N+1, memory leaks, caching              |
| 🧹 Quality     | Code Quality Engineer | Naming, DRY, error handling, SOLID             |
| 🎨 UX          | UX Engineer           | Loading states, a11y, empty states, responsive |

### 📊 Voting System

Agents automatically vote based on issue severity:

- ✅ **approve** — No critical issues
- ⚠️ **conditional** (0.5 vote) — Warnings present
- ❌ **reject** — Critical issue(s) found

### ⚖️ Weighted Scoring

Automatically adjusts agent weights based on PR file types:

```
Frontend (.tsx, .css)  → 🎨 UX ×1.5   🔒 Security ×1.0
Backend  (.ts, .sql)   → 🔒 Security ×1.5   🎨 UX ×0.5
Infra    (.yml, .tf)   → 🔒 Security ×2.0   🎨 UX ×0.3
```

### 💬 Cross-Review Debate

Agents cross-validate each other's findings:

```
Round 1: Independent review (4 agents in parallel)
Round 2: Cross-review (each agent evaluates others' issues with agree/disagree/abstain)
```

→ Per-issue **confidence score** (reduces false positives)

### 🏷️ Auto Labels

Automatically applies PR labels based on vote results:

- `review:approved` 🟢
- `review:changes-requested` 🔴
- `review:needs-discussion` 🟡

---

## 🚀 Quick Start

```yaml
# .github/workflows/review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: minjihan/simple-review-bot@v1
        with:
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Provider Options

```yaml
# OpenAI (default)
- uses: minjihan/simple-review-bot@v1
  with:
    openai_api_key: ${{ secrets.OPENAI_API_KEY }}

# Claude
- uses: minjihan/simple-review-bot@v1
  with:
    provider: claude
    claude_api_key: ${{ secrets.CLAUDE_API_KEY }}

# Gemini
- uses: minjihan/simple-review-bot@v1
  with:
    provider: gemini
    gemini_api_key: ${{ secrets.GEMINI_API_KEY }}
```

---

## ⚙️ Configuration

Create `.github/pr-lens.yml` for advanced settings:

```yaml
# LLM Provider
provider:
  type: openai
  model: gpt-4o

# Enable/disable agents
agents:
  security: true
  performance: true
  quality: true
  ux: false # Disable for backend-only repos

# Voting
voting:
  required_approvals: 2
  conditional_weight: 0.5

# Cross-review debate
debate:
  enabled: true
  trigger: on-critical # always | on-critical | on-disagreement

# Auto weight detection
weights:
  auto_detect: true

# Auto labels
labels:
  enabled: true
  approved: "review:approved"
  rejected: "review:changes-requested"
  discussion: "review:needs-discussion"

# Output style
output:
  style: detailed # detailed | summary

# Ignore patterns
ignore:
  files:
    - "*.lock"
    - "*.generated.*"
  paths:
    - "node_modules/"
    - "dist/"
```

---

## 📊 Output Example

```markdown
## 🔍 simple-review-bot Review

### 📊 Dashboard

✅ **APPROVED** (3.2 / 4.0 weighted votes)

| Agent          | Vote           | Weight | Issues     | Score |
| -------------- | -------------- | ------ | ---------- | ----- |
| 🔒 Security    | ✅ approve     | ×1.5   | None       | 1.5   |
| ⚡ Performance | ⚠️ conditional | ×1.2   | 1 warning  | 0.6   |
| 🧹 Quality     | ✅ approve     | ×1.0   | 1 info     | 1.0   |
| 🎨 UX          | ❌ reject      | ×0.5   | 1 critical | 0.0   |

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 80% confidence

### 📋 Action Items

- [ ] Refactor nested loop in src/utils.ts:15 (⚡ Performance)
```

---

## 🏗️ Architecture

```
PR Diff
   │
   ▼
┌──────────────────────────────────────────────────────┐
│                 Round 1: Parallel Review              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │🔒Security│ │⚡Perform.│ │🧹Quality │ │🎨  UX    ││
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘│
│        └────────────┴────────────┴────────────┘      │
│                         │                             │
│                    Auto Vote                          │
│           (severity → approve/reject)                 │
│                         │                             │
│                 Round 2: Cross-Review                 │
│          (agents validate each other)                 │
│                         │                             │
│              Weighted Vote Counting                   │
│         (file type weights applied)                   │
└──────────────────────────────────────────────────────┘
   │
   ▼
PR Comment (Dashboard + Issues + Action Items)
   +
GitHub Label (approved / changes-requested)
```

---

## 🔧 Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Watch mode
pnpm typecheck        # Type check
pnpm build            # Build with ncc
```

## 📁 Project Structure

```
simple-review-bot/
├── action.yml              # GitHub Action definition
├── src/
│   ├── index.ts            # Main entry point
│   ├── agents/             # 4 review agents
│   ├── providers/          # LLM providers (OpenAI / Claude / Gemini)
│   ├── review/             # Voting + debate system
│   ├── github/             # GitHub API integration
│   └── utils/              # Config, errors, retry, logger
└── dist/                   # Bundled output
```

## 📝 License

MIT
