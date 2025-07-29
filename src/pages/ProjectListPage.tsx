import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getProjects,
  ProjectListItem,
  getProjectStatuses,
  PocListItem,
  getPocs,
} from "../services/api";
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Plus,
  Search,
  Clock,
  Users,
  UserCheck,
  Loader2,
  XCircle,
  Building,
  Settings2,
  Briefcase,
  ClipboardList,
  PauseCircle,
  CircleDotDashed,
  Target,
  Phone,
  CalendarCheck,
  DraftingCompass,
  Send,
  ThumbsUp,
  Truck,
  PackageCheck,
  ServerCog,
  Server,
  AlertTriangle,
  Hourglass,
  Trophy,
  Check,
  ChevronsUpDown,
  Rocket,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RecentActivitySidebar } from "@/components/RecentActivitySidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Color palette for Project statuses
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

// Icons for Project statuses
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

const ProjectListPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [loadingEnums, setLoadingEnums] = useState(true);
  const [view, setView] = useState("active");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPocList, setShowPocList] = useState(false);
  const [pocs, setPocs] = useState<PocListItem[]>([]);
  const [isLoadingPocs, setIsLoadingPocs] = useState(false);

  const handleFetchPocs = async () => {
    setShowPocList(true);
    setIsLoadingPocs(true);
    try {
      // 1. Fetch all available PoCs
      const allPocs = await getPocs();

      // 2. Filter for PoCs that have a "Done" status
      //    (Assuming PocListItem has a 'statuses' array like ProjectListItem)
      const completedPocs = allPocs.filter((poc) =>
        poc.status === "Done"
      );

      // 3. Update state and provide feedback based on the *filtered* list
      if (completedPocs.length === 0) {
        toast.info(
          "No PoCs marked as 'Done' are available to create projects from."
        );
      }
      setPocs(completedPocs);
    } catch (error) {
      toast.error("Failed to fetch Proof of Concepts.");
      console.error(error);
    } finally {
      setIsLoadingPocs(false);
    }
  };

  const handlePocSelect = (pocId: number) => {
    setIsDialogOpen(false);
    setShowPocList(false);
    navigate(`/projects/create?fromPoc=${pocId}`);
  };

  const onDialogStateChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setShowPocList(false);
    }
  };

  // Fetches project data from the live API
  const fetchProjectData = useCallback(async () => {
    try {
      setLoading(true);
      // 1. Fetch the raw data which may have snake_case properties
      const rawData: any[] = await getProjects();

      // 2. *** THE FIX IS HERE ***
      // Transform the raw data to match the camelCase properties of the ProjectListItem interface.
      const transformedData: ProjectListItem[] = rawData.map((project) => ({
        id: project.id,
        title: project.title,
        customerName: project.customer_name,
        technology: project.technology,
        projectManagerName: project.project_manager_name,
        technicalLeadName: project.technical_lead_name,
        accountManagerName: project.account_manager_name,
        statuses: Array.isArray(project.statuses) ? project.statuses : [], // Ensure 'statuses' is always an array
        startDate: project.start_date,
        endDate: project.end_date,
      }));

      // 3. Set the state with the correctly formatted data
      setProjects(transformedData);
    } catch (error) {
      console.error("Error fetching Projects:", error);
      toast.error("Failed to load Projects. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetches project statuses from the live API
  const loadProjectStatuses = useCallback(async () => {
    try {
      setLoadingEnums(true);
      const statuses = await getProjectStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("Failed to load Project statuses:", error);
      toast.error("Could not load status filter options.");
    } finally {
      setLoadingEnums(false);
    }
  }, []);

  useEffect(() => {
    loadProjectStatuses();
    fetchProjectData();
  }, [loadProjectStatuses, fetchProjectData]);

  // Normalizes status strings for consistent key access in color/icon maps

  const normalizeStatusKey = (status: string): string => {
    return status.toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ").trim();
  };

  const filteredProjects = projects.filter((project) => {
    const searchVal = searchTerm.toLowerCase();
    const matchesSearch =
      project.title.toLowerCase().includes(searchVal) ||
      (project.customerName &&
        project.customerName.toLowerCase().includes(searchVal)) ||
      (project.technicalLeadName &&
        project.technicalLeadName.toLowerCase().includes(searchVal)) ||
      (project.projectManagerName &&
        project.projectManagerName.toLowerCase().includes(searchVal));

    // This logic now safely checks the 'statuses' array.
    const matchesStatus =
      statusFilter.length === 0
        ? true
        : project.statuses.some((status) => statusFilter.includes(status));

        const isCompleted = project.statuses.some(
          (status) => normalizeStatusKey(status) === "project delivered"
      );
  
    let matchesView = false;
    if (view === "active") {
        matchesView = !isCompleted;
    } else if (view === "completed") {
        matchesView = isCompleted;
    }

    return matchesSearch && matchesStatus && matchesView;
  });

  // Displays a loading spinner while initial data is being fetched
  if (loading || loadingEnums) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-violet-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <RecentActivitySidebar />
      <div className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800">
              Projects
            </h1>
            <p className="text-gray-500">
              Manage and track all ongoing projects.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Wrapper for buttons */}            
            {hasPermission("project", "create") && (
              <Dialog open={isDialogOpen} onOpenChange={onDialogStateChange}>
                <DialogTrigger asChild>
                  <Button className="bg-violet-600 hover:bg-violet-700 w-full sm:w-auto mr-10">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Create a New Project</DialogTitle>
                    <DialogDescription>
                      Choose how you'd like to start your new project.
                    </DialogDescription>
                  </DialogHeader>

                  {!showPocList ? (
                    <div className="grid gap-4 py-4">
                      <Button
                        variant="outline"
                        onClick={() => navigate("/projects/create")}
                        className="justify-start p-6"
                      >
                        <FileText className="w-5 h-5 mr-3" />
                        <div>
                          <p className="font-semibold text-left">
                            Create a Blank Project
                          </p>
                          <p className="text-xs text-gray-500 text-left">
                            Start with a fresh, empty form.
                          </p>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleFetchPocs}
                        className="justify-start p-6"
                      >
                        <Rocket className="w-5 h-5 mr-3" />
                        <div>
                          <p className="font-semibold text-left">
                            Create from a PoC
                          </p>
                          <p className="text-xs text-gray-500 text-left">
                            Use a successful PoC as a template.
                          </p>
                        </div>
                      </Button>
                    </div>
                  ) : (
                    <div className="py-4">
                      <Command>
                        <CommandInput placeholder="Search PoCs by title..." />
                        <CommandList>
                          {isLoadingPocs && (
                            <CommandItem>Loading PoCs...</CommandItem>
                          )}
                          <CommandEmpty>
                            {!isLoadingPocs && "No available completed PoCs found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {pocs.map((poc) => (
                              <CommandItem
                                key={poc.id}
                                value={poc.title}
                                onSelect={() => handlePocSelect(poc.id)}
                                className="cursor-pointer"
                              >
                                {poc.title}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <div className="mb-6">
            <Tabs value={view} onValueChange={setView}>
                <TabsList>
                    <TabsTrigger value="active">Active Projects</TabsTrigger>
                    <TabsTrigger value="completed">Completed Projects</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>

        <Card className="mb-6 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="projectSearch"
                  name="projectSearch"
                  placeholder="Search by title, customer, tech, PM, lead, AM..."
                  className="pl-12 pr-4 py-2.5 text-base rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full md:w-72">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                    >
                      {statusFilter.length > 0
                        ? `${statusFilter.length} status${
                            statusFilter.length > 1 ? "es" : ""
                          } selected`
                        : "Filter by status..."}
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
                                const newSelection = new Set(statusFilter);
                                if (newSelection.has(status)) {
                                  newSelection.delete(status);
                                } else {
                                  newSelection.add(status);
                                }
                                setStatusFilter(Array.from(newSelection));
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  statusFilter.includes(status)
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              {status}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {statusFilter.length > 0 && (
                          <>
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => setStatusFilter([])}
                                className="justify-center text-center text-red-500"
                              >
                                Clear filters
                              </CommandItem>
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredProjects.length === 0 ? (
          <Card className="shadow">
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">
                No Projects Found
              </h3>
              <p className="text-gray-500 max-w-md mx-auto mt-2">
                {searchTerm || statusFilter.length > 0
                  ? "Try adjusting your search or filter criteria."
                  : "No projects have been created yet."}
              </p>
              {hasPermission("project", "create") &&
                !searchTerm &&
                statusFilter.length === 0 && (
                  <Link to="/projects/create">
                    <Button className="mt-6 bg-violet-600 hover:bg-violet-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Project
                    </Button>
                  </Link>
                )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProjects.map((project) => {
              const primaryStatus = project.statuses?.[0] || "default";
              const normalizedPrimaryStatus = normalizeStatusKey(primaryStatus);
              const StatusIconComponent =
                projectStatusIcons[normalizedPrimaryStatus] || Clock;

              return (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="block hover:no-underline"
                >
                  <Card className="transition-all duration-300 hover:shadow-xl hover:border-violet-300 h-full flex flex-col">
                    <CardHeader className="pb-3 pt-5 px-5">
                      <div className="flex items-center space-x-2 mr-2 min-w-0">
                        <StatusIconComponent
                          className={`h-5 w-5 ${
                            projectStatusColors[normalizedPrimaryStatus]?.split(
                              " "
                            )[1] || "text-gray-500"
                          } flex-shrink-0`}
                        />
                        <CardTitle className="text-lg font-semibold text-gray-800 truncate">
                          {project.title}
                        </CardTitle>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {project.statuses.map((status) => {
                          const normalizedKey = normalizeStatusKey(status);
                          const colorClass =
                            projectStatusColors[normalizedKey] ||
                            projectStatusColors.default;
                          return (
                            <Badge
                              key={status}
                              variant="outline"
                              className={`${colorClass} px-2 py-0.5 text-xs`}
                            >
                              {status}
                            </Badge>
                          );
                        })}
                        {project.statuses.length === 0 && (
                          <Badge
                            variant="outline"
                            className={projectStatusColors.default}
                          >
                            No Status
                          </Badge>
                        )}
                      </div>
                      {project.customerName && (
                        <p className="text-sm text-violet-600 font-medium pt-2 flex items-center">
                          <Building className="inline w-4 h-4 mr-1.5 opacity-70 flex-shrink-0" />
                          <span className="truncate">
                            {project.customerName}
                          </span>
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-3 text-sm text-gray-600 flex-grow">
                      <div className="flex items-center">
                        <Briefcase className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        PM:{" "}
                        <span className="font-medium ml-1 truncate">
                          {project.projectManagerName || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <UserCheck className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        TL:{" "}
                        <span className="font-medium ml-1 truncate">
                          {project.technicalLeadName || "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        AM:{" "}
                        <span className="font-medium ml-1 truncate">
                          {project.accountManagerName || "N/A"}
                        </span>
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 px-5 py-3 text-xs text-gray-500 border-t">
                      <div className="flex justify-between w-full">
                        <span className="truncate">
                          Start:{" "}
                          {project.startDate
                            ? format(parseISO(project.startDate), "MMM d, yy")
                            : "N/A"}
                        </span>
                        <span className="truncate ml-2">
                          End:{" "}
                          {project.endDate
                            ? format(parseISO(project.endDate), "MMM d, yy")
                            : "N/A"}
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default ProjectListPage;
