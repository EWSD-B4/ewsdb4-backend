# EWSDB4 - Professional Backend API

A production-ready backend API built with Node.js, Express, TypeScript, MySQL, and Redis. This project follows industry best practices and is designed for scalability, maintainability, and team collaboration.

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development](#-development)
- [Authentication](#-authentication)
- [API Endpoints](#-api-endpoints)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Architecture](#-architecture)
- [Contributing](#-contributing)
- [Troubleshooting](#-troubleshooting)

## 🚀 Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MySQL 8.0
- **Cache**: Redis 7
- **Authentication**: JWT + bcrypt
- **Testing**: Jest + Supertest
- **Code Quality**: ESLint + Prettier
- **CI/CD**: GitHub Actions
- **Containerization**: Docker + Docker Compose

## ⚡ Quick Start

### Prerequisites

- Node.js >= 18.0.0
- MySQL 8.0
- Redis 7

### Installation

```bash
# 1. Clone and install
git clone <repository-url>
cd ewsdb4
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 3. Set up database
mysql -u root -p < scripts/setup-db.sql

# 4. Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api/v1`

### Using Docker (Alternative)

```bash
cp .env.example .env
docker-compose up -d
```

## 📁 Project Structure

```
ewsdb4/
├── src/
│   ├── config/                 # Configuration management
│   ├── middleware/             # Express middleware
│   │   ├── auth.ts            # JWT authentication
│   │   ├── errorHandler.ts   # Global error handling
│   │   ├── validation.ts     # Request validation
│   │   └── asyncHandler.ts   # Async error wrapper
│   ├── modules/               # Feature modules (domain-driven)
│   │   ├── auth/             # Authentication module
│   │   └── user/             # User module
│   ├── routes/               # Route aggregation
│   ├── shared/               # Shared utilities
│   │   ├── database/         # MySQL connection pool
│   │   ├── cache/           # Redis client wrapper
│   │   └── logger/          # Winston logger
│   ├── utils/               # Utility functions
│   │   ├── jwt.ts          # JWT utilities
│   │   └── password.ts     # Password hashing
│   ├── types/              # TypeScript type definitions
│   ├── app.ts             # Express app setup
│   └── index.ts           # Server entry point
├── scripts/               # Database setup scripts
├── .github/workflows/     # CI/CD pipeline
└── docker-compose.yml    # Docker services
```

### Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
import config from '@/config';
import { User } from '@/modules/user/user.types';
import logger from '@/shared/logger';
import { authenticate } from '@/middleware/auth';
```

## 🛠 Development

### Available Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build for production
npm start                # Start production server

# Testing
npm test                 # Run tests with coverage
npm run test:watch       # Run tests in watch mode

# Code Quality
npm run lint             # Check for linting errors
npm run lint:fix         # Fix linting errors
npm run format           # Format code with Prettier
npm run typecheck        # Check TypeScript types

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop all services
docker-compose logs -f   # View logs
```

### Makefile Commands

```bash
make help           # Show all available commands
make install        # Install dependencies
make dev            # Run development server
make test           # Run tests
make lint           # Run linter
make docker-up      # Start with Docker
```

## 🔐 Authentication

This project uses **JWT (JSON Web Tokens)** for authentication with bcrypt password hashing.

### Authentication Flow

```
1. User registers/logs in
2. Server validates credentials
3. Server generates JWT token
4. Client stores token (localStorage/cookies)
5. Client sends token in Authorization header
6. Server validates token on protected routes
```

### API Endpoints

#### Register

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "1",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Login

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Get Current User (Protected)

```bash
GET /api/v1/auth/me
Authorization: Bearer <your-token>
```

### Protecting Routes

```typescript
import { authenticate } from '@/middleware/auth';

// Public route
router.get('/', userController.getAllUsers);

// Protected route - requires authentication
router.get('/profile', authenticate, userController.getProfile);
```

### Accessing Authenticated User

```typescript
getProfile = asyncHandler(async (req: Request, res: Response) => {
  // req.user is available after authenticate middleware
  const userId = req.user!.id;
  const user = await userService.getUserById(userId);

  res.json({ success: true, data: user });
});
```

### Security Best Practices

1. **JWT Secret**: Change in production

   ```bash
   # Generate a strong secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Token Expiration**: Configure in `.env`

   ```env
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d
   ```

3. **Password Hashing**: Automatically handled with bcrypt (10 salt rounds)

4. **HTTPS**: Always use HTTPS in production

## 📡 API Endpoints

Base URL: `http://localhost:3000/api/v1`

### Health Check

```bash
GET /health
```

### Authentication

| Method | Endpoint         | Description       | Auth Required |
| ------ | ---------------- | ----------------- | ------------- |
| POST   | `/auth/register` | Register new user | No            |
| POST   | `/auth/login`    | Login user        | No            |
| GET    | `/auth/me`       | Get current user  | Yes           |

### Users

| Method | Endpoint     | Description    | Auth Required |
| ------ | ------------ | -------------- | ------------- |
| GET    | `/users`     | Get all users  | No            |
| GET    | `/users/:id` | Get user by ID | No            |
| POST   | `/users`     | Create user    | No            |
| PUT    | `/users/:id` | Update user    | No            |
| DELETE | `/users/:id` | Delete user    | No            |

### Response Format

**Success:**

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error:**

```json
{
  "success": false,
  "message": "Error description"
}
```

### Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `500 Internal Server Error`: Server error

## 🧪 Testing

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- user.service.test.ts
```

### Test Structure

```typescript
describe('UserService', () => {
  it('should create a user', async () => {
    const userData = { email: 'test@example.com', name: 'Test' };
    const result = await userService.createUser(userData);
    expect(result).toBeDefined();
  });
});
```

### Testing with cURL

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Access protected route
TOKEN="your-token-here"
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## 🚢 Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build the Docker image
docker build -t ewsdb4-api .

# Run the container
docker run -p 3000:3000 --env-file .env ewsdb4-api
```

### Environment Variables

Key environment variables for production:

```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Other
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
```

## 🏗 Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│         HTTP Layer (Express)        │
│  Routes → Controllers → Middleware  │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│        Business Logic Layer         │
│           Services                  │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│        Data Access Layer            │
│         Repositories                │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│      Infrastructure Layer           │
│   Database, Cache, External APIs    │
└─────────────────────────────────────┘
```

### Design Patterns

1. **Repository Pattern**: Abstracts data access
2. **Dependency Injection**: Singleton pattern for services
3. **Factory Pattern**: Centralized configuration
4. **Middleware Pattern**: Cross-cutting concerns

### Request Flow

```
HTTP Request
  ↓
Express Middleware (CORS, Helmet, Body Parser)
  ↓
Route Handler
  ↓
Validation Middleware
  ↓
Authentication Middleware (if protected)
  ↓
Controller
  ↓
Service (Business Logic)
  ↓
Repository (Data Access)
  ↓
Database/Cache
  ↓
Response
```

## 📝 Contributing

### Commit Message Convention

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

[optional body]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(auth): add JWT authentication
fix(user): resolve email validation bug
docs(readme): update installation instructions
```

### Code Style

- Use TypeScript strict mode
- Always define return types for functions
- Use async/await instead of promises
- Handle errors properly with try-catch
- Keep functions small and focused

### Pull Request Process

1. Create a feature branch from `develop`
2. Make your changes following the code style
3. Add tests for new functionality
4. Ensure CI pipeline passes
5. Request review from team members
6. Merge after approval

### Before Committing

```bash
npm run typecheck    # Type checking
npm run lint         # Linting
npm test             # Run tests
```

## 🔧 Troubleshooting

### Path Alias Errors

**Problem:** `Cannot find module '@/config'`

**Solution:**

```bash
npm install
# Restart your IDE
# WebStorm: File → Invalidate Caches / Restart
# VS Code: Cmd+Shift+P → "Reload Window"
```

### MySQL Connection Error

**Solution:**

1. Check if MySQL is running: `mysql -u root -p`
2. Verify credentials in `.env`
3. Create database: `mysql -u root -p < scripts/setup-db.sql`

### Redis Connection Error

**Solution:**

1. Check if Redis is running: `redis-cli ping`
2. Start Redis:

   ```bash
   # macOS
   brew services start redis

   # Linux
   sudo systemctl start redis

   # Docker
   docker run -d -p 6379:6379 redis:7-alpine
   ```

### Port Already in Use

**Solution:**

```bash
# Change port in .env
PORT=3000

# Or kill the process
kill -9 $(lsof -ti:3000)
```

### TypeScript Build Errors

**Solution:**

```bash
# Check for type errors
npm run typecheck

# Clean and rebuild
rm -rf dist node_modules package-lock.json
npm install
npm run build
```

### IDE Not Recognizing Path Aliases

**WebStorm:**

1. Right-click `tsconfig.json` → "Set as TypeScript Configuration File"
2. Restart IDE

**VS Code:**

1. Cmd+Shift+P → "TypeScript: Select TypeScript Version"
2. Choose "Use Workspace Version"

## 🔄 CI/CD Pipeline

The project uses GitHub Actions for continuous integration:

### Pipeline Steps

1. Code Checkout
2. Dependency Installation
3. Linting
4. Type Checking
5. Format Check
6. Testing with coverage
7. Build
8. Security Audit

### Triggers

- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MySQL Documentation](https://dev.mysql.com/doc/)
- [Redis Documentation](https://redis.io/docs/)
- [JWT.io](https://jwt.io/)
- [Jest Testing Framework](https://jestjs.io/)

## 📄 License

This project is private and intended for educational purposes as a final year group project.

## 👥 Team

[Add your team members here]

## 📞 Support

For questions or issues, please contact your team members or create an issue in the repository.

---

**Happy Coding! 🚀**
