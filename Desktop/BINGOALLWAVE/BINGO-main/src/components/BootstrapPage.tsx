import React, { useState } from 'react';
import { createBootstrapAdmin } from '../services/bootstrapService';
import LogoIcon from './icons/LogoIcon';
import WarningIcon from './icons/WarningIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface BootstrapPageProps {
  onBootstrapComplete: () => void;
}

export function BootstrapPage({ onBootstrapComplete }: BootstrapPageProps) {
  const [step, setStep] = useState<'form' | 'success' | 'error'>('form');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    bootstrapSecret: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.name || !formData.password || !formData.confirmPassword || !formData.bootstrapSecret) {
      setErrorMessage('All fields are required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }

    if (formData.password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setStep('error');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const result = await createBootstrapAdmin(
        formData.email,
        formData.name,
        formData.password,
        formData.bootstrapSecret
      );

      if (result.success) {
        setSuccessMessage(result.message);
        setStep('success');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          onBootstrapComplete();
        }, 3000);
      } else {
        setErrorMessage(result.message);
        setStep('error');
      }
    } catch (error) {
      setErrorMessage('An unexpected error occurred. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full filter blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-green-500/10 rounded-full filter blur-3xl -ml-32 -mb-32"></div>
      </div>

      {/* Content container */}
      <div className="relative w-full max-w-md">
        {step === 'form' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl">
            {/* Header */}
            <div className="flex justify-center mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center">
                <LogoIcon className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-center text-white mb-2">BINGO Setup</h1>
            <p className="text-center text-gray-300 mb-8">Create your first admin account</p>

            {errorMessage && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
                <WarningIcon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-300 text-sm">{errorMessage}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="admin@example.com"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition"
                  disabled={loading}
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition"
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Password (8+ characters)</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition"
                  disabled={loading}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition"
                  disabled={loading}
                />
              </div>

              {/* Bootstrap Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">Bootstrap Secret Key</label>
                <input
                  type="password"
                  name="bootstrapSecret"
                  value={formData.bootstrapSecret}
                  onChange={handleChange}
                  placeholder="Enter the bootstrap key"
                  className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-green-400/50 focus:ring-1 focus:ring-green-400/50 transition"
                  disabled={loading}
                />
                <p className="text-xs text-gray-400 mt-2">You should have received this from your system administrator</p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 px-6 py-3 bg-gradient-to-r from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition duration-200 shadow-lg hover:shadow-green-500/50 disabled:shadow-none"
              >
                {loading ? 'Setting up...' : 'Create Admin Account'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6">
              This bootstrap process can only be completed once. After creation, use the Admin Dashboard to manage additional users.
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-10 h-10 text-white" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Setup Complete!</h2>
            <p className="text-gray-300 mb-2">{successMessage}</p>
            <p className="text-sm text-gray-400 mb-6">Redirecting to login page...</p>

            <div className="flex justify-center">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        )}

        {step === 'error' && (
          <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-8 shadow-2xl text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/50">
                <WarningIcon className="w-10 h-10 text-red-400" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3">Setup Failed</h2>
            <p className="text-red-300 mb-6">{errorMessage}</p>

            <button
              onClick={() => {
                setStep('form');
                setErrorMessage('');
              }}
              className="w-full px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition duration-200"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
