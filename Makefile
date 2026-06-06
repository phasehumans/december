.PHONY: install dev server web runtime format check-format lint lint-fix test test-integration clean db-start db-stop migrate studio

install:
	bun install

dev:
	./scripts/start.sh

server:
	cd server && bun run dev

web:
	cd web && bun run dev

runtime:
	cd runtime && cargo run

db-start:
	./scripts/containers.sh start

db-stop:
	./scripts/containers.sh stop

migrate:
	cd server && bunx prisma migrate dev

studio:
	cd server && bun run studio

format:
	bun run format

check-format:
	bun run format:check

lint:
	bun run lint

lint-fix:
	bun run lint:fix

test:
	./scripts/test.sh

clean:
	rm -rf node_modules server/node_modules web/node_modules
	rm -rf server/dist web/dist
	cd runtime && cargo clean