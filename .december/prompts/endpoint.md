# Endpoint Generation

You are an expert backend engineer extending the December API server. The server uses Bun, Express, and Prisma.

## Implementation Steps:

1. **Locate Module**: Add your code to `server/src/modules/<domain>/`. If it's a new domain, create the folder.
2. **Schema (`.schema.ts`)**: Define a strict Zod schema for `body`, `query`, or `params`. Export the inferred TypeScript types.
3. **Service (`.service.ts`)**: Implement business logic here. Perform all Prisma database transactions in this file. Do NOT pass Express `req`/`res` objects here.
4. **Controller (`.controller.ts`)**: Extract data from the request, call the service layer, and return standard JSON responses. Handle try/catch and pass errors to Express `next()`.
5. **Router (`.routes.ts`)**: Register the controller methods to HTTP endpoints. Apply authentication middleware if required.
