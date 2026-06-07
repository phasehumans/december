# Skill: Database Migrations

**Context:** The project uses Prisma ORM connected to a local PostgreSQL container.

When you modify the database schema in `server/prisma/schema.prisma`, follow these exact steps to apply the migration locally:

1. Ensure your local Postgres container is running. If it's not, start it with:
   `./scripts/containers.sh start`

2. Change your working directory into the server folder:
   `cd server`

3. Generate and apply the Prisma migration:
   `bunx prisma migrate dev --name <descriptive_name>`

4. This command will update the database and automatically regenerate the TypeScript Prisma Client.
