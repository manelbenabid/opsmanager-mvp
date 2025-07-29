// frontend/src/components/GenericEmployeeListComponent.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Adjusted path assuming contexts is sibling to components
import { 
  getEmployees, 
  createEmployee,
  updateEmployee,
  Employee,
  CreateEmployeePayload, 
  UpdateEmployeePayload, 
  getEmployeeRoles,
  getEmployeeStatuses,
  getEmployeeLocations
} from '../services/api'; 
// Note: AppLayout is typically used by pages, not by a generic list component directly.
// Pages using this component will be wrapped in AppLayout.
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; 
import { Button } from '@/components/ui/button';
import { Search, Mail, Phone, UserCircle, Briefcase, Plus, Edit, UserPlus, MapPin, Eye, Filter } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Separator } from '@/components/ui/separator';

// Zod Schema, Role Colors, Dialog Props and Component (Copied from your EmployeeListPage)
// These can also be moved to separate utility/type files if used elsewhere

const employeeFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email format").refine(val => val.endsWith('@taqniyat.com.sa'), {
    message: "Email must end with @taqniyat.com.sa"
  }),
  phoneNumber: z.string().min(1, "Phone number is required").regex(/^\+?[0-9\s-]+$/, "Invalid phone number format"),
  workExt: z.string().min(1, "Work extension is required").regex(/^\d+$/, { 
    message: "Work extension must be a number.",
  }),
  jobTitle: z.string().min(1, "Job title is required"),
  role: z.string().min(1, "Company role is required"), 
  managerEmail: z.string().email("Invalid manager email format").optional().or(z.literal('')).refine(val => val === '' || val === undefined || val.endsWith('@taqniyat.com.sa'), {
    message: "Manager Email must end with @taqniyat.com.sa if provided"
  }),
  status: z.string().min(1, "Status is required"), 
  skills: z.string().refine(val => val.trim() !== '', { message: "Skills are required (comma-separated)" }), 
  certificates: z.string().refine(val => val.trim() !== '', { message: "Certificates are required (comma-separated)" }),
  location: z.string().nullable().optional(), 
});
type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

const companyRoleColors: { [key: string]: string } = {
  lead: 'bg-purple-100 text-purple-700 border-purple-300',
  technical_team: 'bg-green-100 text-green-700 border-green-300',
  account_manager: 'bg-amber-100 text-amber-700 border-amber-300',
  default: 'bg-gray-100 text-gray-700 border-gray-300',
};

interface EmployeeFormDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  employee?: Employee | null; 
  onFormSubmitSuccess: () => void; 
  availableRoles: string[];
  availableStatuses: string[];
  availableLocations: string[];
}

const EmployeeFormDialog: React.FC<EmployeeFormDialogProps> = ({
  open, setOpen, employee, onFormSubmitSuccess, availableRoles, availableStatuses, availableLocations
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = !!employee;
  const form = useForm<EmployeeFormValues>({ resolver: zodResolver(employeeFormSchema) });

  useEffect(() => {
    if (open) {
        if (isEditMode && employee) {
            form.reset({
                firstName: employee.firstName || "", lastName: employee.lastName || "",
                email: employee.email || "", phoneNumber: employee.phoneNumber || "",
                workExt: employee.workExt?.toString() || "", jobTitle: employee.jobTitle || "",
                role: employee.role || "", managerEmail: employee.managerEmail || "",
                status: employee.status || "", skills: employee.skills?.join(', ') || "",
                certificates: employee.certificates?.join(', ') || "", location: employee.location || null,
            });
        } else { 
            form.reset({ 
                firstName: "", lastName: "", email: "", phoneNumber: "", workExt: "",
                jobTitle: "", role: availableRoles[0] || "", managerEmail: "", status: availableStatuses[0] || "",
                skills: "", certificates: "", location: availableLocations[0] || null,
            });
        }
    }
  }, [employee, open, form, isEditMode, availableRoles, availableStatuses, availableLocations]);

  const onSubmit = async (data: EmployeeFormValues) => {
    setIsSubmitting(true);
    const workExtNum = parseInt(data.workExt, 10); 
    const payload = { ...data, workExt: workExtNum, 
        skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        certificates: data.certificates.split(',').map(c => c.trim()).filter(Boolean),
        managerEmail: data.managerEmail || null, location: data.location || null,     
    };
    try {
      if (isEditMode && employee) { await updateEmployee(employee.id, payload as UpdateEmployeePayload); toast.success("Employee updated!"); } 
      else { await createEmployee(payload as CreateEmployeePayload); toast.success("Employee created!"); }
      setOpen(false); onFormSubmitSuccess();
    } catch (error: any) { console.error(error); toast.error(error.response?.data?.error || error.message || "Failed action."); } 
    finally { setIsSubmitting(false); }
  };
  return ( <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if(!isOpen) form.reset();}}> <DialogContent className="sm:max-w-[600px]"> <DialogHeader> <DialogTitle>{isEditMode ? 'Edit Employee' : 'Add New Employee'}</DialogTitle> <DialogDescription> {isEditMode ? 'Update info.' : 'Fill details.'} </DialogDescription> </DialogHeader> <Form {...form}> <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2"> {/* FormFields go here, same as your current dialog */} <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name *</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} /> </div> <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" placeholder="john.doe@taqniyat.com.sa" {...field} /></FormControl><FormMessage /></FormItem>)} /> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number *</FormLabel><FormControl><Input placeholder="+966..." {...field} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={form.control} name="workExt" render={({ field }) => (<FormItem><FormLabel>Work Extension *</FormLabel><FormControl><Input type="text" placeholder="1234" {...field} /></FormControl><FormMessage /></FormItem>)} /> </div> <Separator /> <FormField control={form.control} name="jobTitle" render={({ field }) => (<FormItem><FormLabel>Job Title *</FormLabel><FormControl><Input placeholder="e.g., Senior Software Engineer" {...field} /></FormControl><FormMessage /></FormItem>)} /> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Company Role *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger></FormControl><SelectContent>{availableRoles.map(r => <SelectItem key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /> <FormField control={form.control} name="managerEmail" render={({ field }) => (<FormItem><FormLabel>Manager Email</FormLabel><FormControl><Input type="email" placeholder="manager@taqniyat.com.sa" {...field} /></FormControl><FormMessage /></FormItem>)} /> </div> <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{availableStatuses.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /> <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger></FormControl><SelectContent>{availableLocations.map(l => <SelectItem key={l} value={l}>{l.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /> </div> <Separator /> <FormField control={form.control} name="skills" render={({ field }) => (<FormItem><FormLabel>Skills *</FormLabel><FormControl><Textarea placeholder="React, Node.js, PostgreSQL (comma-separated)" {...field} /></FormControl><FormMessage /></FormItem>)} /> <FormField control={form.control} name="certificates" render={({ field }) => (<FormItem><FormLabel>Certificates *</FormLabel><FormControl><Textarea placeholder="AWS Certified Developer, Scrum Master (comma-separated)" {...field} /></FormControl><FormMessage /></FormItem>)} /> <DialogFooter> <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button> <Button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700"> {isSubmitting ? (isEditMode ? 'Saving...' : 'Creating...') : (isEditMode ? 'Save Changes' : 'Create Employee')} </Button> </DialogFooter> </form> </Form> </DialogContent> </Dialog> );};


interface GenericEmployeeListComponentProps {
  pageTitle: string;
  pageDescription: string;
  filterRoles?: string[]; // Array of roles to filter by, or null/undefined for all
  showRoleFilter?: boolean;
}

const GenericEmployeeListComponent: React.FC<GenericEmployeeListComponentProps> = ({
  pageTitle,
  pageDescription,
  filterRoles,
  showRoleFilter = false,
}) => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate(); 
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]); // Holds all fetched employees
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilterUI, setSelectedRoleFilterUI] = useState<string>('All Roles');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [loadingEnums, setLoadingEnums] = useState(true);

  const loadEnums = useCallback(async () => {
    try {
      setLoadingEnums(true); 
      const [roles, statuses, locations] = await Promise.all([
        getEmployeeRoles(), getEmployeeStatuses(), getEmployeeLocations(),
      ]);
      setAvailableRoles(roles); setAvailableStatuses(statuses); setAvailableLocations(locations);
    } catch (error) { toast.error("Failed to load options for form."); console.error("Enum loading error:", error); } 
    finally { setLoadingEnums(false); }
  }, []);
  
  const fetchAllEmployees = useCallback(async () => {
    if (!hasPermission('employee', 'view')) { setLoading(false); return; }
    try {
      setLoading(true); const data = await getEmployees(); setAllEmployees(data);
    } catch (error) { console.error('Error fetching employees:', error); toast.error('Failed to load employees.'); } 
    finally { setLoading(false); }
  }, [hasPermission]);

  useEffect(() => { loadEnums(); fetchAllEmployees(); }, [loadEnums, fetchAllEmployees]); 

  const handleOpenCreateDialog = () => { setEditingEmployee(null); setIsFormOpen(true); };
  const handleOpenEditDialog = (employee: Employee) => { setEditingEmployee(employee); setIsFormOpen(true); };

  // Apply role filter first, then search term
  const processedEmployees = useMemo(() => {
    let employeesToDisplay = allEmployees;
    // Apply the external role filter from props (e.g., for Delivery Team page)
    if (filterRoles && filterRoles.length > 0) {
      employeesToDisplay = employeesToDisplay.filter(employee => 
        typeof employee.role === 'string' && filterRoles.includes(employee.role)
      );
    }
    // Apply the UI dropdown role filter
    if (showRoleFilter && selectedRoleFilterUI !== 'All Roles') {
      employeesToDisplay = employeesToDisplay.filter(employee => 
        typeof employee.role === 'string' && employee.role === selectedRoleFilterUI
      );
    }
    // Apply search term
    if (searchTerm) {
      const searchValue = searchTerm.toLowerCase();
      employeesToDisplay = employeesToDisplay.filter(employee => {
        const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
        const roleString = typeof employee.role === 'string' ? employee.role.toLowerCase() : '';
        const locationString = typeof employee.location === 'string' ? employee.location.toLowerCase() : '';
        return (
          fullName.includes(searchValue) || employee.email.toLowerCase().includes(searchValue) ||
          (employee.jobTitle && employee.jobTitle.toLowerCase().includes(searchValue)) ||
          roleString.includes(searchValue) || (employee.phoneNumber && employee.phoneNumber.includes(searchValue)) ||
          locationString.includes(searchValue)
        );
      });
    }
    return employeesToDisplay;
  }, [allEmployees, filterRoles, selectedRoleFilterUI, searchTerm, showRoleFilter]);

  const getRoleColor = (role: string) => { const normalized = typeof role === 'string' ? role.toLowerCase().replace(/\s+/g, '_') : 'default'; return companyRoleColors[normalized] || companyRoleColors.default; };
  const formatDisplayValue = (value: string | null | undefined) => { if (!value) return 'N/A'; return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); };

  const rolesWithDetailView = ['Technical Team', 'Managed Services'];

  return (
    // This component does not render AppLayout itself. The page using it will.
    <div className="p-4 md:p-6"> {/* This div is what pages will place inside AppLayout */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">{pageTitle}</h1>
          <p className="text-gray-500">{pageDescription}</p>
        </div>
        {hasPermission('employee', 'manage') && ( 
          <Button onClick={handleOpenCreateDialog} className="bg-indigo-600 hover:bg-indigo-700">
            <UserPlus className="w-4 h-4 mr-2" /> Add New Employee
          </Button>
        )}
      </div>

      <Card className="mb-6 shadow-sm">
        <CardContent className="pt-6 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input id="employeeSearch" placeholder="Search employees..." className="pl-12 pr-4 py-2.5 text-base rounded-md w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {showRoleFilter && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <Select value={selectedRoleFilterUI} onValueChange={setSelectedRoleFilterUI}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filter by role..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All Roles">All Roles</SelectItem>
                {/* Use availableRoles fetched for the dialog, assuming these are company roles */}
                {availableRoles.map(role => ( <SelectItem key={role} value={role}>{formatDisplayValue(role)}</SelectItem> ))}
              </SelectContent>
            </Select>
          </div>
          )}
        </CardContent>
      </Card>

      {(loading || loadingEnums) && processedEmployees.length === 0 ? ( <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>
      ) : !hasPermission('employee', 'view') ? ( <Card><CardContent className="flex flex-col items-center justify-center h-64"><UserCircle className="h-20 w-20 mx-auto text-red-300 mb-4" /><h3 className="text-xl font-semibold text-gray-800">Access Denied</h3><p className="text-gray-500 text-center mt-2">You do not have permission to view employees.</p></CardContent></Card>
      ) : processedEmployees.length === 0 ? ( <Card><CardContent className="flex flex-col items-center justify-center h-64"><UserCircle className="h-20 w-20 mx-auto text-gray-300 mb-4" /><h3 className="text-xl font-semibold text-gray-800">No Employees Found</h3><p className="text-gray-500 text-center mt-2">{searchTerm || selectedRoleFilterUI !== 'All Roles' ? "Try adjusting your search or filter." : "No employees exist."}</p></CardContent></Card>
      ) : (
        <Card className="shadow-lg">
          <CardHeader className="border-b"><CardTitle>Employees ({processedEmployees.length})</CardTitle></CardHeader>
          <CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow>
              <TableHead className="py-3 px-4 md:px-6">Name</TableHead>
              <TableHead className="py-3 px-4 md:px-6">Job Title</TableHead>
              <TableHead className="py-3 px-4 md:px-6">Company Role</TableHead>
              <TableHead className="py-3 px-4 md:px-6">Status</TableHead>
              <TableHead className="py-3 px-4 md:px-6">Location</TableHead>
              <TableHead className="py-3 px-4 md:px-6 text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {processedEmployees.map((employee) => (
                <TableRow key={employee.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium py-3 px-4 md:px-6"><div className="flex items-center space-x-3">
                    <Avatar className="h-10 w-10"><AvatarFallback className="bg-indigo-100 text-indigo-600 font-semibold">{employee.firstName?.charAt(0).toUpperCase()}{employee.lastName?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div>
                      {rolesWithDetailView.includes(employee.role) ? (
                        <RouterLink to={`/employees/technical-profile/${employee.id}`} className="font-semibold text-gray-800 hover:text-indigo-600 hover:underline">{employee.firstName} {employee.lastName}</RouterLink>
                      ) : ( <span className="font-semibold text-gray-800">{employee.firstName} {employee.lastName}</span> )}
                      <div className="text-xs text-gray-500">{employee.email}</div>
                    </div></div>
                  </TableCell>
                  <TableCell className="py-3 px-4 md:px-6 text-sm text-gray-600"><div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-gray-400" />{employee.jobTitle || 'N/A'}</div></TableCell>
                  <TableCell className="py-3 px-4 md:px-6"><Badge variant="outline" className={`px-2 py-1 text-xs font-medium border ${getRoleColor(employee.role)}`}>{formatDisplayValue(employee.role)}</Badge></TableCell>
                  <TableCell className="py-3 px-4 md:px-6"><Badge variant={employee.status.toLowerCase() === 'active' ? 'default' : 'secondary'} className={employee.status.toLowerCase() === 'active' ? 'bg-green-100 text-green-700 border-green-300' : employee.status.toLowerCase() === 'on leave' ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-red-100 text-red-700 border-red-300'}>{formatDisplayValue(employee.status)}</Badge></TableCell>
                  <TableCell className="py-3 px-4 md:px-6 text-sm text-gray-600"><div className="flex items-center"><MapPin className="w-4 h-4 mr-2 text-gray-400" />{formatDisplayValue(employee.location)}</div></TableCell>
                  <TableCell className="text-right py-3 px-4 md:px-6"><div className="flex items-center justify-end space-x-1">
                    {rolesWithDetailView.includes(employee.role) && (<Button asChild variant="ghost" size="icon" className="text-gray-500 hover:text-indigo-600" title="View Technical Profile"><RouterLink to={`/employees/technical-profile/${employee.id}`}><Eye className="h-4 w-4" /></RouterLink></Button> )}
                    <a href={`mailto:${employee.email}`} className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-indigo-50" title={`Email ${employee.email}`}><Mail className="h-4 w-4" /></a>
                    {employee.phoneNumber && (<a href={`tel:${employee.phoneNumber}`} className="p-2 text-gray-500 hover:text-indigo-600 rounded-full hover:bg-indigo-50" title={`Call ${employee.phoneNumber}`}><Phone className="h-4 w-4" /></a>)}
                    {hasPermission('employee', 'manage') && (<Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(employee)} className="text-gray-500 hover:text-indigo-600" title="Edit Employee"><Edit className="h-4 w-4" /></Button> )}
                  </div></TableCell>
                </TableRow>
              ))}
            </TableBody></Table></div>
          </CardContent>
        </Card>
      )}
      {isFormOpen && !loadingEnums && ( 
        <EmployeeFormDialog open={isFormOpen} setOpen={setIsFormOpen} employee={editingEmployee} 
          onFormSubmitSuccess={() => { fetchAllEmployees(); setIsFormOpen(false); }}
          availableRoles={availableRoles} availableStatuses={availableStatuses} availableLocations={availableLocations}
        />
      )}
    </div>
  );
};

export default GenericEmployeeListComponent;

