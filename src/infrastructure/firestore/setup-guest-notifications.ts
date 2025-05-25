/**
 * Script to set up required Firestore collections for guest notifications
 *
 * This script creates the necessary Firestore collections and documents
 * for the guest notification system to work properly.
 */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Set up the Firebase Admin SDK
async function initializeFirebase() {
    try {
        // Check for existing Firebase apps
        if (admin.apps.length === 0) {
            // Try to load config from service account file
            const serviceAccountPath =
                process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
                path.resolve(__dirname, '../../../firebase-service-account.json');

            // Configure Firebase app
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                console.log('Firebase initialized with service account file');
            } else {
                // Try environment variables
                const projectId = process.env.FIREBASE_PROJECT_ID;
                const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
                const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

                if (projectId && clientEmail && privateKey) {
                    admin.initializeApp({
                        credential: admin.credential.cert({
                            projectId,
                            clientEmail,
                            privateKey,
                        }),
                    });
                    console.log('Firebase initialized with environment variables');
                } else {
                    throw new Error(
                        'Firebase credentials not found. Please provide a service account file or set environment variables.',
                    );
                }
            }
        }

        return admin.firestore();
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        process.exit(1);
    }
}

// Set up the necessary collections for guest notifications
async function setupGuestNotifications(firestore) {
    try {
        // 1. Check for guest_devices collection
        const guestDevicesRef = firestore.collection('guest_devices');

        // 2. Create a test device document if it doesn't exist
        const testDeviceId = 'test_device_' + Date.now().toString().substring(8);
        const testDeviceRef = guestDevicesRef.doc(testDeviceId);

        // Check if it exists
        const doc = await testDeviceRef.get();

        if (!doc.exists) {
            // Create the test device
            await testDeviceRef.set({
                deviceId: testDeviceId,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                isTest: true,
                platform: 'Firebase Script',
            });
            console.log(`Created test device: ${testDeviceId}`);

            // Create test notification
            const notificationsRef = testDeviceRef.collection('notifications');
            await notificationsRef.add({
                title: 'Welcome to Momento',
                body: 'Your guest notifications are working!',
                status: 'unread',
                type: 'system',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 30 * 86400000), // 30 days
            });
            console.log('Created test notification');
        } else {
            console.log(`Test device already exists: ${testDeviceId}`);

            // Check if the notifications collection exists
            const notificationsRef = testDeviceRef.collection('notifications');
            const notifications = await notificationsRef.limit(1).get();

            if (notifications.empty) {
                await notificationsRef.add({
                    title: 'Welcome to Momento',
                    body: 'Your guest notifications are working!',
                    status: 'unread',
                    type: 'system',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: new Date(Date.now() + 30 * 86400000), // 30 days
                });
                console.log('Created test notification');
            } else {
                console.log('Test notification already exists');
            }
        }

        // Create security rules
        console.log(`
IMPORTANT: Make sure your Firestore security rules include:
--------------------------------
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Guest device notifications
    match /guest_devices/{deviceId} {
      allow read: if request.auth != null && request.auth.uid == deviceId;
      
      match /notifications/{notificationId} {
        allow read: if request.auth != null && request.auth.uid == deviceId;
      }
    }
  }
}
--------------------------------
`);

        return {
            success: true,
            testDeviceId,
        };
    } catch (error) {
        console.error('Error setting up guest notifications:', error);
        return {
            success: false,
            error: error.message,
        };
    }
}

// Main function
async function main() {
    try {
        console.log('Setting up Firestore for guest notifications...');

        const firestore = await initializeFirebase();
        const result = await setupGuestNotifications(firestore);

        if (result.success) {
            console.log(`
Guest notification setup completed successfully!
Test device ID: ${result.testDeviceId}

To test guest notifications, use:
1. Add this device ID to your database: ${result.testDeviceId}
2. Register a Firebase token for this device
3. Send a test notification to this device

You can check the Firebase console to verify the collections are set up correctly.`);
        }
    } catch (error) {
        console.error('Setup failed:', error);
    }
}

// Run the script
main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
