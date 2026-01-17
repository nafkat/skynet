import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Search, 
  Users, 
  Shield, 
  Clock, 
  Loader2,
  User,
  CheckCircle,
  XCircle,
  Lock,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AppRole = 'admin' | 'hr' | 'timekeeper';

interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
  full_name: string | null;
}

interface ModuleAccessRecord {
  module_key: string;
  can_access: boolean;
  name: string;
}

interface ActionPermissionRecord {
  action_key: string;
  allowed: boolean;
  description: string | null;
}

interface AuditLogRecord {
  id: string;
  actor_user_id: string;
  actor_email?: string;
  change_type: string;
  details: any;
  created_at: string;
}

export default function AdminConsole() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRole[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Selected user's permissions
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessRecord[]>([]);
  const [actionPermissions, setActionPermissions] = useState<ActionPermissionRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/home');
    }
  }, [authLoading, isAdmin, navigate]);

  // Fetch all users with roles
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get all user roles with profile info
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get profiles for names
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name');

      // We need to get emails from auth - but we can't directly query auth.users
      // So we'll use a workaround: store emails when they log in or use the profile
      // For now, we'll just use user_id and profile info
      
      const usersWithRoles: UserWithRole[] = (rolesData || []).map(role => {
        const profile = profilesData?.find(p => p.user_id === role.user_id);
        return {
          user_id: role.user_id,
          email: role.user_id.slice(0, 8) + '...', // Placeholder - we'll need to enhance this
          role: role.role as AppRole,
          full_name: profile?.full_name || null,
        };
      });

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης χρηστών' : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, fetchUsers]);

  // Filter users based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
      return;
    }
    const query = searchQuery.toLowerCase();
    setFilteredUsers(
      users.filter(u => 
        u.email.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, users]);

  // Fetch selected user's permissions
  const fetchUserPermissions = useCallback(async (userId: string) => {
    try {
      setPermissionsLoading(true);

      // Fetch modules with access status
      const { data: modulesData } = await supabase
        .from('modules')
        .select('key, name')
        .eq('is_active', true);

      const { data: userModules } = await supabase
        .from('user_module_access')
        .select('module_key, can_access')
        .eq('user_id', userId);

      const moduleAccessList: ModuleAccessRecord[] = (modulesData || []).map(m => {
        const access = userModules?.find(um => um.module_key === m.key);
        return {
          module_key: m.key,
          name: m.name,
          can_access: access?.can_access ?? false,
        };
      });
      setModuleAccess(moduleAccessList);

      // Fetch timekeeping actions with permissions
      const { data: actionsData } = await supabase
        .from('module_actions')
        .select('action_key, description')
        .eq('module_key', 'timekeeping');

      const { data: userActions } = await supabase
        .from('user_module_actions')
        .select('action_key, allowed')
        .eq('user_id', userId);

      const actionsList: ActionPermissionRecord[] = (actionsData || []).map(a => {
        const permission = userActions?.find(ua => ua.action_key === a.action_key);
        return {
          action_key: a.action_key,
          description: a.description,
          allowed: permission?.allowed ?? false,
        };
      });
      setActionPermissions(actionsList);

      // Fetch audit logs for this user
      const { data: logsData } = await supabase
        .from('permission_audit_logs')
        .select('*')
        .eq('target_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      // Get actor emails for audit logs
      const actorIds = [...new Set((logsData || []).map(l => l.actor_user_id))];
      const { data: actorProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', actorIds);

      const logsWithActors: AuditLogRecord[] = (logsData || []).map(log => ({
        ...log,
        actor_email: actorProfiles?.find(p => p.user_id === log.actor_user_id)?.full_name || log.actor_user_id.slice(0, 8),
      }));
      setAuditLogs(logsWithActors);

    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης δικαιωμάτων' : 'Failed to load permissions');
    } finally {
      setPermissionsLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (selectedUser) {
      fetchUserPermissions(selectedUser.user_id);
    }
  }, [selectedUser, fetchUserPermissions]);

  // Handle role change
  const handleRoleChange = async (newRole: AppRole) => {
    if (!selectedUser || !user) return;

    try {
      setSaving(true);
      const oldRole = selectedUser.role;

      // Update role in user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUser.user_id);

      if (roleError) throw roleError;

      // Initialize permissions based on new role
      const { error: initError } = await supabase.rpc('initialize_user_permissions', {
        _user_id: selectedUser.user_id,
        _role: newRole,
        _granted_by: user.id,
      });

      if (initError) throw initError;

      // Log the change
      const { error: logError } = await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'ROLE_CHANGE',
          details: { old_role: oldRole, new_role: newRole },
        });

      if (logError) console.error('Error logging role change:', logError);

      // Update local state
      setSelectedUser({ ...selectedUser, role: newRole });
      setUsers(users.map(u => 
        u.user_id === selectedUser.user_id ? { ...u, role: newRole } : u
      ));

      // Refresh permissions
      await fetchUserPermissions(selectedUser.user_id);

      toast.success(language === 'el' ? 'Ο ρόλος ενημερώθηκε επιτυχώς' : 'Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης ρόλου' : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  // Handle module access toggle
  const handleModuleAccessToggle = async (moduleKey: string, canAccess: boolean) => {
    if (!selectedUser || !user) return;
    
    // Check if this is locked for non-admin users
    if (selectedUser.role !== 'admin') {
      if (moduleKey === 'admin_console') {
        toast.error(language === 'el' ? 'Η πρόσβαση στην Κονσόλα Διαχειριστή είναι περιορισμένη από το σύστημα' : 'Admin Console access is system-restricted');
        return;
      }
      if (moduleKey === 'timekeeping' && !canAccess) {
        toast.error(language === 'el' ? 'Η πρόσβαση στο Χρονοκαταγραφή δεν μπορεί να απενεργοποιηθεί για αυτόν τον ρόλο' : 'Timekeeping access cannot be disabled for this role');
        return;
      }
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_module_access')
        .upsert({
          user_id: selectedUser.user_id,
          module_key: moduleKey,
          can_access: canAccess,
          granted_by: user.id,
        }, { onConflict: 'user_id,module_key' });

      if (error) throw error;

      // Log the change
      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'MODULE_ACCESS',
          details: { module_key: moduleKey, can_access: canAccess },
        });

      // Update local state
      setModuleAccess(moduleAccess.map(m =>
        m.module_key === moduleKey ? { ...m, can_access: canAccess } : m
      ));

      toast.success(language === 'el' ? 'Η πρόσβαση στο module ενημερώθηκε' : 'Module access updated');
    } catch (error) {
      console.error('Error updating module access:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης πρόσβασης' : 'Failed to update access');
    } finally {
      setSaving(false);
    }
  };

  // Handle action permission toggle
  const handleActionToggle = async (actionKey: string, allowed: boolean) => {
    if (!selectedUser || !user) return;

    // Check if this action is locked for timekeeper
    if (selectedUser.role === 'timekeeper') {
      const lockedActions = [
        'timekeeping.entries.approve_requests',
        'timekeeping.employees.manage',
        'timekeeping.projects.manage',
        'timekeeping.reports.export',
      ];
      if (lockedActions.includes(actionKey) && allowed) {
        toast.error(language === 'el' ? 'Αυτή η ενέργεια δεν είναι διαθέσιμη για τον ρόλο Χρονομέτρη' : 'This action is not available for Timekeeper role');
        return;
      }
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('user_module_actions')
        .upsert({
          user_id: selectedUser.user_id,
          action_key: actionKey,
          allowed: allowed,
          granted_by: user.id,
        }, { onConflict: 'user_id,action_key' });

      if (error) throw error;

      // Log the change
      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'ACTION_PERMISSION',
          details: { action_key: actionKey, allowed: allowed },
        });

      // Update local state
      setActionPermissions(actionPermissions.map(a =>
        a.action_key === actionKey ? { ...a, allowed: allowed } : a
      ));

      toast.success(language === 'el' ? 'Το δικαίωμα ενημερώθηκε' : 'Permission updated');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης δικαιώματος' : 'Failed to update permission');
    } finally {
      setSaving(false);
    }
  };

  // Check if module is locked for the selected user's role
  const isModuleLocked = (moduleKey: string): boolean => {
    if (!selectedUser) return false;
    if (selectedUser.role === 'admin') return false;
    // HR and Timekeeper: timekeeping is locked ON, admin_console is locked OFF
    return moduleKey === 'timekeeping' || moduleKey === 'admin_console';
  };

  // Check if action is locked for the selected user's role
  const isActionLocked = (actionKey: string): boolean => {
    if (!selectedUser) return false;
    if (selectedUser.role === 'admin' || selectedUser.role === 'hr') return false;
    // Timekeeper: certain actions are locked OFF
    const lockedActions = [
      'timekeeping.entries.approve_requests',
      'timekeeping.employees.manage',
      'timekeeping.projects.manage',
      'timekeeping.reports.export',
    ];
    return lockedActions.includes(actionKey);
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'default';
      case 'hr': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: AppRole) => {
    switch (role) {
      case 'admin': return language === 'el' ? 'Διαχειριστής' : 'Admin';
      case 'hr': return 'HR';
      case 'timekeeper': return language === 'el' ? 'Χρονομέτρης' : 'Timekeeper';
    }
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'ROLE_CHANGE': return language === 'el' ? 'Αλλαγή Ρόλου' : 'Role Change';
      case 'MODULE_ACCESS': return language === 'el' ? 'Πρόσβαση Module' : 'Module Access';
      case 'ACTION_PERMISSION': return language === 'el' ? 'Δικαίωμα Ενέργειας' : 'Action Permission';
      default: return type;
    }
  };

  const formatActionKey = (key: string) => {
    // Convert timekeeping.entries.view -> View entries
    const parts = key.split('.');
    if (parts.length >= 3) {
      const action = parts[2].replace(/_/g, ' ');
      const target = parts[1];
      return `${action.charAt(0).toUpperCase() + action.slice(1)} (${target})`;
    }
    return key;
  };

  if (authLoading || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Κονσόλα Διαχειριστή' : 'Admin Console'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Διαχείριση χρηστών, ρόλων και δικαιωμάτων' 
              : 'Manage users, roles, and permissions'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - User List */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {language === 'el' ? 'Χρήστες' : 'Users'}
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'el' ? 'Αναζήτηση...' : 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1 p-2">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.user_id}
                      onClick={() => setSelectedUser(u)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                        selectedUser?.user_id === u.user_id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      )}
                    >
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {u.full_name || u.email}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.email}
                        </p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(u.role)} className="shrink-0">
                        {getRoleLabel(u.role)}
                      </Badge>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      {language === 'el' ? 'Δεν βρέθηκαν χρήστες' : 'No users found'}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Right Panel - User Details */}
          <Card className="lg:col-span-2">
            {selectedUser ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedUser.full_name || selectedUser.email}
                      </CardTitle>
                      <CardDescription>{selectedUser.email}</CardDescription>
                    </div>
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)} className="text-sm px-3 py-1">
                      {getRoleLabel(selectedUser.role)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="profile" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="profile" className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {language === 'el' ? 'Προφίλ' : 'Profile'}
                      </TabsTrigger>
                      <TabsTrigger value="access" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        {language === 'el' ? 'Πρόσβαση' : 'Access Control'}
                      </TabsTrigger>
                      <TabsTrigger value="audit" className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {language === 'el' ? 'Ιστορικό' : 'Audit'}
                      </TabsTrigger>
                    </TabsList>

                    {/* Profile Tab */}
                    <TabsContent value="profile" className="space-y-6 pt-4">
                      <div className="space-y-4">
                        <div>
                          <Label>{language === 'el' ? 'Όνομα' : 'Name'}</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedUser.full_name || (language === 'el' ? 'Δεν έχει οριστεί' : 'Not set')}
                          </p>
                        </div>
                        <div>
                          <Label>{language === 'el' ? 'Email' : 'Email'}</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {selectedUser.email}
                          </p>
                        </div>
                        <Separator />
                        <div>
                          <Label htmlFor="role-select">{language === 'el' ? 'Ρόλος' : 'Role'}</Label>
                          <Select
                            value={selectedUser.role}
                            onValueChange={(value) => handleRoleChange(value as AppRole)}
                            disabled={saving || selectedUser.user_id === user?.id}
                          >
                            <SelectTrigger id="role-select" className="mt-2">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                {language === 'el' ? 'Διαχειριστής' : 'Admin'}
                              </SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                              <SelectItem value="timekeeper">
                                {language === 'el' ? 'Χρονομέτρης' : 'Timekeeper'}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          {selectedUser.user_id === user?.id && (
                            <p className="text-xs text-muted-foreground mt-2">
                              {language === 'el' 
                                ? 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο' 
                                : 'You cannot change your own role'}
                            </p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* Access Control Tab */}
                    <TabsContent value="access" className="space-y-6 pt-4">
                      {permissionsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : (
                        <>
                          {/* Module Access Section */}
                          <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              {language === 'el' ? 'Πρόσβαση Modules' : 'Module Access'}
                            </h3>
                            <div className="space-y-3">
                              {moduleAccess.map((module) => {
                                const locked = isModuleLocked(module.module_key);
                                return (
                                  <div
                                    key={module.module_key}
                                    className={cn(
                                      'flex items-center justify-between p-3 rounded-lg border',
                                      locked ? 'bg-muted/50' : 'bg-card'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      {module.can_access ? (
                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-muted-foreground" />
                                      )}
                                      <span className="font-medium">{module.name}</span>
                                      {locked && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Lock className="h-4 w-4 text-muted-foreground" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {language === 'el' 
                                              ? 'Περιορισμένο από πολιτική συστήματος' 
                                              : 'Restricted by system policy'}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <Switch
                                      checked={module.can_access}
                                      onCheckedChange={(checked) => handleModuleAccessToggle(module.module_key, checked)}
                                      disabled={saving || locked}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <Separator />

                          {/* Timekeeping Actions Section */}
                          <div>
                            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                              <Clock className="h-4 w-4" />
                              {language === 'el' ? 'Ενέργειες Χρονοκαταγραφής' : 'Timekeeping Actions'}
                            </h3>
                            <div className="space-y-2">
                              {actionPermissions.map((action) => {
                                const locked = isActionLocked(action.action_key);
                                return (
                                  <div
                                    key={action.action_key}
                                    className={cn(
                                      'flex items-center justify-between p-3 rounded-lg border',
                                      locked ? 'bg-muted/50 opacity-60' : 'bg-card'
                                    )}
                                  >
                                    <div className="flex items-center gap-3">
                                      {action.allowed ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <div>
                                        <span className="text-sm font-medium">
                                          {formatActionKey(action.action_key)}
                                        </span>
                                        {action.description && (
                                          <p className="text-xs text-muted-foreground">
                                            {action.description}
                                          </p>
                                        )}
                                      </div>
                                      {locked && (
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Lock className="h-4 w-4 text-muted-foreground" />
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {language === 'el' 
                                              ? 'Μη διαθέσιμο για αυτόν τον ρόλο' 
                                              : 'Not available for this role'}
                                          </TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                    <Switch
                                      checked={action.allowed}
                                      onCheckedChange={(checked) => handleActionToggle(action.action_key, checked)}
                                      disabled={saving || locked}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Info Box */}
                          <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                              <p className="font-medium mb-1">
                                {language === 'el' ? 'Πολιτικές Ρόλων' : 'Role Policies'}
                              </p>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>
                                  {language === 'el' 
                                    ? 'Οι Admin έχουν πλήρη πρόσβαση σε όλα τα modules και ενέργειες' 
                                    : 'Admins have full access to all modules and actions'}
                                </li>
                                <li>
                                  {language === 'el' 
                                    ? 'Οι HR & Timekeeper έχουν μόνο πρόσβαση στο Timekeeping' 
                                    : 'HR & Timekeeper only have access to Timekeeping'}
                                </li>
                                <li>
                                  {language === 'el' 
                                    ? 'Οι Timekeeper έχουν περιορισμένες ενέργειες' 
                                    : 'Timekeepers have limited actions'}
                                </li>
                              </ul>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>

                    {/* Audit Tab */}
                    <TabsContent value="audit" className="pt-4">
                      {permissionsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                      ) : auditLogs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          {language === 'el' ? 'Δεν υπάρχει ιστορικό' : 'No audit history'}
                        </p>
                      ) : (
                        <ScrollArea className="h-[400px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>{language === 'el' ? 'Ημερομηνία' : 'Date'}</TableHead>
                                <TableHead>{language === 'el' ? 'Ενεργών' : 'Actor'}</TableHead>
                                <TableHead>{language === 'el' ? 'Τύπος' : 'Type'}</TableHead>
                                <TableHead>{language === 'el' ? 'Λεπτομέρειες' : 'Details'}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {auditLogs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs">
                                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm')}
                                  </TableCell>
                                  <TableCell className="text-xs">
                                    {log.actor_email}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {getChangeTypeLabel(log.change_type)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs max-w-[200px] truncate">
                                    {JSON.stringify(log.details)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {language === 'el' 
                    ? 'Επιλέξτε έναν χρήστη για να δείτε τα δικαιώματά του' 
                    : 'Select a user to view their permissions'}
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
