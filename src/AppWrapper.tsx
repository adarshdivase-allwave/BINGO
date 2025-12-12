import React, { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import App from './App';
import AdminDashboard from './components/AdminDashboard';
import CreateUserModal from './components/CreateUserModal';
import { BootstrapPage } from './components/BootstrapPage';
import { AppUser } from './types';
import { getCurrentUserWithDetails } from './services/userManagementService';
import { getBootstrapStatus } from './services/bootstrapService';

const AppWrapper: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      // Check if user is currently authenticated
      try {
        await getCurrentUser();
      } catch {
        // User not authenticated - they are still in login flow
        setIsLoading(false);
        return;
      }

      // Check bootstrap status first — if the app isn't bootstrapped, show bootstrap page
      const status = await getBootstrapStatus();
      if (!status.isBootstrapped) {
        setNeedsBootstrap(true);
        setIsLoading(false);
        return;
      }

      const user = await getCurrentUserWithDetails();
      setCurrentUser(user);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load user data:', error);
      setIsLoading(false);
    }
  };

  const handleBootstrapComplete = () => {
    setNeedsBootstrap(false);
    // Reload the app to pick up the new admin user
    window.location.reload();
  };

  // Show loading screen while checking bootstrap and user status
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Show bootstrap page if bootstrap is needed
  if (needsBootstrap) {
    return <BootstrapPage onBootstrapComplete={handleBootstrapComplete} />;
  }

  // If no user loaded yet, return null - they are still in auth flow (CustomAuthenticator login screen)
  if (!currentUser) {
    return null;
  }

  // Show admin dashboard if requested
  if (showAdminDashboard && currentUser.role === 'ADMIN') {
    return (
      <>
        <AdminDashboard
          currentUserEmail={currentUser.email}
          currentUserId={currentUser.id}
        />
        <div className="fixed bottom-4 right-4 gap-2 flex z-40 no-print">
          <button
            onClick={() => setShowAdminDashboard(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Back to App
          </button>
        </div>
      </>
    );
  }

  // Render main app with admin button if user is admin
  return (
    <>
      <App currentUser={currentUser} />

      {/* Admin access button - only for admins */}
      {currentUser.role === 'ADMIN' && (
        <button
          onClick={() => setShowAdminDashboard(true)}
          className="fixed bottom-4 left-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium z-40 no-print"
          title="Admin Dashboard"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Admin
        </button>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && currentUser.role === 'ADMIN' && (
        <CreateUserModal
          isOpen={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          onUserCreated={loadUserData}
          adminEmail={currentUser.email}
          adminId={currentUser.id}
        />
      )}
    </>
  );
};

export default AppWrapper;
