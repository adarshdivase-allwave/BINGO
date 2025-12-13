import React, { useState, useEffect } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import LogoIcon from './icons/LogoIcon';
import { getUserByEmail, updateLastLogin } from '../services/userManagementService';
import { AppUser } from '../types';

interface AuthGateProps {
    children: React.ReactNode;
}

const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const user = await getCurrentUser();
            
            // Get user details from database
            const userDetails = await getUserByEmail(user.signInDetails?.loginId || user.username);

            if (!userDetails) {
                setError('User account not found. Please contact an administrator.');
                setIsLoading(false);
                return;
            }

            // Check if user is active
            if (userDetails.status !== 'ACTIVE') {
                await signOut();
                setError(`Your account is ${userDetails.status.toLowerCase()}. Please contact an administrator.`);
                setIsLoading(false);
                return;
            }

            // Update last login
            await updateLastLogin(userDetails.id, userDetails.email);

            setIsAuthenticated(true);
            setError(null);
        } catch (err) {
            console.error('Authentication check failed:', err);
            setIsAuthenticated(false);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center">
                    <LogoIcon className="h-16 w-auto mx-auto mb-4 animate-pulse" />
                    <h1 className="text-2xl font-bold mb-2">BINGO</h1>
                    <p className="text-slate-400">Loading...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen text-white bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <div className="text-center p-8 bg-slate-800/50 rounded-lg border border-slate-700 backdrop-blur-sm max-w-md">
                    <h1 className="text-2xl font-bold text-red-400 mb-4">Access Denied</h1>
                    <p className="text-slate-300 mb-6">{error}</p>
                    <button
                        onClick={() => signOut()}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        // User not authenticated - they should still be seeing the login form from CustomAuthenticator
        // This shouldn't normally be rendered as CustomAuthenticator guards this
        return null;
    }

    // User is authenticated - render children (AppWrapper)
    return <>{children}</>;
};

export default AuthGate;