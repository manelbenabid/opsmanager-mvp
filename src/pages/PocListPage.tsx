import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  getPocs, 
  PocListItem, 
  getPocStatuses 
} from '../services/api'; 
import AppLayout from '../components/AppLayout';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Plus, 
  Search, 
  Clock, 
  Users,
  UserCheck,
  CalendarDays, 
  Loader2,
  CheckCircle2,
  XCircle,
  Archive, 
  Building, 
  Settings2 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"; // Import Tabs
import { Textarea } from "@/components/ui/textarea";

const statusColors: { [key: string]: string } = {
  default: 'bg-gray-100 text-gray-700 border-gray-300',
  'account manager coordinated with tech lead': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  'tech lead reached the customer': 'bg-teal-100 text-teal-700 border-teal-300',
  'tech lead assigned engineering team': 'bg-sky-100 text-sky-700 border-sky-300',
  'kickoff is done and scope is defined': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  'in progress': 'bg-blue-100 text-blue-700 border-blue-300',
  'customer pending': 'bg-orange-100 text-orange-700 border-orange-300',
  'taqniyat pending': 'bg-pink-100 text-pink-700 border-pink-300',
  done: 'bg-green-100 text-green-700 border-green-300',
  failed: 'bg-red-100 text-red-700 border-red-300',
};

const statusIcons: { [key: string]: React.ElementType } = {
  default: Clock,
  'account manager coordinated with tech lead': UserCheck,
  'tech lead reached the customer': Users,
  'tech lead assigned engineering team': Users,
  'kickoff is done and scope is defined': CalendarDays,
  'in progress': Loader2, 
  'customer pending': Clock,
  'taqniyat pending': Clock,
  done: CheckCircle2,
  failed: XCircle,
};


const PocListPage: React.FC = () => {
  const { hasPermission, hasRole, user } = useAuth();
  const [pocs, setPocs] = useState<PocListItem[]>([]); 
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([]);
  const [loadingEnums, setLoadingEnums] = useState(true);
  const [view, setView] = useState('active');


  const fetchPocData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPocs();
      setPocs(data);
    } catch (error) {
      console.error('Error fetching POCs:', error);
      toast.error("Failed to load POCs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  
  const loadPocStatuses = useCallback(async () => {
    try {
      setLoadingEnums(true);
      const statuses = await getPocStatuses();
      setAvailableStatuses(statuses);
    } catch (error) {
      console.error("Failed to load PoC statuses", error);
      toast.error("Could not load status filter options.");
    } finally {
      setLoadingEnums(false);
    }
  }, []);

  useEffect(() => {
    loadPocStatuses();
    fetchPocData();
  }, [loadPocStatuses, fetchPocData]);

  const normalizeStatusKey = (status?: string | null): string => { // Accept potentially undefined/null status
    if (typeof status === 'string' && status.trim() !== '') {
      return status.toLowerCase().replace(/&/g, 'and').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return 'default'; // Fallback to 'default' key if status is not a valid non-empty string
  };

  const filteredPocs = pocs.filter(poc => {
        const searchVal = searchTerm.toLowerCase();
        
        // Search filter (remains the same)
        const matchesSearch = 
          poc.title.toLowerCase().includes(searchVal) ||
          (poc.customerName && poc.customerName.toLowerCase().includes(searchVal)) ||
          (poc.technology && poc.technology.some(tech => tech.toLowerCase().includes(searchVal))) ||
          (poc.leadName && poc.leadName.toLowerCase().includes(searchVal)) ||
          (poc.amName && poc.amName.toLowerCase().includes(searchVal));
        
        // Status dropdown filter (remains the same)
        const normalizedStatusFilter = statusFilter === 'all' ? 'all' : normalizeStatusKey(statusFilter);
        const normalizedPocStatus = normalizeStatusKey(poc.status || '');
        const matchesStatus = normalizedStatusFilter === 'all' || normalizedPocStatus === normalizedStatusFilter;
    
        // Tab view filter (this is the new logic)
        const isCompleted = normalizedPocStatus === 'done' || normalizedPocStatus === 'failed';
        let matchesView = false;
        switch(view) {
            case 'active':
                matchesView = !isCompleted && poc.workflow_status === 'active';
                break;
            case 'completed':
                matchesView = isCompleted;
                break;
            case 'pending':
                matchesView = poc.workflow_status === 'pending_presales_review';
                break;
            default:
                matchesView = true; // Fallback, should not happen
        }
        
        return matchesSearch && matchesStatus && matchesView;
      });


  if (loading || loadingEnums) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-150px)]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-800">Proof of Concepts</h1>
            <p className="text-gray-500">Manage and track all POC projects.</p>
          </div>
          {hasPermission('poc', 'create') && (
            <Link to="/pocs/create">
              <Button className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                New POC
              </Button>
            </Link>
          )}
        </div>

        <div className="mb-6">
            <Tabs value={view} onValueChange={setView}>
                <TabsList>
                    <TabsTrigger value="active">Active POCs</TabsTrigger>
                    {/* Assuming the role for Account Manager is 'account_manager' */}
                    {hasRole(['admin', 'presales', 'account_manager']) && (
                        <TabsTrigger value="pending">Pending Review</TabsTrigger>
                    )}
                    <TabsTrigger value="completed">Completed POCs</TabsTrigger>
                </TabsList>
            </Tabs>
        </div>



        <Card className="mb-6 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="pocSearch" // Added id
                  name="pocSearch" // Added name
                  placeholder="Search by title, customer, technology, lead, AM..."
                  className="pl-12 pr-4 py-2.5 text-base rounded-md"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="w-full md:w-60">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger id="statusFilter" name="statusFilter" className="py-2.5 text-base">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {availableStatuses.map(status => (
                      <SelectItem key={status} value={status}>
                        {status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredPocs.length === 0 ? (
          <Card className="shadow">
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">No POCs Found</h3>
              <p className="text-gray-500 max-w-md mx-auto mt-2">
                {searchTerm || statusFilter !== 'all'
                  ? "Try adjusting your search or filter criteria."
                  : "No proof of concepts have been created yet."}
              </p>
              {hasPermission('poc', 'create') && !searchTerm && statusFilter === 'all' && (
                <Link to="/pocs/create">
                  <Button className="mt-6 bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First POC
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPocs.map((poc) => {
              const isPending = poc.workflow_status === 'pending_presales_review';
              const pocStatusDisplay = poc.status || 'default'; // Ensure status is never null/undefined for display
              const normalizedStatusKey = normalizeStatusKey(pocStatusDisplay);
              const StatusIconComponent = statusIcons[normalizedStatusKey] || statusIcons.default;
              const statusColorClass = statusColors[normalizedStatusKey] || statusColors.default;
              
              return (
                <Link key={poc.id} to={`/pocs/${poc.id}`} className="block hover:no-underline">
                  <Card 
                    className={`transition-all duration-300 h-full flex flex-col overflow-hidden rounded-lg border 
                    ${isPending 
                      ? 'bg-amber-50 border-amber-400 hover:shadow-lg hover:border-amber-500' 
                      : 'hover:shadow-xl hover:border-indigo-300'
                    }`}
                  >
                    <CardHeader className="pb-3 pt-5 px-5">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-2 mr-2 min-w-0">
                            <StatusIconComponent className={`h-5 w-5 ${statusIcons[normalizedStatusKey] === Loader2 ? 'animate-spin' : ''} ${statusColorClass.split(' ')[1] || 'text-gray-500'} flex-shrink-0`} />
                            <CardTitle className="text-lg font-semibold text-gray-800 line-clamp-2 leading-tight truncate">
                              {poc.title}
                            </CardTitle>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="outline" 
                          className={`${statusColorClass} px-2.5 py-1 text-xs whitespace-nowrap flex-shrink-0`}
                        >
                          {pocStatusDisplay.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())}
                        </Badge>
                      </div>
                      
                      {/* "Pending" Badge */}
                      {isPending && (
                        <Badge variant="outline" className="mt-2 bg-amber-100 text-amber-800 border-amber-300">
                          Pending Presales Review
                        </Badge>
                      )}


                      {poc.customerName && (
                        <p className="text-sm text-indigo-600 font-medium pt-2 flex items-center">
                          <Building className="inline w-4 h-4 mr-1.5 opacity-70 flex-shrink-0" />
                          <span className="truncate">{poc.customerName}</span>
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-3 text-sm text-gray-600 flex-grow"> 
                      <div className="flex items-center">
                      <Settings2 className="w-4 h-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {poc.technology && poc.technology.length > 0 ? (
                            poc.technology.map(tech => (
                              <Badge key={tech} variant="secondary" className="font-medium">
                                {tech}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <UserCheck className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                        TL: <span className="font-medium ml-1 truncate">{poc.leadName || 'N/A'}</span> 
                      </div>
                       <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" /> 
                        AM: <span className="font-medium ml-1 truncate">{poc.amName || 'N/A'}</span> 
                      </div>
                    </CardContent>
                    <CardFooter className="bg-gray-50 px-5 py-3 text-xs text-gray-500 border-t">
                      <div className="flex justify-between w-full">
                        <span className="truncate">
                          Start: {poc.startDate ? format(parseISO(poc.startDate), "MMM d, yy") : 'N/A'}
                        </span>
                        <span className="truncate ml-2"> 
                          End: {poc.endDate ? format(parseISO(poc.endDate), "MMM d, yy") : 'N/A'}
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

export default PocListPage;
