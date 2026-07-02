import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Plus, 
  Loader2,
  FileStack,
  Save,
  Trash2,
  Check,
  X,
  Info,
  Undo2
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface PermissionTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

interface ModuleConfig {
  module_key: string;
  name: string;
  can_access: boolean;
}

interface ActionConfig {
  action_key: string;
  module_key: string;
  description: string | null;
  allowed: boolean;
}

export default function AdminTemplates() {
  const { user } = useAuth();
  const { language } = useLanguage();
  
  const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PermissionTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Template modules and actions (current editing state)
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [actions, setActions] = useState<ActionConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  
  // Original state from DB (for dirty tracking and cancel)
  const [originalModules, setOriginalModules] = useState<ModuleConfig[]>([]);
  const [originalActions, setOriginalActions] = useState<ActionConfig[]>([]);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [pendingSwitchTemplate, setPendingSwitchTemplate] = useState<PermissionTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (!selectedTemplate) return false;
    
    const modulesChanged = modules.some(m => {
      const original = originalModules.find(om => om.module_key === m.module_key);
      return original?.can_access !== m.can_access;
    });
    
    const actionsChanged = actions.some(a => {
      const original = originalActions.find(oa => oa.action_key === a.action_key);
      return original?.allowed !== a.allowed;
    });
    
    return modulesChanged || actionsChanged;
  }, [modules, actions, originalModules, originalActions, selectedTemplate]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('permission_templates')
        .select('*')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης ρόλων' : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Fetch template configuration
  const fetchTemplateConfig = useCallback(async (templateId: string) => {
    try {
      setConfigLoading(true);

      // Fetch all modules
      const { data: allModules } = await supabase
        .from('modules')
        .select('key, name')
        .eq('is_active', true);

      // Fetch template modules
      const { data: templateModules } = await supabase
        .from('permission_template_modules')
        .select('module_key, can_access')
        .eq('template_id', templateId);

      const modulesConfig: ModuleConfig[] = (allModules || []).map(m => {
        const config = templateModules?.find(tm => tm.module_key === m.key);
        return {
          module_key: m.key,
          name: m.name,
          can_access: config?.can_access ?? false,
        };
      });
      setModules(modulesConfig);
      setOriginalModules(JSON.parse(JSON.stringify(modulesConfig)));

      // Fetch all timekeeping actions
      const { data: allActions } = await supabase
        .from('module_actions')
        .select('action_key, description')
        .eq('module_key', 'timekeeping');

      // Fetch template actions
      const { data: templateActions } = await supabase
        .from('permission_template_actions')
        .select('action_key, allowed')
        .eq('template_id', templateId);

      const actionsConfig: ActionConfig[] = (allActions || []).map(a => {
        const config = templateActions?.find(ta => ta.action_key === a.action_key);
        return {
          action_key: a.action_key,
          description: a.description,
          allowed: config?.allowed ?? false,
        };
      });
      setActions(actionsConfig);
      setOriginalActions(JSON.parse(JSON.stringify(actionsConfig)));

    } catch (error) {
      console.error('Error fetching template config:', error);
      toast.error(language === 'el' ? 'Αποτυχία φόρτωσης ρυθμίσεων' : 'Failed to load configuration');
    } finally {
      setConfigLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (selectedTemplate) {
      fetchTemplateConfig(selectedTemplate.id);
    }
  }, [selectedTemplate, fetchTemplateConfig]);

  // Handle template selection with dirty check
  const handleTemplateSelect = (template: PermissionTemplate) => {
    if (isDirty && selectedTemplate?.id !== template.id) {
      setPendingSwitchTemplate(template);
      setShowDiscardDialog(true);
    } else {
      setSelectedTemplate(template);
    }
  };

  // Confirm discard and switch
  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    if (pendingSwitchTemplate) {
      setSelectedTemplate(pendingSwitchTemplate);
      setPendingSwitchTemplate(null);
    }
  };

  // Create template
  const handleCreateTemplate = async () => {
    if (!user || !newTemplateName.trim()) return;

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('permission_templates')
        .insert({
          name: newTemplateName.trim(),
          description: newTemplateDescription.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Audit log
      await supabase.from('permission_audit_logs').insert({
        actor_user_id: user.id,
        target_user_id: null,
        change_type: 'ROLE_CREATED',
        details: {
          role_id: data.id,
          role_name: newTemplateName.trim(),
          description: newTemplateDescription.trim() || null,
        },
      });

      toast.success(language === 'el' ? 'Ο ρόλος δημιουργήθηκε' : 'Role created');
      setShowCreateModal(false);
      setNewTemplateName('');
      setNewTemplateDescription('');
      await fetchTemplates();
      if (data) {
        setSelectedTemplate(data);
      }
    } catch (error: any) {
      console.error('Error creating template:', error);
      if (error.code === '23505') {
        toast.error(language === 'el' ? 'Το όνομα υπάρχει ήδη' : 'Name already exists');
      } else {
        toast.error(language === 'el' ? 'Αποτυχία δημιουργίας' : 'Failed to create role');
      }
    } finally {
      setCreating(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);

      // Audit log before deletion
      await supabase.from('permission_audit_logs').insert({
        actor_user_id: user!.id,
        target_user_id: null,
        change_type: 'ROLE_DELETED',
        details: {
          role_id: selectedTemplate.id,
          role_name: selectedTemplate.name,
          description: selectedTemplate.description,
        },
      });

      const { error } = await supabase
        .from('permission_templates')
        .delete()
        .eq('id', selectedTemplate.id);

      if (error) throw error;

      toast.success(language === 'el' ? 'Ο ρόλος διαγράφηκε' : 'Role deleted');
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(language === 'el' ? 'Αποτυχία διαγραφής' : 'Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  // Local toggle (no DB write until Save)
  const handleModuleToggle = (moduleKey: string, canAccess: boolean) => {
    setModules(modules.map(m =>
      m.module_key === moduleKey ? { ...m, can_access: canAccess } : m
    ));
  };

  const handleActionToggle = (actionKey: string, allowed: boolean) => {
    setActions(actions.map(a =>
      a.action_key === actionKey ? { ...a, allowed: allowed } : a
    ));
  };

  // Save all changes
  const handleSave = async () => {
    if (!selectedTemplate) return;

    try {
      setSaving(true);

      // Save modules and log changes
      for (const module of modules) {
        const original = originalModules.find(m => m.module_key === module.module_key);
        if (original?.can_access !== module.can_access) {
          const { error } = await supabase
            .from('permission_template_modules')
            .upsert({
              template_id: selectedTemplate.id,
              module_key: module.module_key,
              can_access: module.can_access,
            }, { onConflict: 'template_id,module_key' });
          if (error) throw error;

          await supabase.from('permission_audit_logs').insert({
            actor_user_id: user!.id,
            target_user_id: null,
            change_type: module.can_access ? 'ROLE_MODULE_GRANTED' : 'ROLE_MODULE_REVOKED',
            details: {
              role_id: selectedTemplate.id,
              role_name: selectedTemplate.name,
              module_key: module.module_key,
              module_name: module.name,
              old_value: original?.can_access || false,
              new_value: module.can_access,
            },
          });
        }
      }

      // Save actions and log changes
      for (const action of actions) {
        const original = originalActions.find(a => a.action_key === action.action_key);
        if (original?.allowed !== action.allowed) {
          const { error } = await supabase
            .from('permission_template_actions')
            .upsert({
              template_id: selectedTemplate.id,
              action_key: action.action_key,
              allowed: action.allowed,
            }, { onConflict: 'template_id,action_key' });
          if (error) throw error;

          await supabase.from('permission_audit_logs').insert({
            actor_user_id: user!.id,
            target_user_id: null,
            change_type: action.allowed ? 'ROLE_ACTION_GRANTED' : 'ROLE_ACTION_REVOKED',
            details: {
              role_id: selectedTemplate.id,
              role_name: selectedTemplate.name,
              action_key: action.action_key,
              action_description: action.description || action.action_key,
              old_value: original?.allowed || false,
              new_value: action.allowed,
            },
          });
        }
      }

      // Update original state to match current
      setOriginalModules(JSON.parse(JSON.stringify(modules)));
      setOriginalActions(JSON.parse(JSON.stringify(actions)));

      toast.success(language === 'el' ? 'Ο ρόλος αποθηκεύτηκε' : 'Role saved');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(language === 'el' ? 'Αποτυχία αποθήκευσης' : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  // Cancel and revert to original
  const handleCancel = () => {
    setModules(JSON.parse(JSON.stringify(originalModules)));
    setActions(JSON.parse(JSON.stringify(originalActions)));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'el' ? 'Ρόλοι' : 'Roles'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'el' 
              ? 'Δημιουργήστε και διαχειριστείτε ρόλους δικαιωμάτων (σύνολα δικαιωμάτων).' 
              : 'Create and manage permission roles (permission sets).'}
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {language === 'el' ? 'Νέος Ρόλος' : 'New Role'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Role List */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileStack className="h-5 w-5" />
              {language === 'el' ? 'Ρόλοι' : 'Roles'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="space-y-1 p-2">
                {templates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {language === 'el' ? 'Δεν υπάρχουν ρόλοι' : 'No roles'}
                  </p>
                ) : (
                  templates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors',
                        selectedTemplate?.id === template.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      )}
                    >
                      <FileStack className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {template.name}
                        </p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel - Role Configuration */}
        <Card className="lg:col-span-2">
          {selectedTemplate ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {selectedTemplate.name}
                      </CardTitle>
                      {isDirty && (
                        <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                          {language === 'el' ? 'Μη αποθηκευμένες αλλαγές' : 'Unsaved changes'}
                        </Badge>
                      )}
                    </div>
                    {selectedTemplate.description && (
                      <CardDescription>{selectedTemplate.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      disabled={!isDirty || saving}
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      {language === 'el' ? 'Ακύρωση' : 'Cancel'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={!isDirty || saving}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {language === 'el' ? 'Αποθήκευση' : 'Save'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {language === 'el' ? 'Διαγραφή' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {configLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Module Access */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">
                        {language === 'el' ? 'Πρόσβαση Modules' : 'Module Access'}
                      </h3>
                      <div className="space-y-3">
                        {modules.map((module) => (
                          <div
                            key={module.module_key}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              {module.can_access ? (
                                <Check className="h-5 w-5 text-green-500" />
                              ) : (
                                <X className="h-5 w-5 text-muted-foreground" />
                              )}
                              <span className="font-medium">{module.name}</span>
                            </div>
                            <Switch
                              checked={module.can_access}
                              onCheckedChange={(checked) => handleModuleToggle(module.module_key, checked)}
                              disabled={saving}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Timekeeping Actions */}
                    <div>
                      <h3 className="text-sm font-medium mb-3">
                        {language === 'el' ? 'Ενέργειες Χρονοκαταγραφής' : 'Timekeeping Actions'}
                      </h3>
                      <div className="space-y-2">
                        {actions.map((action) => (
                          <div
                            key={action.action_key}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              {action.allowed ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <X className="h-4 w-4 text-muted-foreground" />
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
                          {language === 'el' ? 'Σημείωση' : 'Note'}
                        </p>
                        <p className="text-xs">
                          {language === 'el' 
                            ? 'Αυτός ο ρόλος μπορεί να εφαρμοστεί σε χρήστες από τη σελίδα Χρηστών. Οι περιορισμοί ρόλων (Admin Console, Procurement) εφαρμόζονται πάντα.' 
                            : 'This role can be applied to users from the Users page. Role restrictions (Admin Console, Procurement) are always enforced.'}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center h-[500px] text-center">
              <FileStack className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {language === 'el' 
                  ? 'Επιλέξτε έναν ρόλο για να δείτε τις ρυθμίσεις του' 
                  : 'Select a role to view its configuration'}
              </p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Create Role Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              {language === 'el' ? 'Νέος Ρόλος' : 'New Role'}
            </DialogTitle>
            <DialogDescription>
              {language === 'el'
                ? 'Δημιουργήστε ένα νέο ρόλο δικαιωμάτων.'
                : 'Create a new permission role.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">
                {language === 'el' ? 'Όνομα' : 'Name'} *
              </Label>
              <Input
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder={language === 'el' ? 'π.χ. Πλήρης Πρόσβαση' : 'e.g., Full Access'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description">
                {language === 'el' ? 'Περιγραφή' : 'Description'}
              </Label>
              <Textarea
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                placeholder={language === 'el' ? 'Προαιρετική περιγραφή...' : 'Optional description...'}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={creating || !newTemplateName.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {language === 'el' ? 'Δημιουργία...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {language === 'el' ? 'Δημιουργία' : 'Create'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'el' ? 'Διαγραφή Ρόλου' : 'Delete Role'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'el'
                ? `Είστε σίγουροι ότι θέλετε να διαγράψετε τον ρόλο "${selectedTemplate?.name}"; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`
                : `Are you sure you want to delete the role "${selectedTemplate?.name}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>
              {language === 'el' ? 'Ακύρωση' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplate}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                language === 'el' ? 'Διαγραφή' : 'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard Changes Confirmation Dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'el' ? 'Μη αποθηκευμένες αλλαγές' : 'Unsaved Changes'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'el'
                ? 'Έχετε μη αποθηκευμένες αλλαγές. Θέλετε να τις απορρίψετε και να αλλάξετε ρόλο;'
                : 'You have unsaved changes. Discard and switch roles?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingSwitchTemplate(null)}>
              {language === 'el' ? 'Παραμονή' : 'Stay'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>
              {language === 'el' ? 'Απόρριψη' : 'Discard'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
