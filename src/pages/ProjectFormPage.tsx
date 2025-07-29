import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../contexts/AuthContext";
import {
  // Project-specific API calls
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getProjectStatuses,
  getProjectEmployeeRoles,
  // PoC API calls
  getPocById,
  // Shared API calls
  getEmployees,
  getCustomers,
  createCustomer,
  getOrganizationTypes,
  getIndustryTypes,
  // Type definitions
  Poc,
  Project,
  Employee,
  Customer,
  CreateProjectPayload,
  UpdateProjectPayload,
  createProjectStatusUpdate,
  CreateCustomerPayload as CustomerCreatePayload,
  getAddressTypes,
} from "../services/api";
import { format, parseISO } from "date-fns";
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Plus,
  Calendar as CalendarIcon,
  Info,
  Trash2,
  UserPlus,
  UserCircle,
  Check,
  ChevronsUpDown,
  Rocket,
  ShieldCheck
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { MultiSelect } from "../components/MultiSelect"; 

// Schema for a single address, mirroring other pages
const addressFormSchema = z.object({
  id: z.number().optional().nullable(),
  street: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  postalCode: z
    .string()
    .regex(/^[0-9]*$/, "Postal code must be numbers only")
    .optional()
    .or(z.literal("")),
  type: z.string().min(1, "Address type is required"),
  locationUrl: z
    .string()
    .url("Must be a valid URL")
    .min(1, "Location URL is required"),
  country: z.literal("KSA").default("KSA"),
});

// --- Zod Schemas ---
const customerFormSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  website: z
    .string()
    .url("Invalid URL (e.g., https://example.com)")
    .optional()
    .or(z.literal("")),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactEmail: z.string().email("Invalid email format"),
  contactPhone: z.string().min(1, "Phone number is required"),
  industry: z.string().min(1, "Industry is required"),
  organizationType: z.string().min(1, "Organization type is required"),
  addresses: z.array(addressFormSchema).optional(),
  accountManagerId: z.string().nullable().optional(),
});
type CustomerFormValues = z.infer<typeof customerFormSchema>;

const teamMemberSchema = z.object({
  assignmentId: z.number().optional(),
  employeeId: z.string().min(1, "Employee is required"),
  role: z.string().min(1, "Role is required"),
});

const projectFormSchemaBase = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  customerId: z.string().min(1, "Customer is required"),
  technology: z.array(z.string()).min(1, "At least one technology is required"),
  statuses: z.array(z.string()).min(1, "At least one status is required."),
  leadId: z.string().min(1, "Technical Lead is required"),
  teamAssignments: z.array(teamMemberSchema).optional(),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date().nullable().optional(),
  // REQ 2: Project Manager ID is no longer in the form, it's derived from the logged-in user.
  // We'll handle this in the submission logic.
});

// Unified schema for both create and edit, with date validation.
const projectFormSchema = projectFormSchemaBase.refine(
  (data) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      return false;
    }
    return true;
  },
  {
    message: "Est. End Date cannot be earlier than Start Date.",
    path: ["endDate"],
  }
);

type ProjectFormValues = z.infer<typeof projectFormSchema>;

const TECHNOLOGY_OPTIONS = [
  { value: "Switching", label: "Switching" },
  { value: "Routers", label: "Routers" },
  { value: "Security", label: "Security" },
  { value: "Wireless", label: "Wireless" },
  { value: "Firewall", label: "Firewall" },
  { value: "Access Points", label: "Access Points" },
  { value: "Webex Communication", label: "Webex Communication" },
  { value: "IP Phones", label: "IP Phones" },
  { value: "AppDynamics", label: "AppDynamics" },
  { value: "Splunk", label: "Splunk" },
  { value: "Webex Room Kits", label: "Webex Room Kits" },
];

// --- Component ---
const ProjectFormPage: React.FC = () => {
  const { id: projectIdParam } = useParams<{ id: string }>();
  const isEditMode = !!projectIdParam;
  const projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const [searchParams] = useSearchParams();

  const fromPocId = searchParams.get("fromPoc")
    ? parseInt(searchParams.get("fromPoc")!, 10)
    : null;

  // State Management
  const [loadingData, setLoadingData] = useState(true);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialProjectData, setInitialProjectData] = useState<Project | null>(
    null
  );
  const [assignedAccountManager, setAssignedAccountManager] =
    useState<Employee | null>(null);
  const [sourcePoc, setSourcePoc] = useState<Poc | null>(null); // NEW: State to hold source PoC data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<string[]>([]);
  const [teamMemberRoles, setTeamMemberRoles] = useState<string[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<string[]>([]);
  const [industryTypes, setIndustryTypes] = useState<string[]>([]);
  const [addressTypes, setAddressTypes] = useState<string[]>([]);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountManagers, setAccountManagers] = useState<Employee[]>([]);
  const isFromPoc = !!fromPocId || !!initialProjectData?.sourcePocId;
  // Form setup
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema), // Simplified schema usage
    defaultValues: {
      title: "",
      customerId: "",
      technology: [],
      statuses: [],
      startDate: undefined,
      endDate: null,
      leadId: "",
      teamAssignments: [],
    },
  });
  const {
    fields: teamFields,
    append: appendTeamMember,
    remove: removeTeamMember,
  } = useFieldArray({ control: form.control, name: "teamAssignments" });

  // UPDATED: Customer form setup
  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      website: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      industry: "",
      organizationType: "",
      addresses: [],
    },
  });
  const {
    fields: customerAddressFields,
    append: appendCustomerAddress,
    remove: removeCustomerAddress,
  } = useFieldArray({ control: customerForm.control, name: "addresses" });

  // Permissions & Watched Values
  const canManageTeam = hasRole(["admin", "lead"]);
  const watchedLeadId = form.watch("leadId");
  const watchedCustomerId = form.watch("customerId"); // Watch customer ID to react to changes
  const watchedStartDate = form.watch("startDate");

  
  const technicalLeads = useMemo(() => {
    // A lead cannot be the project manager (current user).
    const assignedIds = new Set([user?.id]);
    return employees.filter(
      (emp) => emp.role === "Lead" && !assignedIds.has(emp.id.toString())
    );
  }, [employees, user]);


  const engineeringTeamPool = useMemo(() => {
    // Exclude the current user (PM) and the selected Technical Lead.
    const assignedIds = new Set([watchedLeadId, user?.id]);
    return employees.filter(
      (emp) =>
        emp.role === "Technical Team" && !assignedIds.has(emp.id.toString())
    );
  }, [employees, watchedLeadId, user]);

  // Display name for creator is the current user (Project Manager).
  const projectCreatorDisplayName = user?.name || "N/A (Current User)";

  // Effect to update the Account Manager when the customer changes.
  useEffect(() => {
    if (!watchedCustomerId) {
      setAssignedAccountManager(null);
      return;
    }

    const selectedCustomer = customers.find(
      (c) => c.id.toString() === watchedCustomerId
    );
    if (selectedCustomer?.accountManager) {
      setAssignedAccountManager(selectedCustomer.accountManager as Employee);
    } else {
      setAssignedAccountManager(null);
    }
  }, [watchedCustomerId, customers]);

  // Data Loading
  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [
        employeesData,
        customersData,
        statusesData,
        apiProjectEmployeeRoles,
        orgTypesData,
        indTypesData,
        addrTypesData,
      ] = await Promise.all([
        getEmployees(),
        getCustomers(),
        getProjectStatuses(),
        getProjectEmployeeRoles(),
        getOrganizationTypes(),
        getIndustryTypes(),
        getAddressTypes(),
      ]);
      setEmployees(employeesData);
      setCustomers(customersData);
      setProjectStatuses(statusesData);
      setTeamMemberRoles(
        apiProjectEmployeeRoles.filter(
          (role) =>
            !["Technical Lead", "Account Manager", "Project Manager"].includes(
              role
            )
        )
      );
      setOrganizationTypes(orgTypesData);
      setAccountManagers(
        employeesData.filter((emp) => emp.role === "Account Manager")
      );
      setIndustryTypes(indTypesData);
      setAddressTypes(addrTypesData);

      if (isEditMode && projectId) {
        const projectDataFromApi = await getProjectById(projectId);
        setInitialProjectData(projectDataFromApi);
        // REQ 2: Set the account manager from the fetched project data
        if (projectDataFromApi?.accountManager) {
          setAssignedAccountManager(projectDataFromApi.accountManager);
        }
        form.reset({
          title: projectDataFromApi.title,
          customerId: projectDataFromApi.customerId.toString(),
          technology: projectDataFromApi.technology || [],
          statuses: projectDataFromApi.statuses || [],
          startDate: projectDataFromApi.startDate
            ? parseISO(projectDataFromApi.startDate)
            : undefined,
          endDate: projectDataFromApi.endDate
            ? parseISO(projectDataFromApi.endDate)
            : null,
          leadId: projectDataFromApi.lead?.id.toString() || "",
          teamAssignments:
            projectDataFromApi.teamAssignments
              ?.filter(
                (a) =>
                  ![
                    "Technical Lead",
                    "Account Manager",
                    "Project Manager",
                  ].includes(a.role)
              )
              .map((a) => ({
                assignmentId: a.id,
                employeeId: a.employeeId.toString(),
                role: a.role,
              })) || [],
        });
      } else if (fromPocId) {
        // --- CREATE FROM POC MODE ---
        const pocData = await getPocById(fromPocId);
        setSourcePoc(pocData);

        // REQ 3: Auto-fill Account Manager from PoC data
        if (pocData?.accountManager) {
          setAssignedAccountManager(pocData.accountManager as Employee);
        }

        form.reset({
          title: `${pocData.title} - Project`,
          customerId: pocData.customerId.toString(),
          technology: pocData.technology || [],
          startDate: undefined,
          endDate: null,
          statuses: statusesData.length > 0 ? [statusesData[0]] : [],
          leadId: "", // User must select a lead
          teamAssignments: [],
        });
        toast.info(`Creating a new project from PoC: "${pocData.title}"`);
      } else {
        // --- REGULAR CREATE MODE ---
        if (statusesData.length > 0) {
          form.setValue("statuses", [statusesData[0]]);
        }
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast.error(
        "Failed to load initial data. You may be trying to use a PoC that was already converted."
      );
      navigate("/projects");
    } finally {
      setLoadingData(false);
    }
  }, [isEditMode, projectId, fromPocId, form, navigate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Form Submission
  const onSubmitProject = async (data: ProjectFormValues) => {
    //  Validate the user is a PM and has an ID.

    if (!user?.id || hasRole('account_manager')) {
      toast.error(
        "You must be a Project Manager to create or update a project."
      );
      return;
    }
    // REQ 2: Validate that an Account Manager is assigned.
    if (!assignedAccountManager?.id) {
      toast.error(
        "An Account Manager could not be determined for the selected customer."
      );
      return;
    }

    setSubmittingForm(true);

    try {
      if (isEditMode && projectId && initialProjectData) {
        // --- UPDATE ---
        const payload: UpdateProjectPayload = {
          title: data.title,
          technology: data.technology,
          statuses: data.statuses,
          startDate: format(data.startDate, "yyyy-MM-dd"),
          endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : null,
          technicalLeadId: parseInt(data.leadId, 10),
          // Project Manager can be updated if the user has permission (e.g., admin)
          // For now, let's assume only the assigned PM or an Admin can edit.
          // The API should handle permissions. We send the current user's ID as the PM.
          projectManagerId: parseInt(user.id, 10),
          teamAssignments: canManageTeam
            ? data.teamAssignments?.map((a) => ({
                employeeId: parseInt(a.employeeId, 10),
                role: a.role,
              }))
            : undefined,
        };
        const updatedProject = await updateProject(projectId, payload);
        toast.success("Project updated successfully");
        navigate(`/projects/${updatedProject.id}`);
      } else {
        // --- CREATE ---
        const payload: CreateProjectPayload = {
          title: data.title,
          customerId: parseInt(data.customerId, 10),
          technology: data.technology,
          statuses: data.statuses,
          startDate: format(data.startDate, "yyyy-MM-dd"),
          endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : null,
          // The PM is the user, the AM is derived from the customer.
          projectManagerId: parseInt(user.id, 10),
          accountManagerId: assignedAccountManager.id,
          // Technical lead is now mandatory.
          technicalLeadId: parseInt(data.leadId, 10),
          initialTeamAssignments: canManageTeam
            ? data.teamAssignments?.map((a) => ({
                employeeId: parseInt(a.employeeId, 10),
                role: a.role,
              }))
            : [],
          sourcePocId: fromPocId,
        };
        const newProject = await createProject(payload);
        toast.success("Project created successfully");
        navigate(`/projects/${newProject.id}`);
      }
    } catch (error) {
      console.error("Error saving Project:", error);
      toast.error(
        isEditMode ? "Failed to update Project" : "Failed to create Project"
      );
    } finally {
      setSubmittingForm(false);
    }
  };

  // Handle New Customer Creation
  const handleCreateNewCustomer = async (data: CustomerFormValues) => {
    try {
      const payload: CustomerCreatePayload = {
        name: data.name,
        contactPerson: data.contactPerson,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        industry: data.industry,
        organizationType: data.organizationType,
        website: data.website || null,
        accountManagerId: data.accountManagerId
          ? parseInt(data.accountManagerId, 10)
          : null,
        addresses: data.addresses?.map((addr) => ({
          street: addr.street || null,
          district: addr.district || null,
          city: addr.city,
          postalCode: addr.postalCode || null,
          type: addr.type,
          locationUrl: addr.locationUrl,
          country: "KSA",
        })),
      };

      const newCustomer = await createCustomer(payload);
      setCustomers((prev) =>
        [...prev, newCustomer].sort((a, b) => a.name.localeCompare(b.name))
      );
      form.setValue("customerId", newCustomer.id.toString());
      toast.success(`Customer "${newCustomer.name}" created and selected.`);
      setIsNewCustomerDialogOpen(false);
      customerForm.reset();
    } catch (error) {
      console.error("Error creating new customer:", error);
      toast.error("Failed to create new customer.");
    }
  };

  // Handle Project Deletion
  const handleDeleteProject = async () => {
    if (!projectId || !isEditMode) return;
    setIsDeleting(true);
    try {
      await deleteProject(projectId);
      toast.success("Project deleted successfully.");
      navigate("/projects");
    } catch (error) {
      console.error("Error deleting Project:", error);
      toast.error("Failed to delete Project.");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  if (loadingData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() =>
            navigate(
              isEditMode && projectId ? `/projects/${projectId}` : "/projects"
            )
          }
          className="flex items-center mb-4 text-sm font-medium text-gray-500 hover:text-indigo-600 px-0"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {isEditMode ? "Back to Project Details" : "Back to All Projects"}
        </Button>

        <h1 className="text-3xl font-bold tracking-tight text-gray-800 mb-8">
          {isEditMode
            ? "Edit Project"
            : fromPocId
            ? "Create Project from PoC"
            : "Create New Project"}
        </h1>

        {fromPocId && sourcePoc && (
          <div className="mb-8 p-3 rounded-md bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-3">
            <Rocket className="h-5 w-5" />
            <p className="text-sm font-medium">
              Based on PoC: <span className="font-bold">{sourcePoc.title}</span>
            </p>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitProject, (errors) => {
              console.error("Project Form Validation Errors:", errors);
              toast.error("Please correct the form errors.");
            })}
            className="space-y-8"
          >
            {/* --- CORE DETAILS CARD --- */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Project Manager (Creator)
                  </label>
                  <div className="flex items-center p-2 border rounded-md bg-slate-50 min-h-[40px]">
                    <UserCircle className="w-5 h-5 mr-2 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {projectCreatorDisplayName}
                    </span>
                  </div>
                </div>
                {/* Account Manager is now a display-only field */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Account Manager
                  </label>
                  <div className="flex items-center p-2 border rounded-md bg-slate-50 min-h-[40px]">
                    <ShieldCheck className="w-5 h-5 mr-2 text-gray-500" />
                    <span className="text-sm text-gray-700">
                      {assignedAccountManager
                        ? `${assignedAccountManager.firstName} ${assignedAccountManager.lastName}`
                        : "Select a customer to assign"}
                    </span>
                  </div>
                </div>
              </div>


                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                

                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <div className="flex items-center gap-2">
                      <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            // When creating from PoC, this field is disabled
                            // so we don't need extra logic here.
                          }}
                          value={field.value}
                          disabled={isEditMode || !!fromPocId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* This Dialog is now fully implemented */}
                        {!isEditMode && !fromPocId && (
                          <Dialog
                            open={isNewCustomerDialogOpen}
                            onOpenChange={setIsNewCustomerDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="flex flex-col max-h-[90vh] sm:max-w-[650px]">
                              <DialogHeader>
                                <DialogTitle>Create New Customer</DialogTitle>
                                <DialogDescription>
                                  Add a new customer and their addresses. Click
                                  create when you're done.
                                </DialogDescription>
                              </DialogHeader>

                              {/* This is the single, main scrollable area for the form */}
                              <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4">
                                <Form {...customerForm}>
                                  <form
                                    id="create-customer-form"
                                    onSubmit={customerForm.handleSubmit(
                                      handleCreateNewCustomer
                                    )}
                                    // Note: Fixed a small typo here from "sspace-y-4"
                                    className="space-y-4"
                                  >
                                    {/*
                                      FIX #1: The extra, inner div with `max-h-[60vh]` has been REMOVED.
                                      All your FormFields now go directly inside the form.
                                    */}
                                    <FormField
                                      control={customerForm.control}
                                      name="name"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Name*</FormLabel>
                                          <FormControl>
                                            <Input {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="contactPerson"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Contact Person*</FormLabel>
                                          <FormControl>
                                            <Input {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="contactEmail"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Contact Email*</FormLabel>
                                          <FormControl>
                                            <Input type="email" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="contactPhone"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Contact Phone*</FormLabel>
                                          <FormControl>
                                            <Input type="tel" {...field} />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="industry"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Industry*</FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select industry" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {industryTypes.map((i) => (
                                                <SelectItem key={i} value={i}>
                                                  {i.charAt(0).toUpperCase() +
                                                    i.slice(1)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="organizationType"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>
                                            Organization Type*
                                          </FormLabel>
                                          <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Select type" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {organizationTypes.map((o) => (
                                                <SelectItem key={o} value={o}>
                                                  {o.charAt(0).toUpperCase() +
                                                    o.slice(1)}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      control={customerForm.control}
                                      name="website"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Website</FormLabel>
                                          <FormControl>
                                            <Input
                                              type="url"
                                              placeholder="https://example.com"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={customerForm.control}
                                      name="accountManagerId"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Account Manager</FormLabel>
                                          <Select
                                            // The `value` is converted to a string for the component
                                            value={
                                              field.value
                                                ? field.value.toString()
                                                : "null"
                                            }
                                            // The `onValueChange` handles converting "null" back to a real null
                                            onValueChange={(value) => {
                                              field.onChange(
                                                value === "null" ? null : value
                                              );
                                            }}
                                          >
                                            <FormControl>
                                              <SelectTrigger>
                                                <SelectValue placeholder="Assign an Account Manager" />
                                              </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {/* The value is now "null" instead of "" */}
                                              <SelectItem value="null">
                                                None
                                              </SelectItem>
                                              {accountManagers.map((am) => (
                                                <SelectItem
                                                  key={am.id}
                                                  value={am.id.toString()}
                                                >
                                                  {am.firstName} {am.lastName}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <Separator />

                                    {/* Address Fields Section */}
                                    <div>
                                      <FormLabel className="text-base font-semibold">
                                        Addresses
                                      </FormLabel>
                                      <div className="space-y-4 mt-2">
                                        {customerAddressFields.map(
                                          (field, index) => (
                                            <Card
                                              key={field.id}
                                              className="bg-slate-50 p-4 relative"
                                            >
                                              <CardContent className="p-0 grid grid-cols-2 gap-4">
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.type`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>
                                                        Type*
                                                      </FormLabel>
                                                      <Select
                                                        onValueChange={
                                                          field.onChange
                                                        }
                                                        defaultValue={
                                                          field.value
                                                        }
                                                      >
                                                        <FormControl>
                                                          <SelectTrigger>
                                                            <SelectValue placeholder="Select type" />
                                                          </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                          {addressTypes.map(
                                                            (type) => (
                                                              <SelectItem
                                                                key={type}
                                                                value={type}
                                                              >
                                                                {type}
                                                              </SelectItem>
                                                            )
                                                          )}
                                                        </SelectContent>
                                                      </Select>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.city`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>
                                                        City*
                                                      </FormLabel>
                                                      <FormControl>
                                                        <Input
                                                          placeholder="Riyadh"
                                                          {...field}
                                                        />
                                                      </FormControl>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.street`}
                                                  render={({ field }) => (
                                                    <FormItem className="col-span-2">
                                                      <FormLabel>
                                                        Street
                                                      </FormLabel>
                                                      <FormControl>
                                                        <Input
                                                          placeholder="King Fahd Rd"
                                                          {...field}
                                                        />
                                                      </FormControl>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.district`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>
                                                        District
                                                      </FormLabel>
                                                      <FormControl>
                                                        <Input
                                                          placeholder="Al Olaya"
                                                          {...field}
                                                        />
                                                      </FormControl>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.postalCode`}
                                                  render={({ field }) => (
                                                    <FormItem>
                                                      <FormLabel>
                                                        Postal Code
                                                      </FormLabel>
                                                      <FormControl>
                                                        <Input
                                                          placeholder="12345"
                                                          {...field}
                                                        />
                                                      </FormControl>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                                <FormField
                                                  control={customerForm.control}
                                                  name={`addresses.${index}.locationUrl`}
                                                  render={({ field }) => (
                                                    <FormItem className="col-span-2">
                                                      <FormLabel>
                                                        Location URL*
                                                      </FormLabel>
                                                      <FormControl>
                                                        <Input
                                                          type="url"
                                                          placeholder="https://maps.google.com/..."
                                                          {...field}
                                                        />
                                                      </FormControl>
                                                      <FormMessage />
                                                    </FormItem>
                                                  )}
                                                />
                                              </CardContent>
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="absolute top-1 right-1 h-7 w-7"
                                                onClick={() =>
                                                  removeCustomerAddress(index)
                                                }
                                              >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                            </Card>
                                          )
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-4"
                                        onClick={() =>
                                          appendCustomerAddress({
                                            city: "",
                                            type: "",
                                            locationUrl: "",
                                            street: "",
                                            district: "",
                                            postalCode: "",
                                            country: "KSA",
                                          })
                                        }
                                      >
                                        <Plus className="mr-2 h-4 w-4" /> Add
                                        Address
                                      </Button>
                                    </div>
                                  </form>
                                </Form>
                              </div>

                              {/*
                                FIX #2: The DialogFooter is MOVED here.
                                It's now a direct child of the flex container, so it will stay fixed at the bottom.
                              */}
                              <DialogFooter className="border-t pt-4 mt-auto">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setIsNewCustomerDialogOpen(false)
                                  }
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="submit"
                                  form="create-customer-form"
                                >
                                  Create Customer
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                      {(isEditMode || !!fromPocId) && (
                        <FormDescription className="text-xs text-amber-600 flex items-center mt-1">
                          <Info className="h-3 w-3 mr-1" />
                          Customer cannot be changed after creation.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="technology"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technology *</FormLabel>
                      <FormControl>
                        <MultiSelect
                          options={TECHNOLOGY_OPTIONS}
                          selected={field.value}
                          onChange={field.onChange}
                          placeholder="Select technologies..."
                          className="w-full"
                          disabled={isFromPoc} // FIX #1: Disable the component if it's from a PoC
                        />
                      </FormControl>
                      {isFromPoc ? ( // FIX #2: Only show the message if it's from a PoC
                        <FormDescription className="text-xs text-amber-600 flex items-center mt-1">
                          <Info className="h-3 w-3 mr-1" />
                          Technology is inherited from the PoC and cannot be changed.
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />


                
                {/* Technical Lead is now mandatory. */}
                <FormField
                  control={form.control}
                  name="leadId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Technical Lead *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a Technical Lead" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicalLeads.map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>
                              {e.firstName} {e.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="statuses"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Project Statuses *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {field.value?.length > 0
                                ? `${field.value.length} selected`
                                : "Select statuses..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command>
                            <CommandInput placeholder="Search statuses..." />
                            <CommandList>
                              <CommandEmpty>No statuses found.</CommandEmpty>
                              <CommandGroup>
                                {projectStatuses.map((status) => (
                                  <CommandItem
                                    key={status}
                                    onSelect={() => {
                                      const newValue = field.value?.includes(
                                        status
                                      )
                                        ? field.value.filter(
                                            (s) => s !== status
                                          )
                                        : [...(field.value || []), status];
                                      field.onChange(newValue);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        field.value?.includes(status)
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                    {status}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-6 pt-4 border-t mt-6">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Start Date *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                id={field.name}
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${
                                  !field.value ? "text-muted-foreground" : ""
                                }`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                field.value === null ? undefined : field.value
                              }
                              onSelect={(date) => field.onChange(date || null)}
                              disabled={(date) => date < new Date("1900-01-01")}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Est. End Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                id={field.name}
                                variant="outline"
                                className={`w-full justify-start text-left font-normal ${
                                  !field.value ? "text-muted-foreground" : ""
                                }`}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                field.value === null ? undefined : field.value
                              }
                              onSelect={(date) => field.onChange(date || null)}
                              disabled={(date) =>
                                date <
                                (watchedStartDate || new Date("1900-01-01"))
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {canManageTeam && (
                    <div className="pt-4 border-t">
                      <FormLabel>Engineering Team Members</FormLabel>
                      <div className="mt-2 space-y-3">
                        {teamFields.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-end gap-2 p-3 border rounded-md bg-slate-50"
                          >
                            <FormField
                              control={form.control}
                              name={`teamAssignments.${index}.employeeId`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">
                                    Member
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select member" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {engineeringTeamPool.map((e) => (
                                        <SelectItem
                                          key={e.id}
                                          value={e.id.toString()}
                                        >
                                          {e.firstName} {e.lastName}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`teamAssignments.${index}.role`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">
                                    Role in Project
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {teamMemberRoles.map((r) => (
                                        <SelectItem key={r} value={r}>
                                          {r.replace(/_/g, " ")}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeTeamMember(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          appendTeamMember({ employeeId: "", role: "" })
                        }
                        className="mt-3"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Team Member
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-4">
              {isEditMode && (
                <AlertDialog
                  open={isDeleteDialogOpen}
                  onOpenChange={setIsDeleteDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  {isDeleteDialogOpen && (
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Are you absolutely sure?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently
                          delete this Proof of Concept and all its associated
                          data.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel
                          onClick={() => setIsDeleteDialogOpen(false)}
                        >
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteProject}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {isDeleting ? "Deleting..." : "Confirm Deletion"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  )}
                </AlertDialog>
              )}
              <div className={`flex gap-4 ml-auto`}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      isEditMode && projectId
                        ? `/projects/${projectId}`
                        : "/projects"
                    )
                  }
                  disabled={submittingForm}
                >
                  Cancel
                </Button>
                {(isEditMode || !isEditMode) && (
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={submittingForm || loadingData}
                  >
                    {submittingForm
                      ? "Saving..."
                      : isEditMode
                      ? "Update Project"
                      : "Create Project"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
};

export default ProjectFormPage;
