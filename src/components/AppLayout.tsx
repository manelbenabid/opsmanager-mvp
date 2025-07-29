import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  FileCode, 
  Users as UsersIcon, // Renamed to avoid conflict with User icon
  LogOut, 
  Menu, 
  X,
  User,
  Building,
  // Phone, // Not used in current nav items
  ChevronDown, // For dropdown indicator
  UsersRound, // Example for "All Employees"
  Truck,      // Example for "Delivery Team"
  Server,     // Example for "Managed Services"
  Briefcase,   // Example for "Account Managers"
  GanttChartSquare // Projects
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar'; //  Avatar for user menu


interface NavItem {
  id: string; // Unique ID for each item, especially parents
  name: string;
  href?: string; // Optional: Parent items might not have a direct href
  icon: React.ElementType;
  permission?: { resource: string; action: string };
  children?: NavItem[]; // For nested items
}

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true); // Default to open on desktop
  const [openSubMenus, setOpenSubMenus] = useState<{ [key: string]: boolean }>({});

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleSubMenu = (id: string) => {
    setOpenSubMenus(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navigation: NavItem[] = [
    { id: 'dashboard', name: 'PoC Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { id: 'pocs', name: 'POCs', href: '/pocs', icon: FileCode },
    { 
      id: 'projects', 
      name: 'Projects', 
      href: '/projects', 
      icon: GanttChartSquare,
      // You'll need to define this permission in your AuthContext
      permission: { resource: 'project', action: 'view' } 
    },
    { 
      id: 'employees', 
      name: 'Employees', 
      icon: UsersIcon, // Main icon for Employees
      permission: { resource: 'employee', action: 'view' }, // Overall permission to see Employees section
      children: [
        { id: 'employees-all', name: 'All Employees', href: '/employees/all', icon: UsersRound, permission: { resource: 'employee', action: 'view' } },
        { id: 'employees-delivery', name: 'Delivery Team', href: '/employees/delivery-team', icon: Truck, permission: { resource: 'employee', action: 'view' } },
        { id: 'employees-managed', name: 'Managed Services', href: '/employees/managed-services', icon: Server, permission: { resource: 'employee', action: 'view' } },
        { id: 'employees-am', name: 'Account Managers', href: '/employees/account-managers', icon: Briefcase, permission: { resource: 'employee', action: 'view' } },
      ]
    },
    {
      id: 'customers',
      name: 'Customers',
      href: '/customers',
      icon: Building,
      permission: { resource: 'customer', action: 'view' }
    },
    { id: 'my-info', name: 'My Info', href: '/my-info', icon: User }
  ];

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden"> {/* Added dark mode bg */}
      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } w-64 bg-sidebar text-sidebar-foreground transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:flex md:flex-col`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border shrink-0"> {/* Added shrink-0 */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            {/* Optional: Add a logo icon here */}
            <span className="text-xl font-bold">Apex</span>
          </Link>
          <button 
            className="p-1 rounded-md md:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={toggleSidebar}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto"> {/* Added flex-1 and overflow-y-auto */}
          {navigation.map((item) => {
            if (item.permission && !hasPermission(item.permission.resource, item.permission.action)) {
              return null;
            }
            
            const isParentActive = item.children && item.children.some(child => child.href && (location.pathname === child.href || location.pathname.startsWith(child.href + '/')));
            const isSubMenuOpen = !!openSubMenus[item.id];

            if (item.children && item.children.length > 0) {
              // Parent item with children
              return (
                <div key={item.id}>
                  <button
                    onClick={() => toggleSubMenu(item.id)}
                    className={`flex items-center justify-between w-full px-4 py-2 text-sm rounded-md ${
                      isParentActive 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-50'
                    }`}
                    aria-expanded={isSubMenuOpen}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSubMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isSubMenuOpen && (
                    <div className="pl-5 mt-1 space-y-1 border-l-2 border-sidebar-accent ml-2"> {/* Indentation for sub-items */}
                      {item.children.map((child) => {
                        if (child.permission && !hasPermission(child.permission.resource, child.permission.action)) {
                          return null;
                        }
                        const isChildActive = child.href && (location.pathname === child.href || location.pathname.startsWith(child.href + '/'));
                        return (
                          <Link
                            key={child.id}
                            to={child.href || '#'}
                            className={`flex items-center px-4 py-2 text-sm rounded-md ${
                              isChildActive 
                                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-50'
                            }`}
                          >
                            <child.icon className="w-4 h-4 mr-3 opacity-75" /> {/* Slightly muted child icon */}
                            {child.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            } else {
              // Regular item without children
              const isActive = item.href && (location.pathname === item.href || (item.href !== '/dashboard' && location.pathname.startsWith(item.href + '/')));
              return (
                <Link
                  key={item.id}
                  to={item.href || '#'}
                  className={`flex items-center px-4 py-2 text-sm rounded-md ${
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:bg-opacity-50'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            }
          })}
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Top navigation */}
        <header className="bg-white shadow-sm h-10 flex items-center px-4 ">
          <div className="flex justify-between items-center w-full">
            <button
              className="p-1 text-gray-400 rounded-md md:hidden"
              onClick={toggleSidebar}
            >
              <Menu size={24} />
            </button>
            <div className="flex-1 md:flex-initial"></div>
            <div className="flex items-center ml-4 space-x-3">
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 flex items-center space-x-2" size="sm">
                      <div className="w-8 h-8 overflow-hidden bg-gray-200 rounded-full">
                        <User className="w-5 h-5 mx-auto mt-1.5" />
                      </div>
                      <span>{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/my-info" className="cursor-pointer w-full">
                        <User className="w-4 h-4 mr-2" />
                        <span>My Info</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={logout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-gray-50">
          <div className="py-0 overflow-hidden">
            <div className="px-2 max-w-full overflow-hidden">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
