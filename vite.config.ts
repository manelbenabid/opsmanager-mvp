// vite.config.ts (frontend project root)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path' // Make sure to import 'path'
import fs from 'fs' // If you're still using this for HTTPS certs

// A simple plugin to ensure the server handles root requests correctly.
const rootRedirectPlugin = () => {
  return {
    name: 'root-redirect',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        // If the request is for the bare domain (e.g., http://localhost:8080),
        // rewrite the URL to be for the root path '/'.
        if (req.url === '/index.html' && !req.originalUrl.endsWith('/index.html')) {
            req.url = '/';
        }
        next();
      });
    },
  };
};


export default defineConfig({
  plugins: [
    react(),
    rootRedirectPlugin() // Add the custom plugin here
  ],
  server: { // Your HTTPS config
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'key.pem')), 
      cert: fs.readFileSync(path.resolve(__dirname, 'cert.pem')) 
    },
    host: '0.0.0.0', 
    port: 8080 
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Maps @ to the src directory
    },
  },
})





/*import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // In a production environment with a real backend, you would configure
  // the PostgreSQL connection through environment variables and use
  // the backend to handle database operations rather than trying to
  // connect directly from the frontend
}));*/
