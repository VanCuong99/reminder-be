# Authentication API Guide

This document describes how to use the authentication APIs provided by the Momento_BE backend. The API supports user registration, login, logout, token refresh, profile retrieval, and social authentication (Google, Facebook).

## Endpoints

### 1. Register
- **URL:** `POST /auth/register`
- **Description:** Register a new user.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "username": "username",
    "password": "yourPassword"
  }
  ```
- **Response:**
  - `201 Created` on success
  - Returns user info and tokens

### 2. Login
- **URL:** `POST /auth/login`
- **Description:** Log in with email and password.
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "yourPassword"
  }
  ```
- **Response:**
  - `200 OK` on success
  - Example:
    ```json
    {
      "user": {
        "id": "string",
        "email": "user@example.com",
        "username": "username",
        "role": "USER"
      },
      "accessToken": "<jwt-access-token>",
      "refreshToken": "<jwt-refresh-token>",
      "csrfToken": "<csrf-token>",
      "message": "Login successful"
    }
    ```
  - Tokens are also set as HTTP-only cookies.

### 3. Logout
- **URL:** `POST /auth/logout`
- **Description:** Log out the current user and invalidate tokens.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `x-csrf-token: <csrfToken>`
- **Response:**
  - `200 OK` on success

### 4. Refresh Token
- **URL:** `POST /auth/refresh`
- **Description:** Get new access and refresh tokens using a valid refresh token.
- **Request Body:**
  ```json
  {
    "refreshToken": "<jwt-refresh-token>"
  }
  ```
- **Response:**
  - `200 OK` on success
  - Example:
    ```json
    {
      "user": {
        "id": "string",
        "email": "user@example.com",
        "username": "username",
        "role": "USER"
      },
      "accessToken": "<new-access-token>",
      "refreshToken": "<new-refresh-token>",
      "csrfToken": "<new-csrf-token>"
    }
    ```

### 5. Get Profile (Me)
- **URL:** `GET /auth/me`
- **Description:** Get the authenticated user's profile.
- **Headers:**
  - `Authorization: Bearer <accessToken>`
  - `x-csrf-token: <csrfToken>`
- **Response:**
  - `200 OK` on success
  - Returns user info

### 6. Social Login
#### Google
- **URL:** `GET /auth/google`
- **Description:** Redirects to Google for authentication.
- **Callback:** `GET /auth/google/callback`
- **Response:**
  - On success, returns user info and tokens as in the login response.

#### Facebook
- **URL:** `GET /auth/facebook`
- **Description:** Redirects to Facebook for authentication.
- **Callback:** `GET /auth/facebook/callback`
- **Response:**
  - On success, returns user info and tokens as in the login response.

## Token Handling
- **Access Token:** Used for authenticating API requests. Sent as a Bearer token and set as an HTTP-only cookie.
- **Refresh Token:** Used to obtain new access tokens. Also set as an HTTP-only cookie.
- **CSRF Token:** Returned in the response and must be sent in the `x-csrf-token` header for protected requests.

## Example Usage

**Login Request:**
```bash
curl -X POST https://your-api-domain/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "yourPassword"}'
```

**Authenticated Request:**
```bash
curl -X GET https://your-api-domain/auth/me \
  -H "Authorization: Bearer <accessToken>" \
  -H "x-csrf-token: <csrfToken>"
```

**Refresh Token:**
```bash
curl -X POST https://your-api-domain/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<jwt-refresh-token>"}'
```

## Notes
- Always store tokens securely. Access and refresh tokens are set as HTTP-only cookies for security.
- CSRF token must be included in the `x-csrf-token` header for state-changing requests.
- For social login, follow the redirect flow and handle the callback as described above.

For more details, refer to the API source code and controller documentation.
