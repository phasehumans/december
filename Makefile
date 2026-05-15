.PHONY: dev build test lint format clean

dev:
	bun run dev

build:
	bun run build

test:
	bun test

lint:
	bunx eslint .

format:
	bunx prettier --write .

clean:
	rm -rf dist