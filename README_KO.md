# 🔍 simple-review-bot

> AI 코드 리뷰 봇 — 다중 관점 리뷰 + 투표 + 교차 검증

📖 [English](./README.md)

4개의 전문 에이전트가 PR을 **병렬로** 리뷰하고, 교차 검증을 통해 신뢰도 높은 코드 리뷰를 제공합니다.

## ✨ 기능

### 🤖 4개 에이전트

| 에이전트       | 역할               | 주요 체크                             |
| -------------- | ------------------ | ------------------------------------- |
| 🔒 Security    | 보안 엔지니어      | 시크릿 노출, 인젝션, XSS, 인증 취약점 |
| ⚡ Performance | 성능 엔지니어      | O(n²), N+1, 메모리 누수, 캐싱         |
| 🧹 Quality     | 코드 품질 엔지니어 | 네이밍, DRY, 에러 핸들링, SOLID       |
| 🎨 UX          | UX 엔지니어        | 로딩 상태, a11y, 빈 상태, 반응형      |

### 📊 투표 시스템

이슈 심각도에 따라 에이전트가 자동 투표:

- ✅ **approve** — critical 이슈 없음
- ⚠️ **conditional** (0.5표) — warning 존재
- ❌ **reject** — critical 이슈 발견

### ⚖️ 가중치 시스템

PR 파일 유형을 분석하여 에이전트별 가중치 자동 조정:

```
Frontend (.tsx, .css)  → 🎨 UX ×1.5   🔒 Security ×1.0
Backend  (.ts, .sql)   → 🔒 Security ×1.5   🎨 UX ×0.5
Infra    (.yml, .tf)   → 🔒 Security ×2.0   🎨 UX ×0.3
```

### 💬 교차 검증 (Debate)

에이전트들이 서로의 이슈를 검증:

```
Round 1: 독립 리뷰 (4개 에이전트 병렬 실행)
Round 2: 교차 검증 (각 에이전트가 다른 에이전트의 이슈에 동의/반대/의견없음)
```

→ 이슈별 **신뢰도 점수** 산출 (false positive 감소)

### 🏷️ 자동 라벨

투표 결과에 따라 PR에 자동 라벨 적용:

- `review:approved` 🟢
- `review:changes-requested` 🔴
- `review:needs-discussion` 🟡

---

## 🚀 시작하기

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

### Provider 선택

```yaml
# OpenAI (기본)
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

## ⚙️ 설정

`.github/pr-lens.yml` 파일로 상세 설정:

```yaml
# LLM Provider
provider:
  type: openai
  model: gpt-4o # 모델 지정 (선택)

# 에이전트 활성화/비활성화
agents:
  security: true
  performance: true
  quality: true
  ux: false # 백엔드 전용 레포에서 비활성화

# 투표 설정
voting:
  required_approvals: 2 # 필요 찬성 표
  conditional_weight: 0.5

# 교차 검증
debate:
  enabled: true
  trigger: on-critical # always | on-critical | on-disagreement

# 가중치
weights:
  auto_detect: true # 파일 확장자 기반 자동 감지

# 자동 라벨
labels:
  enabled: true
  approved: "review:approved"
  rejected: "review:changes-requested"
  discussion: "review:needs-discussion"

# 출력 스타일
output:
  style: detailed # detailed | summary

# 무시할 파일/경로
ignore:
  files:
    - "*.lock"
    - "*.generated.*"
  paths:
    - "node_modules/"
    - "dist/"
```

---

## 📊 출력 예시

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

- [ ] src/utils.ts:15의 중첩 루프 리팩토링 (⚡ Performance)
```

---

## 🏗️ 아키텍처

```
PR Diff
   │
   ▼
┌──────────────────────────────────────────────────────┐
│              Round 1: 병렬 리뷰                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │🔒Security│ │⚡Perform.│ │🧹Quality │ │🎨  UX    ││
│  └─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘│
│        └────────────┴────────────┴────────────┘      │
│                         │                             │
│                    자동 투표                           │
│         (심각도 → approve/reject 판정)                 │
│                         │                             │
│              Round 2: 교차 검증                       │
│       (에이전트들이 서로의 이슈 검증)                    │
│                         │                             │
│              가중치 적용 집계                           │
│        (파일 유형에 따른 가중치 반영)                    │
└──────────────────────────────────────────────────────┘
   │
   ▼
PR 코멘트 (Dashboard + Issues + Action Items)
   +
GitHub 라벨 (approved / changes-requested)
```

---

## 🔧 개발

```bash
pnpm install          # 의존성 설치
pnpm dev              # Watch 모드
pnpm typecheck        # 타입 체크
pnpm build            # ncc 번들 빌드
```

## 📁 프로젝트 구조

```
simple-review-bot/
├── action.yml              # GitHub Action 정의
├── src/
│   ├── index.ts            # 메인 엔트리포인트
│   ├── agents/             # 4개 리뷰 에이전트
│   ├── providers/          # LLM 프로바이더 (OpenAI / Claude / Gemini)
│   ├── review/             # 투표 + 교차 검증 시스템
│   ├── github/             # GitHub API 연동
│   └── utils/              # 설정, 에러, 재시도, 로거
└── dist/                   # 빌드 결과물
```

## 📝 라이선스

MIT
