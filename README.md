# Momento Backend

Day counter & reminder application built with NestJS, GraphQL, TypeORM, and PostgreSQL.

## Technologies

- **Framework**: NestJS v11
- **API**: GraphQL v16 with Apollo Server
- **Database**: PostgreSQL v15 with TypeORM v0.3
- **Container**: Docker & Docker Compose
- **Language**: TypeScript v5

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

- Node.js (v20+)
- Docker & Docker Compose
- PostgreSQL

## Installation

```bash
# Install dependencies
npm install
```

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
npm run start:dev
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate src/infrastructure/database/migrations/[MigrationName]

# Run migrations
npm run migration:run

# Revert migrations
npm run migration:revert
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
npm run build

# Start production server
npm run start:prod
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
