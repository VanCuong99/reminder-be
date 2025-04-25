# Presentation Layer

This layer handles the interface between the application and external clients through GraphQL APIs.

## Structure

### /graphql

Contains GraphQL-specific implementations:

- Resolvers: Handle GraphQL operations
- Types: Define GraphQL types
- Inputs: Define input types for mutations
- Outputs: Define response types

### /dto

Data Transfer Objects for structuring API requests and responses.

## Best Practices

- Keep resolvers thin
- Use DTOs for data validation
- Implement proper error handling
- Document API endpoints
