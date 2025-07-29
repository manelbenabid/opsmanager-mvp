import React, { useState, useEffect, useCallback, CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getPocById,
  createPocThreadComment,
  updatePoc,
  createPocStatusUpdate,
  getPocStatuses,
  Poc,
  //PocCurrentStatus, // This is now string in api.ts, but used as a specific type here
  PocThreadComment,
  PocStatusUpdate,
  Employee,
  searchEmployeesForMention,
  uploadPocAttachment,
  PocAttachment,
  approvePoc,
} from "../services/api"; // Assuming api.ts is in ../services/
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Edit,
  MessageSquare,
  User,
  CheckCircle,
  Clock,
  FileCode,
  Archive,
  CalendarClock,
  Users,
  Briefcase,
  Building,
  Send,
  FileText,
  Plus,
  Search,
  UserCheck,
  CalendarDays,
  Loader2,
  CheckCircle2,
  XCircle,
  Settings2,
  Paperclip,
  Upload,
  Download,
  File,
  Trash2,
  X,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Avatar,
  AvatarFallback,
  // AvatarImage, // Removed as Employee interface doesn't have avatar
} from "@/components/ui/avatar";
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
import ActivitySidebar from "../components/ActivitySidebar";
//Mentions
import { MentionsInput, Mention, SuggestionDataItem } from "react-mentions";
import { formatDistanceToNow } from "date-fns"; // For friendly dates
import { filesize } from "filesize";
import AttachmentCard from "../components/AttachmentCard";

// Define role constants for display and logic if needed
const TECHNICAL_LEAD_ROLE_DISPLAY = "Technical Lead";
const ACCOUNT_MANAGER_ROLE_DISPLAY = "Account Manager";

// Ensure these keys match the values from getPocStatuses API
const statusColors: { [key: string]: string } = {
  default: "bg-gray-100 text-gray-700 border-gray-300",
  "account manager coordinated with tech lead":
    "bg-cyan-100 text-cyan-700 border-cyan-300",
  "tech lead reached the customer": "bg-teal-100 text-teal-700 border-teal-300",
  "tech lead assigned engineering team":
    "bg-sky-100 text-sky-700 border-sky-300",
  "kickoff is done and scope is defined":
    "bg-indigo-100 text-indigo-700 border-indigo-300",
  "in progress": "bg-blue-100 text-blue-700 border-blue-300",
  "customer pending": "bg-orange-100 text-orange-700 border-orange-300",
  "taqniyat pending": "bg-pink-100 text-pink-700 border-pink-300",
  done: "bg-green-100 text-green-700 border-green-300",
  failed: "bg-red-100 text-red-700 border-red-300",
};

const statusIcons: { [key: string]: React.ElementType } = {
  default: Clock,
  "account manager coordinated with tech lead": UserCheck,
  "tech lead reached the customer": Users,
  "tech lead assigned engineering team": Users,
  "kickoff is done and scope is defined": CalendarDays,
  "in progress": Loader2,
  "customer pending": Clock,
  "taqniyat pending": Clock,
  done: CheckCircle2,
  failed: XCircle,
};

// Helper to render mentions with blue color
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

const PocDetailPage: React.FC = () => {
  const { id: pocIdParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission, hasRole } = useAuth();
  const [poc, setPoc] = useState<Poc | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [endDateForm, setEndDateForm] = useState(""); // For date input
  const [isEndDateUpdating, setIsEndDateUpdating] = useState(false);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [loadingEnums, setLoadingEnums] = useState(true);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  const pocId = pocIdParam ? parseInt(pocIdParam, 10) : null;

  const fetchPocDetails = useCallback(async () => {
    if (!pocId) {
      toast.error("Invalid PoC ID.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getPocById(pocId);
      setPoc(data);
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
      console.error("Error fetching POC details:", error);
      toast.error("Failed to load POC details.");
      navigate("/pocs");
    } finally {
      setLoading(false);
    }
  }, [pocId, navigate]);

  const loadEnums = useCallback(async () => {
    try {
      setLoadingEnums(true);
      const statuses = await getPocStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("Failed to load PoC statuses", error);
      toast.error("Could not load status options.");
    } finally {
      setLoadingEnums(false);
    }
  }, []);

  useEffect(() => {
    loadEnums();
    fetchPocDetails();
  }, [loadEnums, fetchPocDetails]);

  const handleStatusChange = async (newStatus: string) => {
    // newStatus is string
    if (!poc || !pocId || newStatus === poc.status || statusUpdating) return;

    setStatusUpdating(true);
    try {
      const updatedPocMain = await updatePoc(pocId, { status: newStatus });

      if (updatedPocMain) {
        toast.success(
          `Status updated to ${newStatus.replace(
            /_/g,
            " "
          )} and history recorded.`
        );
        fetchPocDetails(); // Re-fetch to get all updated data including new history
      } else {
        toast.error("Failed to update PoC status.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status or record history.");
    } finally {
      setStatusUpdating(false);
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
      !poc ||
      !user ||
      !user.id ||
      !poc.statusHistory ||
      poc.statusHistory.length === 0
    ) {
      toast.info(
        "Cannot add comment. No active status found or missing information."
      );
      return;
    }

    // Explicitly find the status update with the most recent startedAt date
    // Create a shallow copy before sorting to avoid mutating the state directly if sort is in-place.
    let latestStatusUpdate: PocStatusUpdate | undefined = undefined;
    if (poc.statusHistory && poc.statusHistory.length > 0) {
      latestStatusUpdate = [...poc.statusHistory].sort(
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

      await createPocThreadComment({
        statusCommentId: latestStatusUpdate.id, // Use the ID of the explicitly found latest status
        authorId: authorIdAsNumber,
        comment: commentText,
      });

      setCommentText("");
      toast.success("Comment added successfully!");
      fetchPocDetails(); // Re-fetch to show the new comment and updated history
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEndDateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poc || !pocId || isEndDateUpdating) return;

    setIsEndDateUpdating(true);
    try {
      const payload: Partial<Omit<Poc, "id" | "createdAt" | "updatedAt">> = {};
      if (endDateForm) {
        payload.endDate = new Date(endDateForm).toISOString().split("T")[0];
      } else {
        toast.info("End date not provided.");
        setIsEndDateUpdating(false);
        return;
      }

      await updatePoc(pocId, payload);
      toast.success("End date updated successfully.");
      fetchPocDetails();
    } catch (error) {
      console.error("Error updating end date:", error);
      toast.error("Failed to update end date.");
    } finally {
      setIsEndDateUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!pocId || !description.trim()) {
      toast.warning("PoC Description is required to approve.");
      return;
    }
    setIsApproving(true);
    try {
      await approvePoc(pocId, { description });
      toast.success("POC has been approved and is now active!");
      fetchPocDetails(); // Refresh data to show the standard view
    } catch (error) {
      toast.error("Failed to approve POC.");
    } finally {
      setIsApproving(false);
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

  if (loading || loadingEnums) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!poc) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-2xl font-semibold mb-2">POC Not Found</h2>
          <p className="text-gray-500 mb-6">
            The proof of concept you're looking for doesn't exist or you don't
            have permission to view it.
          </p>
          <Button onClick={() => navigate("/pocs")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to POCs
          </Button>
        </div>
      </AppLayout>
    );
  }

  const CurrentStatusIcon =
    statusIcons[poc.status.toLowerCase().replace(/ /g, "_")] ||
    statusIcons.default;
  const currentPocStatusColor =
    statusColors[poc.status.toLowerCase().replace(/ /g, "_")] ||
    statusColors.default;

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

  const renderInitialRequestDetails = () => (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
            <span className="text-gray-600">Account Manager:</span>
            <span className="font-medium text-gray-800">
                {poc.accountManager ? `${poc.accountManager.firstName} ${poc.accountManager.lastName}` : "Not Assigned"}
            </span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Technical Lead:</span>
            <span className="font-medium text-gray-800">
                {poc.lead ? `${poc.lead.firstName} ${poc.lead.lastName}` : "Not Assigned"}
            </span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Status:</span>
            <Badge variant="outline" className={`${currentPocStatusColor} px-2 py-1 text-xs`}>
                {poc.status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
            </Badge>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Start Date:</span>
            <span className="font-medium text-gray-800">
                {format(parseISO(poc.startDate), "MMM d, yyyy")}
            </span>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-gray-600">End Date:</span>
            <span className="font-medium text-gray-800">
                {poc.endDate ? format(parseISO(poc.endDate), "MMM d, yyyy") : "TBA"}
            </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Budget Allocated:</span>
            <Badge
                variant={poc?.isBudgetAllocated ? "default" : "secondary"}
                className={
                    poc?.isBudgetAllocated ? "bg-green-100 text-green-800" : ""
                }
            >
                {poc?.isBudgetAllocated ? "Yes" : "No"}
            </Badge>
        </div>
        <div className="flex items-center justify-between">
            <span className="text-gray-600">Vendor's AM Aware:</span>
            <Badge
                variant={poc?.isVendorAware ? "default" : "secondary"}
                className={poc?.isVendorAware ? "bg-green-100 text-green-800" : ""}
            >
                {poc?.isVendorAware ? "Yes" : "No"}
            </Badge>
        </div>
    </div>
);

  const renderApprovalForm = () => (
    <Card className="shadow-lg border-amber-400 bg-amber-50">
      <CardHeader>
        <CardTitle>Presales Review & Approval</CardTitle>
        <CardDescription>
          Review the details below, add the PoC description, and approve to make
          it active.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Separator />
        {renderInitialRequestDetails()}
        <Separator />
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            PoC Description *
          </label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Define features, success criteria, and any other technical notes..."
            rows={10}
          />
        </div>
        <Button onClick={handleApprove} disabled={isApproving}>
          {isApproving ? "Approving..." : "Approve & Activate POC"}
        </Button>
      </CardContent>
    </Card>
  );

  const renderStandardDetails = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Content Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Status History and Comments */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-xl">
              <Clock className="w-5 h-5 mr-2 text-indigo-600" />
              Status History & Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!poc.statusHistory || poc.statusHistory.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                No status updates recorded yet.
              </div>
            ) : (
              <div className="space-y-6">
                {poc.statusHistory
                  .sort(
                    (a, b) =>
                      new Date(b.startedAt).getTime() -
                      new Date(a.startedAt).getTime()
                  )
                  .map((update, index) => (
                    <div
                      key={update.id}
                      className={`p-4 rounded-lg border ${
                        index === 0
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <Badge
                          variant="outline"
                          className={`${
                            statusColors[
                              update.status.toLowerCase().replace(/ /g, "_")
                            ] || statusColors.default
                          } px-2 py-1 text-xs`}
                        >
                          {update.status
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (char) => char.toUpperCase())}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {format(
                            parseISO(update.startedAt),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                          {update.endedAt &&
                            ` - ${format(
                              parseISO(update.endedAt),
                              "MMM d, yyyy 'at' h:mm a"
                            )}`}
                        </span>
                      </div>
                      {update.comments && update.comments.length > 0 && (
                        <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-300">
                          {update.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className="flex space-x-3 text-sm"
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-gray-200 text-gray-600 text-xs">
                                  {comment.author?.name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <p className="font-medium text-gray-800">
                                  {comment.author?.name || "Unknown User"}
                                </p>
                                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                  {renderMention(comment.comment)}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(
                                    parseISO(comment.createdAt),
                                    "MMM d, h:mm a"
                                  )}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {index === 0 && hasPermission("comment", "add") && (
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
                            allowSpaceInQuery // If you want to type "Manel Benabid" after @ before selection closes
                          >
                            <Mention
                              trigger="@"
                              data={fetchUsersForMentionSuggestions}
                              markup="@[__display__](employee:__id__)" // Store as @[Display Name](employee:ID)
                              displayTransform={(id, display) => `${display}`} // How it looks in input after selection
                              style={mentionStyleInInput}
                              appendSpaceOnAdd={true}
                              // renderSuggestion={(suggestion, search, highlightedDisplay, index, focused) => (...)} // Custom render
                            />
                          </MentionsInput>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={!commentText.trim() || submittingComment}
                            className="mt-2 bg-indigo-500 hover:bg-indigo-600 text-white"
                          >
                            <Send className="w-3 h-3 mr-1.5" />{" "}
                            {submittingComment ? "Posting..." : "Post Update"}
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
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <CurrentStatusIcon
                className={`h-5 w-5 mr-2 ${
                  currentPocStatusColor.split(" ")[1]
                }`}
              />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              variant="outline"
              className={`${currentPocStatusColor} px-3 py-1.5 text-sm font-medium w-full justify-center`}
            >
              {poc.status
                .replace(/_/g, " ")
                .replace(/\b\w/g, (char) => char.toUpperCase())}
            </Badge>
            {hasPermission("poc", "edit") && (
              <div className="mt-4">
                <label
                  htmlFor="status-update"
                  className="text-xs font-medium text-gray-500 mb-1 block"
                >
                  Update Status:
                </label>
                <Select
                  value={poc.status}
                  onValueChange={(value) => handleStatusChange(value)} // Value is string
                  disabled={statusUpdating || loadingEnums}
                >
                  <SelectTrigger id="status-update">
                    <SelectValue placeholder="Select new status" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {poc.description && (
        
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><FileText className="w-5 h-5 mr-3 text-indigo-600" />PoC Description</CardTitle>
            <CardDescription>Details by the Presales team.</CardDescription>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
            {poc.description}
          </CardContent>
        </Card>
      )}


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
                {format(parseISO(poc.startDate), "MMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="font-medium text-gray-500">Target End Date</p>
              <p className="font-semibold text-gray-700">
                {poc.endDate
                  ? format(parseISO(poc.endDate), "MMM d, yyyy")
                  : "Not set"}
              </p>
            </div>
            {hasPermission("poc", "edit") && (
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
        attachments={poc.attachments}
        parentId={poc.id}
        showUploader={hasPermission("poc", "edit") || hasRole(["presales", "admin", "account_manager"])}
        onUploadSuccess={fetchPocDetails}
        uploadFunction={uploadPocAttachment}
      />

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <Users className="w-5 h-5 mr-2 text-indigo-600" />
              Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {poc.accountManager && (
              <div>
                <p className="font-medium text-gray-500">
                  {ACCOUNT_MANAGER_ROLE_DISPLAY}
                </p>
                <div className="flex items-center mt-1 space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-green-100 text-green-600">
                      {getInitials(poc.accountManager)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-gray-700">
                    {poc.accountManager.firstName} {poc.accountManager.lastName}
                  </span>
                </div>
              </div>
            )}
            {poc.lead && (
              <div>
                <p className="font-medium text-gray-500">
                  {TECHNICAL_LEAD_ROLE_DISPLAY}
                </p>
                <div className="flex items-center mt-1 space-x-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600">
                      {getInitials(poc.lead)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-gray-700">
                    {poc.lead.firstName} {poc.lead.lastName}
                  </span>
                </div>
              </div>
            )}
            <Separator className="my-3" />
            <div>
              <p className="font-medium text-gray-500">Other Team Members</p>
              {poc.teamAssignments &&
              poc.teamAssignments.filter(
                (member) =>
                  member.employeeId !== poc.lead?.id &&
                  member.employeeId !== poc.accountManager?.id &&
                  !member.unassignedAt
              ).length > 0 ? (
                <div className="mt-2 space-y-2">
                  {poc.teamAssignments
                    .filter(
                      (member) =>
                        member.employeeId !== poc.lead?.id &&
                        member.employeeId !== poc.accountManager?.id &&
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
                              .replace(/\b\w/g, (char) => char.toUpperCase())}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-1">
                  No other team members assigned.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <AppLayout>
      {poc.id && <ActivitySidebar pocId={poc.id} />}
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="ghost"
            onClick={() => navigate('/pocs')}
            className="flex items-center mb-4 text-sm font-medium text-gray-500 hover:text-indigo-600 px-0"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to All POCs
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-grow">
              <h1 className="text-3xl font-bold tracking-tight text-gray-800">{poc.title}</h1>
              <p className="text-gray-500 mt-1">
                Customer: <span className="font-medium text-indigo-600">{poc.customer?.name || 'N/A'}</span>
              </p>
              <div className="flex items-center text-sm text-gray-500 mt-2 gap-2 flex-wrap">
                Technology: 
                {poc.technology.map(tech => (
                  <Badge key={tech} variant="outline" className="text-base">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Also, correct the Edit button logic to only show for ACTIVE pocs */}
            {poc.workflow_status === 'active' && hasPermission('poc', 'edit') && (
                <Button onClick={() => navigate(`/pocs/${poc.id}/edit`)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit POC
                </Button>
            )}
          </div>
        </div>

        {/* This is the ONLY part that renders the main content. 
            It correctly calls your render functions. */}
        {poc.workflow_status === 'pending_presales_review' && hasRole(['presales', 'admin']) 
          ? renderApprovalForm() 
          : renderStandardDetails()
        }
      </div>
    </AppLayout>
);
};

export default PocDetailPage;
