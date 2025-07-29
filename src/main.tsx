import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Or your global stylesheet
//import './styles/mentions.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);