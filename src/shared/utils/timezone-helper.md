# Timezone Handling in Momento API

This document explains how timezone detection works in the Momento API and provides best practices for ensuring correct timezone handling in your applications.

## Timezone Detection Order

When processing requests, the Momento API will try to detect the timezone in the following order:

1. `X-Timezone` header (recommended method)
2. Request body `timezone` field
3. Alternative headers: `Timezone` or `Time-Zone`
4. `Accept-Language` header (fallback to derive timezone from locale)
5. Default timezone (UTC in production, Asia/Ho_Chi_Minh in development)

## Best Practices for Client Applications

### For Web Browsers

Use the browser's built-in API to detect the user's timezone:

```javascript
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
```

Then include this timezone in your API requests:

```javascript
fetch('https://api.momento.com/guest-events', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Timezone': userTimezone, // Include timezone as a header
    },
    body: JSON.stringify({
        title: 'My Event',
        timezone: userTimezone, // Also include in the request body
        // ... other event details
    }),
});
```

### For Mobile Applications

On mobile platforms, get the device's timezone and include it in requests:

**iOS (Swift):**

```swift
let timezone = TimeZone.current.identifier
// Then include in API requests
```

**Android (Kotlin):**

```kotlin
val timezone = TimeZone.getDefault().id
// Then include in API requests
```

### For Server-to-Server Communications

When making server-to-server API calls, always explicitly specify the timezone to avoid relying on detection:

```javascript
const event = {
    title: 'Server Generated Event',
    timezone: 'UTC', // Or a specific timezone
    // ... other event details
};
```

## Testing Timezone Detection

Use our test endpoint to verify timezone detection:

```
GET /guest-events/detect-timezone
```

Include different combinations of headers to see how the system detects timezones:

```javascript
fetch('https://api.momento.com/guest-events/detect-timezone', {
    headers: {
        'X-Timezone': 'America/New_York',
    },
});
```

## Common Issues and Solutions

1. **Events created in UTC instead of local timezone**

    - Ensure you're including the `X-Timezone` header in your requests
    - Verify the timezone is in IANA format (e.g., "America/New_York", not "EDT" or "GMT-4")

2. **Inconsistent timezones between authenticated and guest users**

    - For authenticated users, set their timezone preference in their profile
    - For guest users, always include the `X-Timezone` header

3. **Events showing at wrong times in the UI**
    - Make sure your client application is using the same timezone for display as was used in creation
    - When fetching events, convert times to the user's current timezone for display

## Valid Timezone Formats

All timezones must be valid IANA timezone database names. Common examples include:

- `America/New_York`
- `Europe/London`
- `Asia/Tokyo`
- `Australia/Sydney`
- `Pacific/Auckland`
- `Asia/Ho_Chi_Minh`

Do not use abbreviations like EST, PST, or GMT+8, as these are not supported.
