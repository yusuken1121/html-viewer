## ADDED Requirements

### Requirement: Notion API Route Handler

The system SHALL expose a Next.js API Route Handler (`POST /api/notion`) that handles client submissions by parsing request parameters and calling `CreateNotionRecordUseCase` to write records to a Notion database.

#### Scenario: Post Record to Notion API

- **WHEN** client makes a POST request to `/api/notion` with valid record payload
- **THEN** the system SHALL successfully authenticate and save the record in Notion, returning a 200/201 response with the Notion page reference

### Requirement: React Query Hook for Notion Record Creation

The system SHALL expose a custom React hook `useCreateNotionRecord` wrapping TanStack Query's `useMutation` that manages asynchronous submission states and triggers the `/api/notion` API endpoint.

#### Scenario: Submit Form data to Notion Mutation

- **WHEN** user submits form data using `useCreateNotionRecord`
- **THEN** the hook SHALL execute the request, expose mutation states (`isPending`, `isSuccess`), and capture any write errors

### Requirement: Notion Integration Skill Documentation

The system SHALL update `.gemini/skills/notion-integration/SKILL.md` to comprehensively document this client-side React Query optimization path, including instructions on API routing, hook configurations, and example form submissions.

#### Scenario: Verify Notion Integration Skill Documentation is Updated

- **WHEN** a developer inspects `.gemini/skills/notion-integration/SKILL.md`
- **THEN** it SHALL contain sections detailing "React Query Optimization" and the full API-to-Mutation workflow
