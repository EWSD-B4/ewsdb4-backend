.PHONY: help install dev build start test lint format clean docker-build docker-up docker-down docker-restart docker-rebuild docker-logs local-up local-down local-logs local-restart local-clean local-rebuild local-rebuild-app

help:
	@echo "Available commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make install         - Install dependencies"
	@echo "  make dev            - Run development server with hot reload"
	@echo "  make build          - Build the project for production"
	@echo "  make start          - Start production server"
	@echo "  make test           - Run tests with coverage"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint           - Run ESLint"
	@echo "  make lint-fix       - Run ESLint with auto-fix"
	@echo "  make format         - Format code with Prettier"
	@echo "  make format-check   - Check code formatting"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo "  make clean          - Clean build artifacts"
	@echo ""
	@echo "Docker (Production):"
	@echo "  make docker-build   - Build Docker images"
	@echo "  make docker-up      - Start Docker containers"
	@echo "  make docker-down    - Stop Docker containers"
	@echo "  make docker-restart - Restart Docker containers after code update"
	@echo "  make docker-rebuild - Rebuild and restart all containers"
	@echo "  make docker-logs    - View logs from all containers"
	@echo ""
	@echo "Docker (Local with MinIO):"
	@echo "  make local-up       - Start local Docker stack with MinIO (S3)"
	@echo "  make local-down     - Stop local Docker stack"
	@echo "  make local-logs     - View logs from local stack"
	@echo "  make local-restart  - Restart local stack"
	@echo "  make local-clean    - Stop and remove all local data"
	@echo "  make local-rebuild  - Rebuild local stack from scratch"
	@echo "  make local-rebuild-app - Rebuild app service only"

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

# Local Docker commands (with MinIO instead of AWS S3)
local-up:
	@echo "Starting local Docker stack with MinIO (local S3)..."
	docker-compose -f docker-compose.local.yml up -d
	@echo ""
	@echo "Services started successfully!"
	@echo "API: http://localhost:3000"
	@echo "MinIO Console: http://localhost:9001 (minioadmin/minioadmin)"
	@echo "RabbitMQ Management: http://localhost:15673 (guest/guest)"
	@echo ""

local-down:
	docker-compose -f docker-compose.local.yml down

local-logs:
	docker-compose -f docker-compose.local.yml logs -f --tail=100

local-restart:
	@echo "Restarting local Docker stack..."
	docker-compose -f docker-compose.local.yml restart
	@echo "Stack restarted!"

local-clean:
	@echo "Stopping and removing all local Docker data..."
	docker-compose -f docker-compose.local.yml down -v
	@echo "All local data removed!"

local-rebuild:
	@echo "Rebuilding local Docker stack from scratch..."
	docker-compose -f docker-compose.local.yml down -v
	docker-compose -f docker-compose.local.yml build --no-cache
	docker-compose -f docker-compose.local.yml up -d
	@echo "Local stack rebuilt and started!"

local-rebuild-app:
	@echo "Rebuilding app service..."
	docker-compose -f docker-compose.local.yml up -d --build app
	@echo "App rebuilt!"
