# User Guide: Using API Event for Authenticated Users

This guide explains how authenticated users can interact with the Event API.

## Prerequisites

- You must have a valid user account.
- Obtain a JWT token via the authentication endpoint.

## Authentication

All requests require the `Authorization` header:

```http
Authorization: Bearer <your_jwt_token>
```

## API Endpoints

### 1. Get All Events

**Request:**

GET /api/v1/events
```

**Description:**  
Returns a list of all events accessible to the authenticated user.

---

### 2. Get Event by ID

**Request:**

```http
GET /api/v1/events/{id}
```

**Description:**  
Fetch details of a specific event.

---

### 3. Create a New Event

**Request:**

```http
POST /api/v1/events
Content-Type: application/json
```

**Body Example:**

```json
{
    "name": "Birthday Party",
    "description": "Annual birthday celebration with family and friends",
    "date": "2025-06-15T18:00:00.000Z",
    "category": "other",
    "isRecurring": false,
    "notificationSettings": {
        "reminders": [0],
        "enabled": true
    }
}
```

**Description:**  
Creates a new event. Only authenticated users can create events.

---

### 4. Update an Event

**Request:**

```http
PATCH /api/v1/events/{id}
Content-Type: application/json
```

**Body Example:**

```json
{
    "name": "Birthday Party",
    "description": "Annual birthday celebration with family and friends",
    "date": "2025-06-15T18:00:00.000Z",
    "category": "other",
    "isRecurring": false,
    "notificationSettings": {
        "reminders": [0],
        "enabled": true
    }
}
```

**Description:**  
Updates an existing event. Only the event owner or authorized users can update.

---

### 5. Delete an Event

**Request:**

```http
DELETE /api/v1/events/{id}
```

**Description:**  
Deletes an event. Only the event owner or authorized users can delete.

---

## Error Handling

- `401 Unauthorized`: Missing or invalid token.
- `403 Forbidden`: Insufficient permissions.
- `404 Not Found`: Event does not exist.

---

## Example: Fetch All Events

```bash
curl -H "Authorization: Bearer <your_jwt_token>" https://yourdomain.com/api/v1/events
```

---

For more details, refer to the API documentation or contact support.