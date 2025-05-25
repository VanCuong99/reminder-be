import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private firestore: Firestore;
    private readonly retryAttempts = 3;
    private readonly retryDelay = 300; // ms
    private readonly DAYS_IN_SECONDS = 86400; // seconds in a day
    private readonly DEFAULT_EXPIRATION_DAYS = 30;

    constructor(private readonly configService: ConfigService) {}

    onModuleInit() {
        this.initializeFirebase();
    }

    /**
     * Initialize Firebase app with proper configuration
     *
     * This method has been refactored to reduce cognitive complexity and improve error handling
     */
    private async initializeFirebase() {
        try {
            // Skip if already initialized
            if (admin.apps.length > 0) {
                this.logger.debug('Firebase app already initialized, reusing existing app');
                await this.initializeFirestore();
                return;
            }

            // Get Firebase configuration
            const firebaseConfig = await this.getFirebaseConfig();

            if (!firebaseConfig) {
                await this.initializeDevelopmentMode();
                return;
            }

            // Initialize with the configuration
            await this.initializeWithConfig(firebaseConfig);
        } catch (error) {
            this.logger.error(`Firebase initialization failed: ${error.message}`);
            // We'll create a mock firestore object to prevent null reference errors
            this.createMockFirestore();
        }
    }

    /**
     * Initialize Firestore after Firebase app is initialized
     */
    private async initializeFirestore() {
        const configProjectId = this.configService.get('FIREBASE_PROJECT_ID');
        const appProjectId = admin.apps.length > 0 ? admin.app().options.projectId : undefined;
        const effectiveProjectId = appProjectId || configProjectId;

        try {
            this.firestore = admin.firestore();

            if (!effectiveProjectId) {
                this.logger.error(
                    'Project ID is undefined. Cannot initialize Firestore without a project ID.',
                );
                throw new Error('Firebase project ID is undefined');
            }

            this.logger.debug(
                `Attempting to connect to Firestore with project ID: ${effectiveProjectId}`,
            );

            // Try a basic Firestore operation to verify the connection
            await this.verifyFirestoreConnection(effectiveProjectId);
        } catch (firestoreError) {
            this.logger.error(`Firestore initialization failed: ${firestoreError.message}`);
            this.handleFirestoreInitError(effectiveProjectId);
        }
    }

    /**
     * Verify Firestore connection with a basic write operation
     */
    private async verifyFirestoreConnection(projectId: string) {
        try {
            const healthCollection = this.firestore.collection('_health_check');
            const healthDoc = healthCollection.doc('status');
            await healthDoc.set({ timestamp: new Date().toISOString(), status: 'ok' });

            this.logger.log('Firebase initialized and Firestore connection verified successfully');
        } catch (error) {
            this.handleFirestoreConnectionError(error, projectId);
            throw error; // Re-throw to be caught by the outer catch
        }
    }

    /**
     * Handle Firestore connection errors with proper logging
     */
    private handleFirestoreConnectionError(error: any, projectId: string) {
        if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
            this.logger.error(
                'Firestore service not found or not enabled. This usually means either:\n' +
                    '1. The Firestore service is not enabled for your project in the Firebase console\n' +
                    '2. The service account lacks permissions to access Firestore\n' +
                    `Please visit https://console.firebase.google.com/project/${projectId}/firestore to enable Firestore`,
            );
        } else {
            this.logger.error(`Firestore operation failed: ${error.message} (Code: ${error.code})`);
        }
    }

    /**
     * Handle Firestore initialization error
     */
    private handleFirestoreInitError(projectId?: string) {
        // Attempt to determine if the database exists
        if (projectId) {
            this.logger.warn(
                `Check that Firestore is enabled for project ${projectId} at:\n` +
                    `https://console.firebase.google.com/project/${projectId}/firestore`,
            );
        }

        this.createMockFirestore();
    }

    /**
     * Get Firebase configuration from environment variables
     */
    private async getFirebaseConfig() {
        // Try to get FIREBASE_CONFIG first
        let firebaseConfig = this.configService.get('FIREBASE_CONFIG');

        if (firebaseConfig) {
            this.logger.debug('Using Firebase config from FIREBASE_CONFIG environment variable');
            return this.parseFirebaseConfig(firebaseConfig);
        }

        // Build config from individual environment variables
        return this.buildConfigFromEnvVars();
    }

    /**
     * Parse Firebase config if it's a string
     */
    private parseFirebaseConfig(firebaseConfig: any): any {
        if (typeof firebaseConfig === 'string') {
            try {
                const parsedConfig = JSON.parse(firebaseConfig);
                this.logger.debug('Parsed Firebase config from JSON string');
                return parsedConfig;
            } catch (error) {
                this.logger.error(`Failed to parse Firebase config: ${error.message}`);
                return null;
            }
        }
        return firebaseConfig;
    }

    /**
     * Build Firebase config from individual environment variables
     */
    private buildConfigFromEnvVars(): any {
        const projectId = this.configService.get('FIREBASE_PROJECT_ID');
        const clientEmail = this.configService.get('FIREBASE_CLIENT_EMAIL');
        let privateKey = this.configService.get('FIREBASE_PRIVATE_KEY');
        const privateKeyId = this.configService.get('FIREBASE_PRIVATE_KEY_ID');

        // Debug logging for configuration
        this.logger.debug(
            `Firebase config check - projectId: ${!!projectId}, clientEmail: ${!!clientEmail}, privateKey: ${!!privateKey}`,
        );

        // Process the private key if present
        if (privateKey) {
            privateKey = this.formatPrivateKey(privateKey);
        }

        if (!(projectId && clientEmail && privateKey)) {
            return null;
        }

        this.logger.log('Building Firebase config from individual environment variables');
        return {
            type: 'service_account',
            project_id: projectId.trim(),
            private_key_id: privateKeyId?.trim() ?? undefined,
            private_key: privateKey,
            client_email: clientEmail.trim(),
            client_id: this.configService.get('FIREBASE_CLIENT_ID')?.trim() ?? undefined,
            auth_uri:
                this.configService.get('FIREBASE_AUTH_URI')?.trim() ??
                'https://accounts.google.com/o/oauth2/auth',
            token_uri:
                this.configService.get('FIREBASE_TOKEN_URI')?.trim() ??
                'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url:
                this.configService.get('FIREBASE_AUTH_PROVIDER_X509_CERT_URL')?.trim() ??
                'https://www.googleapis.com/oauth2/v1/certs',
            client_x509_cert_url:
                this.configService.get('FIREBASE_CLIENT_X509_CERT_URL')?.trim() ?? undefined,
            universe_domain:
                this.configService.get('FIREBASE_UNIVERSE_DOMAIN')?.trim() ?? 'googleapis.com',
        };
    }

    /**
     * Format the private key by removing quotes and replacing escaped newlines
     */
    private formatPrivateKey(privateKey: string): string {
        let formattedKey = privateKey;

        // Remove surrounding quotes if present
        if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
            formattedKey = formattedKey.slice(1, -1);
            this.logger.debug('Removed surrounding quotes from private key');
        }

        // Replace escaped newlines with actual newlines
        if (formattedKey.includes('\\n')) {
            formattedKey = formattedKey.replace(/\\n/g, '\n');
            this.logger.debug('Replaced escaped newlines in private key');
        }

        return formattedKey;
    }

    /**
     * Initialize Firebase in development mode with minimal config
     */
    private async initializeDevelopmentMode() {
        this.logger.warn(
            'Firebase configuration not found. Using development mode with empty config.',
        );

        try {
            admin.initializeApp({
                projectId: 'momento-demo',
            });
            this.logger.warn('Initialized Firebase in development mode without credentials');
            await this.initializeFirestore();
        } catch (error) {
            this.logger.error(`Development mode Firebase init failed: ${error.message}`);
            this.createMockFirestore();
        }
    }

    /**
     * Initialize Firebase with the provided configuration
     */
    private async initializeWithConfig(firebaseConfig: any) {
        try {
            // Validate the config has required service account fields
            if (!this.isValidServiceAccount(firebaseConfig)) {
                await this.handleInvalidConfig(firebaseConfig);
                return;
            }

            this.logger.debug(
                `Initializing Firebase with service account for project: ${firebaseConfig.project_id}`,
            );
            await this.initializeWithServiceAccount(firebaseConfig);
        } catch (error) {
            const isDev = this.configService.get('NODE_ENV') !== 'production';

            if (isDev) {
                await this.initializeDevelopmentMode();
            } else {
                this.logger.error(
                    'Firebase initialization failed in production environment. Using mock Firestore.',
                );
                this.createMockFirestore();
            }
            throw error; // Re-throw to be caught by the outer catch
        }
    }

    /**
     * Handle invalid Firebase configuration
     */
    private async handleInvalidConfig(firebaseConfig: any) {
        this.logger.warn('Firebase config is invalid. Missing required fields.');

        // Log which fields are missing for debugging
        const missingFields = this.getMissingConfigFields(firebaseConfig);
        this.logger.debug(`Missing or invalid fields: ${missingFields.join(', ')}`);

        const isDev = this.configService.get('NODE_ENV') !== 'production';
        if (isDev) {
            await this.initializeDevelopmentMode();
        } else {
            this.logger.error(
                `Invalid service account configuration: missing ${missingFields.join(', ')}`,
            );
            this.createMockFirestore();
        }
    }

    /**
     * Get missing fields from Firebase config
     */
    private getMissingConfigFields(config: any): string[] {
        const missingFields = [];
        if (!config.type || config.type !== 'service_account') missingFields.push('type');
        if (!config.project_id) missingFields.push('project_id');
        if (!config.private_key) missingFields.push('private_key');
        if (!config.client_email) missingFields.push('client_email');
        return missingFields;
    }

    /**
     * Initialize Firebase with a service account
     */
    private async initializeWithServiceAccount(firebaseConfig: any) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseConfig as admin.ServiceAccount),
            });

            // Initialize Firestore settings separately after app initialization
            admin.firestore().settings({
                ignoreUndefinedProperties: true,
            });

            this.logger.log('Firebase app initialized successfully with credentials');
            await this.initializeFirestore();
        } catch (error) {
            // If cert fails, try one more time with a modified approach
            this.logger.warn(
                `Certificate initialization failed: ${error.message}. Trying alternate method...`,
            );
            await this.initializeWithMinimalServiceAccount(firebaseConfig);
        }
    }

    /**
     * Initialize with minimal service account (fallback method)
     */
    private async initializeWithMinimalServiceAccount(firebaseConfig: any) {
        // Create a clean service account object with only the required fields
        const minimalServiceAccount: admin.ServiceAccount = {
            projectId: firebaseConfig.project_id,
            privateKey: firebaseConfig.private_key,
            clientEmail: firebaseConfig.client_email,
        };

        try {
            admin.initializeApp({
                credential: admin.credential.cert(minimalServiceAccount),
            });

            // Initialize Firestore settings separately after app initialization
            admin.firestore().settings({
                ignoreUndefinedProperties: true,
            });

            this.logger.log('Firebase initialized with minimal service account');
            await this.initializeFirestore();
        } catch (error) {
            this.logger.error(`Minimal service account initialization failed: ${error.message}`);
            const isDev = this.configService.get('NODE_ENV') !== 'production';

            if (isDev) {
                await this.initializeDevelopmentMode();
            } else {
                throw error;
            }
        }
    }

    private isValidServiceAccount(config: any): boolean {
        return (
            config &&
            typeof config === 'object' &&
            config.type === 'service_account' &&
            config.project_id &&
            config.private_key &&
            config.client_email
        );
    }

    private createMockFirestore() {
        this.logger.warn('Creating mock Firestore instance due to initialization failure');
        // Create a minimal mock to avoid null reference errors
        this.firestore = {
            __isMock: true, // Special marker to identify mock instances
            collection: () => ({
                doc: () => ({
                    get: async () => ({ exists: false, data: () => ({}) }),
                    set: async () => {},
                    update: async () => {},
                    delete: async () => {},
                }),
                add: async () => ({ id: 'mock-id' }),
            }),
            runTransaction: async callback => {
                try {
                    await callback({
                        get: async () => ({ exists: false, data: () => ({}) }),
                        set: async () => {},
                        update: async () => {},
                        create: async () => {},
                        delete: async () => {},
                    });
                } catch (e) {
                    this.logger.error('Mock transaction failed', e);
                }
            },
        } as unknown as Firestore;
    }

    getFirestore(): Firestore {
        return this.firestore;
    }

    /**
     * Verify Firestore connectivity with retry logic
     * This can be called when firestore connection needs to be verified
     */
    async verifyFirestoreConnectivity(retries = 3): Promise<boolean> {
        if (!this.firestore) {
            this.logger.warn('No Firestore instance available to verify');
            return false;
        }

        // Get project ID for diagnostic logging
        const configProjectId = this.configService.get('FIREBASE_PROJECT_ID');
        const projectId = admin.app().options.projectId || configProjectId;

        if (!projectId) {
            this.logger.error(
                'Project ID is undefined. Cannot verify Firestore connectivity without a project ID.',
            );
            return false;
        }

        for (let i = 0; i < retries; i++) {
            try {
                const healthCollection = this.firestore.collection('_health_check');
                const healthDoc = healthCollection.doc('connectivity_test');
                await healthDoc.set({
                    timestamp: new Date().toISOString(),
                    status: 'ok',
                    attempt: i + 1,
                });

                // If we get here, the connection is working
                this.logger.log(`Firestore connectivity verified successfully on attempt ${i + 1}`);
                return true;
            } catch (error: any) {
                this.logger.warn(
                    `Firestore connectivity test failed (${i + 1}/${retries}): ${error.message}`,
                );

                // Specific error handling for common Firestore issues
                if (error.code === 5 || error.message?.includes('NOT_FOUND')) {
                    this.logger.error(
                        `Firestore service not found for project "${projectId}" - verify it is enabled in Firebase Console: https://console.firebase.google.com/project/${projectId}/firestore`,
                    );
                } else if (error.code === 7 || error.message?.includes('PERMISSION_DENIED')) {
                    this.logger.error(
                        `Permission denied for project "${projectId}" - verify service account has Firestore access`,
                    );
                }

                if (i < retries - 1) {
                    // Wait before next attempt (exponential backoff)
                    const delay = Math.pow(2, i) * 1000;
                    this.logger.debug(`Waiting ${delay}ms before next attempt...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        this.logger.error(`Failed to verify Firestore connectivity after ${retries} attempts`);
        return false;
    }

    /**
     * Verify if the service account has permissions to access Firestore
     */
    async verifyPermissions(): Promise<{ hasAccess: boolean; details: any }> {
        try {
            if (!this.firestore) {
                return {
                    hasAccess: false,
                    details: { error: 'Firestore not initialized' },
                };
            }

            // Get project ID for diagnostics
            const configProjectId = this.configService.get('FIREBASE_PROJECT_ID');
            const projectId = admin.app().options.projectId || configProjectId;

            // Try to perform basic operations to test permissions
            const testCollection = this.firestore.collection('_permission_test');

            // Test write permission
            const writeDoc = testCollection.doc('write_test');
            await writeDoc.set({ timestamp: new Date().toISOString() });

            // Test delete permission
            await writeDoc.delete();

            return {
                hasAccess: true,
                details: {
                    read: true,
                    write: true,
                    delete: true,
                    projectId,
                    timestamp: new Date().toISOString(),
                },
            };
        } catch (error: any) {
            const details: any = {
                error: error.message,
                code: error.code,
                timestamp: new Date().toISOString(),
            };

            // Try to determine which specific permissions failed
            if (error.code === 7) {
                // PERMISSION_DENIED
                details.suggestedFix = 'Update IAM permissions for this service account';
            } else if (error.code === 5) {
                // NOT_FOUND
                details.suggestedFix = 'Enable Firestore in Firebase Console';
            }

            return { hasAccess: false, details };
        }
    }

    /**
     * Get a document by ID from a collection
     */
    async getDocumentById(collection: string, documentId: string): Promise<any> {
        try {
            const docRef = this.firestore.collection(collection).doc(documentId);
            const doc = await docRef.get();

            if (!doc.exists) {
                this.logger.debug(`Document not found in ${collection}: ${documentId}`);
                return null;
            }

            return {
                id: doc.id,
                ...doc.data(),
            };
        } catch (error) {
            this.logger.error(`Error getting document from ${collection}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add a document to a collection with an optional ID
     */
    async addDocument(collection: string, data: any, documentId?: string): Promise<string> {
        try {
            let docRef;
            if (documentId) {
                docRef = this.firestore.collection(collection).doc(documentId);
                await docRef.set(data);
            } else {
                docRef = await this.firestore.collection(collection).add(data);
            }

            this.logger.debug(`Document added to ${collection}: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            this.logger.error(`Error adding document to ${collection}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update a document in a collection
     */
    async updateDocument(collection: string, documentId: string, data: any): Promise<void> {
        try {
            const docRef = this.firestore.collection(collection).doc(documentId);
            await docRef.update(data);

            this.logger.debug(`Document updated in ${collection}: ${documentId}`);
        } catch (error) {
            this.logger.error(`Error updating document in ${collection}: ${error.message}`);
            throw error;
        }
    }

    async updateEventWithNotification(
        userId: string,
        eventId: string,
        eventData: any,
    ): Promise<void> {
        let attempts = 0;

        while (attempts < this.retryAttempts) {
            try {
                await this.firestore.runTransaction(async t => {
                    const eventRef = this.firestore.collection('events').doc(eventId);
                    const notificationRef = this.firestore
                        .collection('users')
                        .doc(userId)
                        .collection('notifications')
                        .doc();

                    // Verify the event exists and belongs to the user
                    const eventDoc = await t.get(eventRef);
                    if (!eventDoc.exists) {
                        throw new Error(`Event ${eventId} not found`);
                    }

                    const eventData = eventDoc.data();
                    if (eventData.userId !== userId) {
                        throw new Error('Unauthorized access to event');
                    }

                    // Update event
                    t.update(eventRef, eventData);

                    // Create notification
                    t.create(notificationRef, {
                        content: `Event updated: ${eventData.name}`,
                        eventId: eventId,
                        status: 'unread',
                        type: 'event_update',
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        expiresAt: new Date(
                            Date.now() + this.DEFAULT_EXPIRATION_DAYS * this.DAYS_IN_SECONDS * 1000,
                        ), // Using constants instead of hardcoded values
                    });
                });

                // If successful, break out of retry loop
                break;
            } catch (error) {
                attempts++;

                if (attempts >= this.retryAttempts) {
                    this.logger.error(
                        `Failed to update event after ${attempts} attempts: ${error.message}`,
                    );
                    throw error;
                }

                this.logger.warn(
                    `Retrying event update (${attempts}/${this.retryAttempts}): ${error.message}`,
                );
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
            }
        }
    }

    /**
     * Get the current Firebase configuration status for debugging
     */
    getFirebaseStatus(): any {
        try {
            const configProjectId = this.configService.get('FIREBASE_PROJECT_ID');
            const appProjectId = admin.apps.length > 0 ? admin.app().options.projectId : undefined;
            const isFirestoreInitialized = !!this.firestore;

            return {
                configProjectId,
                appProjectId,
                initialized: admin.apps.length > 0,
                firestoreInitialized: isFirestoreInitialized,
                mode: this.isMockFirestore() ? 'mock' : 'real',
            };
        } catch (error) {
            return {
                error: error.message,
                initialized: false,
                firestoreInitialized: false,
            };
        }
    }

    /**
     * Check if the current Firestore instance is a mock
     */
    private isMockFirestore(): boolean {
        return !this.firestore || !!(this.firestore as any).__isMock;
    }

    /**
     * Create a Firestore database - can only be called from Firebase Console
     * This is just informational for users
     */
    createFirestoreDatabase(): string {
        const projectId =
            this.configService.get('FIREBASE_PROJECT_ID') ??
            (admin.apps.length > 0 ? admin.app().options.projectId : 'unknown');

        return `To create a Firestore database, please visit:
https://console.firebase.google.com/project/${projectId}/firestore

You cannot create a Firestore database programmatically. It must be done through the Firebase Console.
Choose "Native mode" when creating the database.`;
    }
}
