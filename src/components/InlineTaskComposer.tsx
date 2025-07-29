import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Employee, Task, CreateTaskPayload } from "@/services/api"; // Adjust path if needed
import {
  UserPlus,
  Calendar as CalendarIcon,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Signal,
  TriangleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

// --- Helper Components & Functions ---

const Priorities: Task["priority"][] = [
  "Urgent",
  "High",
  "Normal",
  "Low",
  "No Priority",
];

const getInitials = (name: string) => {
  if (!name) return "?";
  const names = name.split(" ");
  const firstInitial = names[0]?.[0] || "";
  const lastInitial =
    names.length > 1 ? names[names.length - 1]?.[0] || "" : "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

/**
 * Renders a priority icon and its name with appropriate styling.
 * @param priority - The task priority level.
 * @param showName - Whether to show the name next to the icon.
 */
const PriorityIcon = ({
  priority,
  showName = false,
}: {
  priority: Task["priority"];
  showName?: boolean;
}) => {
  const iconMap: Record<Task["priority"], React.ReactNode> = {
    Urgent: <TriangleAlert className="h-4 w-4 text-red-500 flex-shrink-0" />,
    High: <Signal className="h-4 w-4 text-orange-500 flex-shrink-0" />,
    Normal: <SignalHigh className="h-4 w-4 text-blue-500 flex-shrink-0" />,
    Low: <SignalMedium className="h-4 w-4 text-gray-500 flex-shrink-0" />,
    "No Priority": <SignalLow className="h-4 w-4 text-gray-400 flex-shrink-0" />,
  };

  const icon = iconMap[priority] || iconMap["No Priority"];
  const priorityName = priority || "No Priority";

  return (
    <div title={priorityName} className="flex items-center gap-2">
      {icon}
      {showName && <span>{priorityName}</span>}
    </div>
  );
};

// --- Main Component ---

interface InlineTaskComposerProps {
  employees: Employee[];
  projectId: number;
  parentId: number | null;
  creator: Employee;
  onSubmit: (
    payload: Omit<CreateTaskPayload, "createdBy"> & { createdBy: number }
  ) => void;
  onCancel: () => void;
}

export const InlineTaskComposer: React.FC<InlineTaskComposerProps> = ({
  employees,
  projectId,
  parentId,
  creator,
  onSubmit,
  onCancel,
}) => {
  const [taskName, setTaskName] = useState("");
  const [assignees, setAssignees] = useState<Employee[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [priority, setPriority] = useState<Task["priority"]>("Normal");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleAssigneeSelect = (employee: Employee) => {
    setAssignees((prev) =>
      prev.some((a) => a.id === employee.id)
        ? prev.filter((a) => a.id !== employee.id)
        : [...prev, employee]
    );
  };

  const handleSave = () => {
    if (taskName.trim().length < 3) {
      toast.info("Task name must be at least 3 characters long.");
      return;
    }
    const payload = {
      projectId,
      parentTaskId: parentId,
      taskName: taskName.trim(),
      priority,
      assignees: assignees.map((a) => a.id),
      dueDate: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      tags: [],
      createdBy: creator.id,
    };
    onSubmit(payload);
  };

  const creatorFullName = `${creator.firstName} ${creator.lastName}`;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-3 my-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 animate-in fade-in-50 slide-in-from-top-2 duration-300">
        <div className="flex flex-col gap-2">
          <Input
            ref={inputRef}
            placeholder="What needs to be done?"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="text-base border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-1 h-auto"
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              {/* --- Action Buttons --- */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-64">
                  <Command>
                    <CommandInput placeholder="Assign to..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            onSelect={() => handleAssigneeSelect(emp)}
                          >
                            {emp.firstName} {emp.lastName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate ?? undefined}
                    onSelect={(d) => setDueDate(d ?? null)}
                  />
                </PopoverContent>
              </Popover>
              {/* --- Priority Picker (UPDATED) --- */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <PriorityIcon priority={priority} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-1 w-auto">
                  {Priorities.map((p) => (
                    <Button
                      key={p}
                      variant="ghost"
                      className="w-full justify-start"
                      size="sm"
                      onClick={() => setPriority(p)}
                    >
                      <PriorityIcon priority={p} showName={true} />
                    </Button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* --- Display Area for selected items --- */}
              <div className="flex items-center gap-2 ml-2">
                <Tooltip>
                  <TooltipTrigger>
                    <Avatar className="h-6 w-6 border-2 border-sky-500">
                      <AvatarFallback>
                        {getInitials(creatorFullName)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>Created by: {creatorFullName}</TooltipContent>
                </Tooltip>

                <div className="border-l h-5 border-zinc-300 dark:border-zinc-700"></div>

                {assignees.map((a) => (
                  <Tooltip key={a.id}>
                    <TooltipTrigger>
                      <Avatar className="h-6 w-6">
                        <AvatarFallback>
                          {getInitials(`${a.firstName} ${a.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {a.firstName} {a.lastName}
                    </TooltipContent>
                  </Tooltip>
                ))}
                {dueDate && (
                  <Badge variant="secondary" className="font-medium">
                    {format(dueDate, "MMM d")}
                  </Badge>
                )}
                {/* Display selected priority icon if not Normal */}
                {priority !== "Normal" && (
                   <Badge variant="secondary" className="font-medium flex items-center gap-1.5 pl-1.5">
                     <PriorityIcon priority={priority} />
                     {priority}
                   </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={taskName.trim().length < 3}
              >
                Add Task
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
