# Momento Backend

Day counter & reminder application built with NestJS, GraphQL, TypeORM, and PostgreSQL.

## Technologies

- **Framework**: NestJS v11
- **API**: GraphQL v16 with Apollo Server
- **Database**: PostgreSQL v15 with TypeORM v0.3
- **Container**: Docker & Docker Compose
- **Language**: TypeScript v5
- **Package Manager**: pnpm v8

## Features

- User Management
  - User registration
  - User authentication (coming soon)
- Day Counter
  - Create and manage important dates
  - Track days until/since specific events
- Reminders (coming soon)
  - Set up custom reminders
  - Notification system

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

## Prerequisites

- Node.js v20.11.1 (LTS)
- pnpm v8.15.4
- Docker & Docker Compose
- PostgreSQL v15

## Development Setup

### Node.js Version

This project uses Node.js v20.11.1. We recommend using nvm (Node Version Manager) to manage Node.js versions:

```bash
# Install specific Node.js version
nvm install 20.11.1

# Use the installed version
nvm use 20.11.1
```

### Installation

```bash
# Install dependencies
pnpm install
```

## Git Conventions

### Branch Naming Convention

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
DB_HOST=localhost          # Use 'postgres' for Docker
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=123
DB_NAME=momentobe
DEFAULT_DB=postgres       # For database creation script

# Application Configuration
PORT=3001
NODE_ENV=development
```

## Development Guide

### Code Style

- Follow NestJS best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused

### Testing (Coming Soon)

- Unit tests with Jest
- E2E tests with Supertest
- GraphQL testing

### Error Handling

- Use custom exception filters
- Proper error messages and codes
- Validation using class-validator

## Running the Application

### Development

```bash
# Run with Docker
docker-compose up

# Run locally
pnpm run start:dev
```

### Database Migrations

```bash
# Generate migration
pnpm run migration:generate src/infrastructure/database/migrations/[MigrationName]

# Run migrations
pnpm run migration:run

# Revert migrations
pnpm run migration:revert
```

## Deployment

### Docker

```bash
# Build and run containers
docker-compose up --build

# Run in detached mode
docker-compose up -d

# Stop containers
docker-compose down
```

### Production

```bash
# Build application
pnpm run build

# Start production server
pnpm run start:prod
```

## API Documentation

GraphQL Playground is available at:

- Docker: http://localhost:3002/graphql
- Local: http://localhost:3001/graphql

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

ISC
