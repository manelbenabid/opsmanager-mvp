import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { Task, Employee, UpdateTaskPayload } from '../services/api';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: Task[];
  employees: Employee[];
  onTaskUpdate: (taskId: number, payload: UpdateTaskPayload) => Promise<void>;
}

// ✅ NEW: Themed styles for each column status
const statusStyles: Record<string, { border: string; text: string; bg: string; badge: string }> = {
  "Not Started": { border: "border-gray-400", text: "text-gray-600 dark:text-gray-300", bg: "bg-gray-500/5", badge: "bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300"},
  "In Progress": { border: "border-blue-500", text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/5", badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300" },
  "Overdue": { border: "border-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/5", badge: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"},
  "Completed": { border: "border-green-500", text: "text-green-600 dark:text-green-400", bg: "bg-green-500/5", badge: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"},
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tasks, employees, onTaskUpdate }) => {
  const { setNodeRef } = useDroppable({ id });
  const styles = statusStyles[id] || statusStyles["Not Started"];

  return (
    // ✅ CHANGED: Column now has flex layout and a themed top border
    <div className={`flex flex-1 flex-col min-w-0 rounded-lg border-t-4 ${styles.border} bg-gray-50 dark:bg-zinc-900 shadow-sm`}>
      <div className="flex items-center justify-between p-3 border-b dark:border-zinc-800">
        <h3 className={`font-semibold ${styles.text}`}>{title}</h3>
        <span className={`text-sm font-medium rounded-full px-2 py-0.5 ${styles.badge}`}>
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 rounded-b-lg min-h-[400px] overflow-y-auto transition-colors ${styles.bg}`}
      >
        <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              employees={employees}
              onTaskUpdate={onTaskUpdate}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};