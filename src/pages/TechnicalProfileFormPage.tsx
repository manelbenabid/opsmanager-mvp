// frontend/src/pages/EditTechnicalTeamMemberPage.tsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { 
    getTechnicalTeamMemberDetailsById, // Assuming this fetches the data needed for the form
    updateTechnicalTeamMemberProfile, // Assuming this updates the data
    TechnicalTeamMemberProfile, // Import from services/api
    UpdateTechnicalProfilePayload // Import this if it's defined in api.ts, or define locally
} from '../services/api'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from "sonner";
import { getLevelFromGrade } from './TechnicalTeamMemberDetailPage';

// Zod Schema for the editable fields
const editProfileSchema = z.object({
  team: z.enum(['Delivery', 'Managed Services'], { required_error: "Team is required." }),
  grade: z.string().min(1, "Grade is required."), // G1-G15
  yearsOfExperience: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Years of experience is required." }).int().min(0, "Years cannot be negative.")
  ),
  skills: z.string().optional(),
  certificates: z.string().optional(),
  fields_covered: z.string().optional(),
  technical_development_plan: z.string().optional(),
});

type EditProfileFormValues = z.infer<typeof editProfileSchema>;

// If UpdateTechnicalProfilePayload is not imported, define it here based on what backend expects
// For example:
// interface UpdateTechnicalProfilePayload {
//   team: 'Delivery' | 'Managed Services';
//   level: 'Junior' | 'Specialist' | 'Senior' | 'Lead' | 'Technical Manager';
//   grade: string;
//   yearsOfExperience: number;
//   skills: string[];
//   certificates: string[];
// }


const TechnicalProfileFormPage: React.FC = () => {
  const { employeeId: employeeIdString } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [employeeInitialData, setEmployeeInitialData] = useState<TechnicalTeamMemberProfile | null>(null);


  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      team: undefined,
      grade: '',
      yearsOfExperience: 0,
      skills: '',
      certificates: '',
      fields_covered: '',
      technical_development_plan: '',
    }
  });

  useEffect(() => {
    if (!employeeIdString) {
      toast.error("Employee ID is missing.");
      navigate('/employees');
      return;
    }

    const parsedEmployeeId = parseInt(employeeIdString, 10);
    if (isNaN(parsedEmployeeId)) {
        toast.error("Invalid Employee ID format.");
        navigate('/employees');
        return;
    } 

    // Example permission: user needs to be able to edit employee profiles
    if (!hasPermission('employee', 'manage')) { // Adjust permission as needed
        toast.error("You don't have permission to edit employee profiles.");
        navigate(`/employees/technical-profile/${employeeIdString}`); 
        return;
    }

    const loadEmployeeData = async () => {
      setLoading(true);
      try {
        // Use actual API call
        const data = await getTechnicalTeamMemberDetailsById(parsedEmployeeId); 
        if (data) {
          setEmployeeInitialData(data);
          form.reset({
            team: data.team as any,
            grade: data.grade,
            yearsOfExperience: typeof data.yearsOfExperience === 'string' 
                                ? parseInt(data.yearsOfExperience.replace(/\D/g,''), 10) 
                                : data.yearsOfExperience,
            skills: data.skills?.join(', ') || '',
            certificates: data.certificates?.join(', ') || '',
            fields_covered: data.fields_covered?.join(', ') || '',
            technical_development_plan: data.technical_development_plan?.join(', ') || '',
          });
        } else {
          toast.error(`Employee with ID ${employeeIdString} not found.`);
          navigate('/employees');
        }
      } catch (error) {
        console.error("Error fetching employee details for edit:", error);
        toast.error("Failed to load employee details for editing.");
      } finally {
        setLoading(false);
      }
    };
    loadEmployeeData();
  }, [employeeIdString, navigate, form, hasPermission]);

  const onSubmit = async (formData: EditProfileFormValues) => {
    if (!employeeIdString) return;
    const parsedEmployeeId = parseInt(employeeIdString, 10);
    if (isNaN(parsedEmployeeId)) return;

    setSubmitting(true);
    
    const payload: UpdateTechnicalProfilePayload = {
      ...formData,
      skills: formData.skills?.split(',').map(s => s.trim()).filter(Boolean) || [],
      certificates: formData.certificates?.split(',').map(c => c.trim()).filter(Boolean) || [],
      fields_covered: formData.fields_covered?.split(',').map(f => f.trim()).filter(Boolean) || [],
      technical_development_plan: formData.technical_development_plan?.split(',').map(p => p.trim()).filter(Boolean) || [],
    };


    console.log("Processed payload for API:", payload);

    try {
      await updateTechnicalTeamMemberProfile(parsedEmployeeId, payload);
      toast.success("Employee profile updated successfully!");
      navigate(`/employees/technical-profile/${employeeIdString}`);
    } catch (error) {
      console.error("Error updating employee profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const gradeOptions = Array.from({ length: 15 }, (_, i) => `G${i + 1}`); // G1 to G15
  const watchedGrade = form.watch('grade');
  const derivedLevel = useMemo(() => getLevelFromGrade(watchedGrade), [watchedGrade]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-128px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/employees/technical-profile/${employeeIdString}`)} 
          className="flex items-center mb-6 text-sm font-medium text-gray-500 hover:text-indigo-600 px-0"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Profile
        </Button>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Edit Technical Profile</CardTitle>
            <CardDescription>
              Update details for {employeeInitialData?.name || 'employee'} 
              {employeeInitialData?.jobTitle && ` (${employeeInitialData.jobTitle})`}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="team"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Team *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Delivery">Delivery</SelectItem>
                          <SelectItem value="Managed Services">Managed Services</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Grade Dropdown (G1-G15) */}
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {gradeOptions.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Level Display (Read-only, derived from Grade) */}
                <div>
                    <FormLabel>Derived Level</FormLabel>
                    <div className="p-2 border rounded-md bg-slate-100 dark:bg-slate-800 min-h-[40px] flex items-center text-sm font-medium text-gray-700 dark:text-gray-300">
                      {derivedLevel}
                    </div>
                </div>

                <FormField
                  control={form.control}
                  name="yearsOfExperience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Years of Experience *</FormLabel>
                      <FormControl>
                        <Input 
                          id={field.name} 
                          type="number" 
                          placeholder="e.g., 5" 
                          {...field} 
                          onChange={e => {
                            const value = e.target.value;
                            // Update form with number, or undefined if empty to allow Zod's required_error
                            field.onChange(value === '' ? undefined : parseInt(value, 10)); 
                          }}
                          value={field.value === undefined || field.value === null || isNaN(field.value) ? '' : field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* New Textarea Fields */}
                <FormField
                  control={form.control}
                  name="fields_covered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fields Covered</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Site Surveys, Meraki, Security..." {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated list of technical fields.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technical_development_plan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technical Development Plan</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Advanced AWS Cert, Python Course..." {...field} />
                      </FormControl>
                      <FormDescription>Comma-separated list of development items.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skills</FormLabel>
                      <FormControl>
                        <Textarea
                          id={field.name}
                          placeholder="Enter skills, comma-separated (e.g., Networking, Python, AWS)"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Comma-separated list of skills.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="certificates"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificates</FormLabel>
                      <FormControl>
                        <Textarea
                          id={field.name}
                          placeholder="Enter certificates, comma-separated (e.g., CCNP, AWS Certified)"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Comma-separated list of certificates.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate(`/employees/technical-profile/${employeeIdString}`)} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={submitting || loading}>
                        <Save className="mr-2 h-4 w-4" />
                        {submitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TechnicalProfileFormPage;
