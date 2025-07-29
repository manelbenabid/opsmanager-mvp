import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCorners,
  useSensor,
  useSensors,
  PointerSensor,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Task, Employee, updateTask, UpdateTaskPayload } from "../services/api";
import { toast } from "sonner";

const Statuses: Task["status"][] = [
  "Not Started",
  "In Progress",
  "Overdue",
  "Completed",
];

interface KanbanBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  employees: Employee[];
  nestTasks: (tasks: Task[]) => Task[];
  onUpdate: () => void;
}

const flattenNestedTasks = (nestedTasks: Task[]): Task[] => {
  const flatList: Task[] = [];
  const recurse = (tasks: Task[]) => {
    tasks.forEach((task) => {
      flatList.push(task);
      if (task.subtasks && task.subtasks.length > 0) {
        recurse(task.subtasks);
      }
    });
  };
  recurse(nestedTasks);
  return flatList;
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  setTasks,
  employees,
  nestTasks,
  onUpdate,
}) => {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const parentTasks = useMemo(
    () => tasks.filter((t) => !t.parent_task_id),
    [tasks]
  );

  const columns = useMemo(() => {
    const groupedTasks = new Map<Task["status"], Task[]>();
    Statuses.forEach((status) => groupedTasks.set(status, []));
    parentTasks.forEach((task) => {
      const statusGroup = groupedTasks.get(task.status) || [];
      statusGroup.push(task);
      groupedTasks.set(task.status, statusGroup);
    });
    return Array.from(groupedTasks.entries());
  }, [parentTasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const allTasks = flattenNestedTasks(tasks);
    const task = allTasks.find((t) => t.id === active.id);
    if (task) {
      const nestedTask = tasks.find((t) => t.id === task.id);
      setActiveTask(nestedTask || null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) {
      return;
    }

    const newStatus = over.id as Task["status"];
    const flatTasks = flattenNestedTasks(tasks);
    const originalTask = flatTasks.find((t) => t.id === active.id);

    if (originalTask && originalTask.status !== newStatus) {
      const originalNestedState = tasks;

      const updatedFlatTasks = flatTasks.map((t) =>
        t.id === originalTask.id ? { ...t, status: newStatus } : t
      );

      const updatedNestedTasks = nestTasks(updatedFlatTasks);
      setTasks(updatedNestedTasks);

      try {
        await updateTask(originalTask.id, { status: newStatus });
        toast.success(`Task status updated to "${newStatus}"`);
        onUpdate();
      } catch (error) {
        toast.error("Failed to update task. Reverting change.");
        setTasks(originalNestedState);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
      collisionDetection={closestCorners}
    >
      {/* ✅ CHANGED: Switched to a responsive grid to remove horizontal scroll */}
      <div className="flex w-full gap-4">
        {columns.map(([status, tasksInColumn]) => (
          <KanbanColumn
            key={status}
            id={status}
            title={status}
            tasks={tasksInColumn}
            employees={employees}
            onTaskUpdate={async (taskId, payload) => { // Keep onTaskUpdate for cards
              await updateTask(taskId, payload);
              onUpdate(); // Also call the refresh function here
            }}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            employees={employees}
            onTaskUpdate={async (taskId, payload) => {
              await updateTask(taskId, payload);
              onUpdate();
          }}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};