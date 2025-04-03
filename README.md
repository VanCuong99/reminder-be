# Momento Backend

Day counter & reminder application built with NestJS, GraphQL, TypeORM, and PostgreSQL.

## Table of Contents

- [Technologies](#technologies)
- [Features](#features)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Git Conventions](#git-conventions)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Deployment](#deployment)

## Technologies

- **Core Framework**: NestJS v11
- **API Layer**: GraphQL v16 with Apollo Server
- **Database**: PostgreSQL v15
- **ORM**: TypeORM v0.3
- **Container**: Docker & Docker Compose
- **Language**: TypeScript v5
- **Package Manager**: pnpm v8
- **Testing**: Jest
- **Documentation**: GraphQL Playground

## Features

### User Management

- Authentication & Authorization
    - User registration with validation
    - JWT-based authentication
    - Role-based access control (coming soon)
- User Operations
    - CRUD operations for users
    - Advanced user search
    - Paginated user queries with sorting
    - Profile management

### Data Management

- Generic Pagination Support
    - Configurable page size
    - Dynamic sorting options
    - Total count tracking
    - Page information (prev/next)
- Type-safe GraphQL Implementation
    - Strong typing with TypeScript
    - Input validation
    - Error handling
    - Response formatting

### Day Counter (In Progress)

- Event Tracking
    - Create and manage important dates
    - Calculate days until/since events
    - Recurring events support
- Customization
    - Event categories
    - Custom reminders
    - Notification preferences

### Coming Soon

## Project Structure

src/
├── presentation/ # Interface adapters layer
│ ├── controllers/ # REST controllers (if needed)
│ ├── graphql/ # GraphQL components
│ │ ├── resolvers/ # GraphQL resolvers
│ │ ├── types/ # GraphQL types and inputs
│ └── dto/ # Data Transfer Objects
├── application/ # Application business rules
│ ├── services/ # Application services
│ ├── interfaces/ # Port interfaces
│ └── use-cases/ # Use cases implementations
├── domain/ # Enterprise business rules
│ ├── entities/ # Domain entities
│ ├── repositories/ # Repository interfaces
│ └── value-objects/ # Value objects
├── infrastructure/ # Frameworks & drivers layer
│ ├── database/ # Database configurations and migrations
│ └── cache/ # Caching implementations (future use)
└── shared/ # Shared kernel
| ├── constants/ # Constants and enums
| └── utils/ # Utility functions

## Development Setup

### Prerequisites

- Node.js v20.11.1 (LTS)
- pnpm v8.15.4
- Docker & Docker Compose
- PostgreSQL v15

### Installation Steps

```bash
# Install specific Node.js version
nvm install 20.11.1

# Install dependencies
pnpm install
```

# Setup environment

cp .env.example .env

# Start development server

pnpm run start:dev

````
## Code Quality & CI/CD

### Code Quality Tools

- **ESLint**: JavaScript/TypeScript linting
- **Prettier**: Code formatting
- **SonarQube**: Code quality and security analysis
- **Husky**: Git hooks for code quality checks
- **lint-staged**: Run linters on git staged files

### Quality Standards

- Minimum test coverage: 80%
- Zero critical or blocker issues
- No code smells
- No security hotspots
- Maximum duplicated lines: 3%

### CI/CD Pipeline

Our GitHub Actions workflow includes:

1. **Code Quality**
   - ESLint check
   - Prettier check
   - Unit tests with coverage
   - SonarQube analysis

2. **Pre-commit Checks**
   - Code formatting
   - Linting
   - Unit tests
   - Type checking

### SonarQube Integration

SonarQube is configured to analyze:
- Code quality
- Test coverage
- Code duplication
- Security vulnerabilities
- Code smells

Access the SonarQube dashboard at: `[Your SonarQube URL]`

### Running Quality Checks Locally

```bash
# Format code
pnpm run format

# Lint code
pnpm run lint

# Run tests with coverage
pnpm run test:cov

# Run all checks (pre-commit)
pnpm run pre-commit
````

Branches should be named using the following format:

```
<type>/<ticket-number>-<short-description>
```

Types:

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes for production
- `refactor/` - Code refactoring
- `chore/` - Maintenance tasks
- `test/` - Test-related changes
- `docs/` - Documentation updates

Examples:

```
feature/MOM-123-add-user-authentication
bugfix/MOM-124-fix-date-calculation
refactor/MOM-125-improve-error-handling
```

### Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi colons, etc)
- `refactor`: Code refactoring
- `test`: Adding missing tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD related changes

Examples:

```
feat(auth): implement JWT authentication
fix(date): correct date calculation logic
docs(readme): update installation instructions
refactor(user): improve error handling in user service
```

Scope (optional):

- auth
- user
- reminder
- date
- db
- config
- etc.

Guidelines:

- Use imperative mood in description ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Keep description under 72 characters
- Describe what the change does, not what you did

## Environment Setup

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_NAME=momentobe
DEFAULT_DB=postgres

# Application Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your-secret-key
```

## Testing

### Test Structure

```
src/
├── application/
│   ├── services/
│   │   ├── auth/
│   │   │   └── auth.service.spec.ts
│   │   ├── base/
│   │   │   └── base.service.spec.ts
│   │   └── users/
│   │       └── user.service.spec.ts
│   └── interfaces/
├── infrastructure/
│   ├── auth/
│   │   ├── decorators/
│   │   │   └── current-user.decorator.spec.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.spec.ts
│   │   │   └── roles.guard.spec.ts
│   │   └── strategies/
│   │       └── jwt.strategy.spec.ts
│   └── database/
├── presentation/
│   └── graphql/
│       └── resolvers/
│           ├── auth.resolver.spec.ts
│           └── user.resolver.spec.ts
└── shared/
```

### Running Tests

```bash
# Run all tests
pnpm run test

# Run specific test file
pnpm run test src/path/to/test/file

# Run tests with coverage
pnpm run test:cov

# Run e2e tests
pnpm run test:e2e
```

### Test Coverage Goals

- Unit Tests: 80%+ coverage
- Integration Tests: Key workflows
- E2E Tests: Critical user journeys

## Code Quality

### SonarQube Analysis

Để chạy phân tích code với SonarQube:

1. Đảm bảo SonarQube server đang chạy (mặc định tại http://localhost:9000)

2. Cài đặt SonarQube Scanner:

```bash
pnpm add -D sonarqube-scanner
```

3. Chạy test với coverage:

```bash
pnpm test:cov
```

4. Chạy SonarQube analysis:

Khởi động Docker Desktop và chắc chắn rằng container của sonarqube hoạt động

```bash
docker run --rm --network=host -e SONAR_HOST_URL="http://localhost:9000" -e SONAR_TOKEN="YOUR_SONAR_TOKEN" -v "%cd%:/usr/src" sonarsource/sonar-scanner-cli
```

## API Documentation

### GraphQL Playground

- Development: http://localhost:3001/graphql
- Docker: http://localhost:3002/graphql

### Sample Queries

```graphql
# Get paginated users
query {
    users(pagination: { page: 1, limit: 10, sortBy: "createdAt", sortDirection: "DESC" }) {
        items {
            id
            username
            email
            createdAt
        }
        total
        page
        totalPages
        hasNext
        hasPrevious
    }
}

# Create new user
mutation {
    createUser(
        input: { username: "testuser", email: "test@example.com", password: "password123" }
    ) {
        id
        username
        email
        createdAt
    }
}
```

## Deployment

### Docker Deployment

```bash
# Build and start containers
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

### Production Deployment

```bash
# Build application
pnpm run build

# Start production server
pnpm run start:prod
```

## Contributing

Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
