
import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './components/AuthGate';
import AppWrapper from './AppWrapper';
import { Root } from './Root';
import './styles/global.css';
import './styles/animations.css';
import './styles/print.css';
import './styles/authenticator.css';
import { Amplify } from 'aws-amplify';
import { CustomAuthenticator } from './components/CustomAuthenticator';
import outputs from '../amplify_outputs.json';

// Configure Amplify with the generated outputs
Amplify.configure(outputs);

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
