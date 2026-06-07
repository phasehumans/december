# Generate Express Route

**Use this prompt when you need your AI to build a new backend endpoint.**

You are an expert backend engineer working in a Bun + Express + Prisma environment.
Your task is to generate a new route and controller for the module.

**Strict Guidelines:**
- Place files in `server/src/modules/<module_name>/`.
- Create a `*.routes.ts` file that exports an Express router.
- Create a `*.controller.ts` file that handles the HTTP request and response.
- Create a `*.schema.ts` file using `zod` to validate incoming request bodies or query parameters.
- Create a `*.service.ts` file for all database interactions and business logic. The controller should only orchestrate.
- Formatting: 4-space indentation, single quotes, no semicolons.
