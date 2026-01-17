import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, User, FileText, Clock, RefreshCw } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

interface AuditLogEntry {
  id: string;
  action_type: string;
  actor_user_id: string;
  employee_id: string | null;
  project_id: string | null;
  time_entry_id: string | null;
  correction_request_id: string | null;
  details: Json;
  created_at: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
}

interface Project {
  id: string;
  project_name: string;
  project_code: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
}

const ACTION_TYPES = [
  // Time Entry actions (new format)
  'TIME_ENTRY_CREATE',
  'TIME_ENTRY_EDIT',
  'TIME_ENTRY_DELETE',
  'TIME_ENTRY_DELETE_REQUEST',
  'TIME_ENTRY_APPROVE',
  'TIME_ENTRY_REJECT',
  // Employee actions
  'EMPLOYEE_CREATE',
  'EMPLOYEE_EDIT',
  'EMPLOYEE_STATUS_CHANGE',
  'EMPLOYEE_ASSIGN_RECORDER',
  // Legacy action types (backward compatibility)
  'CREATE_ENTRY',
  'EDIT_ENTRY',
  'DELETE_ENTRY',
  'DELETE_REQUEST',
  'APPROVE',
  'REJECT',
] as const;

const PAGE_SIZE = 50;

// Get today's date in Europe/Athens timezone
function getTodayAthens(): string {
  const now = new Date();
  const athensDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Athens' }));
  return format(athensDate, 'yyyy-MM-dd');
}

export default function AuditLog() {
  const { t, language } = useLanguage();
  
  // Filter state
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const today = getTodayAthens();
    return new Date(today);
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const today = getTodayAthens();
    return new Date(today);
  });
  const [selectedUserId, setSelectedUserId] = useState<string>('__ALL__');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('__ALL__');
  const [selectedActionType, setSelectedActionType] = useState<string>('__ALL__');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('__ALL__');
  
  // Data state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load reference data on mount
  useEffect(() => {
    loadReferenceData();
    // Auto-load today's logs on mount
    handleSearch();
  }, []);

  async function loadReferenceData() {
    const [employeesRes, projectsRes, profilesRes] = await Promise.all([
      supabase.from('employees').select('id, first_name, last_name, employee_code').order('last_name'),
      supabase.from('projects').select('id, project_name, project_code').order('project_name'),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    
    if (employeesRes.data) setEmployees(employeesRes.data);
    if (projectsRes.data) setProjects(projectsRes.data);
    if (profilesRes.data) setUsers(profilesRes.data);
  }

  async function handleSearch(page = 1) {
    setLoading(true);
    setCurrentPage(page);
    
    try {
      // Build query with filters
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' });
      
      // Date range filter (required - defaults to today)
      if (dateFrom) {
        const fromStr = format(dateFrom, 'yyyy-MM-dd');
        query = query.gte('created_at', `${fromStr}T00:00:00+00:00`);
      }
      if (dateTo) {
        const toStr = format(dateTo, 'yyyy-MM-dd');
        query = query.lte('created_at', `${toStr}T23:59:59+00:00`);
      }
      
      // Optional filters (check for __ALL__ value which means no filter)
      if (selectedUserId && selectedUserId !== '__ALL__') {
        query = query.eq('actor_user_id', selectedUserId);
      }
      if (selectedEmployeeId && selectedEmployeeId !== '__ALL__') {
        query = query.eq('employee_id', selectedEmployeeId);
      }
      if (selectedActionType && selectedActionType !== '__ALL__') {
        query = query.eq('action_type', selectedActionType);
      }
      if (selectedProjectId && selectedProjectId !== '__ALL__') {
        query = query.eq('project_id', selectedProjectId);
      }
      
      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setLogs(data || []);
      setTotalCount(count || 0);
      setLastUpdated(new Date());
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    const today = new Date(getTodayAthens());
    setDateFrom(today);
    setDateTo(today);
    setSelectedUserId('__ALL__');
    setSelectedEmployeeId('__ALL__');
    setSelectedActionType('__ALL__');
    setSelectedProjectId('__ALL__');
    setCurrentPage(1);
  }

  // Lookup helpers
  const getUserName = (userId: string): string => {
    const user = users.find(u => u.user_id === userId);
    return user?.full_name || userId.substring(0, 8) + '...';
  };

  const getEmployeeName = (employeeId: string | null): string => {
    if (!employeeId) return '-';
    const employee = employees.find(e => e.id === employeeId);
    return employee ? `${employee.first_name} ${employee.last_name}` : '-';
  };

  const getProjectName = (projectId: string | null): string => {
    if (!projectId) return '-';
    const project = projects.find(p => p.id === projectId);
    return project?.project_name || '-';
  };

  const getActionBadgeVariant = (actionType: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (actionType) {
      case 'CREATE_ENTRY':
      case 'TIME_ENTRY_CREATE':
      case 'EMPLOYEE_CREATE':
        return 'default';
      case 'EDIT_ENTRY':
      case 'TIME_ENTRY_EDIT':
      case 'EMPLOYEE_EDIT':
      case 'EMPLOYEE_ASSIGN_RECORDER':
        return 'secondary';
      case 'DELETE_ENTRY':
      case 'DELETE_REQUEST':
      case 'TIME_ENTRY_DELETE':
      case 'TIME_ENTRY_DELETE_REQUEST':
        return 'destructive';
      case 'APPROVE':
      case 'TIME_ENTRY_APPROVE':
        return 'default';
      case 'REJECT':
      case 'TIME_ENTRY_REJECT':
        return 'outline';
      case 'EMPLOYEE_STATUS_CHANGE':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getActionLabel = (actionType: string): string => {
    const labels: Record<string, { en: string; el: string }> = {
      // Time Entry actions (new)
      'TIME_ENTRY_CREATE': { en: 'Time Entry Create', el: 'Δημιουργία Καταχώρησης' },
      'TIME_ENTRY_EDIT': { en: 'Time Entry Edit', el: 'Επεξεργασία Καταχώρησης' },
      'TIME_ENTRY_DELETE': { en: 'Time Entry Delete', el: 'Διαγραφή Καταχώρησης' },
      'TIME_ENTRY_DELETE_REQUEST': { en: 'Delete Request', el: 'Αίτηση Διαγραφής' },
      'TIME_ENTRY_APPROVE': { en: 'Approve', el: 'Έγκριση' },
      'TIME_ENTRY_REJECT': { en: 'Reject', el: 'Απόρριψη' },
      // Employee actions
      'EMPLOYEE_CREATE': { en: 'Employee Create', el: 'Δημιουργία Εργαζομένου' },
      'EMPLOYEE_EDIT': { en: 'Employee Edit', el: 'Επεξεργασία Εργαζομένου' },
      'EMPLOYEE_STATUS_CHANGE': { en: 'Status Change', el: 'Αλλαγή Κατάστασης' },
      'EMPLOYEE_ASSIGN_RECORDER': { en: 'Assign Recorder', el: 'Ανάθεση Καταγραφέα' },
      // Legacy
      'CREATE_ENTRY': { en: 'Create Entry', el: 'Δημιουργία' },
      'EDIT_ENTRY': { en: 'Edit Entry', el: 'Επεξεργασία' },
      'DELETE_ENTRY': { en: 'Delete Entry', el: 'Διαγραφή' },
      'DELETE_REQUEST': { en: 'Delete Request', el: 'Αίτηση Διαγραφής' },
      'APPROVE': { en: 'Approve', el: 'Έγκριση' },
      'REJECT': { en: 'Reject', el: 'Απόρριψη' },
    };
    return labels[actionType]?.[language] || actionType;
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {language === 'el' ? 'Ημερολόγιο Ελέγχου' : 'Audit Log'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'el' 
                ? 'Παρακολούθηση όλων των ενεργειών στο σύστημα' 
                : 'Track all system actions'}
            </p>
          </div>
          {lastUpdated && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {language === 'el' ? 'Τελευταία ενημέρωση' : 'Last updated'}: {format(lastUpdated, 'HH:mm:ss')}
            </div>
          )}
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              {language === 'el' ? 'Φίλτρα Αναζήτησης' : 'Search Filters'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Date From */}
              <div className="space-y-2">
                <Label>{t('common.from')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : language === 'el' ? 'Επιλέξτε' : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>{t('common.to')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : language === 'el' ? 'Επιλέξτε' : 'Select'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* User Filter */}
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Χρήστης' : 'User'}</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">{t('common.all')}</SelectItem>
                    {users.map(user => (
                      <SelectItem key={user.user_id} value={user.user_id}>
                        {user.full_name || user.user_id.substring(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Filter */}
              <div className="space-y-2">
                <Label>{t('nav.employees')}</Label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">{t('common.all')}</SelectItem>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} ({emp.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Type Filter */}
              <div className="space-y-2">
                <Label>{language === 'el' ? 'Τύπος Ενέργειας' : 'Action Type'}</Label>
                <Select value={selectedActionType} onValueChange={setSelectedActionType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">{t('common.all')}</SelectItem>
                    {ACTION_TYPES.map(action => (
                      <SelectItem key={action} value={action}>
                        {getActionLabel(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Project Filter */}
              <div className="space-y-2">
                <Label>{t('nav.projects')}</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">{t('common.all')}</SelectItem>
                    {projects.map(proj => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.project_name} ({proj.project_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <Button onClick={() => handleSearch(1)} disabled={loading}>
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                {t('common.search')}
              </Button>
              <Button variant="outline" onClick={resetFilters}>
                {language === 'el' ? 'Επαναφορά' : 'Reset'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {language === 'el' ? 'Αποτελέσματα' : 'Results'}
                {hasSearched && (
                  <Badge variant="secondary" className="ml-2">
                    {totalCount} {language === 'el' ? 'εγγραφές' : 'records'}
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!hasSearched ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'el' ? 'Κάντε κλικ στο "Αναζήτηση" για να δείτε τα αποτελέσματα' : 'Click "Search" to view results'}</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{language === 'el' ? 'Δεν υπάρχουν εγγραφές για σήμερα.' : 'No audit events for today.'}</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">{language === 'el' ? 'Ημερομηνία/Ώρα' : 'Date/Time'}</TableHead>
                        <TableHead className="w-[120px]">{language === 'el' ? 'Ενέργεια' : 'Action'}</TableHead>
                        <TableHead>{language === 'el' ? 'Χρήστης' : 'User'}</TableHead>
                        <TableHead>{language === 'el' ? 'Εργαζόμενος' : 'Employee'}</TableHead>
                        <TableHead>{language === 'el' ? 'Έργο' : 'Project'}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action_type)}>
                              {getActionLabel(log.action_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {getUserName(log.actor_user_id)}
                            </div>
                          </TableCell>
                          <TableCell>{getEmployeeName(log.employee_id)}</TableCell>
                          <TableCell>{getProjectName(log.project_id)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => currentPage > 1 && handleSearch(currentPage - 1)}
                            className={cn(currentPage === 1 && 'pointer-events-none opacity-50')}
                          />
                        </PaginationItem>
                        
                        {pageNumbers.map(page => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => handleSearch(page)}
                              isActive={page === currentPage}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => currentPage < totalPages && handleSearch(currentPage + 1)}
                            className={cn(currentPage === totalPages && 'pointer-events-none opacity-50')}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
