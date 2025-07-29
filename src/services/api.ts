import axios from "axios";
import { auth } from "../firebaseConfig";

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://10.65.99.71:3001/api",
});

// Interceptor to add Firebase ID token to requests
api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken(true); // Force refresh the token
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error("Error getting Firebase ID token:", error);
        // Optionally handle token refresh error, e.g., by redirecting to login
        // or by allowing the request to proceed without the token if appropriate for some endpoints.
      }
    }
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// --- Types ---

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  workExt: number;
  jobTitle: string;
  role: string;
  managerEmail: string | null;
  status: string;
  skills: string[];
  certificates: string[];
  location: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TechnicalTeamMemberProfile {
  id: number; // Employee ID from main 'employees' table (used for URL param)
  //firebaseUid?: string; // Optional: if you link Firebase Auth users
  name: string;
  email: string;
  jobTitle: string; // From main 'employees' table
  team: "Delivery" | "Managed Services" | string; // From 'employee_profiles' table
  level: string; // From 'employee_profiles'
  grade: string; // From 'employee_profiles'
  yearsOfExperience: number | string; // From 'employee_profiles'
  skills: string[]; // From 'employee_profiles'
  certificates: string[]; // From 'employee_profiles'
  fields_covered?: string[]; // New field
  technical_development_plan?: string[]; // New field
}

// Payload for creating an employee
export type CreateEmployeePayload = Omit<
  Employee,
  "id" | "createdAt" | "updatedAt"
>;
// Payload for updating an employee
export type UpdateEmployeePayload = Partial<
  Omit<Employee, "id" | "createdAt" | "updatedAt">
>;

export interface Customer {
  id: number;
  name: string;
  website: string | null;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  industry: string;
  organizationType: string;
  createdAt: string;
  updatedAt: string;
  addresses: Address[];
  accountManagerId: number | null; // Add this line
  accountManager?: Pick<Employee, 'id' | 'firstName' | 'lastName'>;
}

export interface Address {
  id?: number; // FIX: Make id optional to support creating new addresses during an update
  customerId: number;
  type: "HQ" | "Branch" | string;
  locationUrl: string;
  street?: string | null;
  district?: string | null;
  postalCode?: string | null;
  city: string;
  country: string;
}

export interface PocEmployeeAssignment {
  id: number;
  pocId: number;
  employeeId: number;
  role: string;
  assignedAt: string;
  unassignedAt: string | null;
  employee?: Pick<
    Employee,
    "id" | "firstName" | "lastName" | "email" | "jobTitle"
  >;
}

export interface ProjectEmployeeAssignment {
  id: number;
  projectId: number;
  employeeId: number;
  role: string;
  assignedAt: string;
  unassignedAt: string | null;
  employee?: Pick<
    Employee,
    "id" | "firstName" | "lastName" | "email" | "jobTitle"
  >;
}

export interface PocStatusUpdate {
  id: number;
  pocId: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  comments?: PocThreadComment[];
}

export interface PocThreadComment {
  id: number;
  statusCommentId: number;
  authorId: number;
  comment: string;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email?: string;
  };
}
export interface Attachment {
  id: number;
  uuid: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploadedBy: {
    id: number;
    name: string;
  };
}

export interface Poc {
  id: number;
  title: string;
  status: string;
  workflow_status: 'pending_presales_review' | 'active' | 'rejected';
  description?: string | null; // The text from Presales
  isBudgetAllocated?: boolean;
  isVendorAware?: boolean;
  createdAt: string;
  updatedAt: string;
  customerId: number;
  customer?: Customer;
  leadId?: number;
  lead?: Employee;
  accountManagerId?: number;
  accountManager?: Employee;
  technology: string[];
  startDate: string;
  endDate: string;
  statusHistory?: PocStatusUpdate[];
  teamAssignments?: PocEmployeeAssignment[];
  lastComment?: string | null;
  attachments: Attachment[];
}

// Interface for the PoC List Page items
export interface PocListItem {
  id: number;
  title: string;
  status: string;
  customerName?: string;
  technology?: string[];
  leadName?: string | null;
  amName?: string | null;
  teamMemberCount?: number;
  startDate: string;
  endDate: string;
  updatedAt: string;
  workflow_status: 'pending_presales_review' | 'active' | 'rejected';
}

export interface CreatePocPayload {
  title: string;
  status: string;
  customerId: number;
  leadId: number;
  accountManagerId: number;
  technology: string[];
  startDate: string | null; // Now optional, can be null if not provided
  endDate?: string | null; // Now optional, can be null if not provided
  initialTeamAssignments?: Array<
    Omit<PocEmployeeAssignment, "id" | "pocId" | "unassignedAt" | "employee">
  >;
  isBudgetAllocated?: boolean;
  isVendorAware?: boolean;
}

export interface TeamAssignmentPayload {
  employeeId: number;
  role: string;
}

export interface UpdatePocPayload {
  title?: string;
  status?: string;
  technology?: string[];
  startDate?: string | null; // Added: Start date can now be updated, can be null
  endDate?: string | null; // Changed: Can be null
  leadId?: number; // ID of the employee for the PoC Technical Lead role
  accountManagerId?: number; // ID of the employee for the PoC Account Manager role (typically not changed via this form update)
  teamAssignments?: TeamAssignmentPayload[];
}

export interface UpdateTechnicalProfilePayload {
  team?: "Delivery" | "Managed Services" | string;
  grade?: string;
  yearsOfExperience?: number;
  skills?: string[];
  certificates?: string[];
  fields_covered?: string[];
  technical_development_plan?: string[];
  // Note: 'level' is not included here because the backend should derive it
  // and update the 'level' column in the database based on the 'grade' it receives.
}

export interface ProjectListItem {
  id: number;
  title: string;
  customerName: string;
  technology: string[];
  projectManagerName: string | null;
  technicalLeadName: string | null;
  accountManagerName: string | null;
  statuses: string[]; // From the project_status_enum
  startDate: string | null; // Comes as ISO 8601 string from the backend
  endDate: string | null; // Comes as ISO 8601 string from the backend
}

export interface Assignee {
  id: number;
  name: string;
}

export interface Task {
  id: number;
  task_name: string;
  assignees: Assignee[] | null;
  status: "Not Started" | "In Progress" | "Overdue" | "Completed";
  priority: "Urgent" | "High" | "Normal" | "Low" | "No Priority";
  due_date: string | null;
  tags: string[] | null;
  subtasks: Task[];
  parent_task_id: number | null;
  created_by: number;
}

export interface CreateTaskPayload {
  projectId: number;
  taskName: string;
  parentTaskId?: number | null;
  priority?: Task["priority"];
  dueDate?: string | null;
  tags?: string[];
  assignees?: number[]; 
  createdBy: number;
}

export interface UpdateTaskPayload {
  taskName?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  dueDate?: string | null;
  tags?: string[];
  assignees?: number[]; // Array of employee IDs
}

export interface TeamAssignmentPayload {
  employeeId: number;
  role: string;
}

export interface CreateProjectPayload {
  title: string;
  customerId: number;
  technology: string[];
  statuses?: string[];
  startDate: string; // "yyyy-MM-dd"
  endDate?: string | null; // "yyyy-MM-dd"
  accountManagerId: number;
  technicalLeadId?: number | null;
  projectManagerId: number; // Added
  initialTeamAssignments?: TeamAssignmentPayload[];
  sourcePocId?: number;
}

export interface UpdateProjectPayload {
  title?: string;
  technology?: string[];
  statuses?: string[];
  startDate?: string;
  endDate?: string | null;
  technicalLeadId?: number;
  projectManagerId?: number; // Added
  teamAssignments?: TeamAssignmentPayload[];
}

export interface ProjectStatusUpdate {
  id: number;
  projectId: number;
  startedAt: string;
  endedAt: string | null;
  status: string;
  comments?: ProjectThreadComment[];
}

export interface ProjectThreadComment {
  id: number;
  statusCommentId: number;
  authorId: number;
  comment: string;
  createdAt: string;
  author?: {
    id: number;
    name: string;
    email?: string;
  };
}

export interface ProjectAttachment {
  id: number;
  uuid: string;
  description: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploadedBy: {
      id: number;
      name: string;
  };
}

export interface Project {
  id: number;
  title: string;
  technology: string[];
  statuses?: string[];
  activeStatuses?: string[];
  startDate: string;
  endDate: string | null;
  customerId: number;
  accountManagerId: number;
  technicalLeadId: number;
  projectManagerId: number;
  customer?: Customer;
  accountManager?: Employee;
  lead?: Employee;
  projectManager?: Employee;
  statusHistory?: ProjectStatusUpdate[];
  teamAssignments?: ProjectEmployeeAssignment[];
  attachments: ProjectAttachment[];
  sourcePocId?: number;
  //tasks?: Task[];
}

export interface PocActivityLog {
  id: number;
  pocId: number;
  activityType: 'POC_CREATED' | 'FIELD_UPDATED' | 'STATUS_UPDATED' | 'LEAD_ASSIGNED' | 'TEAM_MEMBER_ASSIGNED' | 'TEAM_MEMBER_UNASSIGNED' | 'ATTACHMENT_UPLOADED' | 'ATTACHMENT_DOWNLOADED';
  details: {
    title?: string;
    field?: string;
    from?: any;
    to?: any;
    member?: string;
    role?: string;
    filename?: string;
  };
  timestamp: string; // ISO Date string
  user: {
    id: number;
    name: string;
  };
}

export interface ProjectActivityLog {
  id: number;
  projectId: number;
  activityType: 
    | 'PROJECT_CREATED' | 'FIELD_UPDATED' | 'STATUS_UPDATED' 
    | 'LEAD_ASSIGNED' | 'PM_ASSIGNED' | 'TEAM_MEMBER_ASSIGNED' | 'TEAM_MEMBER_UNASSIGNED'
    | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'TASK_DELETED' | 'ATTACHMENT_UPLOADED' | 'ATTACHMENT_DOWNLOADED';
  details: {
    title?: string;
    field?: string;
    from?: any;
    to?: any;
    member?: string;
    role?: string;
    taskName?: string;
    parentTaskName?: string;
    filename?: string;
  };
  timestamp: string;
  user: {
    id: number;
    name: string;
  };
}

export interface RecentProjectActivityLog {
  id: number;
  projectId: number;
  projectTitle: string; // <-- Has project title
  activityType: string;
  details: {
    title?: string;
    field?: string;
    from?: any;
    to?: any;
    taskName?: string;
  };
  timestamp: string;
  user: {
    id: number;
    name: string;
  };
}





export const getRecentProjectActivity = async (): Promise<RecentProjectActivityLog[]> => {
  try {
    const response = await api.get<RecentProjectActivityLog[]>(`/recent-activity/projects`);
    return response.data;
  } catch (error) {
    console.error(`API error in getRecentProjectActivity:`, error);
    return [];
  }
};

export const getProjectActivityLog = async (projectId: number): Promise<ProjectActivityLog[]> => {
  try {
    const response = await api.get<ProjectActivityLog[]>(`/project-activity-log/${projectId}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getProjectActivityLog for projectId ${projectId}:`, error);
    return [];
  }
};

// --- New API Method for fetching the log ---
export const getPocActivityLog = async (pocId: number): Promise<PocActivityLog[]> => {
  try {
    const response = await api.get<PocActivityLog[]>(`/poc-activity-log/${pocId}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getPocActivityLog for pocId ${pocId}:`, error);
    // Return empty array on error to prevent UI crash
    return [];
  }
};

// --- Enum Fetching API Methods ---

export const getAddressTypes = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/address-types");
    return response.data;
  } catch (error) {
    console.error("API error in getAddressTypes:", error);
    throw error;
  }
};
// An address object for creation doesn't have an ID or customerId yet
type NewAddressPayload = Omit<Address, "id" | "customerId">;

// The customer payload for creation uses this address payload
export interface CreateCustomerPayload
  extends Omit<Customer, "id" | "createdAt" | "updatedAt" | "addresses" | "accountManager"> {
  addresses?: NewAddressPayload[];
}

export const getPocStatuses = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/poc-statuses");
    return response.data;
  } catch (error) {
    console.error("API error in getPocStatuses:", error);
    throw error;
  }
};

export const getEmployeeRoles = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/employee-roles");
    return response.data;
  } catch (error) {
    console.error("API error in getEmployeeRoles:", error);
    throw error;
  }
};

export const getEmployeeLocations = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/employee-locations");
    return response.data;
  } catch (error) {
    console.error("API error in getEmployeeLocations:", error);
    throw error;
  }
};

export const getEmployeeStatuses = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/employee-statuses");
    return response.data;
  } catch (error) {
    console.error("API error in getEmployeeStatuses:", error);
    throw error;
  }
};

export const getIndustryTypes = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/industries");
    return response.data;
  } catch (error) {
    console.error("API error in getIndustryTypes:", error);
    throw error;
  }
};

export const getOrganizationTypes = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/organization-types");
    return response.data;
  } catch (error) {
    console.error("API error in getOrganizationTypes:", error);
    throw error;
  }
};

export const getPocEmployeeRoles = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/poc-employee-roles");
    return response.data;
  } catch (error) {
    console.error("API error in getPocEmployeeRoles:", error);
    throw error;
  }
};

// --- Employee API Methods ---
export const getEmployees = async (): Promise<Employee[]> => {
  try {
    const response = await api.get<Employee[]>("/employees");
    return response.data;
  } catch (error) {
    console.error("API error in getEmployees:", error);
    throw error;
  }
};

export const getEmployeeById = async (id: number): Promise<Employee | null> => {
  try {
    const response = await api.get<Employee>(`/employees/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getEmployeeById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const getEmployeeByEmail = async (
  email: string
): Promise<Employee | null> => {
  try {
    const response = await api.get<Employee>(`/employees/${email}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getEmployeeByEmail(${email}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createEmployee = async (
  employeeData: CreateEmployeePayload
): Promise<Employee> => {
  try {
    const response = await api.post<Employee>("/employees", employeeData);
    return response.data;
  } catch (error) {
    console.error("API error in createEmployee:", error);
    throw error;
  }
};

export const updateEmployee = async (
  id: number,
  employeeData: UpdateEmployeePayload
): Promise<Employee | null> => {
  try {
    const response = await api.put<Employee>(`/employees/${id}`, employeeData);
    return response.data;
  } catch (error) {
    console.error(`API error in updateEmployee(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteEmployee = async (id: number): Promise<void> => {
  try {
    await api.delete(`/employees/${id}`);
  } catch (error) {
    console.error(`API error in deleteEmployee(${id}):`, error);
    throw error;
  }
};

export const getTechnicalTeamMemberDetailsById = async (
  employeeId: number
): Promise<TechnicalTeamMemberProfile | null> => {
  try {
    const response = await api.get<TechnicalTeamMemberProfile>(
      `/employees/technical-profile/${employeeId}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in getTechnicalTeamMemberDetailsById(${employeeId}):`,
      error
    );
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

// --- Customer API Methods ---
export const getCustomers = async (): Promise<Customer[]> => {
  try {
    const response = await api.get<Customer[]>("/customers");
    return response.data;
  } catch (error) {
    console.error("API error in getCustomers:", error);
    throw error;
  }
};

export const getCustomerById = async (id: number): Promise<Customer | null> => {
  try {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getCustomerById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createCustomer = async (
  customerData: CreateCustomerPayload
): Promise<Customer> => {
  try {
    const response = await api.post<Customer>("/customers", customerData);
    return response.data;
  } catch (error) {
    console.error("API error in createCustomer:", error);
    throw error;
  }
};

export const updateCustomer = async (
  id: number,
  customerData: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt" | "accountManager">>
): Promise<Customer | null> => {
  try {
    const response = await api.put<Customer>(`/customers/${id}`, customerData);
    return response.data;
  } catch (error) {
    console.error(`API error in updateCustomer(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteCustomer = async (id: number): Promise<void> => {
  try {
    await api.delete(`/customers/${id}`);
  } catch (error) {
    console.error(`API error in deleteCustomer(${id}):`, error);
    throw error;
  }
};

// --- Address API Methods ---

export const getAddresses = async (customerId?: number): Promise<Address[]> => {
  try {
    const params = customerId ? { customerId } : {};
    const response = await api.get<Address[]>("/addresses", { params });
    return response.data;
  } catch (error) {
    console.error("API error in getAddresses:", error);
    throw error;
  }
};

export const getAddressById = async (id: number): Promise<Address | null> => {
  try {
    const response = await api.get<Address>(`/addresses/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getAddressById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createAddress = async (
  addressData: Omit<Address, "id">
): Promise<Address> => {
  try {
    const response = await api.post<Address>("/addresses", addressData);
    return response.data;
  } catch (error) {
    console.error("API error in createAddress:", error);
    throw error;
  }
};

export const updateAddress = async (
  id: number,
  addressData: Partial<Omit<Address, "id" | "customerId">>
): Promise<Address | null> => {
  try {
    const response = await api.put<Address>(`/addresses/${id}`, addressData);
    return response.data;
  } catch (error) {
    console.error(`API error in updateAddress(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteAddress = async (id: number): Promise<void> => {
  try {
    await api.delete(`/addresses/${id}`);
  } catch (error) {
    console.error(`API error in deleteAddress(${id}):`, error);
    throw error;
  }
};

// --- PoC Employee Assignment API Methods ---
export const getPocEmployeeAssignments = async (filters?: {
  pocId?: number;
  employeeId?: number;
}): Promise<PocEmployeeAssignment[]> => {
  try {
    const response = await api.get<PocEmployeeAssignment[]>("/poc-employees", {
      params: filters,
    });
    return response.data;
  } catch (error) {
    console.error("API error in getPocEmployeeAssignments:", error);
    throw error;
  }
};

export const getPocEmployeeAssignmentById = async (
  id: number
): Promise<PocEmployeeAssignment | null> => {
  try {
    const response = await api.get<PocEmployeeAssignment>(
      `/poc-employees/${id}`
    );
    return response.data;
  } catch (error) {
    console.error(`API error in getPocEmployeeAssignmentById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const assignEmployeeToPoc = async (
  assignmentData: Omit<
    PocEmployeeAssignment,
    "id" | "unassignedAt" | "employee"
  >
): Promise<PocEmployeeAssignment> => {
  try {
    const response = await api.post<PocEmployeeAssignment>(
      "/poc-employees",
      assignmentData
    );
    return response.data;
  } catch (error) {
    console.error("API error in assignEmployeeToPoc:", error);
    throw error;
  }
};

export const updatePocEmployeeAssignment = async (
  id: number,
  assignmentData: Partial<Pick<PocEmployeeAssignment, "role" | "unassignedAt">>
): Promise<PocEmployeeAssignment | null> => {
  try {
    const response = await api.put<PocEmployeeAssignment>(
      `/poc-employees/${id}`,
      assignmentData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updatePocEmployeeAssignment(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deletePocEmployeeAssignment = async (
  id: number
): Promise<void> => {
  try {
    await api.delete(`/poc-employees/${id}`);
  } catch (error) {
    console.error(`API error in deletePocEmployeeAssignment(${id}):`, error);
    throw error;
  }
};

// --- PoC Status Update API Methods ---
export const getPocStatusUpdates = async (
  pocId: number
): Promise<PocStatusUpdate[]> => {
  try {
    const response = await api.get<PocStatusUpdate[]>("/poc-status-comments", {
      params: { pocId },
    });
    return response.data;
  } catch (error) {
    console.error(
      `API error in getPocStatusUpdates for pocId ${pocId}:`,
      error
    );
    throw error;
  }
};

export const getPocStatusUpdateById = async (
  id: number
): Promise<PocStatusUpdate | null> => {
  try {
    const response = await api.get<PocStatusUpdate>(
      `/poc-status-comments/${id}`
    );
    return response.data;
  } catch (error) {
    console.error(`API error in getPocStatusUpdateById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createPocStatusUpdate = async (
  statusData: Omit<PocStatusUpdate, "id" | "comments">
): Promise<PocStatusUpdate> => {
  try {
    const response = await api.post<PocStatusUpdate>(
      "/poc-status-comments",
      statusData
    );
    return response.data;
  } catch (error) {
    console.error("API error in createPocStatusUpdate:", error);
    throw error;
  }
};

export const updatePocStatusUpdate = async (
  id: number,
  statusData: Partial<Omit<PocStatusUpdate, "id" | "pocId" | "comments">>
): Promise<PocStatusUpdate | null> => {
  try {
    const response = await api.put<PocStatusUpdate>(
      `/poc-status-comments/${id}`,
      statusData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updatePocStatusUpdate(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deletePocStatusUpdate = async (id: number): Promise<void> => {
  try {
    await api.delete(`/poc-status-comments/${id}`);
  } catch (error) {
    console.error(`API error in deletePocStatusUpdate(${id}):`, error);
    throw error;
  }
};

// --- PoC Thread Comment API Methods ---
export const getPocThreadComments = async (
  statusCommentId: number
): Promise<PocThreadComment[]> => {
  try {
    const response = await api.get<PocThreadComment[]>("/poc-comments", {
      params: { statusCommentId },
    });
    return response.data;
  } catch (error) {
    console.error(
      `API error in getPocThreadComments for statusCommentId ${statusCommentId}:`,
      error
    );
    throw error;
  }
};

export const getPocThreadCommentById = async (
  id: number
): Promise<PocThreadComment | null> => {
  try {
    const response = await api.get<PocThreadComment>(`/poc-comments/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getPocThreadCommentById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createPocThreadComment = async (
  commentData: Omit<PocThreadComment, "id" | "createdAt" | "author">
): Promise<PocThreadComment> => {
  try {
    const response = await api.post<PocThreadComment>(
      "/poc-comments",
      commentData
    );
    return response.data;
  } catch (error) {
    console.error("API error in createPocThreadComment:", error);
    throw error;
  }
};

export const updatePocThreadComment = async (
  id: number,
  commentData: Pick<PocThreadComment, "comment">
): Promise<PocThreadComment | null> => {
  try {
    const response = await api.put<PocThreadComment>(
      `/poc-comments/${id}`,
      commentData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updatePocThreadComment(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deletePocThreadComment = async (id: number): Promise<void> => {
  try {
    await api.delete(`/poc-comments/${id}`);
  } catch (error) {
    console.error(`API error in deletePocThreadComment(${id}):`, error);
    throw error;
  }
};

// --- PoC (Main Entity) API Methods ---
// Note: getPocs now returns PocListItem[]
export const getPocs = async (): Promise<PocListItem[]> => {
  try {
    const response = await api.get<PocListItem[]>("/pocs");
    return response.data;
  } catch (error) {
    console.error("API error in getPocs:", error);
    throw error;
  }
};

export const getPocById = async (id: number): Promise<Poc | null> => {
  try {
    const response = await api.get<Poc>(`/pocs/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getPocById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createPoc = async (pocData: CreatePocPayload): Promise<Poc> => {
  try {
    const response = await api.post<Poc>("/pocs", pocData);
    return response.data;
  } catch (error) {
    console.error("API error in createPoc:", error);
    throw error;
  }
};

// In services/api.ts (frontend_api_ts_dynamic_enums_20250523)

export const updatePoc = async (
  id: number,
  pocUpdateData: UpdatePocPayload
): Promise<Poc | null> => {
  try {
    const response = await api.put<Poc>(`/pocs/${id}`, pocUpdateData);
    return response.data;
  } catch (error) {
    console.error(`API error in updatePoc(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deletePoc = async (id: number): Promise<void> => {
  try {
    await api.delete(`/pocs/${id}`);
  } catch (error) {
    console.error(`API error in deletePoc(${id}):`, error);
    throw error;
  }
};

export const updateTechnicalTeamMemberProfile = async (
  employeeId: number, // Assuming your backend expects the numeric on-premise ID
  payload: UpdateTechnicalProfilePayload
): Promise<TechnicalTeamMemberProfile | null> => {
  // Assuming backend returns the full updated profile
  try {
    // Using PUT request to update the resource.
    // Adjust to PATCH if your backend supports partial updates and you prefer that.
    const response = await api.put<TechnicalTeamMemberProfile>(
      `/employees/technical-profile/${employeeId}`,
      payload
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in updateTechnicalTeamMemberProfile for ID ${employeeId}:`,
      error
    );
    // You can customize error handling here, e.g., by checking error.response.status
    if (axios.isAxiosError(error) && error.response) {
      // Example: Pass backend error message to the caller
      throw new Error(
        error.response.data?.error ||
          error.response.data?.message ||
          `Failed to update profile: ${error.response.status}`
      );
    }
    throw error; // Re-throw for the component to handle with toast
  }
};

export const searchEmployeesForMention = async (
  query: string
): Promise<Employee[]> => {
  try {
    // Adjust if your Employee type for mentions is different or if backend returns a different structure
    const response = await api.get<Employee[]>(
      `/employees/search/mentions?q=${encodeURIComponent(query)}`
    );
    return response.data;
  } catch (error) {
    console.error("Error searching employees for mention:", error);
    return []; // Return empty array on error or throw
  }
};

export const getProjects = async (): Promise<ProjectListItem[]> => {
  try {
    const response = await api.get<ProjectListItem[]>("/projects");
    return response.data;
  } catch (error) {
    console.error("API error in getProjects:", error);
    throw error;
  }
};

export const getProjectStatuses = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/project-statuses");
    return response.data;
  } catch (error) {
    console.error("API error in getProjectStatuses:", error);
    throw error;
  }
};

export const getProjectById = async (id: number): Promise<Project | null> => {
  try {
    const response = await api.get<Project>(`/projects/${id}`);
    return response.data;
  } catch (error) {
    console.error(`API error in getProjectById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createProject = async (
  projectData: CreateProjectPayload
): Promise<Project> => {
  try {
    const response = await api.post<Project>("/projects", projectData);
    return response.data;
  } catch (error) {
    console.error("API error in createProject:", error);
    throw error;
  }
};

export const updateProject = async (
  id: number,
  projectUpdateData: UpdateProjectPayload
): Promise<Project | null> => {
  try {
    const response = await api.put<Project>(
      `/projects/${id}`,
      projectUpdateData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updateProject(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteProject = async (id: number): Promise<void> => {
  try {
    await api.delete(`/projects/${id}`);
  } catch (error) {
    console.error(`API error in deleteProject(${id}):`, error);
    throw error;
  }
};

export const getProjectEmployeeRoles = async (): Promise<string[]> => {
  try {
    const response = await api.get<string[]>("/enums/project-employee-roles");
    return response.data;
  } catch (error) {
    console.error("API error in getProjectEmployeeRoles:", error);
    throw error;
  }
};

// to update

export const getProjectStatusUpdates = async (
  projectId: number
): Promise<ProjectStatusUpdate[]> => {
  try {
    const response = await api.get<ProjectStatusUpdate[]>(
      "/project-status-comments",
      { params: { projectId } }
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in getProjectStatusUpdates for projectId ${projectId}:`,
      error
    );
    throw error;
  }
};

export const getActiveProjectStatusUpdates = async (
  projectId: number
): Promise<ProjectStatusUpdate[]> => {
  try {
    const response = await api.get<ProjectStatusUpdate[]>(
      "/project-status-comments/active-statuses",
      { params: { projectId } }
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in getActiveProjectStatusUpdates for projectId ${projectId}:`,
      error
    );
    throw error;
  }
};

export const getProjectStatusUpdateById = async (
  id: number
): Promise<ProjectStatusUpdate | null> => {
  try {
    const response = await api.get<ProjectStatusUpdate>(
      `/project-status-comments/${id}`
    );
    return response.data;
  } catch (error) {
    console.error(`API error in getProjectStatusUpdateById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const getActiveProjectStatusUpdateById = async (
  id: number
): Promise<ProjectStatusUpdate | null> => {
  try {
    const response = await api.get<ProjectStatusUpdate>(
      `/project-status-comments/active-statuses/${id}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in getActiveProjectStatusUpdateById(${id}):`,
      error
    );
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createProjectStatusUpdate = async (
  statusData: Omit<ProjectStatusUpdate, "id" | "comments">
): Promise<ProjectStatusUpdate> => {
  try {
    const response = await api.post<ProjectStatusUpdate>(
      "/project-status-comments",
      statusData
    );
    return response.data;
  } catch (error) {
    console.error("API error in createProjectStatusUpdate:", error);
    throw error;
  }
};

export const updateProjectStatusUpdate = async (
  id: number,
  statusData: Partial<
    Omit<ProjectStatusUpdate, "id" | "projectId" | "comments">
  >
): Promise<ProjectStatusUpdate | null> => {
  try {
    const response = await api.put<ProjectStatusUpdate>(
      `/project-status-comments/${id}`,
      statusData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updateProjectStatusUpdate(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteProjectStatusUpdate = async (id: number): Promise<void> => {
  try {
    await api.delete(`/project-status-comments/${id}`);
  } catch (error) {
    console.error(`API error in deleteProjectStatusUpdate(${id}):`, error);
    throw error;
  }
};

// --- PoC Thread Comment API Methods ---
export const getProjectThreadComments = async (
  statusCommentId: number
): Promise<ProjectThreadComment[]> => {
  try {
    const response = await api.get<ProjectThreadComment[]>(
      "/project-comments",
      { params: { statusCommentId } }
    );
    return response.data;
  } catch (error) {
    console.error(
      `API error in getProjectThreadComments for statusCommentId ${statusCommentId}:`,
      error
    );
    throw error;
  }
};

export const getProjectThreadCommentById = async (
  id: number
): Promise<ProjectThreadComment | null> => {
  try {
    const response = await api.get<ProjectThreadComment>(
      `/project-comments/${id}`
    );
    return response.data;
  } catch (error) {
    console.error(`API error in getProjectThreadCommentById(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const createProjectThreadComment = async (
  commentData: Omit<ProjectThreadComment, "id" | "createdAt" | "author">
): Promise<ProjectThreadComment> => {
  try {
    const response = await api.post<ProjectThreadComment>(
      "/project-comments",
      commentData
    );
    return response.data;
  } catch (error) {
    console.error("API error in createProjectThreadComment:", error);
    throw error;
  }
};

export const updateProjectThreadComment = async (
  id: number,
  commentData: Pick<ProjectThreadComment, "comment">
): Promise<ProjectThreadComment | null> => {
  try {
    const response = await api.put<ProjectThreadComment>(
      `/project-comments/${id}`,
      commentData
    );
    return response.data;
  } catch (error) {
    console.error(`API error in updateProjectThreadComment(${id}):`, error);
    if (axios.isAxiosError(error) && error.response?.status === 404)
      return null;
    throw error;
  }
};

export const deleteProjectThreadComment = async (id: number): Promise<void> => {
  try {
    await api.delete(`/project-comments/${id}`);
  } catch (error) {
    console.error(`API error in deleteProjectThreadComment(${id}):`, error);
    throw error;
  }
};

/**
 * Fetches all tasks for a given project ID.
 * Corresponds to: GET /api/tasks?projectId=:id
 */
export const getTasksForProject = async (
  projectId: number
): Promise<Task[]> => {
  try {
    const response = await api.get<Task[]>(`/tasks?projectId=${projectId}`);
    return response.data;
  } catch (error) {
    console.error(
      `API error in getTasksForProject for projectId ${projectId}:`,
      error
    );
    throw error;
  }
};

/**
 * Creates a new task.
 * Corresponds to: POST /api/tasks
 */
export const createTask = async (payload: CreateTaskPayload): Promise<Task> => {
  try {
    const response = await api.post<Task>("/tasks", payload);
    return response.data;
  } catch (error) {
    console.error("API error in createTask:", error);
    throw error;
  }
};

/**
 * Updates an existing task.
 * Corresponds to: PUT /api/tasks/:taskId
 */
export const updateTask = async (
  taskId: number,
  payload: UpdateTaskPayload
): Promise<Task> => {
  try {
    const response = await api.put<Task>(`/tasks/${taskId}`, payload);
    return response.data;
  } catch (error) {
    console.error(`API error in updateTask for taskId ${taskId}:`, error);
    throw error;
  }
};

/**
 * Checks a list of tasks and updates any that are overdue.
 * This function should be called on the frontend after fetching tasks.
 */
export const checkAndSetOverdueTasks = async (
  tasks: Task[]
): Promise<Task[]> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to the beginning of today for accurate date comparison

  const updatedTasks = [...tasks];
  const tasksToUpdate: Promise<any>[] = [];

  for (const task of updatedTasks) {
    const isOverdue = task.due_date && new Date(task.due_date) < today;
    const isNotCompleted = task.status !== "Completed";

    if (isOverdue && isNotCompleted && task.status !== "Overdue") {
      console.log(
        `Task "${task.task_name}" (ID: ${task.id}) is overdue. Updating status.`
      );
      // Add the update API call to a promise array to run them in parallel
      tasksToUpdate.push(updateTask(task.id, { status: "Overdue" }));
      // Optimistically update the local object
      task.status = "Overdue";
    }
  }

  // Wait for all the API update calls to complete
  if (tasksToUpdate.length > 0) {
    await Promise.all(tasksToUpdate);
    console.log(`${tasksToUpdate.length} tasks were updated to 'Overdue'.`);
  }

  return updatedTasks;
};

export const deleteTask = async (taskId: number): Promise<void> => {
  try {
    await api.delete(`/tasks/${taskId}`);
  } catch (error) {
    console.error(`API error in deleteTask for task ${taskId}:`, error);
    // Re-throw the error to be caught by the component's try/catch block
    throw error;
  }
};

export const uploadPocAttachment = async (pocId: number, formData: FormData): Promise<Attachment> => {
  const response = await api.post(`/pocs/${pocId}/attachments`, formData, {
      headers: {
          'Content-Type': 'multipart/form-data',
      },
  });
  return response.data;
};

export const uploadProjectAttachment = async (projectId: number, formData: FormData): Promise<ProjectAttachment> => {
  const response = await api.post(`/projects/${projectId}/attachments`, formData, {
      headers: {
          'Content-Type': 'multipart/form-data',
      },
  });
  return response.data;
};

export const downloadAttachment = async (uuid: string): Promise<Blob> => {
  const response = await api.get(`/attachments/${uuid}/download`, {
    responseType: 'blob', // This is crucial
  });
  return response.data;
};



export const approvePoc = async (pocId: number, data: { description: string }): Promise<void> => {
  const response = await api.put(`/pocs/${pocId}/approve`, data);
  return response.data;
};


export default api;
