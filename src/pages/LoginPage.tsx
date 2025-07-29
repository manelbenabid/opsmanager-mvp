
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, User, AlertCircle, KeyRound, Mail, CheckCircle } from 'lucide-react';
import { Input } from '@/components/ui/input'; // For email and password fields
import { Label } from '@/components/ui/label'; // For form labels
import { auth, signInWithEmailAndPassword, sendPasswordResetEmail  } from '../firebaseConfig';

const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading: authIsLoading } = useAuth(); // isLoading from context is for profile fetching
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Local loading state for form submission
  const [showLoginForm, setShowLoginForm] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  useEffect(() => {
    // If user is already authenticated (e.g., due to active Firebase session and profile loaded), redirect.
    console.log("LoginPage NAV useEffect triggered. isAuthenticated:", isAuthenticated, "authIsLoading:", authIsLoading, "Target nav:", from);
    if (isAuthenticated && !authIsLoading) {
      console.log("LoginPage: Conditions MET for navigation. Navigating to:", from);
      navigate(from, { replace: true });
      console.log("LoginPage: Conditions NOT MET for navigation.");
    }
  }, [isAuthenticated, authIsLoading, navigate, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Firebase onAuthStateChanged listener in AuthContext will handle the rest:
      // 1. Detect the authenticated Firebase user.
      // 2. Call the backend to get the full AppUser profile.
      // 3. Update AuthContext state, triggering isAuthenticated to true.
      // The useEffect above will then handle navigation.
      // No explicit navigation here is needed if useEffect handles it based on isAuthenticated.
      // If navigation doesn't happen quickly enough, you could navigate here,
      // but it's cleaner to let AuthContext state drive it.
    } catch (err: any) {
      console.error("Firebase login error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError('Failed to login. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSuccess(null);
    setIsSubmitting(true);

    try {
        await sendPasswordResetEmail(auth, resetEmail);
        setResetSuccess(`If an account exists for ${resetEmail}, a password reset link has been sent.`);
    } catch (err: any) {
        console.error("Password reset error:", err);
        // Don't reveal if an email exists or not for security.
        // Just show a generic success message.
        setResetSuccess(`If an account exists for ${resetEmail}, a password reset link has been sent.`);
    } finally {
        setIsSubmitting(false);
    }
  };

  // If auth is still loading its initial state, show a generic loader
  // to prevent brief flash of login page if already authenticated.
  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  
  console.log("LoginPage RENDER - isAuthenticated:", isAuthenticated, "authIsLoading:", authIsLoading);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
      <Card className="w-[350px] shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
              <User className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <CardTitle className="text-xl font-semibold text-center">
                        {showForgotPassword ? "Reset Your Password" : "Apex"}
                    </CardTitle>
          <CardDescription className="text-center">
                        {showForgotPassword 
                            ? "Enter your email to receive a reset link"
                            : showLoginForm ? "Enter your credentials below" : "Sign in to access your projects"
                        }
                    </CardDescription>
          </CardHeader>
        {!showLoginForm && !showForgotPassword && (
          <>
            <CardContent className="text-center py-8">
              <p className="text-sm text-gray-500 mb-6">
                Click the button below to proceed with sign in.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                onClick={() => setShowLoginForm(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3"
              >
                <KeyRound className="w-5 h-5 mr-2" />
                Proceed to Sign In
              </Button>
            </CardFooter>
          </>
        )} 
        {showLoginForm && !showForgotPassword && (
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-4"> {/* Added pt-6 for spacing */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  required
                  className="focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              {error && (
                <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md">
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col space-y-3"> {/* Added flex-col for button and back link */}
              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3"
                disabled={isSubmitting || authIsLoading}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Sign in
                  </>
                )}
              </Button>
              <Button
                variant="link"
                onClick={() => {
                  setShowLoginForm(false);
                  setError(null); // Clear error when going back
                }}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                    setShowForgotPassword(true);
                    setShowLoginForm(false);
                    setError(null);
                }}
                className="text-sm text-purple-600 hover:text-purple-800"
            >
                Forgot your password?
            </Button>
            </CardFooter>
          </form>
        )}

        {/* State 3: Forgot Password Form */}
        {showForgotPassword && (
            <form onSubmit={handlePasswordReset}>
                <CardContent className="space-y-4 pt-4">
                    {resetSuccess ? (
                        <div className="flex items-center p-3 text-sm text-green-700 bg-green-100 border border-green-300 rounded-md">
                            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                            <span>{resetSuccess}</span>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="reset-email">Email Address</Label>
                            <Input
                                id="reset-email"
                                type="email"
                                placeholder="your.email@company.com"
                                value={resetEmail}
                                onChange={(e) => setResetEmail(e.target.value.toLowerCase())}
                                required
                            />
                        </div>
                    )}

                    {error && (
                        <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md">
                            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col space-y-2">
                    {!resetSuccess && (
                        <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending...' : <><Mail className="w-5 h-5 mr-2" />Send Reset Link</>}
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="link"
                        onClick={() => {
                            setShowForgotPassword(false);
                            setShowLoginForm(true);
                            setError(null);
                            setResetSuccess(null);
                        }}
                        className="text-sm text-purple-600 hover:text-purple-800"
                    >
                        Back to Sign In
                    </Button>
                </CardFooter>
            </form>
        )}

      </Card>
    </div>
  );
  
};

export default LoginPage;
