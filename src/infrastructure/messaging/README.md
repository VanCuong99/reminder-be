# Messaging Infrastructure

This directory contains messaging implementations for the application.

## Purpose

The messaging layer is responsible for:

- Asynchronous communication between services
- Event-driven architecture
- Notification delivery

## Implementation

Currently, this directory is empty as messaging is not yet implemented.
Future implementations may include:

- RabbitMQ
- Kafka
- WebSockets
- Email service
- Push notifications

# Firebase Notification Integration Guide

## Backend Setup

1. Add Firebase configuration to your `.env` file:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Key Here\n-----END PRIVATE KEY-----"
```

2. Register device token mutation:

```graphql
mutation RegisterDeviceToken($input: RegisterDeviceTokenInput!) {
    registerDeviceToken(input: $input) {
        id
        token
        deviceType
    }
}
```

## Web Client Integration

1. Install Firebase SDK:

```bash
npm install firebase
```

2. Initialize Firebase in your web app:

```typescript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: 'your-api-key',
    authDomain: 'your-auth-domain',
    projectId: 'your-project-id',
    messagingSenderId: 'your-sender-id',
    appId: 'your-app-id',
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get token
async function requestNotificationPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: 'your-vapid-key',
            });

            // Send token to backend
            await registerDeviceToken({
                variables: {
                    input: {
                        token,
                        deviceType: 'web',
                    },
                },
            });
        }
    } catch (err) {
        console.error('Failed to get notification permission:', err);
    }
}

// Handle foreground messages
onMessage(messaging, payload => {
    console.log('Received foreground message:', payload);
    // Show notification using the Notifications API
    new Notification(payload.notification.title, {
        body: payload.notification.body,
    });
});
```

## Mobile Integration (React Native)

1. Install required packages:

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

2. Initialize Firebase Messaging:

```typescript
import messaging from '@react-native-firebase/messaging';

async function requestUserPermission() {
    const authStatus = await messaging().requestPermission();
    const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED;

    if (enabled) {
        const token = await messaging().getToken();
        // Send token to backend
        await registerDeviceToken({
            variables: {
                input: {
                    token,
                    deviceType: Platform.OS,
                },
            },
        });
    }
}

// Handle background messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Received background message:', remoteMessage);
});

// Handle foreground messages
messaging().onMessage(async remoteMessage => {
    console.log('Received foreground message:', remoteMessage);
});

// Handle token refresh
messaging().onTokenRefresh(token => {
    // Send new token to backend
    registerDeviceToken({
        variables: {
            input: {
                token,
                deviceType: Platform.OS,
            },
        },
    });
});
```

## Testing Notifications

You can test notifications using the GraphQL API:

```graphql
# Send to specific user
mutation {
    sendNotificationToUser(
        userId: "user-id"
        notification: { title: "Test Notification", body: "This is a test notification" }
    ) {
        success
        error
    }
}

# Broadcast to all users
mutation {
    broadcastNotification(
        notification: { title: "Broadcast Test", body: "This is a broadcast notification" }
    ) {
        success
        error
    }
}
```
