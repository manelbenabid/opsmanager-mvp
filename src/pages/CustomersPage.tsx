import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import AppLayout from "../components/AppLayout";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building,
  Mail,
  Phone,
  Edit,
  Search,
  Briefcase,
  Plus,
  Globe,
  Trash2,
  MapPin,
  Link,
  UserCircle,
} from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import {
  Customer,
  Address,
  getCustomers,
  updateCustomer,
  createCustomer,
  deleteCustomer,
  getOrganizationTypes,
  getIndustryTypes,
  getAddressTypes,
  CreateCustomerPayload,
  Employee,
  getEmployees,
} from "../services/api";
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
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

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
  country: z.string().default("KSA"), // Default value
});

const customerFormSchema = z.object({
  name: z.string().min(1, "Company name is required"),
  contactPerson: z.string().min(1, "Contact person is required"),
  contactEmail: z.string().email("Invalid email format"),
  contactPhone: z.string().min(1, "Phone number is required"),
  industry: z.string().min(1, "Industry is required"),
  organizationType: z.string().min(1, "Organization type is required"),
  website: z.string().url("Invalid URL format").optional().or(z.literal("")),
  addresses: z.array(addressFormSchema).optional(),
  accountManagerId: z.string().nullable().optional(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

interface CustomerDialogProps {
  organizationTypes: string[];
  industryTypes: string[];
  addressTypes: string[];
  accountManagers: Employee[];
}

interface CustomerCardProps extends CustomerDialogProps {
  customer: Customer;
  canEdit: boolean;
  onCustomerUpdated: () => void;
  onCustomerDeleted: () => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({
  customer,
  canEdit,
  onCustomerUpdated,
  onCustomerDeleted,
  organizationTypes,
  industryTypes,
  addressTypes,
  accountManagers,
}) => {
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      ...customer,
      accountManagerId: customer.accountManagerId?.toString() || null,
      addresses: customer.addresses || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  useEffect(() => {
    if (customer && openEditDialog) {
      form.reset({
        ...customer,
        accountManagerId: customer.accountManagerId?.toString() || null,
        addresses: customer.addresses || [],
      });
    }
  }, [customer, openEditDialog, form]);

  const handleEditSubmit = async (data: CustomerFormValues) => {
    setIsSubmittingEdit(true);
    try {
      const payload = {
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
          id: addr.id,
          street: addr.street || null,
          district: addr.district || null,
          city: addr.city,
          postalCode: addr.postalCode || null,
          type: addr.type,
          locationUrl: addr.locationUrl,
          country: "KSA",
          customerId: customer.id,
        })),
      };

      await updateCustomer(customer.id, payload);

      toast.success(`${customer.name} updated successfully`);
      setOpenEditDialog(false);
      onCustomerUpdated();
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer. Please try again.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteCustomer = async () => {
    setIsDeleting(true);
    try {
      await deleteCustomer(customer.id);
      toast.success(`Customer "${customer.name}" deleted successfully.`);
      onCustomerDeleted();
      setOpenDeleteDialog(false);
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      const errorMsg =
        error.response?.data?.error ||
        "Failed to delete customer. It might be in use.";
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg">
      <CardHeader className="bg-gradient-to-r from-indigo-100 to-purple-100 p-4">
        <CardTitle className="flex items-center text-lg font-semibold text-indigo-700">
          <Building className="w-5 h-5 mr-2" />
          {customer.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow p-4 md:p-6 space-y-3">
        <div className="flex items-start">
          <span className="text-sm text-gray-500 shrink-0 mr-2">Contact:</span>
          <span className="text-sm font-medium text-gray-800">
            {customer.contactPerson}
          </span>
        </div>
        <div className="flex items-start">
          <Mail className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-800 break-all">
            {customer.contactEmail}
          </span>
        </div>
        <div className="flex items-start">
          <Phone className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-800">
            {customer.contactPhone}
          </span>
        </div>
        <div className="flex items-start">
          <Globe className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
          {customer.website && customer.website.trim() !== "" ? (
            <a
              href={customer.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 break-all"
            >
              {customer.website}
            </a>
          ) : (
            <span className="text-sm text-gray-500">N/A</span>
          )}
        </div>
        <Separator className="my-3" />
        <div className="flex items-start">
          <Briefcase className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-800">
            {customer.industry}
          </span>
        </div>
        <div className="flex items-start">
          <span className="text-sm text-gray-500 shrink-0 mr-2">Type:</span>
          <span className="text-sm font-medium text-gray-800 capitalize">
            {customer.organizationType?.replace("-", " ")}
          </span>
        </div>
        {customer.accountManager && customer.accountManager.id && (
          <>
            <Separator className="my-3" />
            <div className="flex items-start">
              <UserCircle className="w-4 h-4 mr-2 mt-0.5 text-gray-400 shrink-0" />
              <div className="text-sm">
                <span className="text-gray-500">Account Manager:</span>
                <span className="font-medium text-gray-800 ml-1">
                  {customer.accountManager.firstName}{" "}
                  {customer.accountManager.lastName}
                </span>
              </div>
            </div>
          </>
        )}

        <Separator className="my-3" />
        {customer.addresses && customer.addresses.length > 0 ? (
          <div className="space-y-3">
            {customer.addresses.map((addr, index) => (
              <div key={addr.id || index} className="text-sm">
                <div className="flex items-center font-medium text-gray-800">
                  {/* Conditionally wrap MapPin with a link if locationUrl exists */}
                  {addr.locationUrl ? (
                    <a
                      href={addr.locationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`View ${addr.type} location on map`}
                      title={`View ${addr.type} location on map`}
                    >
                      <MapPin className="w-4 h-4 mr-2 text-indigo-500 hover:text-indigo-700 transition-colors shrink-0 cursor-pointer" />
                    </a>
                  ) : (
                    <MapPin className="w-4 h-4 mr-2 text-gray-400 shrink-0" />
                  )}
                  <span className="capitalize">{addr.type}</span>
                  <span className="font-normal text-gray-500 ml-1.5">
                    ({addr.city})
                  </span>
                </div>
                <div className="pl-6 text-gray-600">
                  <span>
                    {addr.street}
                    {addr.street && addr.district && ", "}
                    {addr.district}
                  </span>
                  {/* The old Link icon has been removed from here */}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-sm text-gray-400 italic py-3">
            <MapPin className="h-5 w-5 mb-1" />
            No addresses available
          </div>
        )}
      </CardContent>
      {canEdit && (
        <CardFooter className="border-t p-4 bg-gray-50 flex justify-end space-x-2">
          <AlertDialog
            open={openDeleteDialog}
            onOpenChange={setOpenDeleteDialog}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the
                  customer "{customer.name}". If this customer is associated
                  with any Proof of Concepts, those associations might also be
                  affected or prevent deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setOpenDeleteDialog(false)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteCustomer}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? "Deleting..." : "Confirm Deletion"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="w-3 h-3 mr-1.5" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleEditSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Edit Customer: {customer.name}</DialogTitle>
                    <DialogDescription>
                      Update customer information. Click save when you're done.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 grid gap-4 max-h-[70vh] overflow-y-auto pr-3">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="Company name"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person *</FormLabel>
                            <FormControl>
                              <Input placeholder="Contact person" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="organizationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Type *</FormLabel>
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
                                {organizationTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type.charAt(0).toUpperCase() +
                                      type.slice(1).replace("-", " ")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry *</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                                <SelectTrigger className="pl-10">
                                  <SelectValue placeholder="Select industry" />
                                </SelectTrigger>
                              </div>
                            </FormControl>
                            <SelectContent>
                              {industryTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
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
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="https://example.com"
                                className="pl-10"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Separator />
                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                type="email"
                                placeholder="contact@example.com"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Phone *</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                              <Input
                                placeholder="+1 (555) 123-4567"
                                className="pl-10"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="accountManagerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Manager</FormLabel>
                          <Select
                            // Handle conversion between the "null" string and actual null
                            onValueChange={(value) =>
                              field.onChange(value === "null" ? null : value)
                            }
                            value={field.value ?? "null"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Assign an Account Manager" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {/* Use "null" as the value for the None option */}
                              <SelectItem value="null">None</SelectItem>
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
                    <div>
                      <FormLabel className="text-lg font-semibold">
                        Addresses
                      </FormLabel>
                      <div className="space-y-4 mt-2">
                        {fields.map((field, index) => (
                          <Card
                            key={field.id}
                            className="bg-slate-50 p-4 relative"
                          >
                            <CardContent className="p-0 grid grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`addresses.${index}.type`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Type *</FormLabel>
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
                                        {addressTypes.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type}
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
                                name={`addresses.${index}.city`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>City *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Riyadh" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`addresses.${index}.street`}
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Street</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="King Fahd Rd"
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`addresses.${index}.district`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>District</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="Al Olaya"
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`addresses.${index}.postalCode`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Postal Code</FormLabel>
                                    <FormControl>
                                      <Input
                                        placeholder="12345"
                                        {...field}
                                        value={field.value ?? ""}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name={`addresses.${index}.locationUrl`}
                                render={({ field }) => (
                                  <FormItem className="col-span-2">
                                    <FormLabel>Location URL *</FormLabel>
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
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </Card>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() =>
                            append({
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
                          <Plus className="mr-2 h-4 w-4" /> Add Address
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenEditDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700"
                      disabled={isSubmittingEdit}
                    >
                      {isSubmittingEdit ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardFooter>
      )}
    </Card>
  );
};

interface CreateCustomerDialogProps extends CustomerDialogProps {
  onCustomerCreated: () => void;
}

const CreateCustomerDialog: React.FC<CreateCustomerDialogProps> = ({
  onCustomerCreated,
  organizationTypes,
  industryTypes,
  addressTypes,
  accountManagers,
}) => {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      contactPerson: "",
      contactEmail: "",
      contactPhone: "",
      industry: "",
      organizationType: "",
      website: "",
      addresses: [],
      accountManagerId: null,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "addresses",
  });

  const onSubmit = async (data: CustomerFormValues) => {
    setIsSubmitting(true);
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

      await createCustomer(payload);

      toast.success("Customer created successfully!");
      setOpen(false);
      form.reset();
      onCustomerCreated();
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Failed to create customer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />
          Create New Customer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Add a new customer to the system. Fill in all required fields.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-3"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Enter company name"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="organizationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() +
                              type.slice(1).replace("-", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <div className="relative">
                        <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none" />
                        <SelectTrigger className="pl-10">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                      </div>
                    </FormControl>
                    <SelectContent>
                      {industryTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
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
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="https://example.com"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Separator />
            <FormField
              control={form.control}
              name="contactEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        type="email"
                        placeholder="contact@example.com"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Phone *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="+1 (555) 123-4567"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accountManagerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Manager</FormLabel>
                  <Select
                    // Handle conversion between the "null" string and actual null
                    onValueChange={(value) =>
                      field.onChange(value === "null" ? null : value)
                    }
                    value={field.value ?? "null"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign an Account Manager" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* Use "null" as the value for the None option */}
                      <SelectItem value="null">None</SelectItem>
                      {accountManagers.map((am) => (
                        <SelectItem key={am.id} value={am.id.toString()}>
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
            <div>
              <FormLabel className="text-lg font-semibold">Addresses</FormLabel>
              <div className="space-y-4 mt-2">
                {fields.map((field, index) => (
                  <Card key={field.id} className="bg-slate-50 p-4 relative">
                    <CardContent className="p-0 grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type *</FormLabel>
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
                                {addressTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {type}
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
                        name={`addresses.${index}.city`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City *</FormLabel>
                            <FormControl>
                              <Input placeholder="Riyadh" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.street`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Street</FormLabel>
                            <FormControl>
                              <Input placeholder="King Fahd Rd" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.district`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>District</FormLabel>
                            <FormControl>
                              <Input placeholder="Al Olaya" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.postalCode`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code</FormLabel>
                            <FormControl>
                              <Input placeholder="12345" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`addresses.${index}.locationUrl`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Location URL *</FormLabel>
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
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </Card>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    append({
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
                  <Plus className="mr-2 h-4 w-4" /> Add Address
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const CustomersPage: React.FC = () => {
  const { user, hasPermission, hasRole } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [organizationTypes, setOrganizationTypes] = useState<string[]>([]);
  const [industryTypes, setIndustryTypes] = useState<string[]>([]);
  const [enumsLoading, setEnumsLoading] = useState(true);
  const [addressTypes, setAddressTypes] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accountManagers, setAccountManagers] = useState<Employee[]>([]);

  const canEditCustomers = hasPermission("customer", "edit");

  const loadEnums = useCallback(async () => {
    try {
      const [orgTypes, indTypes, addrTypes, employeesData] = await Promise.all([
        getOrganizationTypes(),
        getIndustryTypes(),
        getAddressTypes(),
        getEmployees(),
      ]);
      setOrganizationTypes(orgTypes);
      setIndustryTypes(indTypes);
      setAddressTypes(addrTypes);
      setAccountManagers(
        employeesData.filter((emp) => emp.role === "Account Manager")
      );
    } catch (error) {
      console.error("Failed to load enum types for forms", error);
      toast.error("Could not load filter options. Please try refreshing.");
    } finally {
      setEnumsLoading(false);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnums();
    loadCustomers();
  }, [loadEnums, loadCustomers]);

  const filteredCustomers = useMemo(() => {
    let customersToDisplay = [...customers];

    // Role-based filtering
    if (hasRole("account_manager") && user?.id) {
      const userIdNum = parseInt(user.id, 10);
      customersToDisplay = customersToDisplay.filter(
        (c) => c.accountManagerId === userIdNum
      );
    }

    // Search term filtering
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      return customersToDisplay.filter(
        (customer) =>
          customer.name.toLowerCase().includes(lowercasedFilter) ||
          (customer.contactPerson &&
            customer.contactPerson.toLowerCase().includes(lowercasedFilter)) ||
          (customer.industry &&
            customer.industry.toLowerCase().includes(lowercasedFilter))
      );
    }

    return customersToDisplay;
  }, [customers, searchTerm, hasRole, user]);

  if (enumsLoading) {
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
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800">
              Customers
            </h1>
            <p className="text-gray-500">
              View and manage customer information.
            </p>
          </div>
          {canEditCustomers && (
            <CreateCustomerDialog
              onCustomerCreated={loadCustomers}
              organizationTypes={organizationTypes}
              industryTypes={industryTypes}
              addressTypes={addressTypes}
              accountManagers={accountManagers}
            />
          )}
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="customerSearch"
              name="customerSearch"
              placeholder="Search by name, contact, or industry..."
              className="pl-12 pr-4 py-2.5 text-base rounded-md shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <Card className="shadow">
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <Building className="h-20 w-20 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">
                No Customers Found
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mt-2">
                {searchTerm
                  ? "Try adjusting your search term or clear the search."
                  : "There are no customers in the system yet. Why not create one?"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                canEdit={canEditCustomers}
                onCustomerUpdated={loadCustomers}
                onCustomerDeleted={loadCustomers}
                organizationTypes={organizationTypes}
                industryTypes={industryTypes}
                addressTypes={addressTypes}
                accountManagers={accountManagers}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CustomersPage;
