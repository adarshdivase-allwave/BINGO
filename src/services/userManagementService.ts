import { generateClient } from 'aws-amplify/data';
import { signUp, signIn, signOut, getCurrentUser, updateUserAttributes, deleteUser as amplifyDeleteUser } from 'aws-amplify/auth';
import type { Schema } from '../../amplify/data/resource';
import { AppUser, UserRole, UserStatus } from '../types';
import { logActivity } from './activityLogService';

const client = generateClient<Schema>();

/**
 * User Management Service
 * Handles user creation, deletion, role assignment, and status management
 */

/**
 * Create a new user (Admin only)
 */
export const createUser = async (
  email: string,
  name: string,
  password: string,
  adminId: string,
  adminEmail: string,
  role: UserRole = 'USER'
): Promise<AppUser | null> => {
  try {
    // Sign up user in Cognito
    const signUpResponse = await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          name,
        },
        autoSignIn: false,
      },
    });

    if (!signUpResponse.userId) {
      throw new Error('Failed to create user in Cognito');
    }

    const now = new Date().toISOString();

    // Create user record in database
    const createResult = await client.models.User.create({
      email,
      name,
      role,
      status: 'ACTIVE',
      createdAt: now,
      createdBy: adminEmail,
      updatedAt: now,
    });
    const newUser = (createResult && ((createResult as any).data ?? createResult)) as any;

    // Log activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: 'USER_CREATED',
      resourceType: 'User',
      resourceId: newUser?.id,
      resourceName: email,
      details: { role, status: 'ACTIVE' },
    });

    return (newUser as AppUser) || null;
  } catch (error) {
    console.error('Failed to create user:', error);
    throw error;
  }
};

/**
 * Get all users (Admin only)
 */
export const getAllUsers = async (): Promise<AppUser[]> => {
  try {
    const listResult = await client.models.User.list();
    const users = (listResult && ((listResult as any).data ?? listResult)) as any[] | null;
    if (!users) return [];
    return users.map(u => ({ ...(u as any), role: (u as any).role as UserRole })) as AppUser[];
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return [];
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<AppUser | null> => {
  try {
    const listResult = await client.models.User.list();
    const users = (listResult && ((listResult as any).data ?? listResult)) as any[] | null;
    const user = users?.find(u => u.email === email);
    return (user ? ({ ...user, role: user.role as UserRole } as AppUser) : null) || null;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
};

/**
 * Update user role (Admin only)
 */
export const updateUserRole = async (
  userId: string,
  userEmail: string,
  newRole: UserRole,
  adminId: string,
  adminEmail: string
): Promise<AppUser | null> => {
  try {
    const now = new Date().toISOString();

    const updateResult = await client.models.User.update({
      id: userId,
      role: newRole,
      updatedAt: now,
      updatedBy: adminEmail,
    });
    const updatedUser = (updateResult && ((updateResult as any).data ?? updateResult)) as any;

    // Log activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: 'ROLE_CHANGED',
      resourceType: 'User',
      resourceId: userId,
      resourceName: userEmail,
      details: { newRole },
    });

    return (updatedUser as AppUser) || null;
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw error;
  }
};

/**
 * Update user status (Admin only)
 */
export const updateUserStatus = async (
  userId: string,
  userEmail: string,
  newStatus: UserStatus,
  adminId: string,
  adminEmail: string
): Promise<AppUser | null> => {
  try {
    const now = new Date().toISOString();
    let action: 'USER_UPDATED' | 'USER_SUSPENDED' = 'USER_UPDATED';

    if (newStatus === 'SUSPENDED') {
      action = 'USER_SUSPENDED';
    }

    const updateResult = await client.models.User.update({
      id: userId,
      status: newStatus,
      updatedAt: now,
      updatedBy: adminEmail,
    });
    const updatedUser = (updateResult && ((updateResult as any).data ?? updateResult)) as any;

    // Log activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action,
      resourceType: 'User',
      resourceId: userId,
      resourceName: userEmail,
      details: { newStatus },
    });

    return (updatedUser as AppUser) || null;
  } catch (error) {
    console.error('Failed to update user status:', error);
    throw error;
  }
};

/**
 * Delete user (Admin only)
 */
export const deleteUserAccount = async (
  userId: string,
  userEmail: string,
  adminId: string,
  adminEmail: string
): Promise<boolean> => {
  try {
    // Delete from database
    await client.models.User.delete({ id: userId });

    // NOTE: Deleting a user from Cognito typically requires admin credentials
    // and a different API call. Skipping Cognito deletion here to avoid
    // calling an SDK method with incorrect signature in the frontend.

    // Log activity
    await logActivity({
      userId: adminId,
      userEmail: adminEmail,
      action: 'USER_DELETED',
      resourceType: 'User',
      resourceId: userId,
      resourceName: userEmail,
    });

    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
};

/**
 * Check if user is admin
 */
export const isUserAdmin = async (email: string): Promise<boolean> => {
  try {
    const user = await getUserByEmail(email);
    return user?.role === 'ADMIN' && user?.status === 'ACTIVE';
  } catch (error) {
    console.error('Failed to check admin status:', error);
    return false;
  }
};

/**
 * Get current user with full details
 */
export const getCurrentUserWithDetails = async (): Promise<AppUser | null> => {
  try {
    const user = await getCurrentUser();
    const userDetails = await getUserByEmail(user.signInDetails?.loginId || user.username);
    return userDetails || null;
  } catch (error) {
    console.error('Failed to get current user details:', error);
    return null;
  }
};

/**
 * Update last login timestamp
 */
export const updateLastLogin = async (userId: string, userEmail: string): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await client.models.User.update({
      id: userId,
      lastLogin: now,
      updatedAt: now,
    });

    // Log login activity
    await logActivity({
      userId,
      userEmail,
      action: 'LOGIN',
    });
  } catch (error) {
    console.error('Failed to update last login:', error);
  }
};

/**
 * Log user logout
 */
export const logUserLogout = async (userId: string, userEmail: string): Promise<void> => {
  try {
    await logActivity({
      userId,
      userEmail,
      action: 'LOGOUT',
    });
  } catch (error) {
    console.error('Failed to log logout:', error);
  }
};
