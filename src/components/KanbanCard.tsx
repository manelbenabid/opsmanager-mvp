import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task, Employee, UpdateTaskPayload } from "../services/api";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Edit,
  ChevronsUp,
  ChevronUp,
  Equal,
  Minus,
  SignalLow,
  SignalMedium,
  SignalHigh,
  Signal,
  TriangleAlert
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EditTaskDialog } from "./EditTaskDialog";

// --- Color & Name Helpers ---
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

  return <div title={priorityName}>{icon}</div>;
};

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

interface KanbanCardProps {
  task: Task;
  employees: Employee[];
  onTaskUpdate: (taskId: number, payload: UpdateTaskPayload) => Promise<void>;
  level?: number;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  employees,
  onTaskUpdate,
  level = 0,
}) => {
  const isSubtask = level > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: isSubtask,
  });

  const [subtasksVisible, setSubtasksVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const creator = employees.find((e) => e.id === task.created_by);
  const creatorName = creator ? `${creator.firstName} ${creator.lastName}`.trim() : "Unknown";


  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginLeft: `${level * 20}px`,
    width: `calc(100% - ${level * 20}px)`,
  };

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const DraggableWrapper = "div";
  const draggableProps = isSubtask ? {} : { ...attributes, ...listeners };

  return (
    <>
      <DraggableWrapper ref={setNodeRef} style={style} {...draggableProps}>
        <Card
          className={`p-3 bg-white dark:bg-zinc-800/50 shadow-sm hover:shadow-md transition-shadow group relative ${
            isSubtask ? "mb-1" : "mb-3"
          }`}
        >
          <div className="absolute top-1 right-1 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Creator and Task Name */}
          <div className="flex items-center gap-2 mb-2">
            {creator && (
              <div
                className="h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: generateAvatarColor(creatorName),
                  color: "#333",
                }}
                title={`Created by: ${creatorName}`}
              >
                {getInitials(creatorName)}
              </div>
            )}
            <p className="font-semibold text-sm text-gray-800 dark:text-zinc-200 pr-8">
              {task.task_name}
            </p>
          </div>

          {/* Tags */}

          {task.tags && task.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap my-3">
              {task.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Card Footer: Assignees, Priority, and Due Date */}
          <div className="flex justify-between items-center mt-3">
            <div className="flex items-center -space-x-1.5">
              {task.assignees?.map((a) => (
                <div
                  key={a.id}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white dark:border-zinc-800"
                  style={{
                    backgroundColor: generateAvatarColor(a.name),
                    color: "#333",
                  }}
                  title={a.name}
                >
                  {getInitials(a.name)}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <PriorityIcon priority={task.priority} />
              <span className="text-xs text-gray-500 dark:text-zinc-400">
                {task.due_date ? format(parseISO(task.due_date), "MMM dd") : ""}
              </span>
            </div>
          </div>

          {/* Subtasks Toggle */}

          {hasSubtasks && (
            <div className="mt-3 pt-2 border-t border-dashed">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setSubtasksVisible(!subtasksVisible);
                }}
                className="flex items-center gap-2 w-full text-left p-1 -ml-1 rounded-md text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700/50 transition-colors"
              >
                {subtasksVisible ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>
                  {task.subtasks.length} Subtask
                  {task.subtasks.length > 1 ? "s" : ""}
                </span>
              </button>
            </div>
          )}
        </Card>
      </DraggableWrapper>

      {hasSubtasks && subtasksVisible && (
        <div className="pl-1 -mt-2 space-y-1">
          {task.subtasks.map((subtask) => (
            <KanbanCard
              key={subtask.id}
              task={subtask}
              employees={employees}
              onTaskUpdate={onTaskUpdate}
              level={level + 1}
            />
          ))}
        </div>
      )}

      {isEditing && (
        <EditTaskDialog
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          task={task}
          employees={employees}
          onUpdate={(payload) => onTaskUpdate(task.id, payload)}
        />
      )}
    </>
  );
};
