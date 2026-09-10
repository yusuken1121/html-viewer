---
name: project-setup
description: >-
  Tech stack, installation, environment variables, and dev commands for this
  boilerplate. Use when setting up the project locally or configuring env vars.
---

# Project Setup

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Data Fetching**: TanStack React Query + Axios
- **AI**: Google Generative AI SDK (Gemini)
- **External DB**: Notion API
- **UI**: shadcn/ui + Tailwind CSS v4
- **Testing**: Vitest
- **Lint / Format**: ESLint + Prettier
- **Package Manager**: pnpm

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment setup

```bash
cp .env.example .env.local
```

Fill in the required values (see table below).

### 3. Run development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
pnpm test
```

### 5. Format & lint

```bash
pnpm format        # Prettier — auto-fix
pnpm format:check  # Prettier — check only (CI)
pnpm lint            # ESLint
pnpm lint:fix        # ESLint — auto-fix
pnpm check           # format:check + lint + test
```

VS Code / Cursor: `.vscode/settings.json` enables format-on-save with Prettier and ESLint fix.

## Environment Variables

| Variable                     | Required     | Description                            |
| :--------------------------- | :----------- | :------------------------------------- |
| `GEMINI_API_KEY`             | Yes (Chat)   | Google AI API key                      |
| `NOTION_TOKEN`               | Yes (Notion) | Notion integration token               |
| `NOTION_CONTACT_DATABASE_ID` | Yes (Notion) | Target Notion database ID              |
| `NEXT_PUBLIC_API_URL`        | No           | API base URL (defaults to same origin) |
| `NEXT_PUBLIC_USE_MOCK`       | No           | Set `"true"` to use mock API           |
| `NEXT_PUBLIC_MOCK_API_URL`   | No           | Mock API base URL                      |

See `.env.example` for the template.

## Related Skills

- [architecture-overview](../architecture-overview/SKILL.md)
- [architectural-rules](../architectural-rules/SKILL.md)
