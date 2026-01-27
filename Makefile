.PHONY: help install dev build start test lint format clean docker-build docker-up docker-down

help:
	@echo "Available commands:"
	@echo "  make install       - Install dependencies"
	@echo "  make dev          - Run development server with hot reload"
	@echo "  make build        - Build the project for production"
	@echo "  make start        - Start production server"
	@echo "  make test         - Run tests with coverage"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make lint         - Run ESLint"
	@echo "  make lint-fix     - Run ESLint with auto-fix"
	@echo "  make format       - Format code with Prettier"
	@echo "  make format-check - Check code formatting"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-up    - Start Docker containers"
	@echo "  make docker-down  - Stop Docker containers"

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
	docker build -t ewsdb4-api .

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down
