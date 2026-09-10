## 1. API Route and Endpoint Integration

- [x] 1.1 Create the Next.js API Route Handler at `src/app/api/notion/route.ts` linking to `CreateNotionRecordUseCase`
- [x] 1.2 Implement the client-side API endpoint wrapper at `src/lib/api/notion.ts`

## 2. React Query Hooks and Validators Setup

- [x] 2.1 Implement Zod validation schema for Notion submissions at `src/lib/validators/notion.schema.ts`
- [x] 2.2 Implement custom React Query hooks under `src/lib/api/queries/useNotion.ts`

## 3. Skill Documentation Update

- [x] 3.1 Update `.gemini/skills/notion-integration/SKILL.md` to document the full API-to-mutation flow
- [x] 3.2 Verify project compilation and run tests
