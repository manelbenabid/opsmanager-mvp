import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getProjectById,
  getTasksForProject,
  updateTask,
  createTask,
  getEmployees,
  checkAndSetOverdueTasks,
  Project,
  Task,
  Employee,
  CreateTaskPayload,
  UpdateTaskPayload,
  deleteTask,
  getProjectActivityLog,
  ProjectActivityLog,
} from "../services/api";
import AppLayout from "../components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  ChevronRight,
  Plus,
  Circle,
  CheckCircle,
  ArrowLeft,
  Loader2,
  Check,
  MoreHorizontal,
  Trash2,
  Users,
  Calendar as CalendarIcon,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Signal,
  TriangleAlert,
  List,
  Kanban,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { InlineTaskComposer } from "@/components/InlineTaskComposer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ProjectActivitySidebar from '@/components/ProjectActivitySidebar'; 
// --- Helper Functions & Components ---

const avatarColors = [
  "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff",
  "#a0c4ff", "#bdb2ff", "#ffc6ff",
];

const generateAvatarColor = (name: string): string => {
  if (!name) return "#e0e0e0";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % avatarColors.length);
  return avatarColors[index];
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const names = name.split(" ");
  const firstInitial = names[0]?.[0] || "";
  const lastInitial = names.length > 1 ? names[names.length - 1]?.[0] || "" : "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

/**
 * Renders a priority icon and its name with appropriate styling.
 * @param priority - The task priority level.
 */
const PriorityIcon = ({ priority }: { priority: Task["priority"] }) => {
  const iconMap: Record<Task["priority"], React.ReactNode> = {
    Urgent: <TriangleAlert className="h-4 w-4 text-red-500" />,
    High: <Signal className="h-4 w-4 text-orange-500" />,
    Normal: <SignalHigh className="h-4 w-4 text-blue-500" />,
    Low: <SignalMedium className="h-4 w-4 text-gray-500" />,
    "No Priority": <SignalLow className="h-4 w-4 text-gray-400" />,
  };

  const icon = iconMap[priority] || iconMap["No Priority"];
  const priorityName = priority || "No Priority";

  return (
    <div title={priorityName} className="flex items-center gap-2">
      {icon}
      <span>{priorityName}</span>
    </div>
  );
};

// --- Helper Types & Constants ---
const Priorities: [Task["priority"], ...Task["priority"][]] = [
  "Urgent", "High", "Normal", "Low", "No Priority",
];
const Statuses: [Task["status"], ...Task["status"][]] = [
  "Not Started", "In Progress", "Overdue", "Completed",
];

const statusStyles: Record<Task["status"], { dot: string; text: string }> = {
  "Not Started": { dot: "bg-gray-400", text: "text-gray-700 dark:text-gray-300" },
  "In Progress": { dot: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  Overdue: { dot: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  Completed: { dot: "bg-green-500", text: "text-green-600 dark:text-green-400" },
};

const EditableCell: React.FC<{
  children: React.ReactNode;
  onUpdate: (value: any) => void;
  initialValue: any;
  renderEdit: (value: any, setValue: (v: any) => void, close: () => void) => React.ReactNode;
}> = ({ children, onUpdate, initialValue, renderEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleUpdate = useCallback(() => {
    if (JSON.stringify(value) !== JSON.stringify(initialValue)) {
      onUpdate(value);
    }
    setIsEditing(false);
  }, [value, initialValue, onUpdate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-radix-popper-content-wrapper]")) {
        return;
      }
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handleUpdate();
      }
    };
    if (isEditing) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, ref, handleUpdate]);

  if (isEditing) {
    return <div ref={ref}>{renderEdit(value, setValue, handleUpdate)}</div>;
  }

  return (
    <div onClick={() => setIsEditing(true)} className="w-full h-full cursor-pointer p-2 -m-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800">
      {children}
    </div>
  );
};

// --- TaskRow Component ---
const TaskRow: React.FC<{
  task: Task & { level: number };
  isExpanded: boolean;
  onToggleExpand: () => void;
  employees: Employee[];
  onUpdate: () => void;
  onStartComposeSubtask: (parentId: number) => void;
  onDeleteRequest: (task: Task) => void;
}> = ({
  task,
  isExpanded,
  onToggleExpand,
  employees,
  onUpdate,
  onStartComposeSubtask,
  onDeleteRequest,
}) => {
  const isCompleted = task.status === "Completed";
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !isCompleted;

  const creator = employees.find((emp) => emp.id === task.created_by);
  const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : "Unknown";

  const handleFieldUpdate = async (field: keyof UpdateTaskPayload, value: any) => {
    try {
      await updateTask(task.id, { [field]: value });
      toast.success(`Task updated successfully.`);
      onUpdate();
    } catch (error) {
      toast.error(`Failed to update task.`);
    }
  };

  const handleStatusToggle = () => {
    handleFieldUpdate("status", isCompleted ? "In Progress" : "Completed");
  };

  function AssigneeEditor({ employees, value, setValue, close }: {
    employees: { id: string; firstName: string; lastName: string }[];
    value: string[];
    setValue: (val: string[]) => void;
    close: () => void;
  }) {
    const [popoverOpen, setPopoverOpen] = useState(true);
    return (
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-start -ml-2 h-8">
            Assign...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-64">
          <Command>
            <CommandInput placeholder="Search employees..." />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                {employees.map((emp) => (
                  <CommandItem
                    key={emp.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => {
                      const newSet = new Set(value);
                      if (newSet.has(emp.id)) {
                        newSet.delete(emp.id);
                      } else {
                        newSet.add(emp.id);
                      }
                      setValue(Array.from(newSet));
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value.includes(emp.id) ? "opacity-100" : "opacity-0"}`} />
                    {emp.firstName} {emp.lastName}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="p-2 border-t">
            <Button size="sm" className="w-full" onClick={() => { setPopoverOpen(false); close(); }}>
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TableRow
      data-state={isCompleted ? "completed" : "active"}
      className="data-[state=completed]:text-gray-500 data-[state=completed]:bg-gray-50/50 dark:data-[state=completed]:text-zinc-500 dark:data-[state=completed]:bg-zinc-900/30 group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
    >
      <TableCell>
        {creator ? (
          <div className="flex items-center justify-start gap-2" title={creatorName}>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-zinc-900"
              style={{ backgroundColor: generateAvatarColor(creatorName), color: "#333" }}
            >
              {getInitials(creatorName)}
            </div>
          </div>
        ) : (
          <span className="text-gray-400 italic text-xs">Unknown</span>
        )}
      </TableCell>
      <TableCell style={{ paddingLeft: `${task.level * 24 + 12}px` }} className="w-[40%]">
        <div className="flex items-center gap-2">
          {hasSubtasks ? (
            <Button variant="ghost" size="icon" onClick={onToggleExpand} className="h-6 w-6">
              <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
            </Button>
          ) : (
            <div className="w-6 h-6" />
          )}
          <button onClick={handleStatusToggle} className="flex-shrink-0">
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300 hover:text-gray-500 dark:text-zinc-600 dark:hover:text-zinc-400" />
            )}
          </button>
          <EditableCell
            initialValue={task.task_name}
            onUpdate={(val) => handleFieldUpdate("taskName", val)}
            renderEdit={(val, setVal, close) => (
              <Input value={val} onChange={(e) => setVal(e.target.value)} onBlur={close} autoFocus className="h-8" />
            )}
          >
            <span className={isCompleted ? "line-through" : ""}>{task.task_name}</span>
          </EditableCell>
          {!isCompleted && (
            <Button variant="ghost" size="icon" onClick={() => onStartComposeSubtask(task.id)} className="h-6 w-6 opacity-0 group-hover:opacity-100">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>

      <TableCell>
        <EditableCell
          initialValue={task.assignees?.map((a) => a.id) || []}
          onUpdate={(val) => handleFieldUpdate("assignees", val.map((id: string) => Number(id)))}
          renderEdit={(val, setVal, close) => (
            <AssigneeEditor
              employees={employees.map((emp) => ({
                id: emp.id.toString(),
                firstName: emp.firstName,
                lastName: emp.lastName,
              }))}
              value={val.map(String)}
              setValue={(v) => setVal(v.map((id) => Number(id)))}
              close={close}
            />
          )}
        >
          {task.assignees?.length > 0 ? (
            <div className="flex items-center -space-x-1.5">
              {task.assignees.map((a) => (
                <div
                  key={a.id}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-zinc-900"
                  style={{ backgroundColor: generateAvatarColor(a.name), color: "#333" }}
                  title={a.name}
                >
                  {getInitials(a.name)}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-400 italic text-xs">Unassigned</span>
          )}
        </EditableCell>
      </TableCell>

      <TableCell>
        <Select value={task.status} onValueChange={(newStatus: Task["status"]) => handleFieldUpdate("status", newStatus)}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${statusStyles[task.status]?.dot}`} />
                <span className="text-xs ">{task.status}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Statuses.map((s) => (
              <SelectItem key={s} value={s}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusStyles[s]?.dot}`} />
                  <span>{s}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      {/* Priority Cell - UPDATED */}
      <TableCell>
        <Select
          value={task.priority}
          onValueChange={(newPriority: Task["priority"]) => handleFieldUpdate("priority", newPriority)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue>
              <PriorityIcon priority={task.priority} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Priorities.map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityIcon priority={p} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>

      <TableCell>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`h-8 w-[140px] justify-start font-normal text-left ${isOverdue ? "text-red-500 border-red-300 dark:border-red-800" : ""}`}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {task.due_date ? format(parseISO(task.due_date), "MMM dd, yyyy") : "No date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={task.due_date ? parseISO(task.due_date) : undefined}
              onSelect={(date) => handleFieldUpdate("dueDate", date ? format(date, "yyyy-MM-dd") : null)}
            />
          </PopoverContent>
        </Popover>
      </TableCell>

      <TableCell className="relative">
        <div className="flex items-center justify-between">
          <EditableCell
            initialValue={task.tags?.join(", ") || ""}
            onUpdate={(val) => handleFieldUpdate("tags", val.split(",").map((t: string) => t.trim()).filter(Boolean))}
            renderEdit={(val, setVal, close) => (
              <Input value={val} onChange={(e) => setVal(e.target.value)} onBlur={close} autoFocus className="h-8" />
            )}
          >
            <div className="flex gap-1 flex-wrap">
              {task.tags?.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
          </EditableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-red-600" onClick={() => onDeleteRequest(task)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Task
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
};

// --- Main Page Component ---
const ProjectTasksPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [composingState, setComposingState] = useState<{ parentId: number | null } | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [activityLog, setActivityLog] = useState<ProjectActivityLog[]>([]);
  const [isLogLoading, setIsLogLoading] = useState(true);
  const { user: currentUser } = useAuth();



  const nestTasks = useCallback((taskList: Task[]): Task[] => {
    const taskMap = new Map(taskList.map((t) => [t.id, { ...t, subtasks: [] }]));
    const nested: Task[] = [];
    for (const task of taskMap.values()) {
      if (task.parent_task_id && taskMap.has(task.parent_task_id)) {
        taskMap.get(task.parent_task_id)!.subtasks.push(task);
      } else {
        nested.push(task);
      }
    }
    return nested;
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const [projectData, tasksData, employeesData, logData] = await Promise.all([
        getProjectById(parseInt(projectId, 10)),
        getTasksForProject(parseInt(projectId, 10)),
        getEmployees(),
        getProjectActivityLog(parseInt(projectId, 10)),
      ]);
      setProject(projectData);
      setEmployees(employeesData);
      const updatedTasks = await checkAndSetOverdueTasks(tasksData);
      const nested = nestTasks(updatedTasks);
      setTasks(nested);
      const initialExpanded = new Set(updatedTasks.filter((t) => t.subtasks && t.subtasks.length > 0).map((t) => t.id));
      setExpandedTasks(initialExpanded);
      setActivityLog(logData);
    } catch (error) {
      toast.error("Failed to load project data.");
    } finally {
      setLoading(false);
      setIsLogLoading(false);
    }
  }, [projectId, nestTasks]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateTask = async (payload: Omit<CreateTaskPayload, "createdBy">) => {
    try {
      const payloadWithCreator: CreateTaskPayload = {
        ...payload,
        createdBy: parseInt(currentUser.id, 10),
      };
      await createTask(payloadWithCreator);
      toast.success(`Task "${payload.taskName}" created!`);
      setComposingState(null);
      await loadData();
    } catch (error) {
      toast.error("Failed to create task.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask(deletingTask.id);
      toast.success(`Task "${deletingTask.task_name}" deleted.`);
      setDeletingTask(null);
      await loadData();
    } catch (error) {
      toast.error("Failed to delete task.");
    }
  };

  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleUpdateTask = async (taskId: number, payload: UpdateTaskPayload) => {
    try {
      await updateTask(taskId, payload);
      toast.success("Task updated successfully!");
      await loadData();
    } catch (error) {
      toast.error("Failed to update task.");
    }
  };

  const visibleTasks = useMemo(() => {
    const flatList: (Task & { level: number })[] = [];
    const addTasksToList = (tasksToAdd: Task[], level: number) => {
      for (const task of tasksToAdd) {
        flatList.push({ ...task, level });
        if (expandedTasks.has(task.id) && task.subtasks) {
          addTasksToList(task.subtasks, level + 1);
        }
      }
    };
    addTasksToList(tasks.filter((t) => t.status !== "Completed"), 0);
    return flatList;
  }, [tasks, expandedTasks]);

  const visibleCompletedTasks = useMemo(() => {
    const flatList: (Task & { level: number })[] = [];
    const topLevelCompleted = tasks.filter((t) => t.status === "Completed");
    const addTasksToList = (tasksToAdd: Task[], level: number) => {
      for (const task of tasksToAdd) {
        flatList.push({ ...task, level });
        if (expandedTasks.has(task.id) && task.subtasks) {
          addTasksToList(task.subtasks, level + 1);
        }
      }
    };
    addTasksToList(topLevelCompleted, 0);
    return flatList;
  }, [tasks, expandedTasks]);

  const creatorEmployee = employees.find((emp) => emp.id === parseInt(currentUser.id, 10));

  const renderComposer = (parentId: number | null) => {
    if (composingState?.parentId === parentId && projectId && creatorEmployee) {
      return (
        <TableRow>
          <TableCell colSpan={7}>
            <InlineTaskComposer
              employees={employees}
              projectId={parseInt(projectId, 10)}
              parentId={parentId}
              creator={creatorEmployee}
              onSubmit={handleCreateTask}
              onCancel={() => setComposingState(null)}
            />
          </TableCell>
        </TableRow>
      );
    }
    return null;
  };

  if (loading && tasks.length === 0) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }
  
  // Guard against rendering before creator is found
  if (!creatorEmployee && !loading) {
     return (
       <AppLayout>
        <div className="flex justify-center items-center h-screen">
           Could not identify current user among employees.
        </div>
       </AppLayout>
     )
  }

  return (
    <AppLayout>
      {projectId && (
        <ProjectActivitySidebar
          projectId={parseInt(projectId, 10)}
          activityLog={activityLog}
          isLoading={isLogLoading}
        />
      )}
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center mb-4 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Project Details
        </Button>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800 dark:text-zinc-200">
              Tasks for {project?.title}
            </h1>
            <p className="text-gray-500 dark:text-zinc-400">
              Manage your project's to-do list.
            </p>
          </div>
          <ToggleGroup type="single" value={view} onValueChange={(value) => { if (value) setView(value as "list" | "kanban"); }} aria-label="Task view">
            <ToggleGroupItem value="list" aria-label="List view"><List className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Kanban view"><Kanban className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
        </div>

        {view === "list" ? (
          <>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead className="w-[40%]">Task Name</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <TaskRow
                        task={task}
                        employees={employees}
                        onUpdate={loadData}
                        isExpanded={expandedTasks.has(task.id)}
                        onToggleExpand={() => handleToggleExpand(task.id)}
                        onStartComposeSubtask={(parentId) => setComposingState({ parentId })}
                        onDeleteRequest={setDeletingTask}
                      />
                      {renderComposer(task.id)}
                    </React.Fragment>
                  ))}
                  {renderComposer(null)}
                </TableBody>
              </Table>
              {!composingState && (
                <div className="p-4 border-t">
                  <Button variant="outline" onClick={() => setComposingState({ parentId: null })}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add a new task
                  </Button>
                </div>
              )}
            </Card>

            <div className="mt-8">
              <button onClick={() => setShowCompleted(!showCompleted)} className="flex items-center font-semibold text-gray-600 hover:text-gray-800 dark:text-zinc-400 dark:hover:text-zinc-200">
                <ChevronRight className={`h-5 w-5 mr-1 transition-transform ${showCompleted ? "rotate-90" : ""}`} />
                Completed Tasks ({visibleCompletedTasks.length})
              </button>
              {showCompleted && (
                <Card className="mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Creator</TableHead>
                        <TableHead className="w-[40%]">Task Name</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Tags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleCompletedTasks.length > 0 ? (
                        visibleCompletedTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            employees={employees}
                            onUpdate={loadData}
                            isExpanded={expandedTasks.has(task.id)}
                            onToggleExpand={() => handleToggleExpand(task.id)}
                            onStartComposeSubtask={() => {}}
                            onDeleteRequest={setDeletingTask}
                          />
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center h-24">
                            No completed tasks.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>
          </>
        ) : (
          <KanbanBoard tasks={tasks} setTasks={setTasks} employees={employees} nestTasks={nestTasks} onUpdate={loadData} />
        )}
      </div>

      <AlertDialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              <strong className="mx-1">"{deletingTask?.task_name}"</strong>
              and all of its subtasks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default ProjectTasksPage;
