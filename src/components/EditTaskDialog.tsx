import React, { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label"; // Import Label
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Task, Employee, UpdateTaskPayload } from "../services/api";
import { format, parseISO } from "date-fns";
import { Flag, Check, CalendarIcon, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const avatarColors = [
  "#ffadad",
  "#ffd6a5",
  "#fdffb6",
  "#caffbf",
  "#9bf6ff",
  "#a0c4ff",
  "#bdb2ff",
  "#ffc6ff",
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
  const lastInitial =
    names.length > 1 ? names[names.length - 1]?.[0] || "" : "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const Priorities: Task["priority"][] = [
  "Urgent",
  "High",
  "Normal",
  "Low",
  "No Priority",
];
const priorityColors: Record<Task["priority"], string> = {
  Urgent: "text-red-500",
  High: "text-orange-500",
  Normal: "text-blue-500",
  Low: "text-gray-500",
  "No Priority": "text-gray-400",
};

interface EditTaskDialogProps {
  task: Task;
  employees: Employee[];
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (payload: UpdateTaskPayload) => Promise<void>;
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({
  task,
  employees,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [payload, setPayload] = useState<UpdateTaskPayload>({});
  const [assigneeSearch, setAssigneeSearch] = useState("");

  useEffect(() => {
    // Reset payload when a new task is selected
    setPayload({
      taskName: task.task_name,
      priority: task.priority,
      assignees: task.assignees?.map((a) => a.id) || [],
      dueDate: task.due_date,
      tags: task.tags || [],
    });
  }, [task]);

  const handleFieldChange = (field: keyof UpdateTaskPayload, value: any) => {
    setPayload((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssigneeSelect = (empId: number) => {
    const currentAssignees = new Set(payload.assignees || []);
    if (currentAssignees.has(empId)) {
      currentAssignees.delete(empId);
    } else {
      currentAssignees.add(empId);
    }
    handleFieldChange("assignees", Array.from(currentAssignees));
  };

  const handleSave = async () => {
    // Filter out any unchanged fields to send a minimal payload
    const changes: UpdateTaskPayload = {};
    if (payload.taskName !== task.task_name)
      changes.taskName = payload.taskName;
    if (payload.priority !== task.priority) changes.priority = payload.priority;
    if (payload.dueDate !== task.due_date) changes.dueDate = payload.dueDate;
    if (
      JSON.stringify(payload.assignees) !==
      JSON.stringify(task.assignees?.map((a) => a.id))
    )
      changes.assignees = payload.assignees;
    if (JSON.stringify(payload.tags) !== JSON.stringify(task.tags))
      changes.tags = payload.tags;

    if (Object.keys(changes).length === 0) {
      toast.info("No changes were made.");
      onClose();
      return;
    }

    await onUpdate(changes);
    onClose();
  };

  const selectedAssignees = useMemo(() => {
    return employees.filter((emp) => payload.assignees?.includes(emp.id));
  }, [payload.assignees, employees]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Make changes to your task here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="taskName">Task Name</Label>
            <Input
              id="taskName"
              value={payload.taskName || ""}
              onChange={(e) => handleFieldChange("taskName", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={payload.priority}
                onValueChange={(p: Task["priority"]) =>
                  handleFieldChange("priority", p)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <Flag className={`h-4 w-4 ${priorityColors[p]}`} />
                        {p}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {payload.dueDate
                      ? format(parseISO(payload.dueDate), "MMM dd, yyyy")
                      : "Set date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={
                      payload.dueDate ? parseISO(payload.dueDate) : undefined
                    }
                    onSelect={(d) =>
                      handleFieldChange(
                        "dueDate",
                        d ? format(d, "yyyy-MM-dd") : null
                      )
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Assignees</Label>
            {/* ✅ CHANGED: Visual assignee selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-auto min-h-[40px] py-2"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Users className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    {selectedAssignees.length > 0 ? (
                      selectedAssignees.map((emp) => (
                        <div
                          key={emp.id}
                          style={{
                            backgroundColor: generateAvatarColor(emp.firstName),
                          }}
                          className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border border-white"
                          title={`${emp.firstName} ${emp.lastName}`}
                        >
                          {getInitials(`${emp.firstName} ${emp.lastName}`)}
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-500">
                        Assign to employees...
                      </span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[--radix-popover-trigger-width]">
                <Command>
                  <CommandInput placeholder="Search employees..." />
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      {employees.map((emp) => (
                        <CommandItem
                          key={emp.id}
                          onSelect={() => handleAssigneeSelect(emp.id)}
                          className="cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              payload.assignees?.includes(emp.id)
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          {emp.firstName} {emp.lastName}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={Array.isArray(payload.tags) ? payload.tags.join(", ") : ""}
              onChange={(e) =>
                handleFieldChange(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              }
              placeholder="e.g. design, frontend, bug"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
