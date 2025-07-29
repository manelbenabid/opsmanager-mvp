import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getProjectById, // Changed
  createProjectThreadComment,
  updateProject,
  getProjectStatuses,
  // getActiveProjectStatusUpdateById,
  // getActiveProjectStatusUpdates,
  Project,
  Task, // New
  ProjectThreadComment,
  ProjectStatusUpdate,
  Employee,
  searchEmployeesForMention,
  UpdateProjectPayload,
  getProjectActivityLog,
  ProjectActivityLog,
  uploadProjectAttachment
} from "../services/api";
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  Clock,
  Users,
  UserCheck,
  Send,
  Loader2,
  Phone,
  CalendarCheck,
  DraftingCompass,
  ThumbsUp,
  Truck,
  PackageCheck,
  ServerCog,
  Server,
  AlertTriangle,
  Hourglass,
  Trophy,
  ChevronRight,
  CheckCircle,
  ListTodo,
  CircleDot,
  UserCog,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Paperclip, Upload, Download, File, Trash2, X
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import AttachmentCard from '../components/AttachmentCard';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { MentionsInput, Mention, SuggestionDataItem } from "react-mentions";
import ProjectActivitySidebar from '../components/ProjectActivitySidebar';
import { formatDistanceToNow } from 'date-fns'; // For friendly dates
import { filesize } from 'filesize';

// --- STATUS AND ROLE DEFINITIONS ---
const PROJECT_MANAGER_ROLE_DISPLAY = "Project Manager";
const TECHNICAL_LEAD_ROLE_DISPLAY = "Technical Lead";
const ACCOUNT_MANAGER_ROLE_DISPLAY = "Account Manager";

const projectStatusColors: { [key: string]: string } = {
  default: "bg-gray-100 text-gray-700 border-gray-300",
  "reached the customer via call/email":
    "bg-sky-100 text-sky-800 border-sky-300",
  "initiated the kickoff meeting": "bg-blue-100 text-blue-800 border-blue-300",
  "lld in progress": "bg-indigo-100 text-indigo-800 border-indigo-300",
  "lld sent to customer": "bg-violet-100 text-violet-800 border-violet-300",
  "lld initially approved": "bg-purple-100 text-purple-800 border-purple-300",
  "materials shipped": "bg-lime-100 text-lime-800 border-lime-300",
  "materials delivered": "bg-green-100 text-green-800 border-green-300",
  "staging in progress": "bg-teal-100 text-teal-800 border-teal-300",
  "staging complete": "bg-cyan-100 text-cyan-800 border-cyan-300",
  "customer has a challenge": "bg-orange-100 text-orange-800 border-orange-300",
  "coc is pending": "bg-amber-100 text-amber-800 border-amber-300",
  "project delivered":
    "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const projectStatusIcons: { [key: string]: React.ElementType } = {
  default: Clock,
  "reached the customer via call/email": Phone,
  "initiated the kickoff meeting": CalendarCheck,
  "lld in progress": DraftingCompass,
  "lld sent to customer": Send,
  "lld initially approved": ThumbsUp,
  "materials shipped": Truck,
  "materials delivered": PackageCheck,
  "staging in progress": ServerCog,
  "staging complete": Server,
  "customer has a challenge": AlertTriangle,
  "coc is pending": Hourglass,
  "project delivered": Trophy,
};





// --- HELPER FUNCTIONS ---
const renderMention = (mentionText: string): React.ReactNode => {
  /* ... */
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  const parts: (string | JSX.Element)[] = [];
  let match;
  while ((match = mentionRegex.exec(mentionText)) !== null) {
    const [_fullMatch, displayName, _idValueWithPrefix] = match;
    if (match.index > lastIndex) {
      parts.push(mentionText.substring(lastIndex, match.index));
    }
    parts.push(
      <span
        key={`${displayName}-${match.index}`}
        className="text-blue-600 font-medium"
      >
        {displayName}
      </span>
    );
    lastIndex = mentionRegex.lastIndex;
  }
  if (lastIndex < mentionText.length) {
    parts.push(mentionText.substring(lastIndex));
  }
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>{part}</React.Fragment>
      ))}
    </>
  );
};

const getInitials = (
  employee?: { firstName?: string; lastName?: string } | { name?: string }
) => {
  if (!employee) return "?";
  if ("name" in employee && employee.name) {
    return (
      employee.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase() || "?"
    );
  }
  if ("firstName" in employee && "lastName" in employee) {
    return (
      `${employee.firstName?.charAt(0) || ""}${
        employee.lastName?.charAt(0) || ""
      }`.toUpperCase() || "?"
    );
  }
  return "?";
};

const normalizeStatusKey = (status: string): string =>
  status.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();



// --- MAIN DETAIL PAGE COMPONENT ---
const ProjectDetailPage: React.FC = () => {
  const { id: projectIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [endDateForm, setEndDateForm] = useState(""); // For date input
  const [isEndDateUpdating, setIsEndDateUpdating] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]); // For the update control
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [loadingEnums, setLoadingEnums] = useState(true);
  const [activityLog, setActivityLog] = useState<ProjectActivityLog[]>([]);
  const [isLogLoading, setIsLogLoading] = useState(true);const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const projectId = projectIdParam ? parseInt(projectIdParam, 10) : null;

  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) {
      toast.error("Invalid Project ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setIsLogLoading(true);


      const [data, logData] = await Promise.all([
          getProjectById(projectId),
          getProjectActivityLog(projectId)
      ]);
      setProject(data);
      setActivityLog(logData);
      setSelectedStatuses(data.statuses || []);
      

      if (data?.endDate) {
        try {
          const parsedDate = parseISO(data.endDate);
          setEndDateForm(format(parsedDate, "yyyy-MM-dd"));
        } catch (e) {
          console.warn(
            "Could not parse endDate for form input:",
            data.endDate,
            e
          );
          if (
            typeof data.endDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(data.endDate)
          ) {
            setEndDateForm(data.endDate);
          }
        }
      } else {
        setEndDateForm("");
      }
    } catch (error) {
      console.error("Error fetching Project details:", error);
      toast.error("Failed to load Project details.");
      navigate("/projects");
    } finally {
      setLoading(false);
      setIsLogLoading(false);
    }
  }, [projectId, navigate]);

  const loadEnums = useCallback(async () => {
    try {
      setLoadingEnums(true);
      const statuses = await getProjectStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("Failed to load Project statuses", error);
      toast.error("Could not load status options.");
    } finally {
      setLoadingEnums(false);
    }
  }, []);

  useEffect(() => {
    loadEnums();
    fetchProjectDetails();
  }, [loadEnums, fetchProjectDetails]);

  const handleStatusUpdate = async () => {
    // Basic validation to ensure we have the necessary data
    if (!project || !projectId || isStatusUpdating) {
      return;
    }

    // Optional but recommended: Check if the statuses have actually changed
    // This prevents making an unnecessary API call if the user clicks "Apply" without changing anything.
    const currentStatuses = new Set(project.statuses || []);
    const newStatuses = new Set(selectedStatuses);
    if (
      currentStatuses.size === newStatuses.size &&
      [...currentStatuses].every((status) => newStatuses.has(status))
    ) {
      toast.info("No changes to apply.");
      return;
    }

    setIsStatusUpdating(true);
    try {
      // Send the entire array of selected statuses to the backend.
      await updateProject(projectId, { statuses: selectedStatuses });

      toast.success("Statuses updated successfully!");

      // Re-fetch the project details to display the updated information.
      fetchProjectDetails();
    } catch (error) {
      console.error("Error updating statuses:", error);
      toast.error("Failed to update statuses.");
    } finally {
      setIsStatusUpdating(false);
    }
  };

  // Fetch users for mentions
  const fetchUsersForMentionSuggestions = async (
    query: string,
    callback: (data: SuggestionDataItem[]) => void
  ) => {
    if (!query || query.length < 1) {
      // Start searching after 1 char for example
      // callback([]); // Optionally provide suggestions even with just "@"
      return;
    }
    console.log("Mention query:", query);
    try {
      // You need to create this API function in services/api.ts
      // It should call your backend: GET /api/employees/mention-search?q=${query}
      const employeesForMention: Employee[] = await searchEmployeesForMention(
        query
      );
      const suggestions = employeesForMention.map((emp) => ({
        id: emp.id.toString(), // react-mentions expects id to be string or number
        display: `${emp.firstName} ${emp.lastName}`, // This is what's shown in dropdown & inserted
      }));
      console.log("Suggestions:", suggestions);
      callback(suggestions);
    } catch (error) {
      console.error("Error fetching users for mention:", error);
      callback([]);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !commentText.trim() ||
      !project ||
      !user ||
      !user.id ||
      !project.statusHistory ||
      project.statusHistory.length === 0
    ) {
      toast.info(
        "Cannot add comment. No active status found or missing information."
      );
      return;
    }

    // Explicitly find the status update with the most recent startedAt date
    // Create a shallow copy before sorting to avoid mutating the state directly if sort is in-place.
    let latestStatusUpdate: ProjectStatusUpdate | undefined = undefined;
    if (project.statusHistory && project.statusHistory.length > 0) {
      latestStatusUpdate = [...project.statusHistory].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )[0];
    }

    if (!latestStatusUpdate || !latestStatusUpdate.id) {
      toast.error(
        "Could not find the current status update to attach the comment to."
      );
      return;
    }

    setSubmittingComment(true);
    try {
      const authorIdAsNumber = parseInt(user.id, 10);
      if (isNaN(authorIdAsNumber)) {
        toast.error("Invalid user ID for comment author.");
        setSubmittingComment(false);
        return;
      }

      await createProjectThreadComment({
        statusCommentId: latestStatusUpdate.id, // Use the ID of the explicitly found latest status
        authorId: authorIdAsNumber,
        comment: commentText,
      });

      setCommentText("");
      toast.success("Comment added successfully!");
      fetchProjectDetails(); // Re-fetch to show the new comment and updated history
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEndDateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !projectId || isEndDateUpdating) return;

    setIsEndDateUpdating(true);
    try {
      // *** THE FIX IS HERE ***
      // The payload is now correctly typed as UpdateProjectPayload.
      const payload: UpdateProjectPayload = {};

      if (endDateForm) {
        payload.endDate = new Date(endDateForm).toISOString().split("T")[0];
      } else {
        // Setting the end date to null is a valid update.
        payload.endDate = null;
      }

      await updateProject(projectId, payload);
      toast.success("End date updated successfully.");
      fetchProjectDetails();
    } catch (error) {
      console.error("Error updating end date:", error);
      toast.error("Failed to update end date.");
    } finally {
      setIsEndDateUpdating(false);
    }
  };

  const getInitials = (employee?: Pick<Employee, "firstName" | "lastName">) => {
    if (!employee) return "?";
    return (
      `${employee.firstName?.charAt(0) || ""}${
        employee.lastName?.charAt(0) || ""
      }`.toUpperCase() || "?"
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-violet-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-gray-500 mb-6">
            The project you're looking for doesn't exist or you don't have
            permission to view it.
          </p>
          <Button onClick={() => navigate("/projects")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Determine the primary status for display. Use the first one, or a default if the array is empty.
  const primaryStatus = project.statuses?.[0] || "default";

  // Use this primary status to get the correct icon and color class.
  const CurrentStatusIcon =
    projectStatusIcons[primaryStatus.toLowerCase()] || Clock;
  const currentProjectStatusColor =
    projectStatusColors[primaryStatus.toLowerCase()] ||
    "bg-gray-100 text-gray-700";

  const commonTextLayoutStyles: CSSProperties = {
    // Be very explicit with font stack matching your app's inputs
    fontFamily:
      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    fontSize: "14px",
    lineHeight: "1.5",
    fontWeight: 400, // Base weight for non-mention text
    paddingTop: "8px",
    paddingBottom: "8px",
    paddingLeft: "12px",
    paddingRight: "12px",
    margin: 0,
    border: "none",
    whiteSpace: "pre-wrap",
    wordWrap: "break-word",
    boxSizing: "border-box",
    overflow: "hidden",
    letterSpacing: "normal", // Explicitly set
    wordSpacing: "normal", // Explicitly set
    textIndent: "0px", // Explicitly set
    textAlign: "left", // Explicitly set
  };

  // Define common font/text properties to ensure synchronization
  const mentionsInputStyleConfig = {
    control: {
      backgroundColor: "hsl(var(--card))",
      border: "1px solid hsl(var(--input))",
      borderRadius: "var(--radius)",
    } as CSSProperties,
    "&multiLine": {
      control: {
        minHeight: 68,
        position: "relative",
        padding: 0,
      } as CSSProperties,
      highlighter: {
        ...commonTextLayoutStyles,
        position: "absolute",
        top: 0,
        // left: 0, // Keep your -2.5px if it aligned the first letter, or try removing it with other fixes
        left: "-2.5px", // Your manual adjustment for initial alignment
        bottom: 0,
        right: 0,
        zIndex: 1,
        color: "transparent", // Base text in highlighter is transparent
      } as CSSProperties,
      input: {
        ...commonTextLayoutStyles,
        position: "relative",
        zIndex: 2,
        outline: "none",
        backgroundColor: "transparent",
        color: "hsl(var(--foreground))",
      } as CSSProperties,
    },
    suggestions: {
      /* ... (same as your previous working version from last canvas update) ... */
      list: {
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        borderRadius: "var(--radius)",
        fontSize: 14,
        maxHeight: "250px",
        overflowY: "auto",
        boxShadow:
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        minWidth: "250px",
        marginTop: "2px",
        zIndex: 10,
      } as CSSProperties,
      item: {
        padding: "8px 12px",
        borderBottom: "1px solid hsla(var(--border) / 0.5)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "hsl(var(--popover-foreground))",
        "&focused": {
          backgroundColor: "hsl(var(--accent))",
          color: "hsl(var(--accent-foreground))",
        } as CSSProperties,
      } as CSSProperties & { "&focused"?: CSSProperties },
    },
  };

  const mentionStyleInInput: CSSProperties = {
    color: "hsl(var(--primary))",
    //fontWeight: 500,
    fontWeight: commonTextLayoutStyles.fontWeight,
    backgroundColor: "hsla(var(--primary) / 0.15)",
    padding: "1px 3px",
    borderRadius: "3px",
  };

  
  return (
    <AppLayout>
      {project && (
        <ProjectActivitySidebar
          projectId={project.id}
          activityLog={activityLog}
          isLoading={isLogLoading}
        />
      )}
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/projects")}
            className="flex items-center mb-4 text-sm font-medium text-gray-500 hover:text-violet-600 px-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to All Projects
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-grow">
              <h1 className="text-3xl font-bold tracking-tight text-gray-800">
                {project.title}
              </h1>
              <p className="text-gray-500 mt-1">
                Customer:{" "}
                <span className="font-medium text-indigo-600">
                  {project.customer?.name || "N/A"}
                </span>
              </p>
              <div className="flex items-center text-sm text-gray-500 mt-2 gap-x-2 gap-y-1 flex-wrap">
                <span>Technology:</span>
                {project.technology.map(tech => (
                  <Badge key={tech} variant="outline" className="text-sm font-medium">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
            <Link to={`/projects/${project.id}/tasks`}>
              <Button variant="outline">
                  <ListTodo className="w-4 h-4 mr-2" />
                  Tasks
              </Button>
            </Link>
            {hasPermission("project", "edit") && (
              <Button
                onClick={() => navigate(`/projects/${project.id}/edit`)}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Project
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status History and Comments (Adapted from Project) */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Clock className="w-5 h-5 mr-3 text-violet-600" />
                  Status History & Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!project.statusHistory ||
                project.statusHistory.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">
                    No status updates recorded yet.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Group status updates by their start date */}
                    {Object.entries(
                      project.statusHistory.reduce((acc, update) => {
                        const dateKey = format(
                          parseISO(update.startedAt),
                          "yyyy-MM-dd'T'HH:mm:ss"
                        );
                        if (!acc[dateKey]) {
                          acc[dateKey] = [];
                        }
                        acc[dateKey].push(update);
                        return acc;
                      }, {} as Record<string, ProjectStatusUpdate[]>)
                    )
                      .sort(
                        ([dateA], [dateB]) =>
                          new Date(dateB).getTime() - new Date(dateA).getTime()
                      )
                      .map(([dateKey, updates], index) => (
                        // Each group of statuses with the same start date gets a single styled block
                        <div
                          key={dateKey}
                          className={`p-4 rounded-lg border ${
                            updates.some((u) => u.endedAt === null)
                              ? "bg-indigo-50 border-indigo-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            {/* Display all status badges for this group */}
                            <div className="flex flex-wrap gap-1">
                              {updates.map((update) => (
                                <Badge
                                  key={update.id}
                                  variant="outline"
                                  className={`${
                                    projectStatusColors[
                                      normalizeStatusKey(update.status)
                                    ] || projectStatusColors.default
                                  } px-2 py-1 text-xs`}
                                >
                                  {update.status}
                                </Badge>
                              ))}
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {format(
                                parseISO(updates[0].startedAt),
                                "MMM d, yyyy 'at' h:mm a"
                              )}
                            </span>
                          </div>

                          {/* Display all comments for this group */}
                          {updates
                            .flatMap((u) => u.comments)
                            .sort(
                              (a, b) =>
                                new Date(a.createdAt).getTime() -
                                new Date(b.createdAt).getTime()
                            )
                            .map((comment) => (
                              <div
                                key={comment.id}
                                className="mt-3 pl-4 border-l-2 border-gray-300"
                              >
                                <div className="flex space-x-3 text-sm">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                                      {comment.author?.name
                                        ?.split(" ")
                                        .map((n: string) => n[0])
                                        .join("")
                                        .toUpperCase() || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-800">
                                      {comment.author?.name || "Unknown User"}
                                    </p>
                                    <div className="text-gray-600 whitespace-pre-wrap">
                                      {renderMention(comment.comment)}
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                      {format(
                                        parseISO(comment.createdAt),
                                        "MMM d, h:mm a"
                                      )}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}

                          {/* Single Comment Form at the bottom */}
                          {updates.some((u) => u.endedAt === null) &&
                            hasPermission("comment", "add") && (
                              <form
                                onSubmit={handleSubmitComment}
                                className="mt-4 pt-4 border-t border-gray-200"
                              >
                                <MentionsInput
                                  value={commentText}
                                  onChange={(event, newValue) =>
                                    setCommentText(newValue)
                                  }
                                  placeholder="Tag with @, e.g. @Jane Doe"
                                  //className="custom-mentions-input" // Add this class for global styling if needed
                                  style={mentionsInputStyleConfig}
                                  singleLine={false} // Set to true if you want a single line input
                                  allowSpaceInQuery
                                >
                                  <Mention
                                    trigger="@"
                                    data={fetchUsersForMentionSuggestions}
                                    markup="@[__display__](employee:__id__)" // Store as @[Display Name](employee:ID)
                                    displayTransform={(id, display) =>
                                      `${display}`
                                    } // How it looks in input after selection
                                    style={mentionStyleInInput}
                                    appendSpaceOnAdd={true}
                                  />
                                </MentionsInput>
                                <Button
                                  type="submit"
                                  size="sm"
                                  disabled={
                                    !commentText.trim() || submittingComment
                                  }
                                  className="mt-2 bg-indigo-500 hover:bg-indigo-600 text-white"
                                >
                                  <Send className="w-3 h-3 mr-1.5" />{" "}
                                  {submittingComment
                                    ? "Posting..."
                                    : "Post Update"}
                                </Button>
                              </form>
                            )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Current Status Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  {/* Using a generic icon since there can be multiple statuses */}
                  <CheckCircle className="h-5 w-5 mr-2 text-violet-600" />
                  Current Statuses
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* --- Status Bubbles Display --- */}
                <div className="flex flex-wrap gap-2">
                  {/* FIX: Check for project.statuses AND that its length is greater than 0 */}
                  {project.statuses && project.statuses.length > 0 ? (
                    project.statuses.map((status) => (
                      <Badge
                        key={status}
                        variant="outline"
                        // FIX: Get the color for each individual status inside the loop
                        className={`${
                          projectStatusColors[normalizeStatusKey(status)] ||
                          projectStatusColors.default
                        } px-3 py-1 text-sm font-medium`}
                      >
                        {status}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No active statuses.</p>
                  )}
                </div>

                {/* --- Multi-Select Status Update Control --- */}
                {hasPermission("project", "edit") && (
                  <div className="mt-6 pt-4 border-t">
                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                      Update Statuses:
                    </label>
                    <Popover>
                      <PopoverTrigger asChild>
                        {/* FIX: Removed the invalid 'value' prop from the Button */}
                        <Button
                          variant="outline"
                          className="w-full justify-between"
                        >
                          {selectedStatuses.length > 0
                            ? `${selectedStatuses.length} selected`
                            : "Select statuses..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Search statuses..." />
                          <CommandList>
                            <CommandEmpty>No statuses found.</CommandEmpty>
                            <CommandGroup>
                              {availableStatuses.map((status) => (
                                <CommandItem
                                  key={status}
                                  onSelect={() => {
                                    const newSelection = new Set(
                                      selectedStatuses
                                    );
                                    if (newSelection.has(status)) {
                                      newSelection.delete(status);
                                    } else {
                                      newSelection.add(status);
                                    }
                                    setSelectedStatuses(
                                      Array.from(newSelection)
                                    );
                                  }}
                                >
                                  {/* FIX: This now correctly uses 'selectedStatuses' to show checkmarks */}
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      selectedStatuses.includes(status)
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
                    <Button
                      // FIX: The onClick handler now calls the correct function
                      onClick={handleStatusUpdate}
                      disabled={isStatusUpdating}
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
                    >
                      {isStatusUpdating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Apply Status Changes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <CalendarClock className="w-5 h-5 mr-2 text-indigo-600" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-gray-500">Start Date</p>
                  <p className="font-semibold text-gray-700">
                    {format(parseISO(project.startDate), "MMM d, yyyy")}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-gray-500">Target End Date</p>
                  <p className="font-semibold text-gray-700">
                    {project.endDate
                      ? format(parseISO(project.endDate), "MMM d, yyyy")
                      : "Not set"}
                  </p>
                </div>
                {hasPermission("project", "edit") && (
                  <form
                    className="mt-3 pt-3 border-t"
                    onSubmit={handleEndDateUpdate}
                  >
                    <label
                      htmlFor="endDate"
                      className="text-xs font-medium text-gray-500 mb-1 block"
                    >
                      Update End Date:
                    </label>
                    <div className="flex space-x-2">
                      <Input
                        id="endDate"
                        type="date"
                        value={endDateForm}
                        onChange={(e) => setEndDateForm(e.target.value)}
                        className="text-sm px-3 py-2 border rounded-md"
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={isEndDateUpdating}
                        className="h-10"
                      >
                        {isEndDateUpdating ? "Saving..." : "Set"}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            <AttachmentCard
                attachments={project.attachments}
                parentId={project.id}
                showUploader={hasPermission('project', 'edit')}
                onUploadSuccess={fetchProjectDetails}
                uploadFunction={uploadProjectAttachment}
            />

            {/* Team Card (Adapted for Project Manager) */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Users className="w-5 h-5 mr-3 text-violet-600" />
                  Team
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Project Manager */}
                {project.projectManager && (
                  <div>
                    <p className="font-medium text-gray-500">
                      {PROJECT_MANAGER_ROLE_DISPLAY}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-purple-100 text-purple-600">
                          {getInitials(project.projectManager)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-gray-700">
                        {project.projectManager.firstName}{" "}
                        {project.projectManager.lastName}
                      </span>
                    </div>
                  </div>
                )}
                {/* Account Manager */}
                {project.accountManager && (
                  <div>
                    <p className="font-medium text-gray-500">
                      {ACCOUNT_MANAGER_ROLE_DISPLAY}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-green-100 text-green-600">
                          {getInitials(project.accountManager)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-gray-700">
                        {project.accountManager.firstName}{" "}
                        {project.accountManager.lastName}
                      </span>
                    </div>
                  </div>
                )}
                {/* Technical Lead */}
                {project.lead && (
                  <div>
                    <p className="font-medium text-gray-500">
                      {TECHNICAL_LEAD_ROLE_DISPLAY}
                    </p>
                    <div className="flex items-center mt-1 space-x-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {getInitials(project.lead)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-gray-700">
                        {project.lead.firstName} {project.lead.lastName}
                      </span>
                    </div>
                  </div>
                )}

                <Separator className="my-3" />
                <div>
                  <p className="font-medium text-gray-500">
                    Technical Team Members
                  </p>
                  {project.teamAssignments &&
                  project.teamAssignments.filter(
                    (member) =>
                      member.employeeId !== project.lead?.id &&
                      member.employeeId !== project.accountManager?.id &&
                      member.employeeId !== project.projectManager?.id &&
                      !member.unassignedAt
                  ).length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {project.teamAssignments
                        .filter(
                          (member) =>
                            member.employeeId !== project.lead?.id &&
                            member.employeeId !== project.accountManager?.id &&
                            member.employeeId !== project.projectManager?.id &&
                            !member.unassignedAt
                        )
                        .map((assignment) => (
                          <div
                            key={assignment.id}
                            className="flex items-center space-x-2"
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gray-100 text-gray-600">
                                {getInitials(assignment.employee)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-gray-700">
                                {assignment.employee?.firstName}{" "}
                                {assignment.employee?.lastName}
                              </p>
                              <p className="text-xs text-gray-500">
                                {assignment.role
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (char) =>
                                    char.toUpperCase()
                                  )}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">
                      No technical team members assigned.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default ProjectDetailPage;
