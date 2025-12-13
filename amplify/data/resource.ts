
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // User Management Model
  User: a
    .model({
      email: a.string().required(),
      name: a.string().required(),
      role: a.string().required(), // ADMIN or USER
      status: a.string().required(), // User status: ACTIVE, INACTIVE, SUSPENDED
      createdAt: a.string().required(),
      createdBy: a.string().required(), // Admin who created the user
      lastLogin: a.string(),
      updatedAt: a.string().required(),
      updatedBy: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      allow.publicApiKey().to(['read', 'create']),
    ]),

  // Activity Log Model - Track all user activities
  ActivityLog: a
    .model({
      userId: a.string().required(),
      userEmail: a.string().required(),
      action: a.string().required(), // LOGIN, LOGOUT, CREATE_PROJECT, etc.
      timestamp: a.string().required(),
      resourceType: a.string(), // e.g., 'Project', 'User'
      resourceId: a.string(),
      resourceName: a.string(),
      details: a.json(), // Additional details as needed
      ipAddress: a.string(),
      userAgent: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create']),
    ]),

  // Bootstrap Configuration - Track if initial admin setup is complete
  BootstrapConfig: a
    .model({
      id: a.id().required(),
      isBootstrapped: a.boolean().required(),
      bootstrappedAt: a.string(),
      bootstrappedBy: a.string(),
    })
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update']),
      allow.publicApiKey().to(['read', 'create']),
    ]),

  // Project Model (existing)
  Project: a
    .model({
      name: a.string().required(),
      clientDetails: a.json(),
      rooms: a.json(),
      branding: a.json(),
      margin: a.float(),
      selectedCurrency: a.string(),
      viewMode: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
