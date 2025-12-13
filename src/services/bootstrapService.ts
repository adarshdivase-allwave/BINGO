import { generateClient } from 'aws-amplify/api';
import { signUp } from 'aws-amplify/auth';
import { type Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

// Bootstrap secret - in production, this should be in environment variables
// Format: "BOOTSTRAP_SECRET_<random-string>"
const BOOTSTRAP_SECRET = process.env.REACT_APP_BOOTSTRAP_SECRET || 'BOOTSTRAP_SECRET_dev2025!@#';

// Hash function removed for browser compatibility
// function hashSecret(secret: string): string {
//   return crypto.createHash('sha256').update(secret).digest('hex');
// }

/**
 * Check if the application has been bootstrapped (first admin created)
 */
export async function isBootstrapped(): Promise<boolean> {
  try {
    const response = await client.models.BootstrapConfig.list({
      selectionSet: ['id', 'isBootstrapped'],
      authMode: 'apiKey',
    });

    if (!response.data || response.data.length === 0) {
      return false;
    }

    return response.data[0].isBootstrapped || false;
  } catch (error) {
    console.error('Error checking bootstrap status:', error);
    return false;
  }
}

/**
 * Create the bootstrap configuration record (called once on first admin creation)
 */
export async function createBootstrapConfig(adminEmail: string): Promise<void> {
  try {
    await client.models.BootstrapConfig.create({
      id: 'bootstrap-config',
      isBootstrapped: true,
      bootstrappedAt: new Date().toISOString(),
      bootstrappedBy: adminEmail,
    }, { authMode: 'apiKey' });
  } catch (error) {
    console.error('Error creating bootstrap config:', error);
    throw new Error('Failed to mark bootstrap as complete');
  }
}

/**
 * Validate bootstrap secret key
 */
export function validateBootstrapSecret(providedSecret: string): boolean {
  // Compare plain text for browser compatibility
  return providedSecret === BOOTSTRAP_SECRET;
}

/**
 * Create the first admin user during bootstrap
 * This function validates the bootstrap secret before proceeding
 */
export async function createBootstrapAdmin(
  email: string,
  name: string,
  password: string,
  bootstrapSecret: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Validate bootstrap secret
    if (!validateBootstrapSecret(bootstrapSecret)) {
      return {
        success: false,
        message: 'Invalid bootstrap secret key. Contact system administrator.',
      };
    }

    // Check if already bootstrapped
    const isAlreadyBootstrapped = await isBootstrapped();
    if (isAlreadyBootstrapped) {
      return {
        success: false,
        message: 'Application already bootstrapped. Cannot create additional admins this way.',
      };
    }

    // Validate inputs
    if (!email || !name || !password) {
      return {
        success: false,
        message: 'All fields are required',
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        success: false,
        message: 'Please enter a valid email address',
      };
    }

    // Create user in Cognito
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            name,
            email,
          },
        },
      });
    } catch (error: any) {
      console.error('Error creating Cognito user:', error);
      // If user already exists, we might want to proceed if they have the secret
      if (error.name !== 'UsernameExistsException') {
        return {
          success: false,
          message: `Failed to create login account: ${error.message}`,
        };
      }
    }

    // Create user record in database
    const userId = `admin-${Date.now()}`; // Placeholder - actual ID comes from Cognito

    try {
      await client.models.User.create({
        id: userId,
        email,
        name,
        role: 'ADMIN',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        createdBy: 'bootstrap',
        updatedAt: new Date().toISOString(),
      }, { authMode: 'apiKey' });
    } catch (error) {
      console.error('Error creating admin user record:', error);
      return {
        success: false,
        message: 'Failed to create admin user record in database',
      };
    }

    // Mark application as bootstrapped
    try {
      await createBootstrapConfig(email);
    } catch (error) {
      console.error('Error marking bootstrap as complete:', error);
      return {
        success: false,
        message: 'Failed to mark bootstrap as complete',
      };
    }

    return {
      success: true,
      message: 'Admin user created successfully! Please sign in with your credentials.',
    };
  } catch (error) {
    console.error('Error during bootstrap admin creation:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}

/**
 * Get bootstrap status with count of users
 */
export async function getBootstrapStatus(): Promise<{
  isBootstrapped: boolean;
  userCount: number;
}> {
  try {
    const bootstrapped = await isBootstrapped();

    // Count users in database
    const usersResponse = await client.models.User.list({
      selectionSet: ['id'],
      authMode: 'apiKey',
    });

    const userCount = usersResponse.data?.length || 0;

    return {
      isBootstrapped: bootstrapped,
      userCount,
    };
  } catch (error) {
    console.error('Error getting bootstrap status:', error);
    return {
      isBootstrapped: false,
      userCount: 0,
    };
  }
}
