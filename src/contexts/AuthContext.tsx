// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { User as FirebaseUser, signOut, onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { auth } from '../firebaseConfig'; // No longer need initializeAuthListener from here for this specific effect
import api from '../services/api'; // Your Axios instance

// Your specific UserRole type for application roles (from Firestore)
export type UserRole = 'admin' | 'lead' | 'account_manager' | 'technical_team' | 'project_manager'| 'presales';

// Types for data primarily from your on-premise database
export type UserLocation = 'Remote' | 'In-Office' | 'On-Site' | 'Off-Site';
export type UserStatus = 'Active' | 'On Leave' | 'Other';

// This interface defines the structure of the user profile
// that the AuthContext will hold. It's what your backend's
// /api/auth/user-profile endpoint should return.
export interface AppUser {
    uid: string; // Firebase UID
    email: string; // From Firebase token (and should match on-prem)

    // From Firestore (via backend)
    applicationRole: UserRole;

    // From your on-premise 'employees' table (via backend)
    id: string; // This is the employee ID from your on-premise database
    name: string; // Constructed from first_name, last_name
    phone?: string;
    workExt?: string; // Mapped from work_ext
    jobTitle?: string;
    employeeDbRole?: string; // The 'role' field from your on-prem employees table
    managerEmail?: string | null;
    status?: UserStatus | string; // Allow string if on-prem values might not strictly match UserStatus
    skills?: string[];
    certificates?: string[];
    location?: UserLocation | string; // Allow string for flexibility
}

interface AuthContextType {
    isAuthenticated: boolean;
    user: AppUser | null;
    firebaseUser: FirebaseUser | null; // Raw Firebase user object
    logout: () => Promise<void>;
    hasRole: (role: UserRole | UserRole[]) => boolean;
    hasPermission: (resource: string, action: string) => boolean;
    isLoading: boolean;
    // This function is intended to update data primarily in your on-premise DB via a backend call
    updateProfileData: (data: Partial<Omit<AppUser, 'uid' | 'id' | 'email' | 'applicationRole'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        setIsLoading(true); // Set loading true when listener setup begins

        // Set up a persistent listener that reacts to all auth changes
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setFirebaseUser(user); // Update Firebase user state immediately

            if (user) {
                // User is signed in (either initially or after a login/signup action)
                setIsLoading(true); // Explicitly set for the profile fetch phase
                try {
                    const response = await api.get<AppUser>('/auth/user-profile'); // Calls your backend
                    setAppUser(response.data);
                } catch (error) {
                    console.error("AuthContext: Error fetching user profile from backend:", error);
                    setAppUser(null);
                    // Optionally sign out the Firebase user if a full profile is mandatory
                    // await signOut(auth); // This would re-trigger onAuthStateChanged with user=null
                } finally {
                    setIsLoading(false);
                }
            } else {
                // No Firebase user (logged out or initial state with no session)
                setAppUser(null);
                setIsLoading(false);
            }
        });

        // Cleanup function: Unsubscribe from the listener when the AuthProvider unmounts
        return () => {
            console.log("AuthContext: Cleaning up onAuthStateChanged listener.");
            unsubscribe();
        };
    }, []); // Empty dependency array: runs once on mount to set up listener, cleans up on unmount

    const logout = async () => {
        // setIsLoading(true); // isLoading state will be handled by the onAuthStateChanged listener
        try {
            await signOut(auth); // This will trigger onAuthStateChanged with user = null
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };

    // Adjusted Omit to exclude uid, id, email, and applicationRole as these are typically not user-updatable profile fields
    const updateProfileData = async (data: Partial<Omit<AppUser, 'uid' | 'id' | 'email' | 'applicationRole'>>) => {
        if (!appUser || !firebaseUser) {
            throw new Error("User not loaded or not authenticated.");
        }
        setIsLoading(true);
        try {
            console.log("Attempting to update profile data (on-prem via backend):", data);
            // This should call a backend endpoint that updates your on-premise database.
            // Example: await api.put(`/users/profile/${firebaseUser.uid}`, data); // Backend would handle updating on-prem DB
            
            // After successful backend update, refetch the profile to ensure UI consistency
            const updatedProfileResponse = await api.get<AppUser>('/auth/user-profile');
            setAppUser(updatedProfileResponse.data);
            console.log("AuthContext: Profile data updated and re-fetched.");
        } catch (error) {
            console.error("Error updating profile data:", error);
            throw error; // Re-throw for the component to handle
        } finally {
            setIsLoading(false);
        }
    };

    const hasRole = (roleToCheck: UserRole | UserRole[]): boolean => {
        if (!appUser || !appUser.applicationRole) return false;
        const currentAppRole = appUser.applicationRole;
        if (Array.isArray(roleToCheck)) {
            return roleToCheck.some(r => currentAppRole === r);
        }
        return currentAppRole === roleToCheck;
    };

    const hasPermission = (resource: string, action: string): boolean => {
        if (!appUser || !appUser.applicationRole) {
            return false;
        }
        if (appUser.applicationRole === 'admin') return true;

        if (resource === 'poc') {
            if (action === 'view') return true;
            if (action === 'create') return hasRole(['admin', 'account_manager']);
            if (action === 'edit' ) return hasRole(['admin', 'lead']);
            if (action === 'delete') return hasRole(['admin']);
            if (action === 'assignEngTeam') return hasRole(['admin', 'lead']);
        }
        if (resource === 'project') {
            if (action === 'view') return hasRole(['admin']);
            if (action === 'create') return hasRole(['admin']);
            if (action === 'edit' ) return hasRole(['admin']);
            if (action === 'delete') return hasRole(['admin']);
            if (action === 'assignTechnicalLead') return hasRole(['admin']);
            if (action === 'assignEngTeam') return hasRole(['admin']);
        }
        if (resource === 'employee') {
            if (action === 'view') return hasRole(['admin']);
            if (action === 'manage') return hasRole(['admin']);
        }
        if (resource === 'comment') {
            if (action === 'add') return true;
            // if (action === 'delete') return hasRole(['admin', 'lead']); // Your commented out line
        }
        if (resource === 'customer') {
            if (action === 'view') return true;
            if (action === 'edit') return hasRole(['admin', 'account_manager']);
            
        }
        return false;
    };

   

    return (
        <AuthContext.Provider value={{
            isAuthenticated: !!firebaseUser && !!appUser,
            user: appUser,
            firebaseUser,
            logout,
            hasRole,
            hasPermission,
            isLoading,
            updateProfileData,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
