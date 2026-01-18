import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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
  Info,
  UserPlus,
  Power,
  FileStack,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type AppRole = 'admin' | 'hr' | 'timekeeper'; // Legacy for display
type BaseRole = 'admin' | 'employee'; // New base roles

interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
  full_name: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string | null;
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

interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const { language } = useLanguage();
  
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

  // Invite user modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBaseRole, setInviteBaseRole] = useState<BaseRole>('employee');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteTemplateIds, setInviteTemplateIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Apply template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [overwritePermissions, setOverwritePermissions] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Fetch all users with roles
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users_with_profiles');

      if (error) throw error;

      const usersWithRoles: UserWithRole[] = (data || []).map((u: any) => ({
        user_id: u.user_id,
        email: u.email || u.user_id.slice(0, 8) + '...',
        role: (u.role as AppRole) || 'timekeeper',
        full_name: u.full_name,
        display_name: u.display_name,
        is_active: u.is_active ?? true,
        created_at: u.created_at,
      }));

      setUsers(usersWithRoles);
      setFilteredUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης χρηστών' : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

      // Get actor names
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

  // Fetch templates for apply modal
  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('permission_templates')
      .select('id, name, description')
      .order('name');
    setTemplates(data || []);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Handle role change
  const handleRoleChange = async (newRole: AppRole) => {
    if (!selectedUser || !user) return;
    
    if (selectedUser.user_id === user.id) {
      toast.error(language === 'el' ? 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο' : 'You cannot change your own role');
      return;
    }

    try {
      setSaving(true);
      const oldRole = selectedUser.role;

      const { error: roleError } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', selectedUser.user_id);

      if (roleError) throw roleError;

      const { error: initError } = await supabase.rpc('initialize_user_permissions', {
        _user_id: selectedUser.user_id,
        _role: newRole,
        _granted_by: user.id,
      });

      if (initError) throw initError;

      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'ROLE_CHANGE',
          details: { old_role: oldRole, new_role: newRole },
        });

      setSelectedUser({ ...selectedUser, role: newRole });
      setUsers(users.map(u => 
        u.user_id === selectedUser.user_id ? { ...u, role: newRole } : u
      ));

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
    
    if (selectedUser.role !== 'admin') {
      if (moduleKey === 'admin_console') {
        toast.error(language === 'el' ? 'Η πρόσβαση στην Κονσόλα Διαχειριστή είναι περιορισμένη' : 'Admin Console access is restricted');
        return;
      }
      if (moduleKey === 'timekeeping' && !canAccess) {
        toast.error(language === 'el' ? 'Η πρόσβαση στο Χρονοκαταγραφή δεν μπορεί να απενεργοποιηθεί' : 'Timekeeping access cannot be disabled');
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

      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'MODULE_ACCESS',
          details: { module_key: moduleKey, can_access: canAccess },
        });

      setModuleAccess(moduleAccess.map(m =>
        m.module_key === moduleKey ? { ...m, can_access: canAccess } : m
      ));

      toast.success(language === 'el' ? 'Η πρόσβαση ενημερώθηκε' : 'Access updated');
    } catch (error) {
      console.error('Error updating module access:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Handle action permission toggle
  const handleActionToggle = async (actionKey: string, allowed: boolean) => {
    if (!selectedUser || !user) return;

    if (selectedUser.role === 'timekeeper') {
      const lockedActions = [
        'timekeeping.entries.approve_requests',
        'timekeeping.employees.manage',
        'timekeeping.projects.manage',
        'timekeeping.reports.export',
      ];
      if (lockedActions.includes(actionKey) && allowed) {
        toast.error(language === 'el' ? 'Αυτή η ενέργεια δεν είναι διαθέσιμη για τον ρόλο Χρονομέτρη' : 'Not available for Timekeeper role');
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

      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'ACTION_PERMISSION',
          details: { action_key: actionKey, allowed: allowed },
        });

      setActionPermissions(actionPermissions.map(a =>
        a.action_key === actionKey ? { ...a, allowed: allowed } : a
      ));

      toast.success(language === 'el' ? 'Το δικαίωμα ενημερώθηκε' : 'Permission updated');
    } catch (error) {
      console.error('Error updating permission:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Apply template
  const handleApplyTemplate = async () => {
    if (!selectedUser || !user || !selectedTemplateId) return;

    try {
      setApplyingTemplate(true);

      // Fetch template config
      const { data: templateModules } = await supabase
        .from('permission_template_modules')
        .select('module_key, can_access')
        .eq('template_id', selectedTemplateId);

      const { data: templateActions } = await supabase
        .from('permission_template_actions')
        .select('action_key, allowed')
        .eq('template_id', selectedTemplateId);

      // Apply module access
      for (const tm of templateModules || []) {
        // Enforce role restrictions
        let canAccess = tm.can_access;
        if (selectedUser.role !== 'admin') {
          if (tm.module_key === 'admin_console' || tm.module_key === 'procurement') {
            canAccess = false;
          }
          if (tm.module_key === 'timekeeping') {
            canAccess = true;
          }
        }

        await supabase
          .from('user_module_access')
          .upsert({
            user_id: selectedUser.user_id,
            module_key: tm.module_key,
            can_access: canAccess,
            granted_by: user.id,
          }, { onConflict: 'user_id,module_key' });
      }

      // Apply action permissions
      for (const ta of templateActions || []) {
        // Enforce role restrictions for timekeeper
        let allowed = ta.allowed;
        if (selectedUser.role === 'timekeeper') {
          const lockedActions = [
            'timekeeping.entries.approve_requests',
            'timekeeping.employees.manage',
            'timekeeping.projects.manage',
            'timekeeping.reports.export',
          ];
          if (lockedActions.includes(ta.action_key)) {
            allowed = false;
          }
        }

        await supabase
          .from('user_module_actions')
          .upsert({
            user_id: selectedUser.user_id,
            action_key: ta.action_key,
            allowed: allowed,
            granted_by: user.id,
          }, { onConflict: 'user_id,action_key' });
      }

      // Log the change
      const template = templates.find(t => t.id === selectedTemplateId);
      await supabase
        .from('permission_audit_logs')
        .insert({
          actor_user_id: user.id,
          target_user_id: selectedUser.user_id,
          change_type: 'TEMPLATE_APPLIED',
          details: { template_id: selectedTemplateId, template_name: template?.name },
        });

      toast.success(language === 'el' ? 'Ο ρόλος εφαρμόστηκε' : 'Role applied');
      setShowTemplateModal(false);
      await fetchUserPermissions(selectedUser.user_id);
    } catch (error) {
      console.error('Error applying template:', error);
      toast.error(language === 'el' ? 'Αποτυχία εφαρμογής' : 'Failed to apply role');
    } finally {
      setApplyingTemplate(false);
    }
  };

  // Check if module is locked
  const isModuleLocked = (moduleKey: string): boolean => {
    if (!selectedUser) return false;
    if (selectedUser.role === 'admin') return false;
    return moduleKey === 'timekeeping' || moduleKey === 'admin_console' || moduleKey === 'procurement';
  };

  // Check if action is locked
  const isActionLocked = (actionKey: string): boolean => {
    if (!selectedUser) return false;
    if (selectedUser.role === 'admin' || selectedUser.role === 'hr') return false;
    const lockedActions = [
      'timekeeping.entries.approve_requests',
      'timekeeping.employees.manage',
      'timekeeping.projects.manage',
      'timekeeping.reports.export',
    ];
    return lockedActions.includes(actionKey);
  };

  // Handle invite user
  const handleInviteUser = async () => {
    if (!user || !inviteEmail.trim()) return;

    try {
      setInviting(true);

      const { data, error } = await supabase.functions.invoke('invite_user', {
        body: {
          email: inviteEmail.trim(),
          base_role: inviteBaseRole,
          display_name: inviteDisplayName.trim() || undefined,
          template_ids: inviteTemplateIds.filter(id => id !== 'none'),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(language === 'el' ? 'Πρόσκληση εστάλη επιτυχώς' : 'Invitation sent successfully');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteBaseRole('employee');
      setInviteDisplayName('');
      setInviteTemplateIds([]);
      
      await fetchUsers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποστολής πρόσκλησης' : 'Failed to send invitation'));
    } finally {
      setInviting(false);
    }
  };

  // Toggle template selection for invite
  const toggleInviteTemplate = (templateId: string) => {
    setInviteTemplateIds(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      }
      return [...prev, templateId];
    });
  };

  // Handle toggle user active status
  const handleToggleActive = async () => {
    if (!selectedUser || !user) return;
    
    if (selectedUser.user_id === user.id) {
      toast.error(language === 'el' ? 'Δεν μπορείτε να απενεργοποιήσετε τον εαυτό σας' : 'You cannot deactivate yourself');
      return;
    }

    try {
      setSaving(true);
      const newStatus = !selectedUser.is_active;

      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newStatus })
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      await supabase.from('permission_audit_logs').insert({
        actor_user_id: user.id,
        target_user_id: selectedUser.user_id,
        change_type: 'ROLE_CHANGE',
        details: { action: 'STATUS_CHANGE', is_active: newStatus },
      });

      const updatedUser = { ...selectedUser, is_active: newStatus };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => 
        u.user_id === selectedUser.user_id ? updatedUser : u
      ));

      toast.success(
        newStatus
          ? (language === 'el' ? 'Ο χρήστης ενεργοποιήθηκε' : 'User activated')
          : (language === 'el' ? 'Ο χρήστης απενεργοποιήθηκε' : 'User deactivated')
      );
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error(language === 'el' ? 'Αποτυχία ενημέρωσης' : 'Failed to update');
    } finally {
      setSaving(false);
    }
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
      case 'TEMPLATE_APPLIED': return language === 'el' ? 'Εφαρμογή Ρόλου' : 'Role Applied';
      default: return type;
    }
  };

  const formatActionKey = (key: string) => {
    const parts = key.split('.');
    if (parts.length >= 3) {
      const action = parts[2].replace(/_/g, ' ');
      const target = parts[1];
      return `${action.charAt(0).toUpperCase() + action.slice(1)} (${target})`;
    }
    return key;
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === 'el' ? 'Διαχείριση Χρηστών' : 'User Management'}
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
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                {language === 'el' ? 'Χρήστες' : 'Users'}
              </CardTitle>
              <Button size="sm" onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                {language === 'el' ? 'Πρόσκληση' : 'Invite'}
              </Button>
            </div>
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
                        : 'hover:bg-muted',
                      !u.is_active && 'opacity-50'
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full",
                      u.is_active ? "bg-muted" : "bg-destructive/10"
                    )}>
                      <User className={cn(
                        "h-5 w-5",
                        u.is_active ? "text-muted-foreground" : "text-destructive"
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {u.full_name || u.display_name || u.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={getRoleBadgeVariant(u.role)} className="shrink-0">
                        {getRoleLabel(u.role)}
                      </Badge>
                      {!u.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          {language === 'el' ? 'Ανενεργός' : 'Inactive'}
                        </Badge>
                      )}
                    </div>
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
                      {language === 'el' ? 'Πρόσβαση' : 'Access'}
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {language === 'el' ? 'Ιστορικό' : 'History'}
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
                        <Label>Email</Label>
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
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between p-4 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Power className={cn(
                            "h-5 w-5",
                            selectedUser.is_active ? "text-green-500" : "text-destructive"
                          )} />
                          <div>
                            <p className="font-medium">
                              {language === 'el' ? 'Κατάσταση Λογαριασμού' : 'Account Status'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {selectedUser.is_active
                                ? (language === 'el' ? 'Ενεργός' : 'Active')
                                : (language === 'el' ? 'Ανενεργός' : 'Inactive')
                              }
                            </p>
                          </div>
                        </div>
                        <Button
                          variant={selectedUser.is_active ? "destructive" : "default"}
                          size="sm"
                          onClick={handleToggleActive}
                          disabled={saving || selectedUser.user_id === user?.id}
                        >
                          {selectedUser.is_active
                            ? (language === 'el' ? 'Απενεργοποίηση' : 'Deactivate')
                            : (language === 'el' ? 'Ενεργοποίηση' : 'Activate')
                          }
                        </Button>
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
                        {/* Apply Template Button */}
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            onClick={() => setShowTemplateModal(true)}
                            disabled={templates.length === 0}
                          >
                            <FileStack className="h-4 w-4 mr-2" />
                            {language === 'el' ? 'Εφαρμογή Ρόλου' : 'Apply Role'}
                          </Button>
                        </div>

                        {/* Module Access */}
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

                        {/* Timekeeping Actions */}
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
                                  ? 'Οι Admin έχουν πλήρη πρόσβαση' 
                                  : 'Admins have full access'}
                              </li>
                              <li>
                                {language === 'el' 
                                  ? 'Οι HR & Timekeeper έχουν μόνο πρόσβαση στο Timekeeping' 
                                  : 'HR & Timekeeper only access Timekeeping'}
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
                        {language === 'el' ? 'Δεν υπάρχει ιστορικό' : 'No history'}
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

      {/* Invite User Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {language === 'el' ? 'Πρόσκληση Χρήστη' : 'Invite User'}
            </DialogTitle>
            <DialogDescription>
              {language === 'el'
                ? 'Στείλτε πρόσκληση μέσω email.'
                : 'Send an email invitation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-name">
                {language === 'el' ? 'Όνομα' : 'Display Name'}
              </Label>
              <Input
                id="invite-name"
                type="text"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">
                {language === 'el' ? 'Βασικός Ρόλος' : 'Base Role'} *
              </Label>
              <Select
                value={inviteBaseRole}
                onValueChange={(value) => setInviteBaseRole(value as BaseRole)}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    {language === 'el' ? 'Διαχειριστής' : 'Admin'}
                  </SelectItem>
                  <SelectItem value="employee">
                    {language === 'el' ? 'Υπάλληλος' : 'Employee'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {language === 'el' 
                  ? 'Admin έχει πλήρη πρόσβαση. Employee χρειάζεται permission templates.'
                  : 'Admin has full access. Employee needs permission templates.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                {language === 'el' ? 'Ρόλοι Δικαιωμάτων' : 'Permission Roles'}
              </Label>
              <p className="text-xs text-muted-foreground mb-2">
                {language === 'el' 
                  ? 'Επιλέξτε έναν ή περισσότερους ρόλους δικαιωμάτων'
                  : 'Select one or more permission roles'}
              </p>
              <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    {language === 'el' ? 'Δεν υπάρχουν ρόλοι' : 'No roles available'}
                  </p>
                ) : (
                  templates.map(t => (
                    <div key={t.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`template-${t.id}`}
                        checked={inviteTemplateIds.includes(t.id)}
                        onChange={() => toggleInviteTemplate(t.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label 
                        htmlFor={`template-${t.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {t.name}
                        {t.description && (
                          <span className="text-xs text-muted-foreground ml-2">
                            – {t.description}
                          </span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowInviteModal(false)}
              disabled={inviting}
            >
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                language === 'el' ? 'Αποστολή' : 'Send'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Role Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              {language === 'el' ? 'Εφαρμογή Ρόλου' : 'Apply Role'}
            </DialogTitle>
            <DialogDescription>
              {language === 'el'
                ? `Εφαρμόστε έναν ρόλο δικαιωμάτων στον χρήστη ${selectedUser?.full_name || selectedUser?.email}.`
                : `Apply a permission role to ${selectedUser?.full_name || selectedUser?.email}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">
                {language === 'el' ? 'Επιλέξτε Ρόλο' : 'Select Role'}
              </Label>
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
              >
                <SelectTrigger id="template-select">
                  <SelectValue placeholder={language === 'el' ? 'Επιλέξτε...' : 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="overwrite"
                checked={overwritePermissions}
                onCheckedChange={setOverwritePermissions}
              />
              <Label htmlFor="overwrite">
                {language === 'el' ? 'Αντικατάσταση υπαρχόντων δικαιωμάτων' : 'Overwrite existing permissions'}
              </Label>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {language === 'el'
                  ? 'Οι περιορισμοί ρόλων θα εφαρμοστούν αυτόματα.'
                  : 'Role restrictions will be enforced automatically.'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTemplateModal(false)}
              disabled={applyingTemplate}
            >
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={applyingTemplate || !selectedTemplateId}
            >
              {applyingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {language === 'el' ? 'Εφαρμογή' : 'Apply'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
