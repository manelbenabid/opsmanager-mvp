import React, { useState, useEffect } from "react";
import { getPocActivityLog, PocActivityLog } from "../services/api";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import {
  Loader2,
  History,
  FilePlus,
  Edit3,
  CheckSquare,
  UserPlus,
  UserX,
  UserCheck,
  Upload,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils"; // Import `cn` for combining class names

interface ActivitySidebarProps {
  pocId: number;
  className?: string;
}

const activityIcons: {
  [key: string]: { icon: React.ElementType; color: string };
} = {
  POC_CREATED: {
    icon: FilePlus,
    color: "text-green-500 bg-green-100 dark:bg-green-900",
  },
  FIELD_UPDATED: {
    icon: Edit3,
    color: "text-blue-500 bg-blue-100 dark:bg-blue-900",
  },
  STATUS_UPDATED: {
    icon: CheckSquare,
    color: "text-cyan-500 bg-cyan-100 dark:bg-cyan-900",
  },
  LEAD_ASSIGNED: {
    icon: UserCheck,
    color: "text-violet-500 bg-violet-100 dark:bg-violet-900",
  },
  TEAM_MEMBER_ASSIGNED: {
    icon: UserPlus,
    color: "text-purple-500 bg-purple-100 dark:bg-purple-900",
  },
  TEAM_MEMBER_UNASSIGNED: {
    icon: UserX,
    color: "text-red-500 bg-red-100 dark:bg-red-900",
  },
  ATTACHMENT_UPLOADED: {
    icon: Upload,
    color: "text-sky-500 bg-sky-100 dark:bg-sky-900",
  },
  ATTACHMENT_DOWNLOADED: {
    icon: Download,
    color: "text-lime-500 bg-lime-100 dark:bg-lime-900",
  },
  DEFAULT: {
    icon: History,
    color: "text-gray-500 bg-gray-100 dark:bg-gray-700",
  },
};

const ActivityItem: React.FC<{ log: PocActivityLog }> = ({ log }) => {
  const { icon: Icon, color } =
    activityIcons[log.activityType] || activityIcons.DEFAULT;

  const renderDetails = () => {
    const { activityType, details } = log;
    switch (activityType) {
      case "POC_CREATED":
        return (
          <>
            created the PoC: <strong>{details.title}</strong>
          </>
        );
      case "FIELD_UPDATED":
        let fromDisplay = details.from ? `"${details.from}"` : "empty";

        // Check if the field is a date and the 'from' value exists to format it
        if (
          (details.field === "Start Date" ||
            details.field === "Target End Date") &&
          details.from
        ) {
          try {
            // Format the full ISO date string into a simpler one
            fromDisplay = `"${format(parseISO(details.from), "yyyy-MM-dd")}"`;
          } catch (e) {
            console.error(
              "Could not parse date for activity log:",
              details.from
            );
            // If parsing fails, it will fall back to the original string
          }
        }

        return (
          <>
            updated <strong>{details.field}</strong> from {fromDisplay} to "
            <strong>{details.to}</strong>"
          </>
        );

      case "STATUS_UPDATED":
        return (
          <>
            updated the status from{" "}
            <Badge variant="secondary" className="font-normal">
              {details.from}
            </Badge>{" "}
            to <Badge className="font-normal">{details.to}</Badge>
          </>
        );
      case "LEAD_ASSIGNED":
        return (
          <>
            assigned <strong>{details.to}</strong> as the new Technical Lead
          </>
        );
      case "TEAM_MEMBER_ASSIGNED":
        return (
          <>
            assigned <strong>{details.member}</strong> to the team as{" "}
            <strong>{details.role}</strong>
          </>
        );
      case "TEAM_MEMBER_UNASSIGNED":
        return (
          <>
            removed <strong>{details.member}</strong> from the team
          </>
        );
      case "ATTACHMENT_UPLOADED":
        return (
          <>
            uploaded the attachment "<strong>{details.filename}</strong>"
          </>
        );

      case "ATTACHMENT_DOWNLOADED":
        return (
          <>
            downloaded the attachment "<strong>{details.filename}</strong>"
          </>
        );

      default:
        return "performed an unknown action";
    }
  };

  return (
    <div className="mb-8 ml-8 relative">
      <span
        className={cn(
          "absolute flex items-center justify-center w-8 h-8 rounded-full -left-12 ring-8 ring-white dark:ring-gray-800",
          color
        )}
      >
        <Icon className="w-4 h-4" />
      </span>
      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg shadow-sm">
        <div className="text-sm text-gray-800 dark:text-gray-200">
          <span className="font-semibold text-gray-900 dark:text-white">
            {log.user.name}
          </span>{" "}
          {renderDetails()}
        </div>
        <time className="block mt-2 text-xs font-normal leading-none text-gray-400 dark:text-gray-500">
          {format(parseISO(log.timestamp), "MMM d, yyyy 'at' h:mm a")}
        </time>
      </div>
    </div>
  );
};

const ActivitySidebar: React.FC<ActivitySidebarProps> = ({
  pocId,
  className,
}) => {
  const [activityLog, setActivityLog] = useState<PocActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pocId) return;

    const fetchLog = async () => {
      setIsLoading(true);
      const logData = await getPocActivityLog(pocId);
      setActivityLog(logData);
      setIsLoading(false);
    };

    fetchLog();
  }, [pocId]);

  return (
    <div className={cn("group fixed top-4 right-0 z-40", className)}>
      <div className="relative">
        {/* Floating Button */}
        <button className="absolute top-11 -left-16 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-hover:-left-20">
          <History className="h-6 w-6" />
        </button>

        {/* Sidebar Panel */}
        <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white dark:bg-gray-800 shadow-2xl transform translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-in-out">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Activity History
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Recent events for this PoC.
            </p>
          </div>

          <div className="p-6 h-full overflow-y-auto pb-24">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : activityLog.length > 0 ? (
              <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-4">
                {activityLog.map((log) => (
                  <ActivityItem key={log.id} log={log} />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-8">
                No activity recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivitySidebar;
