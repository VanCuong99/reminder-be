## Request Body Example for Creating or Updating an Event

When creating or updating an event as a guest user, use the following JSON structure in the request body:

```json
{
    "name": "Birthday Party",
    "description": "Annual birthday celebration with family and friends",
    "date": "2025-06-15T18:00:00.000Z",
    "category": "other",
    "isRecurring": false,
    "notificationSettings": {
        "reminders": [
            {
                "enabled": true
            }
        ]
    },
}
```

**Field Descriptions:**
- `name`: Name of the event.
- `description`: Details about the event.
- `date`: Event date and time in ISO 8601 format.
- `category`: Event category (e.g., "other").
- `isRecurring`: Indicates if the event is recurring.
- `notificationSettings`: Notification preferences, such as reminders.

Adjust the fields as needed for your use case.
