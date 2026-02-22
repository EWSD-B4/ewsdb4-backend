.PHONY: help install dev build start test lint format clean docker-build docker-up docker-down docker-restart docker-rebuild docker-logs

help:
	@echo "Available commands:"
	@echo "  make install         - Install dependencies"
	@echo "  make dev            - Run development server with hot reload"
	@echo "  make build          - Build the project for production"
	@echo "  make start          - Start production server"
	@echo "  make test           - Run tests with coverage"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo "  make lint           - Run ESLint"
	@echo "  make lint-fix       - Run ESLint with auto-fix"
	@echo "  make format         - Format code with Prettier"
	@echo "  make format-check   - Check code formatting"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Clean build artifacts"
	@echo "  make docker-build   - Build Docker images"
	@echo "  make docker-up      - Start Docker containers"
	@echo "  make docker-down    - Stop Docker containers"
	@echo "  make docker-restart - Restart Docker containers after code update"
	@echo "  make docker-rebuild - Rebuild and restart all containers"
	@echo "  make docker-logs    - View logs from all containers"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

test:
	npm test

test-watch:
	npm run test:watch

lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

typecheck:
	npm run typecheck

clean:
	rm -rf dist coverage node_modules/.cache

docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-restart:
	@echo "Rebuilding and restarting containers after code update..."
	docker-compose build app worker-node
	docker-compose up -d --force-recreate app worker-node
	@echo "Containers restarted successfully!"

docker-rebuild:
	@echo "Rebuilding all containers from scratch..."
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo "All containers rebuilt and started!"

docker-logs:
	docker-compose logs -f --tail=100
