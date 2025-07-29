import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { auth, verifyPasswordResetCode, confirmPasswordReset } from '../firebaseConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, KeyRound } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const oobCode = searchParams.get('oobCode');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!oobCode) {
            setError("Invalid request. The link is missing a required code.");
            setIsLoading(false);
            return;
        }

        verifyPasswordResetCode(auth, oobCode)
            .then((verifiedEmail) => {
                setEmail(verifiedEmail);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error("Invalid oobCode:", err);
                setError("The password reset link is invalid or has expired. Please request a new one.");
                setIsLoading(false);
            });
    }, [oobCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (!oobCode) {
            setError("An unexpected error occurred. The action code is missing.");
            return;
        }
        setError(null);
        setIsSubmitting(true);

        try {
            await confirmPasswordReset(auth, oobCode, newPassword);
            setSuccess("Your password has been reset successfully! You will be redirected to the login page shortly.");
            setTimeout(() => navigate('/login'), 4000);
        } catch (err: any) {
            console.error("Error confirming password reset:", err);
            setError("Failed to reset password. The link may have expired. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                <p className="ml-4 text-purple-800">Verifying your link...</p>
            </div>
        );
    }
    
    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-purple-50">
            <Card className="w-[400px] shadow-lg">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-2">
                        <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                            <KeyRound className="h-6 w-6 text-purple-600" />
                        </div>
                    </div>
                    <CardTitle className="text-xl font-semibold">Set Your Password</CardTitle>
                    <CardDescription>
                        {email ? `Setting password for ${email}` : 'Please enter and confirm your new password.'}
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="flex items-center p-3 text-sm text-red-700 bg-red-100 border border-red-300 rounded-md">
                                <AlertCircle className="w-5 h-5 mr-2" />
                                <span>{error}</span>
                            </div>
                        )}
                        {success && (
                             <div className="flex items-center p-3 text-sm text-green-700 bg-green-100 border border-green-300 rounded-md">
                                <CheckCircle className="w-5 h-5 mr-2" />
                                <span>{success}</span>
                            </div>
                        )}
                        
                        {!success && email && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </>
                        )}
                    </CardContent>
                    {!success && email && (
                        <CardFooter>
                            <Button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-700">
                                {isSubmitting ? 'Saving...' : 'Set New Password'}
                            </Button>
                        </CardFooter>
                    )}
                </form>
            </Card>
        </div>
    );
};

export default ResetPasswordPage;