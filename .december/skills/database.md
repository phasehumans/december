# Skill: Database Workflows

The December stack uses PostgreSQL, managed by Prisma.

## Local Setup
Ensure Docker is running, then execute `./scripts/containers.sh start` to launch the local Postgres container.

## Schema Modifications
1. Modify `server/prisma/schema.prisma`.
2. Run `cd server && bunx prisma migrate dev --name <change_description>`.
3. This creates a migration file and regenerates the Prisma Client.

## Edge Cases
If the local database gets corrupted, tear down the container using `docker rm -f <container_name>` and restart the containers script to get a fresh instance.
