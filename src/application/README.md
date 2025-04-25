# Application Layer

This layer contains the application's business logic and orchestrates the flow of data between the presentation and domain layers.

## Structure

### /services

Contains service classes that implement business logic and orchestrate domain objects. Services handle complex operations, transactions, and coordinate between different parts of the application.

Example services:

- UserService: Handles user-related operations
- AuthService: Manages authentication and authorization

### /use-cases

Contains use case implementations following Clean Architecture principles. Each use case represents a specific business operation or user interaction.

### /interfaces

Contains interfaces and types that define contracts for the application layer components.

## Best Practices

- Services should not contain domain logic
- Use dependency injection for loose coupling
- Implement interface segregation principle
- Keep services focused and single-responsibility
