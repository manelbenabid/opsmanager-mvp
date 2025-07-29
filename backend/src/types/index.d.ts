// Import the user type you use in your application.
// The path might need adjustment based on your project structure.
import { AppUser } from '../../../src/contexts/AuthContext.tsx'; // Assuming AppUser is exported from a shared types file or your context

// This tells TypeScript to add a 'user' property to the Express Request interface.
declare global {
  namespace Express {
    export interface Request {
      // The user property is optional ('?') because not all requests
      // will be authenticated (e.g., login route).
      user?: AppUser;
    }
  }
}

// You need an empty export to make this a module.
export {};