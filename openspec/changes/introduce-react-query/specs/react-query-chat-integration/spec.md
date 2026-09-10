## ADDED Requirements

### Requirement: Unified API Client and Chat Endpoint

The system SHALL expose an Axios-based client (`apiClient`) and a Next.js App Router API Route (`POST /api/chat`) that routes incoming chat requests to the Clean Architecture core `SendMessageUseCase`.

#### Scenario: Post Chat Message to Route Handler

- **WHEN** the client initiates a POST request to `/api/chat` with chat messages history
- **THEN** the Route Handler SHALL parse the request body, instantiate `SendMessageUseCase` with Gemini, and return the response

### Requirement: Custom React Query Chat Hook

The system SHALL expose a custom React hook `useSendMessage` wrapping TanStack Query's `useMutation` that manages message transmission, pending state, and updates the local conversation history.

#### Scenario: Send Chat Message Mutation

- **WHEN** the user submits a prompt via `useSendMessage`
- **THEN** the hook SHALL trigger the API mutation, expose `isPending`, and handle successful response streams or complete text responses

### Requirement: Localized Zod Config and Chat Validations

The system SHALL extend Zod configuration using `z.config` with a custom error map that maps standard Zod issue codes to custom localized Japanese error messages, and define a Zod validation schema for chat message validation.

#### Scenario: Message Empty Validation Check

- **WHEN** user submits an empty or whitespace-only message
- **THEN** the Zod schema SHALL fail validation with the custom message "メッセージを入力してください"

#### Scenario: Custom Zod Error Configuration Tests

- **WHEN** Zod validator checks the custom error map
- **THEN** it SHALL pass all test cases defined in the `zodConfig.test.ts` suite
