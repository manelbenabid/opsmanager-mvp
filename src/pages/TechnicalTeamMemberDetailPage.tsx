// frontend/src/pages/TechnicalTeamMemberDetailPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { getTechnicalTeamMemberDetailsById, TechnicalTeamMemberProfile } from '../services/api'; // Import a new interface if needed
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, UserCircle, Briefcase, Layers, TrendingUp, GanttChartSquare, CalendarDays, Star, Award, ClipboardList, Target } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { toast } from "sonner";

// Helper function to derive Level from Grade. This can be moved to a shared utility file.
export const getLevelFromGrade = (grade?: string | null): string => {
  if (!grade) return 'N/A';
  const gradeNum = parseInt(grade.replace('G', ''), 10);
  if (isNaN(gradeNum)) return 'N/A';

  if (gradeNum === 1) return 'Fresh';
  if (gradeNum >= 2 && gradeNum <= 4) return `Junior ${'I'.repeat(gradeNum - 1)}`;
  if (gradeNum >= 5 && gradeNum <= 6) return `Specialist ${'I'.repeat(gradeNum - 4)}`;
  if (gradeNum >= 7 && gradeNum <= 8) return 'Specialist III';
  if (gradeNum >= 9 && gradeNum <= 11) return `Senior ${'I'.repeat(gradeNum - 8)}`;
  if (gradeNum === 12) return 'Lead';
  if (gradeNum === 13) return 'Senior Lead';
  if (gradeNum === 14) return 'Associate Technical Manager';
  if (gradeNum === 15) return 'Senior Technical Manager';
  
  return 'N/A'; // Default case for grades outside G1-G15
};


const TechnicalTeamMemberDetailPage: React.FC = () => {
  const { employeeId: employeeIdString } = useParams<{ employeeId: string }>(); 
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [member, setMember] = useState<TechnicalTeamMemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeIdString) {
      console.log("employeeId", employeeIdString)
      toast.error("Employee ID is missing.");
      navigate('/employees'); // Or a 404 page
      return;
    }

    const parsedEmployeeId = parseInt(employeeIdString, 10);

    if (!hasPermission('employee', 'manage')) {
      console.log(hasPermission('employee', 'manage'));
      toast.error("You don't have permission to view these details.");
      navigate('/unauthorized');
      return;
    }

    const loadMemberData = async (id: number) => { // Function now expects a number
      setLoading(true);
      try {
        // Now calling with the numeric ID
        const data = await getTechnicalTeamMemberDetailsById(id); 
        
        if (data) {
          setMember(data);
        } else {
          toast.error(`Technical Team member with ID ${id} not found or has no profile.`);
          navigate('/employees');
        }
      } catch (error) {
        console.error("Error fetching technical team member details:", error);
        toast.error("Failed to load member details. The backend might not be ready or an error occurred.");
      } finally {
        setLoading(false);
      }
    };

    loadMemberData(parsedEmployeeId); // Pass the parsed numeric ID

  }, [employeeIdString, navigate, hasPermission]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-128px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 text-center">
          <h1 className="text-2xl font-semibold">Technical Team Member Not Found</h1>
          <p className="text-gray-600 my-2">The requested employee profile could not be loaded.</p>
          <Button onClick={() => navigate('/employees')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Employees List
          </Button>
          {hasPermission('employee', 'manage')  && (
                <Button 
                    variant="outline" 
                    onClick={() => navigate(`/employees/technical-profile/${member.id}/edit`)}
                    className="flex items-center"
                >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                </Button>
            )}
        </div>
      </AppLayout>
    );
  }

    const derivedLevel = getLevelFromGrade(member.grade); // Derive level from grade

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/employees')} 
              className="flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 px-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Employees List
            </Button>
            {/* Edit Profile Button - visible if user has permission */}
            {hasPermission('employee', 'manage') && (
                <Button 
                    variant="outline" 
                    onClick={() => navigate(`/employees/technical-profile/${member.id}/edit`)}
                    className="flex items-center"
                >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                </Button>
            )}
        </div>

        <Card className="shadow-xl overflow-hidden">
          <CardHeader className="bg-slate-100 dark:bg-slate-800 p-6 border-b dark:border-slate-700">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0 p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <UserCircle className="h-20 w-20 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-3xl font-bold text-gray-800 dark:text-gray-100">{member.name}</CardTitle>
                <CardDescription className="text-lg text-blue-600 dark:text-blue-400 font-medium mt-1">{member.jobTitle}</CardDescription>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{member.email}</p>
              </div>
              {/* {hasPermission('employee', 'edit_profile') && (
                <Button variant="outline" onClick={() => navigate(`/employees/technical/${member.id}/edit`)}>Edit Profile</Button>
              )} */}
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-8">
            <InfoSection title="Professional Details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <InfoItem icon={<Layers />} label="Assigned Team" value={member.team} />
                <InfoItem icon={<GanttChartSquare />} label="Grade" value={member.grade} />
                <InfoItem icon={<TrendingUp />} label="Level" value={derivedLevel} />
                <InfoItem icon={<CalendarDays />} label="Years of Experience" value={member.yearsOfExperience.toString()} />
              </div>
            </InfoSection>
            

            <Separator />

            <InfoSection title="Expertise">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center"><ClipboardList className="w-5 h-5 mr-2 text-purple-500" /> Fields Covered</h4>
              {member.fields_covered && member.fields_covered.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {member.fields_covered.map((field, index) => (<Badge key={index} variant="secondary" className="text-sm px-3 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">{field}</Badge>))}
                </div>
              ) : (<p className="text-sm text-gray-500 dark:text-gray-400">No fields covered are listed.</p>)}

              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-2 flex items-center"><Star className="w-5 h-5 mr-2 text-amber-500" /> Skills</h4>
              {member.skills && member.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {member.skills.map((skill, index) => (<Badge key={index} variant="outline" className="text-sm px-3 py-1 border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:bg-blue-900/50">{skill}</Badge>))}
                </div>
              ) : (<p className="text-sm text-gray-500 dark:text-gray-400">No skills listed.</p>)}
            </InfoSection>

            <Separator />

            <InfoSection title="Qualifications & Development">
              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center"><Award className="w-5 h-5 mr-2 text-green-500" /> Certificates</h4>
              {member.certificates && member.certificates.length > 0 ? (<ul className="list-disc list-inside space-y-1 text-sm">{member.certificates.map((cert, index) => (<li key={index}>{cert}</li>))}</ul>) : (<p className="text-sm text-gray-500">No certificates listed.</p>)}

              <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-2 flex items-center"><Target className="w-5 h-5 mr-2 text-red-500" /> Technical Development Plan</h4>
              {member.technical_development_plan && member.technical_development_plan.length > 0 ? (<ul className="list-disc list-inside space-y-1 text-sm">{member.technical_development_plan.map((plan, index) => (<li key={index}>{plan}</li>))}</ul>) : (<p className="text-sm text-gray-500">No development plan listed.</p>)}
            </InfoSection>


          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

// Helper Components (can be moved to a separate file if reused)
const InfoSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-4">
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 border-b pb-2 mb-4 dark:border-slate-700">{title}</h3>
    {children}
  </div>
);

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
}
const InfoItem: React.FC<InfoItemProps> = ({ icon, label, value }) => (
  <div className="flex items-start space-x-3">
    <div className="flex-shrink-0 mt-1 text-blue-500 dark:text-blue-400">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5"})}
    </div>
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-md font-semibold text-gray-700 dark:text-gray-200">{value || 'N/A'}</p>
    </div>
  </div>
);

export default TechnicalTeamMemberDetailPage;
