## 1. Setup and Dependencies

- [x] 1.1 Install npm packages: `@tanstack/react-query` and `axios`
- [x] 1.2 Add React Query Provider at `src/components/providers/query-client-provider.tsx` and integrate it into root layout `src/app/layout.tsx`

## 2. API Types and Constants Setup

- [x] 2.1 Create custom form labels and validation constants at `src/constants/labels.ts` and `src/constants/validation.ts`
- [x] 2.2 Create type definitions at `src/types/chat.type.ts` and `src/types/chat-api.type.ts`

## 3. Zod Configuration and Custom Messaging

- [x] 3.1 Migrate and optimize `_lib/zod/zodConfig.ts` to `src/lib/zod/zodConfig.ts`
- [x] 3.2 Migrate test suite `_lib/zod/zodConfig.test.ts` to `src/lib/zod/zodConfig.test.ts`
- [x] 3.3 Create chat message validator `src/lib/validators/chat.schema.ts`
- [x] 3.4 Verify Zod localized error custom messaging tests pass using vitest

## 4. API Client and Backend Route Integration

- [x] 4.1 Migrate Axios API Client `_lib/api/apiClient.ts` to `src/lib/api/apiClient.ts`
- [x] 4.2 Migrate and optimize Query Client configuration `_lib/api/queryClient.ts` to `src/lib/api/queryClient.ts`
- [x] 4.3 Create the Next.js API Route Handler at `src/app/api/chat/route.ts` that handles streaming/completed AI completions
- [x] 4.4 Implement `src/lib/api/chat.ts` for chat API endpoints
- [x] 4.5 Implement custom React Query hooks under `src/lib/api/queries/useChat.ts`

## 5. UI Refactoring and Cleanup

- [x] 5.1 Refactor frontend `src/app/_components/chat-interface.tsx` to use the new React Query mutation hooks
- [ ] 5.2 Run `npm run build` to verify there are no TypeScript or bundling compilation errors
- [ ] 5.3 Clean up the obsolete temporary `_lib` directory from the root directory
