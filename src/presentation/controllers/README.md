# REST API Controllers

This directory contains the REST API controllers for the Momento BE application. These controllers handle HTTP requests and serve as the interface between clients and the application's business logic.

## Structure

The controllers follow RESTful API design principles and are organized by resource:

- **UsersController**: Manages user resources (create, read, update)
- **AuthController**: Handles authentication operations (login)
- **DeviceTokenController**: Manages device tokens for push notifications
- **NotificationController**: Handles notification sending operations

## API Versioning

The API is versioned through URL paths (e.g., `/api/v1/users`). This allows for future changes without breaking existing client integrations.

## Authentication

Most endpoints require authentication through JWT tokens. Protected routes use the `@UseGuards(JwtAuthGuard)` decorator.

## Role-Based Access Control

Certain operations are restricted based on user roles using the `@Roles()` decorator along with the `RolesGuard`.

## Request/Response Format

### Success Response Structure

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2025-05-05T10:30:00.000Z"
}
```

### Paginated Response Structure

```json
{
  "success": true,
  "message": "Operation successful",
  "data": [ ... ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "totalPages": 10,
  "hasNext": true,
  "timestamp": "2025-05-05T10:30:00.000Z"
}
```

### Error Response Structure

```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ],
  "statusCode": 400,
  "path": "/api/v1/resource",
  "timestamp": "2025-05-05T10:30:00.000Z"
}
```

## Swagger Documentation

API documentation is available at `/api/docs` when the server is running.
