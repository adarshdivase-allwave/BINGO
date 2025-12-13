import React, { useState, useEffect } from 'react';
import { CustomAuthenticator } from './components/CustomAuthenticator';
import AuthGate from './components/AuthGate';
import AppWrapper from './AppWrapper';
import { BootstrapPage } from './components/BootstrapPage';
import { getBootstrapStatus } from './services/bootstrapService';
import LoaderIcon from './components/icons/LoaderIcon';

export const Root = () => {
    const [status, setStatus] = useState<'loading' | 'bootstrap' | 'app'>('loading');

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        try {
            // NOTE: getBootstrapStatus() checks the database. 
            // If the database has "allow.public.read()", this works unauthenticated.
            // If not, this might fail or return false. 
            // Assuming standard "checking if users exist" is safe or public.
            const result = await getBootstrapStatus();

            console.log('Bootstrap Check Result:', result);

            if (!result.isBootstrapped && result.userCount === 0) {
                setStatus('bootstrap');
            } else {
                setStatus('app');
            }
        } catch (e) {
            console.error('Error checking bootstrap status:', e);
            // If error (e.g., auth required), fail safe to App which handles auth.
            setStatus('app');
        }
    };

    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900 text-white">
                <div className="flex flex-col items-center">
                    <LoaderIcon className="w-10 h-10 animate-spin mb-4" />
                    <p className="text-lg font-medium">Initializing Application...</p>
                </div>
            </div>
        );
    }

    // If we need to bootstrap, show that page (outside of Authenticator)
    if (status === 'bootstrap') {
        return <BootstrapPage onBootstrapComplete={() => setStatus('app')} />;
    }

    // Otherwise, render the authenticated app
    return (
        <CustomAuthenticator>
            <AuthGate>
                <AppWrapper />
            </AuthGate>
        </CustomAuthenticator>
    );
};
