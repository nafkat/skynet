import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
  Check,
  Mail,
  AlertTriangle,
  Save,
  X
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// New base role type - only Admin and Employee
type BaseRole = 'admin' | 'employee';

interface UserWithRole {
  user_id: string;
  email: string;
  base_role: BaseRole;
  full_name: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string | null;
  assigned_templates: PermissionTemplate[];
  email_confirmed_at?: string | null; // Track if user has accepted invite
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

// Draft state for permissions
interface PermissionDraft {
  baseRole: BaseRole;
  templateIds: string[];
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
  
  // Original (saved) values for the selected user
  const [savedBaseRole, setSavedBaseRole] = useState<BaseRole>('employee');
  const [savedTemplateIds, setSavedTemplateIds] = useState<string[]>([]);
  
  // Draft state for permissions (editable, not yet saved)
  const [draftBaseRole, setDraftBaseRole] = useState<BaseRole>('employee');
  const [draftTemplateIds, setDraftTemplateIds] = useState<string[]>([]);

  // Invite user modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBaseRole, setInviteBaseRole] = useState<BaseRole>('employee');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteTemplateIds, setInviteTemplateIds] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  // Resend invite state
  const [resendingInvite, setResendingInvite] = useState(false);

  // Apply template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [overwritePermissions, setOverwritePermissions] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  // Confirmation modal states
  const [showRoleChangeConfirm, setShowRoleChangeConfirm] = useState(false);
  const [showCriticalPermissionWarning, setShowCriticalPermissionWarning] = useState(false);
  const [pendingSaveAction, setPendingSaveAction] = useState<(() => Promise<void>) | null>(null);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!selectedUser) return false;
    const baseRoleChanged = draftBaseRole !== savedBaseRole;
    const templatesChanged = 
      draftTemplateIds.length !== savedTemplateIds.length ||
      !draftTemplateIds.every(id => savedTemplateIds.includes(id));
    return baseRoleChanged || templatesChanged;
  }, [selectedUser, draftBaseRole, savedBaseRole, draftTemplateIds, savedTemplateIds]);

  // Check if this is a pending/invited user (hasn't accepted invite yet)
  const isPendingUser = useMemo(() => {
    if (!selectedUser) return false;
    // User is pending if they don't have email_confirmed_at
    return !selectedUser.email_confirmed_at;
  }, [selectedUser]);

  // Fetch all templates
  const fetchTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('permission_templates')
      .select('id, name, description')
      .order('name');
    setTemplates(data || []);
  }, []);

  // Fetch all users with their base roles from user_roles table
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users_with_profiles');

      if (error) throw error;

      // Also fetch assigned templates for each user
      const userIds = (data || []).map((u: any) => u.user_id);
      
      const { data: userTemplatesData } = await supabase
        .from('user_permission_templates')
        .select('user_id, template_id, permission_templates(id, name, description)')
        .in('user_id', userIds);

      // Group templates by user
      const userTemplatesMap: Record<string, PermissionTemplate[]> = {};
      (userTemplatesData || []).forEach((ut: any) => {
        if (!userTemplatesMap[ut.user_id]) {
          userTemplatesMap[ut.user_id] = [];
        }
        if (ut.permission_templates) {
          userTemplatesMap[ut.user_id].push(ut.permission_templates);
        }
      });

      const usersWithRoles: UserWithRole[] = (data || []).map((u: any) => {
        // Map legacy roles to base_role: admin stays admin, everything else is employee
        const legacyRole = u.role;
        const baseRole: BaseRole = legacyRole === 'admin' ? 'admin' : 'employee';
        
        return {
          user_id: u.user_id,
          email: u.email || u.user_id.slice(0, 8) + '...',
          base_role: baseRole,
          full_name: u.full_name,
          display_name: u.display_name,
          is_active: u.is_active ?? true,
          created_at: u.created_at,
          assigned_templates: userTemplatesMap[u.user_id] || [],
          email_confirmed_at: u.email_confirmed_at || null,
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
  }, [language]);

  useEffect(() => {
    fetchUsers();
    fetchTemplates();
  }, [fetchUsers, fetchTemplates]);

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
        u.base_role.toLowerCase().includes(query) ||
        u.assigned_templates.some(t => t.name.toLowerCase().includes(query))
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

      // Fetch user's assigned templates
      const { data: userTemplatesData } = await supabase
        .from('user_permission_templates')
        .select('template_id')
        .eq('user_id', userId);
      
      const templateIds = (userTemplatesData || []).map(t => t.template_id);
      setSavedTemplateIds(templateIds);
      setDraftTemplateIds(templateIds);

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

  // When selected user changes, initialize draft state
  useEffect(() => {
    if (selectedUser) {
      setSavedBaseRole(selectedUser.base_role);
      setDraftBaseRole(selectedUser.base_role);
      fetchUserPermissions(selectedUser.user_id);
    }
  }, [selectedUser, fetchUserPermissions]);

  // Handle resend invite
  const handleResendInvite = async () => {
    if (!selectedUser || !user) return;

    try {
      setResendingInvite(true);

      const { data, error } = await supabase.functions.invoke('resend_invite', {
        body: { user_id: selectedUser.user_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(language === 'el' ? 'Η πρόσκληση εστάλη ξανά' : 'Invitation email has been resent');
      
      // Refresh audit logs
      await fetchUserPermissions(selectedUser.user_id);
    } catch (error: any) {
      console.error('Error resending invite:', error);
      toast.error(error.message || (language === 'el' ? 'Αποτυχία αποστολής πρόσκλησης' : 'Failed to resend invitation'));
    } finally {
      setResendingInvite(false);
    }
  };

  // Save all permission changes
  const handleSaveChanges = async () => {
    if (!selectedUser || !user) return;

    // Check if base role is changing
    const baseRoleChanging = draftBaseRole !== savedBaseRole;
    
    // Check if removing admin-level permissions
    const wasAdmin = savedBaseRole === 'admin';
    const removingAdmin = wasAdmin && draftBaseRole !== 'admin';

    // Show confirmation for role changes
    if (baseRoleChanging) {
      setPendingSaveAction(() => performSave);
      setShowRoleChangeConfirm(true);
      return;
    }

    // Check for critical permission removals (e.g., removing all templates)
    const removingAllTemplates = savedTemplateIds.length > 0 && draftTemplateIds.length === 0;
    if (removingAllTemplates && !baseRoleChanging) {
      setPendingSaveAction(() => performSave);
      setShowCriticalPermissionWarning(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!selectedUser || !user) return;

    try {
      setSaving(true);

      const changes: string[] = [];

      // Update base role if changed
      if (draftBaseRole !== savedBaseRole) {
        const appRole = draftBaseRole === 'admin' ? 'admin' : 'timekeeper';

        const { error: roleError } = await supabase
          .from('user_roles')
          .upsert({ 
            user_id: selectedUser.user_id, 
            role: appRole 
          }, { onConflict: 'user_id,role' });

        if (roleError) {
          const { error: updateError } = await supabase
            .from('user_roles')
            .update({ role: appRole })
            .eq('user_id', selectedUser.user_id);
          
          if (updateError) throw updateError;
        }

        // Log the role change
        await supabase
          .from('permission_audit_logs')
          .insert({
            actor_user_id: user.id,
            target_user_id: selectedUser.user_id,
            change_type: 'ROLE_CHANGE',
            details: { 
              old_base_role: savedBaseRole, 
              new_base_role: draftBaseRole,
              actor_email: user.email,
            },
          });

        changes.push('base role');
      }

      // Update templates if changed
      const addedTemplates = draftTemplateIds.filter(id => !savedTemplateIds.includes(id));
      const removedTemplates = savedTemplateIds.filter(id => !draftTemplateIds.includes(id));

      // Remove templates
      for (const templateId of removedTemplates) {
        const { error } = await supabase
          .from('user_permission_templates')
          .delete()
          .eq('user_id', selectedUser.user_id)
          .eq('template_id', templateId);
        if (error) throw error;

        const template = templates.find(t => t.id === templateId);
        await supabase
          .from('permission_audit_logs')
          .insert({
            actor_user_id: user.id,
            target_user_id: selectedUser.user_id,
            change_type: 'TEMPLATE_REMOVED',
            details: { template_id: templateId, template_name: template?.name },
          });
      }

      // Add templates
      for (const templateId of addedTemplates) {
        const { error } = await supabase
          .from('user_permission_templates')
          .insert({
            user_id: selectedUser.user_id,
            template_id: templateId,
            assigned_by: user.id,
          });
        if (error) throw error;

        const template = templates.find(t => t.id === templateId);
        await supabase
          .from('permission_audit_logs')
          .insert({
            actor_user_id: user.id,
            target_user_id: selectedUser.user_id,
            change_type: 'TEMPLATE_ASSIGNED',
            details: { template_id: templateId, template_name: template?.name },
          });
      }

      if (addedTemplates.length > 0 || removedTemplates.length > 0) {
        changes.push('permission roles');

        // Recompute effective permissions
        await supabase.rpc('recompute_user_permissions', {
          _user_id: selectedUser.user_id,
        });
      }

      // Update saved state
      setSavedBaseRole(draftBaseRole);
      setSavedTemplateIds(draftTemplateIds);

      // Update local user list
      const updatedTemplates = templates.filter(t => draftTemplateIds.includes(t.id));
      const updatedUser = { 
        ...selectedUser, 
        base_role: draftBaseRole,
        assigned_templates: updatedTemplates,
      };
      setSelectedUser(updatedUser);
      setUsers(users.map(u => 
        u.user_id === selectedUser.user_id ? updatedUser : u
      ));

      // Refresh audit logs
      await fetchUserPermissions(selectedUser.user_id);

      toast.success(language === 'el' ? 'Τα δικαιώματα χρήστη ενημερώθηκαν' : 'User permissions updated successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error(language === 'el' ? 'Αποτυχία αποθήκευσης' : 'Failed to save changes');
    } finally {
      setSaving(false);
      setShowRoleChangeConfirm(false);
      setShowCriticalPermissionWarning(false);
      setPendingSaveAction(null);
    }
  };

  // Cancel changes and revert to saved state
  const handleCancelChanges = () => {
    setDraftBaseRole(savedBaseRole);
    setDraftTemplateIds(savedTemplateIds);
  };

  // Handle template toggle in draft state (no auto-save)
  const handleDraftTemplateToggle = (templateId: string, assigned: boolean) => {
    if (assigned) {
      setDraftTemplateIds(prev => [...prev, templateId]);
    } else {
      setDraftTemplateIds(prev => prev.filter(id => id !== templateId));
    }
  };

  // Handle module access toggle (kept as immediate save for Access tab)
  const handleModuleAccessToggle = async (moduleKey: string, canAccess: boolean) => {
    if (!selectedUser || !user) return;
    
    if (selectedUser.base_role !== 'admin') {
      if (moduleKey === 'admin_console') {
        toast.error(language === 'el' ? 'Η πρόσβαση στην Κονσόλα Διαχειριστή είναι περιορισμένη' : 'Admin Console access is restricted');
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

  // Apply template (quick apply from Access tab)
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
        let canAccess = tm.can_access;
        if (selectedUser.base_role !== 'admin' && tm.module_key === 'admin_console') {
          canAccess = false;
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
        await supabase
          .from('user_module_actions')
          .upsert({
            user_id: selectedUser.user_id,
            action_key: ta.action_key,
            allowed: ta.allowed,
            granted_by: user.id,
          }, { onConflict: 'user_id,action_key' });
      }

      // Also assign the template to the user
      await supabase
        .from('user_permission_templates')
        .upsert({
          user_id: selectedUser.user_id,
          template_id: selectedTemplateId,
          assigned_by: user.id,
        }, { onConflict: 'user_id,template_id' });

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
      await fetchUsers();
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
    if (selectedUser.base_role === 'admin') return false;
    return moduleKey === 'admin_console';
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
        change_type: 'STATUS_CHANGE',
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

  const getBaseRoleBadgeVariant = (role: BaseRole) => {
    return role === 'admin' ? 'default' : 'secondary';
  };

  const getBaseRoleLabel = (role: BaseRole) => {
    if (role === 'admin') return language === 'el' ? 'Διαχειριστής' : 'Admin';
    return language === 'el' ? 'Υπάλληλος' : 'Employee';
  };

  const getChangeTypeLabel = (type: string) => {
    switch (type) {
      case 'ROLE_CHANGE': return language === 'el' ? 'Αλλαγή Ρόλου' : 'Role Change';
      case 'MODULE_ACCESS': return language === 'el' ? 'Πρόσβαση Module' : 'Module Access';
      case 'ACTION_PERMISSION': return language === 'el' ? 'Δικαίωμα Ενέργειας' : 'Action Permission';
      case 'TEMPLATE_APPLIED': return language === 'el' ? 'Εφαρμογή Ρόλου' : 'Role Applied';
      case 'TEMPLATE_ASSIGNED': return language === 'el' ? 'Ανάθεση Ρόλου' : 'Role Assigned';
      case 'TEMPLATE_REMOVED': return language === 'el' ? 'Αφαίρεση Ρόλου' : 'Role Removed';
      case 'STATUS_CHANGE': return language === 'el' ? 'Αλλαγή Κατάστασης' : 'Status Change';
      case 'INVITE_RESENT': return language === 'el' ? 'Επαναποστολή Πρόσκλησης' : 'Invite Resent';
      case 'USER_INVITED': return language === 'el' ? 'Πρόσκληση Χρήστη' : 'User Invited';
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
            ? 'Διαχείριση χρηστών, βασικών ρόλων και ρόλων δικαιωμάτων' 
            : 'Manage users, base roles, and permission roles'}
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
                      "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
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
                      {/* Template badges */}
                      {u.assigned_templates.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {u.assigned_templates.slice(0, 2).map(t => (
                            <Badge key={t.id} variant="outline" className="text-[10px] px-1.5 py-0">
                              {t.name}
                            </Badge>
                          ))}
                          {u.assigned_templates.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{u.assigned_templates.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={getBaseRoleBadgeVariant(u.base_role)} className="shrink-0">
                        {getBaseRoleLabel(u.base_role)}
                      </Badge>
                      {!u.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          {language === 'el' ? 'Ανενεργός' : 'Inactive'}
                        </Badge>
                      )}
                      {!u.email_confirmed_at && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                          {language === 'el' ? 'Εκκρεμεί' : 'Pending'}
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
                  <div className="flex items-center gap-2">
                    <Badge variant={getBaseRoleBadgeVariant(selectedUser.base_role)} className="text-sm px-3 py-1">
                      {getBaseRoleLabel(selectedUser.base_role)}
                    </Badge>
                    {isPendingUser && (
                      <Badge variant="outline" className="text-sm px-3 py-1 text-amber-600 border-amber-400">
                        {language === 'el' ? 'Εκκρεμεί' : 'Pending'}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Assigned Templates Display */}
                {selectedUser.assigned_templates.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedUser.assigned_templates.map(t => (
                      <Badge key={t.id} variant="outline" className="text-xs">
                        {t.name}
                      </Badge>
                    ))}
                  </div>
                )}
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

                      {/* Resend Invite Section - only for pending users */}
                      {isPendingUser && (
                        <>
                          <Separator />
                          <div className="p-4 rounded-lg border border-amber-400/50 bg-amber-500/10">
                            <div className="flex items-start gap-3">
                              <Mail className="h-5 w-5 text-amber-600 mt-0.5" />
                              <div className="flex-1">
                                <p className="font-medium text-amber-700 dark:text-amber-400">
                                  {language === 'el' ? 'Πρόσκληση εκκρεμεί' : 'Invitation pending'}
                                </p>
                                <p className="text-sm text-amber-600 dark:text-amber-500 mt-1">
                                  {language === 'el' 
                                    ? 'Ο χρήστης δεν έχει αποδεχτεί ακόμα την πρόσκληση. Μπορείτε να στείλετε ξανά το email πρόσκλησης.'
                                    : 'User has not accepted the invitation yet. You can resend the invitation email.'}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-3 border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50"
                                  onClick={handleResendInvite}
                                  disabled={resendingInvite}
                                >
                                  {resendingInvite ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : (
                                    <Mail className="h-4 w-4 mr-2" />
                                  )}
                                  {language === 'el' ? 'Επαναποστολή Πρόσκλησης' : 'Resend Invite'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <Separator />
                      
                      {/* Unsaved Changes Indicator */}
                      {hasUnsavedChanges && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-sm text-amber-700 dark:text-amber-400">
                            {language === 'el' ? 'Υπάρχουν μη αποθηκευμένες αλλαγές' : 'You have unsaved changes'}
                          </span>
                        </div>
                      )}
                      
                      {/* Base Role Dropdown */}
                      <div>
                        <Label htmlFor="base-role-select">
                          {language === 'el' ? 'Βασικός Ρόλος' : 'Base Role'}
                        </Label>
                        <Select
                          value={draftBaseRole}
                          onValueChange={(value) => setDraftBaseRole(value as BaseRole)}
                          disabled={saving || selectedUser.user_id === user?.id}
                        >
                          <SelectTrigger id="base-role-select" className="mt-2">
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
                        <p className="text-xs text-muted-foreground mt-2">
                          {language === 'el' 
                            ? 'Ο Διαχειριστής έχει πλήρη πρόσβαση. Ο Υπάλληλος χρειάζεται ρόλους δικαιωμάτων.' 
                            : 'Admin has full access. Employee needs permission roles.'}
                        </p>
                        {selectedUser.user_id === user?.id && (
                          <p className="text-xs text-amber-600 mt-1">
                            {language === 'el' 
                              ? 'Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο' 
                              : 'You cannot change your own role'}
                          </p>
                        )}
                      </div>

                      <Separator />

                      {/* Permission Templates Multi-Select */}
                      <div>
                        <Label>
                          {language === 'el' ? 'Ρόλοι Δικαιωμάτων' : 'Permission Roles'}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                          {language === 'el' 
                            ? 'Επιλέξτε τους ρόλους δικαιωμάτων για αυτόν τον χρήστη' 
                            : 'Select permission roles for this user'}
                        </p>
                        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                          {templates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              {language === 'el' ? 'Δεν υπάρχουν ρόλοι' : 'No roles available'}
                            </p>
                          ) : (
                            templates.map(t => {
                              const isAssigned = draftTemplateIds.includes(t.id);
                              return (
                                <div key={t.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                                  <Checkbox
                                    id={`user-template-${t.id}`}
                                    checked={isAssigned}
                                    onCheckedChange={(checked) => handleDraftTemplateToggle(t.id, !!checked)}
                                    disabled={saving}
                                  />
                                  <label 
                                    htmlFor={`user-template-${t.id}`}
                                    className="text-sm cursor-pointer flex-1"
                                  >
                                    <span className="font-medium">{t.name}</span>
                                    {t.description && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        – {t.description}
                                      </span>
                                    )}
                                  </label>
                                  {isAssigned && (
                                    <Check className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* Save / Cancel Buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          onClick={handleSaveChanges}
                          disabled={saving || !hasUnsavedChanges || selectedUser.user_id === user?.id}
                          className="flex-1"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {language === 'el' ? 'Αποθήκευση Αλλαγών' : 'Save Changes'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancelChanges}
                          disabled={saving || !hasUnsavedChanges}
                        >
                          <X className="h-4 w-4 mr-2" />
                          {language === 'el' ? 'Ακύρωση' : 'Cancel'}
                        </Button>
                      </div>

                      <Separator />

                      {/* Active Status Toggle */}
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
                            {language === 'el' ? 'Γρήγορη Εφαρμογή Ρόλου' : 'Quick Apply Role'}
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
                                            ? 'Περιορισμένο - μόνο για Διαχειριστές' 
                                            : 'Restricted - Admins only'}
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
                            {actionPermissions.map((action) => (
                              <div
                                key={action.action_key}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card"
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
                                </div>
                                <Switch
                                  checked={action.allowed}
                                  onCheckedChange={(checked) => handleActionToggle(action.action_key, checked)}
                                  disabled={saving}
                                />
                              </div>
                            ))}
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
                                  ? 'Οι Διαχειριστές έχουν πλήρη πρόσβαση σε όλα τα modules' 
                                  : 'Admins have full access to all modules'}
                              </li>
                              <li>
                                {language === 'el' 
                                  ? 'Οι Υπάλληλοι λαμβάνουν δικαιώματα μέσω ρόλων δικαιωμάτων' 
                                  : 'Employees get permissions via permission roles'}
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
                  ? 'Ο Διαχειριστής έχει πλήρη πρόσβαση. Ο Υπάλληλος χρειάζεται ρόλους δικαιωμάτων.'
                  : 'Admin has full access. Employee needs permission roles.'}
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
                      <Checkbox
                        id={`template-${t.id}`}
                        checked={inviteTemplateIds.includes(t.id)}
                        onCheckedChange={() => toggleInviteTemplate(t.id)}
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
              {language === 'el' ? 'Γρήγορη Εφαρμογή Ρόλου' : 'Quick Apply Role'}
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
                  ? 'Αυτό θα εφαρμόσει τα δικαιώματα του ρόλου και θα τον αναθέσει στον χρήστη.'
                  : 'This will apply the role permissions and assign it to the user.'}
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
                language === 'el' ? 'Εφαρμογή' : 'Apply'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation Modal */}
      <AlertDialog open={showRoleChangeConfirm} onOpenChange={setShowRoleChangeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {language === 'el' ? 'Επιβεβαίωση Αλλαγής Ρόλου' : 'Confirm Role Change'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {draftBaseRole === 'admin' 
                ? (language === 'el' 
                    ? 'Θέλετε να αναβαθμίσετε αυτόν τον χρήστη σε Διαχειριστή; Θα έχει πλήρη πρόσβαση σε όλα τα modules και ρυθμίσεις.'
                    : 'Are you sure you want to promote this user to Admin? They will have full access to all modules and settings.')
                : (language === 'el'
                    ? 'Θέλετε να υποβαθμίσετε αυτόν τον χρήστη σε Υπάλληλο; Θα χάσει την πρόσβαση Διαχειριστή και θα χρειάζεται ρόλους δικαιωμάτων.'
                    : 'Are you sure you want to demote this user to Employee? They will lose Admin access and will need permission roles.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSaveAction(null)}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingSaveAction?.()}>
              {language === 'el' ? 'Επιβεβαίωση' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Critical Permission Warning Modal */}
      <AlertDialog open={showCriticalPermissionWarning} onOpenChange={setShowCriticalPermissionWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {language === 'el' ? 'Προειδοποίηση' : 'Warning'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'el'
                ? 'Πρόκειται να αφαιρέσετε όλους τους ρόλους δικαιωμάτων από αυτόν τον χρήστη. Ο χρήστης μπορεί να χάσει την πρόσβαση σε σημαντικές λειτουργίες.'
                : 'You are about to remove all permission roles from this user. The user may lose access to important functionality.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSaveAction(null)}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => pendingSaveAction?.()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === 'el' ? 'Συνέχεια' : 'Proceed'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
