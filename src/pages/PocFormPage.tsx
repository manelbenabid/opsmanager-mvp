import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "../contexts/AuthContext";
import {
  getPocById,
  getEmployees,
  getCustomers,
  createPoc,
  updatePoc,
  deletePoc,
  createCustomer,
  assignEmployeeToPoc,
  deletePocEmployeeAssignment,
  updatePocEmployeeAssignment,
  createPocStatusUpdate,
  getPocStatuses,
  getPocEmployeeRoles,
  getOrganizationTypes,
  getIndustryTypes,
  Poc,
  Employee,
  Customer,
  CreatePocPayload,
  UpdatePocPayload,
  getAddressTypes,
  CreateCustomerPayload,
} from "../services/api";
import { format, parseISO, isValid } from "date-fns";
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
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
  
} from "lucide-react";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { MultiSelect } from "../components/MultiSelect";

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

// Base schema without dates
const pocFormSchemaBase = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  customerId: z.string().min(1, "Customer is required"),
  technology: z.array(z.string()).min(1, "At least one technology is required"),
  status: z.string().min(1, "Status is required"),
  leadId: z.string().min(1, "Technical Lead is required"),
  teamAssignments: z.array(teamMemberSchema).optional(),
  isBudgetAllocated: z.boolean().default(false),
  isVendorAware: z.boolean().default(false),
});

// Dates are now optional and nullable for both create and edit
const pocFormSchema = pocFormSchemaBase
  .extend({
    startDate: z.date({
      required_error: "Start date is required",
      invalid_type_error: "Invalid start date",
    }), // Made startDate required
    endDate: z
      .date({ invalid_type_error: "Invalid end date" })
      .nullable()
      .optional(), // endDate remains optional/nullable
  })
  .refine(
    (data) => {
      // Ensure end date is after start date if both are provided
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        return false;
      }
      return true;
    },
    {
      message: "Est. End Date cannot be earlier than Start Date.",
      path: ["endDate"], // Point error to endDate field
    }
  );

type PocFormValues = z.infer<typeof pocFormSchema>;

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
const PocFormPage: React.FC = () => {
  const { id: pocIdParam } = useParams<{ id: string }>();
  const isEditMode = !!pocIdParam;
  const pocId = pocIdParam ? parseInt(pocIdParam, 10) : null;
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();

  const [loadingData, setLoadingData] = useState(true);
  const [submittingForm, setSubmittingForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [initialPocData, setInitialPocData] = useState<Poc | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pocStatuses, setPocStatuses] = useState<string[]>([]);
  const [pocTeamMemberRoles, setPocTeamMemberRoles] = useState<string[]>([]);
  const [organizationTypes, setOrganizationTypes] = useState<string[]>([]);
  const [industryTypes, setIndustryTypes] = useState<string[]>([]);
  const [addressTypes, setAddressTypes] = useState<string[]>([]);
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [accountManagers, setAccountManagers] = useState<Employee[]>([]);



  const form = useForm<PocFormValues>({
    resolver: zodResolver(pocFormSchema), // Use the single schema with optional dates
    defaultValues: {
      title: "",
      customerId: "",
      technology: [],
      status: "",
      startDate: null, // StartDate will now be required by schema, but can default to null initially
      endDate: null,
      leadId: "",
      teamAssignments: [],
      isBudgetAllocated: false,
      isVendorAware: false,
    },
  });
  const {
    fields: teamFields,
    append: appendTeamMember,
    remove: removeTeamMember,
  } = useFieldArray({
    control: form.control,
    name: "teamAssignments",
  });

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

  const canEditPoc = hasPermission("poc", "edit");
  const canCreatePoc = hasPermission("poc", "create");
  const canDeletePoc = hasPermission("poc", "delete");
  const canManageTeam = hasRole(["admin", "lead"]);

  const watchedLeadId = form.watch("leadId");
  const watchedStartDate = form.watch("startDate");

  const technicalLeads = useMemo(
    () =>
      employees.filter(
        (emp) =>
          emp.role === "Lead" &&
          emp.id.toString() !==
            (isEditMode
              ? initialPocData?.accountManager?.id?.toString()
              : user?.id)
      ),
    [employees, isEditMode, initialPocData, user]
  );

  const engineeringTeamPool = useMemo(
    () =>
      employees.filter(
        (emp) =>
          emp.role === "Technical Team" &&
          emp.id.toString() !== watchedLeadId &&
          emp.id.toString() !==
            (isEditMode
              ? initialPocData?.accountManager?.id?.toString()
              : user?.id)
      ),
    [employees, watchedLeadId, isEditMode, initialPocData, user]
  );

  const pocCreatorDisplayName = isEditMode
    ? initialPocData?.accountManager?.firstName &&
      initialPocData?.accountManager?.lastName
      ? `${initialPocData.accountManager.firstName} ${initialPocData.accountManager.lastName}`
      : initialPocData?.accountManagerId
      ? `Employee ID: ${initialPocData.accountManagerId}`
      : "N/A"
    : user?.name || "N/A (Current User)";

  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [
        employeesData,
        customersData,
        statusesData,
        apiPocEmployeeRoles,
        orgTypesData,
        indTypesData,
        addrTypesData,
      ] = await Promise.all([
        getEmployees(),
        getCustomers(),
        getPocStatuses(),
        getPocEmployeeRoles(),
        getOrganizationTypes(),
        getIndustryTypes(),
        getAddressTypes(),
      ]);

      let displayCustomers = customersData;
      if (hasRole('account_manager')) { displayCustomers = customersData.filter( customer => customer.accountManagerId === parseInt(user.id, 10));}

      setEmployees(employeesData);
      setAccountManagers(
        employeesData.filter((emp) => emp.role === "Account Manager")
      );
      setCustomers(displayCustomers);
      
      setPocStatuses(statusesData);
      const filteredPocRoles = apiPocEmployeeRoles.filter(
        (role) => role !== "Technical Lead" && role !== "Account Manager"
      );
      setPocTeamMemberRoles(filteredPocRoles);
      setOrganizationTypes(orgTypesData);
      setIndustryTypes(indTypesData);
      setAddressTypes(addrTypesData);

      const currentStatus = form.getValues("status");
      

      if (statusesData.length > 0 && !currentStatus) {
        form.setValue("status", statusesData[0], {
          shouldValidate: !isEditMode,
          shouldDirty: !isEditMode,
        });
      }
      

      if (isEditMode && pocId) {
        const pocDataFromApi = await getPocById(pocId);
        if (pocDataFromApi) {
          setInitialPocData(pocDataFromApi);
          form.reset({
            title: pocDataFromApi.title,
            customerId: pocDataFromApi.customerId.toString(),
            technology: pocDataFromApi.technology || [],
            status: pocDataFromApi.status,
            startDate: pocDataFromApi.startDate
              ? parseISO(pocDataFromApi.startDate)
              : null,
            endDate: pocDataFromApi.endDate
              ? parseISO(pocDataFromApi.endDate)
              : null,
            leadId: pocDataFromApi.lead?.id.toString() || "",
            teamAssignments:
              pocDataFromApi.teamAssignments
                ?.filter(
                  (a) =>
                    !a.unassignedAt &&
                    a.role !== "Technical Lead" &&
                    a.role !== "Account Manager"
                )
                .map((a) => ({
                  assignmentId: a.id,
                  employeeId: a.employeeId.toString(),
                  role: a.role,
                })) || [],
          });
        } else {
          toast.error("POC not found");
          navigate("/pocs");
        }
      } else {
        // For create mode, if startDate is now required, you might want to set a default Date object
        // form.setValue('startDate', new Date()); // Example: default to today
      }
    } catch (error) {
      console.error("Error loading form data:", error);
      toast.error("Failed to load initial data for the form.");
    } finally {
      setLoadingData(false);
    }
  }, [isEditMode, pocId, navigate, form]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!loadingData) {
      if (isEditMode) {
        if (!canEditPoc && !canDeletePoc && !hasPermission("poc", "view")) {
          toast.error("You don't have permission to access this PoC.");
          navigate("/pocs");
        }
      } else {
        if (!canCreatePoc) {
          toast.error("You don't have permission to create a new PoC.");
          navigate("/pocs");
        }
      }
    }
  }, [
    isEditMode,
    canEditPoc,
    canCreatePoc,
    canDeletePoc,
    hasPermission,
    navigate,
    loadingData,
  ]);

  if (loadingData) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  const onSubmitPoc = async (data: PocFormValues) => {
    console.log("PocFormPage: onSubmitPoc function CALLED.");
    console.log(
      "PocFormPage: Form data received:",
      JSON.stringify(data, null, 2)
    );
    console.log(
      "PocFormPage: Current user from context:",
      JSON.stringify(user, null, 2)
    );

    if (!user || !user.id) {
      toast.error("User not authenticated or user employee ID missing.");
      console.error(
        "PocFormPage: onSubmitPoc - ABORTING: User not authenticated or user.id (on-prem employee ID) is missing. Current user:",
        user
      );
      setSubmittingForm(false);
      return;
    }
    setSubmittingForm(true);
    console.log("PocFormPage: submittingForm set to true.");

    const leadIdNum = data.leadId ? parseInt(data.leadId, 10) : undefined;
    const customerIdNum = parseInt(data.customerId, 10);

    // startDate is now required by the schema, so data.startDate should be a Date object if validation passed
    if (!data.startDate) {
      toast.error("Start Date is required."); // Should be caught by Zod, but defensive check
      console.error(
        "PocFormPage: onSubmitPoc - ABORTING: Missing startDate after Zod validation (unexpected)."
      );
      setSubmittingForm(false);
      return;
    }
    const formattedStartDate = format(data.startDate, "yyyy-MM-dd");
    const formattedEndDate = data.endDate
      ? format(data.endDate, "yyyy-MM-dd")
      : null; // endDate can still be null

    const accountManagerIdNum = isEditMode
      ? initialPocData?.accountManager?.id
      : user.id
      ? parseInt(user.id, 10)
      : undefined;

    console.log(
      "PocFormPage: Parsed IDs - leadIdNum:",
      leadIdNum,
      "accountManagerIdNum:",
      accountManagerIdNum,
      "customerIdNum:",
      customerIdNum
    );
    console.log(
      "PocFormPage: Dates - Start:",
      formattedStartDate,
      "End:",
      formattedEndDate
    );

    try {
      if (isEditMode && pocId && initialPocData) {
        console.log("PocFormPage: Entering EDIT mode logic.");
        const pocUpdatePayload: UpdatePocPayload = {
          title: data.title,
          technology: data.technology,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          status: data.status,
          leadId: leadIdNum && !isNaN(leadIdNum) ? leadIdNum : undefined,
          accountManagerId: initialPocData.accountManager?.id,
          // Add the teamAssignments array to the payload if the user can manage them.
          // The backend will handle comparing this to the old state.
          teamAssignments: canManageTeam
            ? data.teamAssignments?.map((a) => ({
                employeeId: parseInt(a.employeeId, 10),
                role: a.role,
              }))
            : undefined,
        };
        console.log(
          "PocFormPage: Update Payload:",
          JSON.stringify(pocUpdatePayload, null, 2)
        );
        await updatePoc(pocId, pocUpdatePayload);

        // const originalOtherTeamAssignments = initialPocData.teamAssignments?.filter(a => !a.unassignedAt && a.role !== 'Technical Lead' && a.role !== 'Account Manager').map(a => ({ assignmentId: a.id, employeeId: a.employeeId.toString(), role: a.role })) || [];
        // const currentFormTeamAssignments = data.teamAssignments || [];
        // if (canManageTeam) { for (const formMember of currentFormTeamAssignments) { const employeeIdNum = parseInt(formMember.employeeId, 10); if (isNaN(employeeIdNum)) continue; if (!formMember.assignmentId && formMember.role) { await assignEmployeeToPoc({ pocId: pocId, employeeId: employeeIdNum, role: formMember.role, assignedAt: new Date().toISOString().split('T')[0] }); } else if (formMember.assignmentId) { const originalMember = originalOtherTeamAssignments.find(om => om.assignmentId === formMember.assignmentId); if (originalMember && originalMember.role !== formMember.role) { await updatePocEmployeeAssignment(formMember.assignmentId, { role: formMember.role }); } } } for (const originalMember of originalOtherTeamAssignments) { if (!currentFormTeamAssignments.find(fm => fm.assignmentId === originalMember.assignmentId)) { if(originalMember.assignmentId) { await deletePocEmployeeAssignment(originalMember.assignmentId); }}}}

        if (initialPocData.status !== data.status) {
          await createPocStatusUpdate({
            pocId: pocId,
            startedAt: new Date().toISOString(),
            status: data.status,
            endedAt: null,
          });
        }
        toast.success("POC updated successfully");
        console.log(
          "PocFormPage: POC updated. Navigating to:",
          `/pocs/${pocId}`
        );
        navigate(`/pocs/${pocId}`);
      } else {
        // Create Mode
        console.log("PocFormPage: Entering CREATE mode logic.");
        if (!leadIdNum) {
          toast.error("Technical Lead is required for new PoC.");
          console.error(
            "PocFormPage: Create Mode - ABORTING: Missing leadIdNum.",
            { leadIdNum }
          );
          setSubmittingForm(false);
          return;
        }
        if (!accountManagerIdNum) {
          toast.error(
            "Could not determine Account Manager ID (current user's employee ID)."
          );
          console.error(
            "PocFormPage: Create Mode - ABORTING: Missing accountManagerIdNum (derived from user.id). Current user:",
            user
          );
          setSubmittingForm(false);
          return;
        }

        const createPayload: CreatePocPayload = {
          title: data.title,
          customerId: customerIdNum,
          technology: data.technology,
          startDate: formattedStartDate, 
          endDate: formattedEndDate, // Can be null
          status: data.status,
          leadId: leadIdNum,
          accountManagerId: accountManagerIdNum,
          isBudgetAllocated: data.isBudgetAllocated,
          isVendorAware: data.isVendorAware,
          initialTeamAssignments: canManageTeam
            ? data.teamAssignments
                ?.filter((tm) => tm.employeeId && tm.role)
                .map((tm) => ({
                  employeeId: parseInt(tm.employeeId, 10),
                  role: tm.role,
                  assignedAt: formattedStartDate,
                }))
            : [],
        };
        console.log(
          "PocFormPage: Create Payload:",
          JSON.stringify(createPayload, null, 2)
        );
        const newPoc = await createPoc(createPayload);
        toast.success("POC created successfully");
        console.log(
          "PocFormPage: POC created. Navigating to:",
          `/pocs/${newPoc.id}`
        );
        navigate(`/pocs/${newPoc.id}`);
      }
    } catch (error) {
      console.error("Error saving POC:", error);
      toast.error(isEditMode ? "Failed to update POC" : "Failed to create POC");
    } finally {
      setSubmittingForm(false);
      console.log("PocFormPage: submittingForm set to false in finally block.");
    }
  };

  const handleCreateNewCustomer = async (data: CustomerFormValues) => {
    try {
      const payload: CreateCustomerPayload = {
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

  const handleDeletePoc = async () => {
    if (!pocId || !isEditMode) return;
    setIsDeleting(true);
    try {
      await deletePoc(pocId);
      toast.success("POC deleted successfully.");
      navigate("/pocs");
    } catch (error) {
      console.error("Error deleting POC:", error);
      toast.error(
        "Failed to delete POC. It might be referenced by other items."
      );
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

  // const availableTeamMembers = employees.filter(
  //   emp => emp.id.toString() !== form.getValues('leadId') && emp.id.toString() !== form.getValues('accountManagerId')
  // );

  // Extracted from the PocFormPage: React.FC component

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() =>
            navigate(isEditMode && pocId ? `/pocs/${pocId}` : "/pocs")
          }
          className="flex items-center mb-4 text-sm font-medium text-gray-500 hover:text-indigo-600 px-0"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {isEditMode ? "Back to POC Details" : "Back to All POCs"}
        </Button>

        <h1 className="text-3xl font-bold tracking-tight text-gray-800 mb-8">
          {isEditMode ? "Edit Proof of Concept" : "Create New Proof of Concept"}
        </h1>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitPoc, (errors) => {
              console.error("PocFormPage: Zod Validation Errors:", errors);
              toast.error("Please correct the form errors displayed below.");
            })}
            className="space-y-8"
          >
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>PoC Details</CardTitle>
                <CardDescription>
                  {isEditMode
                    ? "Update the details for this PoC."
                    : "Provide the core information for the new PoC."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PoC Creator (Account Manager) - Display Only - Corrected Structure */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    PoC Creator
                  </label>
                  <div className="flex items-center p-2 border rounded-md bg-slate-50 dark:bg-slate-800 min-h-[40px]">
                    <UserCircle className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {pocCreatorDisplayName}
                    </span>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PoC Title *</FormLabel>
                      <FormControl>
                        <Input
                          id={field.name}
                          placeholder="Enter PoC title"
                          {...field}
                        />
                      </FormControl>
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
                        />
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
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isEditMode}
                        >
                          <FormControl>
                            <SelectTrigger id={field.name}>
                              <SelectValue placeholder="Select customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          {customers.length > 0 ? (
                            customers.map((c) => (
                              <SelectItem key={c.id} value={c.id.toString()}>
                                {c.name}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              {hasRole('account_manager') ? "No customers assigned to you." : "No customers found."}
                            </SelectItem>
                          )}
                          </SelectContent>
                        </Select>
                        {!isEditMode && (
                          // --- UPDATED DIALOG WITH SCROLLING ---
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
                      {isEditMode && (
                        <FormDescription className="text-xs text-amber-600 flex items-center mt-1">
                          <Info className="h-3 w-3 mr-1" />
                          Customer cannot be changed after PoC creation.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Select Technical Lead" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicalLeads.map((e) => (
                            <SelectItem key={e.id} value={e.id.toString()}>
                              {e.firstName} {e.lastName} ({e.jobTitle})
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
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PoC Status *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger id={field.name}>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {pocStatuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (char) => char.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isEditMode && (
                  <>

                    <FormField
                      control={form.control}
                      name="isBudgetAllocated" // Add this to your Zod schema
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Is Budget Allocated?</FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isVendorAware" // Add this to your Zod schema
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>
                              Is Vendor's Account Manager Aware?
                            </FormLabel>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                </>
              )}

                {/* Date fields are now always part of the form structure. StartDate is required, EndDate is optional. */}
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

                  {/* Engineering Team Members section - visibility still based on canManageTeam */}
                  {canManageTeam && (
                    <div>
                      <FormLabel>Engineering Team Members</FormLabel>
                      <div>
                        {teamFields.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-end gap-2 mt-2 p-3 border rounded-md bg-slate-50"
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
                                      <SelectTrigger id={field.name}>
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
                                    Role in PoC
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    value={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger id={field.name}>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {pocTeamMemberRoles.map((r) => (
                                        <SelectItem key={r} value={r}>
                                          {r
                                            .replace(/_/g, " ")
                                            .replace(/\b\w/g, (char) =>
                                              char.toUpperCase()
                                            )}
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
              {isEditMode && canDeletePoc && (
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
                      <Trash2 className="w-4 h-4 mr-2" /> Delete PoC
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
                          onClick={handleDeletePoc}
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
              <div
                className={`flex gap-4 ${
                  !isEditMode || !canDeletePoc
                    ? "ml-auto w-full justify-end"
                    : "ml-auto"
                }`}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    navigate(isEditMode && pocId ? `/pocs/${pocId}` : "/pocs")
                  }
                  disabled={submittingForm}
                >
                  Cancel
                </Button>
                {((isEditMode && canEditPoc) ||
                  (!isEditMode && canCreatePoc)) && (
                  <Button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={submittingForm || loadingData}
                  >
                    {submittingForm
                      ? "Saving..."
                      : isEditMode
                      ? "Update PoC"
                      : "Create PoC"}
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

export default PocFormPage;
