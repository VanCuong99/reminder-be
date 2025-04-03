# Domain Layer

This layer represents the core business logic and rules of the application. It should be independent of other layers and frameworks.

## Structure

### /entities

Contains domain entities that represent core business objects. These are rich domain models with behavior and business rules.

Current entities:

- User: Represents user data and behavior

### /repositories

Contains repository interfaces that define how to access and persist domain entities.

### /value-objects

Contains immutable value objects that represent concepts in our domain.

## Best Practices

- Keep entities focused on business rules
- Use value objects for immutable concepts
- Follow DDD (Domain-Driven Design) principles
- Entities should validate their invariants
