import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Search, 
  Loader2,
  ClipboardList,
  RefreshCw,
  Filter
} from 'lucide-react';

interface AuditLogRecord {
  id: string;
  actor_user_id: string;
  actor_email?: string;
  target_user_id: string;
  target_email?: string;
  change_type: string;
  details: any;
  created_at: string;
}

export default function AdminAudit() {
  const { language } = useLanguage();
  
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch audit logs
      const { data: logsData, error } = await supabase
        .from('permission_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set([
        ...(logsData || []).map(l => l.actor_user_id),
        ...(logsData || []).map(l => l.target_user_id),
      ])];

      // Fetch user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, display_name')
        .in('user_id', userIds);

      const getUserName = (userId: string) => {
        const profile = profiles?.find(p => p.user_id === userId);
        return profile?.full_name || profile?.display_name || userId.slice(0, 8) + '...';
      };

      const logsWithNames: AuditLogRecord[] = (logsData || []).map(log => ({
        ...log,
        actor_email: getUserName(log.actor_user_id),
        target_email: getUserName(log.target_user_id),
      }));

      setLogs(logsWithNames);
      setFilteredLogs(logsWithNames);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης' : 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs
  useEffect(() => {
    let filtered = logs;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.actor_email?.toLowerCase().includes(query) ||
        log.target_email?.toLowerCase().includes(query) ||
        log.change_type.toLowerCase().includes(query) ||
        JSON.stringify(log.details).toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(log => log.change_type === typeFilter);
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery, typeFilter]);

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'ROLE_CHANGE': return language === 'el' ? 'Αλλαγή Ρόλου' : 'Role Change';
      case 'MODULE_ACCESS': return language === 'el' ? 'Πρόσβαση Module' : 'Module Access';
      case 'ACTION_PERMISSION': return language === 'el' ? 'Δικαίωμα Ενέργειας' : 'Action Permission';
      case 'TEMPLATE_APPLIED': return language === 'el' ? 'Εφαρμογή Ρόλου' : 'Role Applied';
      case 'TEMPLATE_ASSIGNED': return language === 'el' ? 'Ανάθεση Ρόλου' : 'Role Assigned';
      case 'TEMPLATE_REMOVED': return language === 'el' ? 'Αφαίρεση Ρόλου' : 'Role Removed';
      case 'PROFILE_NAME_CHANGE': return language === 'el' ? 'Αλλαγή Ονόματος' : 'Name Change';
      case 'USER_INVITED': return language === 'el' ? 'Πρόσκληση Χρήστη' : 'User Invited';
      case 'USER_ACTIVATED': return language === 'el' ? 'Ενεργοποίηση' : 'User Activated';
      case 'USER_DEACTIVATED': return language === 'el' ? 'Απενεργοποίηση' : 'User Deactivated';
      case 'INVITE_RESENT': return language === 'el' ? 'Επαναποστολή Πρόσκλησης' : 'Invite Resent';
      default: return type;
    }
  };

  const getChangeTypeBadgeVariant = (type: string): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (type) {
      case 'ROLE_CHANGE': return 'default';
      case 'MODULE_ACCESS': return 'secondary';
      case 'ACTION_PERMISSION': return 'outline';
      case 'TEMPLATE_APPLIED': return 'default';
      case 'TEMPLATE_ASSIGNED': return 'default';
      case 'TEMPLATE_REMOVED': return 'destructive';
      case 'PROFILE_NAME_CHANGE': return 'secondary';
      case 'USER_INVITED': return 'default';
      case 'USER_ACTIVATED': return 'default';
      case 'USER_DEACTIVATED': return 'destructive';
      case 'INVITE_RESENT': return 'secondary';
      default: return 'outline';
    }
  };

  const formatDetails = (details: any) => {
    if (!details) return '-';
    
    // Role change
    if (details.old_role && details.new_role) {
      return `${details.old_role} → ${details.new_role}`;
    }
    // Module access
    if (details.module_key !== undefined) {
      return `${details.module_key}: ${details.can_access ? '✓' : '✗'}`;
    }
    // Action permission
    if (details.action_key !== undefined) {
      return `${details.action_key.split('.').pop()}: ${details.allowed ? '✓' : '✗'}`;
    }
    // Template applied/assigned/removed
    if (details.template_name) {
      return details.template_name;
    }
    // Name change
    if (details.old_name !== undefined && details.new_name !== undefined) {
      return `${details.old_name || '(empty)'} → ${details.new_name}`;
    }
    // User invited
    if (details.invited_email) {
      return `${details.invited_email} (${details.invited_role || 'employee'})`;
    }
    // Status change (activated/deactivated)
    if (details.action === 'STATUS_CHANGE' || details.is_active !== undefined) {
      return details.is_active 
        ? (language === 'el' ? 'Ενεργοποιήθηκε' : 'Activated')
        : (language === 'el' ? 'Απενεργοποιήθηκε' : 'Deactivated');
    }
    // Invite resent
    if (details.resent_to) {
      return details.resent_to;
    }
    
    return JSON.stringify(details);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Ημερολόγιο Ελέγχου' : 'Audit Log'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Ιστορικό αλλαγών δικαιωμάτων και ρόλων' 
              : 'History of permission and role changes'}
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Ανανέωση' : 'Refresh'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {language === 'el' ? 'Φίλτρα' : 'Filters'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={language === 'el' ? 'Τύπος' : 'Type'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {language === 'el' ? 'Όλα' : 'All'}
                </SelectItem>
                <SelectItem value="ROLE_CHANGE">
                  {language === 'el' ? 'Αλλαγή Ρόλου' : 'Role Change'}
                </SelectItem>
                <SelectItem value="MODULE_ACCESS">
                  {language === 'el' ? 'Πρόσβαση Module' : 'Module Access'}
                </SelectItem>
                <SelectItem value="ACTION_PERMISSION">
                  {language === 'el' ? 'Δικαίωμα Ενέργειας' : 'Action Permission'}
                </SelectItem>
                <SelectItem value="TEMPLATE_APPLIED">
                  {language === 'el' ? 'Εφαρμογή Ρόλου' : 'Role Applied'}
                </SelectItem>
                <SelectItem value="TEMPLATE_ASSIGNED">
                  {language === 'el' ? 'Ανάθεση Ρόλου' : 'Role Assigned'}
                </SelectItem>
                <SelectItem value="TEMPLATE_REMOVED">
                  {language === 'el' ? 'Αφαίρεση Ρόλου' : 'Role Removed'}
                </SelectItem>
                <SelectItem value="PROFILE_NAME_CHANGE">
                  {language === 'el' ? 'Αλλαγή Ονόματος' : 'Name Change'}
                </SelectItem>
                <SelectItem value="USER_INVITED">
                  {language === 'el' ? 'Πρόσκληση Χρήστη' : 'User Invited'}
                </SelectItem>
                <SelectItem value="USER_ACTIVATED">
                  {language === 'el' ? 'Ενεργοποίηση' : 'User Activated'}
                </SelectItem>
                <SelectItem value="USER_DEACTIVATED">
                  {language === 'el' ? 'Απενεργοποίηση' : 'User Deactivated'}
                </SelectItem>
                <SelectItem value="INVITE_RESENT">
                  {language === 'el' ? 'Επαναποστολή Πρόσκλησης' : 'Invite Resent'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">
                    {language === 'el' ? 'Ημερομηνία' : 'Date'}
                  </TableHead>
                  <TableHead>
                    {language === 'el' ? 'Ενεργών' : 'Actor'}
                  </TableHead>
                  <TableHead>
                    {language === 'el' ? 'Στόχος' : 'Target'}
                  </TableHead>
                  <TableHead className="w-[150px]">
                    {language === 'el' ? 'Τύπος' : 'Type'}
                  </TableHead>
                  <TableHead>
                    {language === 'el' ? 'Λεπτομέρειες' : 'Details'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {language === 'el' ? 'Δεν βρέθηκαν εγγραφές' : 'No records found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {log.actor_email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.target_email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getChangeTypeBadgeVariant(log.change_type)}>
                          {getChangeTypeLabel(log.change_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {formatDetails(log.details)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
