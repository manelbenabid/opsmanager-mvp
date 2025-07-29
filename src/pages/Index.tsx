// frontend/src/pages/Index.tsx (or wherever this component is located)
import React, { useEffect } from 'react'; // Added React for type FC if needed, though not strictly necessary for this component
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Ensure this path is correct
import { Button } from '@/components/ui/button'; // Ensure this path is correct

const Index: React.FC = () => { // Added React.FC for functional component typing
  const navigate = useNavigate();
  // 'login' function is removed as it's no longer provided by AuthContext
  // The actual login happens on LoginPage.tsx via Firebase
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // If the user is authenticated and auth state is not loading, redirect to dashboard
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
    // If not authenticated and auth state is resolved (isLoading is false), they stay on this landing page.
  }, [isAuthenticated, isLoading, navigate]);

  const handleNavigateToLogin = () => {
    navigate('/login'); // Navigate to your LoginPage component
  };

  // Optional: Show a loading state while AuthContext determines authentication status
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        <p className="mt-4 text-gray-700">Loading...</p>
      </div>
    );
  }

  // If authenticated, this component might briefly render before useEffect navigates.
  // Or, if already navigated, this part won't be visible.
  // If not authenticated and not loading, show the landing page content.
  if (isAuthenticated) {
    // This is a fallback, useEffect should handle the navigation.
    // You could return null or a minimal loader here too if preferred.
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 p-6">
            <p className="text-gray-700">Redirecting...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-blue-100 to-purple-100 p-6">
      <div className="max-w-3xl w-full text-center space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">NTS Operation Manager</span>
            <span className="block mt-2 text-primary">Secure Project Management</span> {/* Ensure 'text-primary' is defined in your Tailwind config or styles */}
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-xl mx-auto">
            A secure, role-based platform for managing internal projects and proofs of concept with fine-grained access control.
          </p>
        </div>

        <div className="mt-8 space-y-4 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
          <Button
            size="lg"
            className="text-base px-8 bg-purple-600 hover:bg-purple-700 text-white" // Added example styling
            onClick={handleNavigateToLogin} // Changed from 'login' to 'handleNavigateToLogin'
            disabled={isLoading} // Keep disabled while auth state is initially loading
          >
            {/* isLoading here refers to AuthContext's initial loading, not form submission loading */}
            {isLoading ? 'Loading...' : 'Sign In to Continue'}
          </Button>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Role-Based Access</h3>
            <p className="text-gray-600">
              Fine-grained permissions based on user roles and project attributes.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Secure Authentication</h3>
            <p className="text-gray-600">
              {/* Updated description to reflect Firebase */}
              Powered by Firebase for robust and secure user authentication.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Collaboration</h3>
            <p className="text-gray-600">
              Streamlined workflows for managing projects and team communication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
