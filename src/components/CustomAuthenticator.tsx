import React from 'react';
import { Authenticator, ThemeProvider, View } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Theme } from '@aws-amplify/ui';
import LogoIcon from './icons/LogoIcon';

// Professional custom theme matching your application's dark design
const customTheme: Theme = {
  name: 'custom-theme',
  tokens: {
    colors: {
      background: {
        primary: { value: '#0f172a' }, // slate-900
        secondary: { value: '#1e293b' }, // slate-800
      },
      border: {
        primary: { value: 'rgba(148, 163, 184, 0.2)' },
      },
      font: {
        interactive: { value: '#e2e8f0' }, // slate-200
      },
      text: {
        primary: { value: '#f1f5f9' }, // slate-100
        secondary: { value: '#cbd5e1' }, // slate-300
      },
      brand: {
        primary: { value: '#92D050' }, // Primary green
        secondary: { value: '#7ac43e' }, // Darker green
      },
    },
  },
};

// Custom Header Component for better branding
const CustomSignInHeader = () => {
  return (
    <View textAlign="center" marginBottom="2.5rem">
      <div style={{ marginBottom: '1.5rem' }}>
        <LogoIcon className="h-16 w-auto mx-auto" />
      </div>
      <h1 style={{
        fontSize: '2rem',
        fontWeight: '700',
        color: '#f1f5f9',
        marginBottom: '0.5rem',
        letterSpacing: '-0.5px'
      }}>
        BINGO
      </h1>
      <p style={{
        fontSize: '0.95rem',
        color: '#cbd5e1',
        marginBottom: '0.5rem'
      }}>
        AI-Powered AV Estimator
      </p>
      <p style={{
        fontSize: '0.875rem',
        color: '#94a3b8'
      }}>
        Professional Bill of Quantities Generator
      </p>
    </View>
  );
};

interface CustomAuthenticatorProps {
  children?: any;
}

export const CustomAuthenticator: React.FC<CustomAuthenticatorProps> = ({ children }) => {
  return (
    <ThemeProvider theme={customTheme}>
      <Authenticator
        signUpAttributes={['email']}
        hideSignUp={true}
        socialProviders={[]}
        components={{
          SignIn: {
            Header: CustomSignInHeader,
          },
          SignUp: {
            Header: CustomSignInHeader,
          },
        }}
      >
        {children}
      </Authenticator>
    </ThemeProvider>
  );
};
