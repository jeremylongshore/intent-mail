/**
 * Web Dashboard Entry Point
 *
 * Renders the IntentMail web application to the DOM.
 *
 * E4.S4.1: React Web App Scaffold
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found. Add <div id="root"></div> to your HTML.');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
