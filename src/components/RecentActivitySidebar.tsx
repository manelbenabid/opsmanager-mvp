import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getRecentProjectActivity, RecentProjectActivityLog } from '../services/api';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";


const ActivityMessage: React.FC<{ log: RecentProjectActivityLog }> = ({ log }) => {
  let message;
  switch (log.activityType) {
    case 'PROJECT_CREATED':
      message = <>created project</>;
      break;
    case 'TASK_CREATED':
      message = <>added a new task "<strong>{log.details.taskName}</strong>" to</>;
      break;
    case 'TASK_COMPLETED':
        message = <>completed task "<strong>{log.details.taskName}</strong>" in</>;
        break;
    case 'STATUS_UPDATED':
      message = <>updated the status for</>;
      break;
    default:
      message = <>made an update to</>;
  }

  return (
    <p className="text-sm text-gray-700">
      <span className="font-semibold">{log.user.name}</span> {message}{" "}
      <Link to={`/projects/${log.projectId}`} className="font-semibold text-violet-600 hover:underline">
        {log.projectTitle}
      </Link>
    </p>
  );
};


export const RecentActivitySidebar: React.FC = () => {
  const [logs, setLogs] = useState<RecentProjectActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      const data = await getRecentProjectActivity();
      setLogs(data);
      setIsLoading(false);
    };
    fetchLogs();
  }, []);

  return (
    <div className="group fixed top-4 right-0 z-40">
      <div className="relative">
        {/* Floating Button */}
        <button className="absolute top-11 -left-16 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-left-20">
          <History className="h-6 w-6" />
        </button>
    
          <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-in-out">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Project History</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Recent events for this project.</p>
            </div>
            
            <div className="p-6 h-full overflow-y-auto pb-24">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : logs.length > 0 ? (
            <div className="space-y-6">
              {logs.map(log => (
                <div key={log.id} className="flex gap-3">
                    <div className="text-xs text-gray-400 mt-1 flex-shrink-0 w-20 text-right">
                        {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                    </div>
                    <div className="pl-3 border-l-2">
                        <ActivityMessage log={log} />
                    </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 mt-8">No recent activity.</p>
          )}
       </div>
          </div>
        </div>
        </div>
  );
};