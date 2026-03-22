import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { OktaAuth } from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import App from './App';
import oktaConfig from './oktaConfig';

const oktaAuth = new OktaAuth(oktaConfig);

/**
 * Called by @okta/okta-react after a successful login callback.
 * Redirects the user to wherever they originally tried to go.
 */
const restoreOriginalUri = (_oktaAuth, originalUri) => {
  window.location.replace(originalUri ?? '/dashboard');
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
        <App />
      </Security>
    </BrowserRouter>
  </React.StrictMode>
);
