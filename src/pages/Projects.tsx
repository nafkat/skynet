import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Edit2, Building2, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  assigned_shipyard_company: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
}

interface CustomerDetails {
  project_id: string;
  customer_company_name: string;
  customer_company_afm: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}


interface Company {
  id: string;
  company_name: string;
  company_code: string;
}

// Greek AFM validation: exactly 9 digits
const isValidGreekAFM = (afm: string): boolean => {
  if (!afm) return true; // Optional field
  return /^\d{9}$/.test(afm.trim());
};

export default function Projects() {
  const { t, language } = useLanguage();
  const { role } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state - project_code is auto-generated, not editable
  const [projectName, setProjectName] = useState('');
  const [customerCompanyName, setCustomerCompanyName] = useState('');
  const [customerCompanyAfm, setCustomerCompanyAfm] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [assignedShipyardCompany, setAssignedShipyardCompany] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [customerDetails, setCustomerDetails] = useState<Record<string, CustomerDetails>>({});

  const canEdit = role === 'admin' || role === 'hr';

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('id, project_code, project_name, assigned_shipyard_company, status, created_at')
        .order('project_code');

      setProjects((data as Project[]) || []);

      const { data: detailsData } = await supabase
        .from('project_customer_details')
        .select('project_id, customer_company_name, customer_company_afm, contact_name, contact_email, contact_phone');

      const map: Record<string, CustomerDetails> = {};
      (detailsData || []).forEach((d: any) => {
        map[d.project_id] = d as CustomerDetails;
      });
      setCustomerDetails(map);

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, company_name, company_code')
        .eq('is_active', true)
        .order('company_name');
      setCompanies(companiesData || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setProjectName('');
    setCustomerCompanyName('');
    setCustomerCompanyAfm('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAssignedShipyardCompany('');
    setStatus('OPEN');
    setEditingProject(null);
  };

  const openEditDialog = (project: Project) => {
    const details = customerDetails[project.id];
    setEditingProject(project);
    setProjectName(project.project_name);
    setCustomerCompanyName(details?.customer_company_name || '');
    setCustomerCompanyAfm(details?.customer_company_afm || '');
    setContactName(details?.contact_name || '');
    setContactEmail(details?.contact_email || '');
    setContactPhone(details?.contact_phone || '');
    setAssignedShipyardCompany(project.assigned_shipyard_company);
    setStatus(project.status);
    setIsDialogOpen(true);
  };


  const handleStatusToggle = (project: Project) => {
    setSelectedProject(project);
    setStatusDialogOpen(true);
  };

  const confirmStatusToggle = async () => {
    if (!selectedProject) return;
    
    try {
      const newStatus = selectedProject.status === 'OPEN' ? 'CLOSED' : 'OPEN';
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', selectedProject.id);
      
      if (error) throw error;
      
      toast.success(
        newStatus === 'CLOSED'
          ? (language === 'el' ? 'Το έργο έκλεισε' : 'Project closed')
          : (language === 'el' ? 'Το έργο άνοιξε ξανά' : 'Project reopened')
      );
      
      fetchProjects();
    } catch (error: any) {
      console.error('Error toggling status:', error);
      toast.error(error.message || 'Error updating project status');
    } finally {
      setStatusDialogOpen(false);
      setSelectedProject(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName || !customerCompanyName || !assignedShipyardCompany) {
      toast.error(t('common.fillRequired'));
      return;
    }

    // Validate Greek AFM if provided
    if (customerCompanyAfm && !isValidGreekAFM(customerCompanyAfm)) {
      toast.error(t('projects.invalidAfm'));
      return;
    }

    try {
      const detailsPayload = {
        customer_company_name: customerCompanyName,
        customer_company_afm: customerCompanyAfm || null,
        contact_name: contactName || null,
        contact_email: contactEmail || null,
        contact_phone: contactPhone || null,
      };

      let projectId: string;

      if (editingProject) {
        // Update - don't change project_code
        const { error } = await supabase
          .from('projects')
          .update({
            project_name: projectName,
            assigned_shipyard_company: assignedShipyardCompany,
            status,
          })
          .eq('id', editingProject.id);

        if (error) throw error;
        projectId = editingProject.id;
        toast.success(t('projects.updated'));
      } else {
        // Insert - project_code is auto-generated by trigger, but Supabase types require it
        // The trigger will override this value with the auto-generated code
        const { data: inserted, error } = await supabase
          .from('projects')
          .insert({
            project_code: 'TEMP', // Will be overridden by trigger
            project_name: projectName,
            assigned_shipyard_company: assignedShipyardCompany,
            status,
          })
          .select('id')
          .single();

        if (error) throw error;
        projectId = inserted!.id;
        toast.success(t('projects.created'));
      }

      const { error: detailsError } = await supabase
        .from('project_customer_details')
        .upsert({ project_id: projectId, ...detailsPayload }, { onConflict: 'project_id' });

      if (detailsError) throw detailsError;

      setIsDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error(error.message || t('common.error'));
    }
  };


  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (customerDetails[proj.id]?.customer_company_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.assigned_shipyard_company.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">{t('common.loading')}</div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{t('projects.title')}</h1>
            <p className="page-subtitle">
              {filteredProjects.length} {t('projects.title').toLowerCase()}
            </p>
          </div>
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="btn-tablet">
                  <Plus className="h-5 w-5 mr-2" />
                  {t('projects.addNew')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingProject ? t('common.edit') : t('projects.addNew')}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  {/* Project Code - Read-only, only shown when editing */}
                  {editingProject && (
                    <div className="space-y-2">
                      <Label>{t('projects.code')}</Label>
                      <Input
                        value={editingProject.project_code}
                        className="input-tablet font-mono bg-muted"
                        disabled
                        readOnly
                      />
                      <p className="text-xs text-muted-foreground">{t('projects.codeAutoGenerated')}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{t('projects.name')} *</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="input-tablet"
                      placeholder={t('projects.namePlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('projects.customerCompanyName')} *</Label>
                    <Input
                      value={customerCompanyName}
                      onChange={(e) => setCustomerCompanyName(e.target.value)}
                      className="input-tablet"
                      placeholder={t('projects.customerCompanyNamePlaceholder')}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('projects.customerCompanyAfm')}</Label>
                    <Input
                      value={customerCompanyAfm}
                      onChange={(e) => setCustomerCompanyAfm(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      className="input-tablet font-mono"
                      placeholder="123456789"
                      maxLength={9}
                    />
                    <p className="text-xs text-muted-foreground">{t('projects.afmHint')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'el' ? 'Όνομα Επαφής' : 'Contact Name'}</Label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="input-tablet"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'el' ? 'Email Επαφής' : 'Contact Email'}</Label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="input-tablet"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{language === 'el' ? 'Τηλέφωνο Επαφής' : 'Contact Phone'}</Label>
                    <Input
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="input-tablet"
                    />
                  </div>


                  <div className="space-y-2">
                    <Label>{language === 'el' ? 'Ναυπηγείο (Εταιρεία)' : 'Assigned Shipyard Company'} *</Label>
                    <Select
                      value={assignedShipyardCompany}
                      onValueChange={setAssignedShipyardCompany}
                    >
                      <SelectTrigger className="input-tablet">
                        <SelectValue placeholder={language === 'el' ? 'Επιλέξτε εταιρεία...' : 'Select company...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.company_name}>
                            {company.company_code} — {company.company_name}
                          </SelectItem>
                        ))}
                        {companies.length === 0 && (
                          <SelectItem value="_none" disabled>
                            {language === 'el' ? 'Δεν υπάρχουν εταιρείες' : 'No companies found'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('common.status')}</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as 'OPEN' | 'CLOSED')}>
                      <SelectTrigger className="input-tablet">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPEN">{t('common.open')}</SelectItem>
                        <SelectItem value="CLOSED">{t('common.closed')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" className="flex-1">
                      {t('common.save')}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-tablet pl-12"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 input-tablet">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="OPEN">{t('common.open')}</SelectItem>
            <SelectItem value="CLOSED">{t('common.closed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((project) => (
          <div key={project.id} className="card-elevated p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-muted-foreground">{project.project_code}</p>
                <h3 className="font-semibold mt-1 truncate">{project.project_name}</h3>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditDialog(project)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <div className="space-y-2 mb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{project.customer_company_name}</span>
              </div>
              {project.assigned_shipyard_company && (
                <p className="text-xs text-muted-foreground truncate">
                  {t('projects.assignedTo')}: {project.assigned_shipyard_company}
                </p>
              )}
            </div>

            <button
              onClick={() => handleStatusToggle(project)}
              disabled={!canEdit}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                'transition-all duration-200',
                canEdit && 'cursor-pointer hover:shadow-sm',
                !canEdit && 'cursor-not-allowed opacity-70',
                project.status === 'OPEN'
                  ? canEdit ? 'badge-open hover:bg-green-100' : 'badge-open'
                  : canEdit ? 'badge-closed hover:bg-red-100' : 'badge-closed'
              )}
              title={canEdit
                ? (language === 'el' ? `Πατήστε για ${project.status === 'OPEN' ? 'κλείσιμο' : 'άνοιγμα'}` : `Click to ${project.status === 'OPEN' ? 'close' : 'reopen'}`)
                : (language === 'el' ? 'Δεν έχετε δικαίωμα' : 'No permission')
              }
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', project.status === 'OPEN' ? 'bg-green-500' : 'bg-red-500')} />
              {project.status === 'OPEN' ? t('common.open') : t('common.closed')}
              {canEdit && <ArrowLeftRight className="h-3 w-3 opacity-60" />}
            </button>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="card-elevated p-12 text-center text-muted-foreground">
          {t('common.noData')}
        </div>
      )}
      <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedProject?.status === 'OPEN' ? (language === 'el' ? 'Κλείσιμο Έργου' : 'Close Project') : (language === 'el' ? 'Άνοιγμα Έργου' : 'Reopen Project')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedProject?.status === 'OPEN'
                ? (language === 'el' ? `Είστε σίγουροι ότι θέλετε να κλείσετε το έργο "${selectedProject?.project_name}"? Δεν θα μπορείτε να καταχωρείτε νέες ώρες σε αυτό.` : `Are you sure you want to close project "${selectedProject?.project_name}"? You won't be able to log new time entries to it.`)
                : (language === 'el' ? `Είστε σίγουροι ότι θέλετε να ανοίξετε ξανά το έργο "${selectedProject?.project_name}"?` : `Are you sure you want to reopen project "${selectedProject?.project_name}"?`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'el' ? 'Ακύρωση' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusToggle}>
              {selectedProject?.status === 'OPEN' ? (language === 'el' ? 'Κλείσιμο' : 'Close') : (language === 'el' ? 'Άνοιγμα' : 'Reopen')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
