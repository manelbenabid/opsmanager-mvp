import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole as AuthUserRole, UserLocation as AuthUserLocation, UserStatus as AuthUserStatus } from '../contexts/AuthContext'; // Import specific types from AuthContext
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { User, Mail, Phone, Tag, FileText, MapPin, CheckCircle, Briefcase, Building2 } from 'lucide-react';
import { 
  updateEmployee,
  getEmployeeLocations,
  getEmployeeStatuses,
  Employee // Import Employee type from api.ts
} from '../services/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge'; // Added missing import for Badge


// Form data structure, aligning with editable fields of the Employee interface from api.ts
// But using string for fields that are arrays or numbers in the backend for easier form handling.
interface MyInfoFormData {
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  workExt: string; // Will be converted to number for API
  skills: string; // Comma-separated string
  certificates: string; // Comma-separated string
  location: string | null; // string for select, but Employee.location is string | null
  status: string; // string for select, Employee.status is string
  jobTitle: string;
}

const MyInfoPage: React.FC = () => {
  // userFromAuth is the user object from AuthContext
  // updateUserInfo is the function from AuthContext to update its internal user state
  const { user: userFromAuth, updateProfileData } = useAuth(); 
  const [submitting, setSubmitting] = useState(false);
  const [employeeLocations, setEmployeeLocations] = useState<string[]>([]);
  const [employeeStatuses, setEmployeeStatuses] = useState<string[]>([]);
  const [loadingEnums, setLoadingEnums] = useState(true);
  
  const [formData, setFormData] = useState<MyInfoFormData>({
    name: '',
    email: '',
    phoneNumber: '',
    role: '',
    workExt: '',
    skills: '',
    certificates: '',
    location: '', 
    status: '',
    jobTitle: ''
  });

  // Initialize form data from the user object in AuthContext
  useEffect(() => {
    if (userFromAuth) {
      setFormData({
        name: userFromAuth.name || '',
        email: userFromAuth.email || '',
        phoneNumber: userFromAuth.phone || '', 
        role: userFromAuth.employeeDbRole || '',
        workExt: userFromAuth.workExt?.toString() || '', 
        skills: userFromAuth.skills?.join(', ') || '',
        certificates: userFromAuth.certificates?.join(', ') || '',
        location: userFromAuth.location || null, 
        status: userFromAuth.status || '',
        jobTitle: userFromAuth.jobTitle || '',
      });
    }
  }, [userFromAuth]);



  const loadEnums = useCallback(async () => {
    try {
      setLoadingEnums(true);
      const [locations, statuses] = await Promise.all([
        getEmployeeLocations(),
        getEmployeeStatuses()
      ]);
      setEmployeeLocations(locations);
      setEmployeeStatuses(statuses);
    } catch (error) {
      console.error("Failed to load employee options", error);
      toast.error("Could not load options for location/status.");
    } finally {
      setLoadingEnums(false);
    }
  }, []);

  useEffect(() => {
    loadEnums();
  }, [loadEnums]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value as string }));
  };

  const handleSelectChange = (name: keyof MyInfoFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userFromAuth || !userFromAuth.id) {
        toast.error("User information is not available.");
        return;
    }
    
    setSubmitting(true);
    
    try {
      // Prepare payload for the updateEmployee API call
      // This should match Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'managerEmail' | 'role'>>
      const apiPayload: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'managerEmail' | 'role'>> = {
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        workExt: formData.workExt !== '' && !isNaN(parseInt(formData.workExt, 10)) ? parseInt(formData.workExt, 10) : undefined,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        certificates: formData.certificates.split(',').map(c => c.trim()).filter(Boolean),
        location: formData.location || null,
        status: formData.status,
        jobTitle: formData.jobTitle,
      };

      // Filter out undefined values explicitly if API doesn't like them
      const updatePayloadForApi = Object.fromEntries(
        Object.entries(apiPayload).filter(([, value]) => value !== undefined)
      ) as typeof apiPayload;

      // AuthContext user.id is string, API expects number
      const userIdAsNumber = parseInt(userFromAuth.id, 10);
      if (isNaN(userIdAsNumber)) {
        toast.error("Invalid user ID format.");
        setSubmitting(false);
        return;
      }

      const updatedEmployeeFromApi = await updateEmployee(userIdAsNumber, updatePayloadForApi);
      
      if (updatedEmployeeFromApi) {
        // Prepare data to update AuthContext. This needs to match AuthContext's user structure.
        // The `updateUserInfo` from AuthContext expects Partial<typeof mockUser>
        const authContextUpdatePayload = {
            // Map fields from updatedEmployeeFromApi (Employee type) back to AuthContext user type
            email: updatedEmployeeFromApi.email,
            phone: updatedEmployeeFromApi.phoneNumber,
            workExtension: updatedEmployeeFromApi.workExt?.toString(),
            skills: updatedEmployeeFromApi.skills,
            certificates: updatedEmployeeFromApi.certificates,
            location: updatedEmployeeFromApi.location as AuthUserLocation | undefined, // Cast to AuthContext type
            status: updatedEmployeeFromApi.status as AuthUserStatus | undefined, // Cast to AuthContext type
            jobTitle: updatedEmployeeFromApi.jobTitle,
            
        };
        
        // Create a new user object for AuthContext by merging existing and updated fields
        // Also, ensure 'name' is reconstructed if firstName/lastName were part of the API response (they are not in this specific update path)
        // For now, we assume 'name' in AuthContext is updated if individual name parts were theoretically changeable via this form.
        // Since 'firstName' and 'lastName' are not on this form, 'name' from AuthContext will be preserved by default.
        const newAuthContextUser = {
            ...userFromAuth, // Preserve existing AuthContext user fields
            // If Employee API returned firstName/lastName, you could reconstruct 'name':
            // name: `${updatedEmployeeFromApi.firstName || userFromAuth.name?.split(' ')[0] || ''} ${updatedEmployeeFromApi.lastName || userFromAuth.name?.split(' ')[1] || ''}`.trim(), 
            ...authContextUpdatePayload 
        };

        updateProfileData(newAuthContextUser); // Use the actual update function from AuthContext
        toast.success('Your information has been updated successfully!');
      } else {
         toast.warning('Information updated, but local display might need a refresh or API did not return updated data.');
      }

    } catch (error) {
      console.error('Error updating information:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Failed to update your information: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!userFromAuth) {
    return (
        <AppLayout>
            <div className="flex items-center justify-center h-64">
                <p>Loading user information...</p>
            </div>
        </AppLayout>
    );
  }
  // Removed redundant loadingEnums && !user check, as !user already covers it.
  if (loadingEnums) { 
     return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">My Information</h1>
          <p className="text-gray-500 mt-1">Update your personal and work information.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-8">
            <Card className="overflow-hidden shadow-lg">
              <CardHeader className="bg-gradient-to-r from-sky-50 to-blue-50 p-6">
                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-sky-500 flex items-center justify-center shadow-md text-white text-4xl font-semibold">
                    {/* AuthContext user has 'name', not firstName/lastName directly */}
                    {userFromAuth.name?.split(' ').map(n => n[0]?.toUpperCase()).join('') || <User />}
                  </div>
                  <div>
                    <CardTitle className="text-2xl text-gray-800">{userFromAuth.name}</CardTitle>
                    <CardDescription className="text-gray-600 text-base">{userFromAuth.jobTitle || 'Job title not set'}</CardDescription>
                    {userFromAuth.employeeDbRole && userFromAuth.employeeDbRole.length > 0 && (
                        <Badge variant="outline" className="mt-2 text-sm">
                            {userFromAuth.employeeDbRole}
                        </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-semibold flex items-center mb-4 text-gray-700">
                    <Phone className="w-5 h-5 mr-3 text-sky-600" />
                    Contact Information
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="email" className="text-sm font-medium text-gray-700">Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input 
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="your.email@example.com"
                            className="pl-10 py-2.5"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">Phone Number</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                          <Input 
                            id="phoneNumber"
                            name="phoneNumber"
                            value={formData.phoneNumber}
                            onChange={handleChange}
                            placeholder="+1 (555) 123-4567"
                            className="pl-10 py-2.5"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="workExt" className="text-sm font-medium text-gray-700">Work Extension</label>
                       <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input 
                          id="workExt"
                          name="workExt"
                          type="text" 
                          value={formData.workExt}
                          onChange={handleChange}
                          placeholder="e.g., 1234"
                          className="pl-10 py-2.5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-xl font-semibold flex items-center mb-4 text-gray-700">
                    <Briefcase className="w-5 h-5 mr-3 text-sky-600" />
                    Work Details
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor="jobTitle" className="text-sm font-medium text-gray-700">Job Title</label>
                        <Input 
                          id="jobTitle"
                          name="jobTitle"
                          value={formData.jobTitle}
                          onChange={handleChange}
                          placeholder="e.g., Software Engineer"
                          className="py-2.5"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="status" className="text-sm font-medium text-gray-700">Status</label>
                        <Select
                          value={formData.status}
                          onValueChange={(value) => handleSelectChange('status', value)}
                          disabled={loadingEnums}
                        >
                          <SelectTrigger className="py-2.5">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeeStatuses.map(s => (
                              <SelectItem key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                        <label htmlFor="location" className="text-sm font-medium text-gray-700">Location</label>
                        <Select
                          value={formData.location || ''}
                          onValueChange={(value) => handleSelectChange('location', value)}
                          disabled={loadingEnums}
                        >
                          <SelectTrigger className="py-2.5">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                          <SelectContent>
                            {employeeLocations.map(loc => (
                              <SelectItem key={loc} value={loc}>
                                {loc.charAt(0).toUpperCase() + loc.slice(1).replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h3 className="text-xl font-semibold flex items-center mb-4 text-gray-700">
                    <Tag className="w-5 h-5 mr-3 text-sky-600" />
                    Skills & Certifications
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label htmlFor="skills" className="text-sm font-medium text-gray-700">Skills</label>
                      <Textarea 
                        id="skills"
                        name="skills"
                        value={formData.skills}
                        onChange={handleChange}
                        placeholder="Enter skills separated by commas (e.g., React, TypeScript)"
                        className="min-h-[80px] py-2.5"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="certificates" className="text-sm font-medium text-gray-700">Certificates</label>
                      <Textarea 
                        id="certificates"
                        name="certificates"
                        value={formData.certificates}
                        onChange={handleChange}
                        placeholder="Enter certificates separated by commas"
                        className="min-h-[80px] py-2.5"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="border-t bg-gray-50 px-6 py-4">
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white ml-auto px-6 py-2.5" 
                  disabled={submitting || loadingEnums}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {submitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default MyInfoPage;
