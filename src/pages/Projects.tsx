import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { Plus, Search, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
}

export default function Projects() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [status, setStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('project_code');

      setProjects((data as Project[]) || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProjectCode('');
    setProjectName('');
    setStatus('OPEN');
    setEditingProject(null);
  };

  const openEditDialog = (project: Project) => {
    setEditingProject(project);
    setProjectCode(project.project_code);
    setProjectName(project.project_name);
    setStatus(project.status);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectCode || !projectName) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update({
            project_code: projectCode,
            project_name: projectName,
            status,
          })
          .eq('id', editingProject.id);

        if (error) throw error;
        toast.success('Project updated successfully');
      } else {
        const { error } = await supabase
          .from('projects')
          .insert({
            project_code: projectCode,
            project_name: projectName,
            status,
          });

        if (error) throw error;
        toast.success('Project created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchProjects();
    } catch (error: any) {
      console.error('Error saving project:', error);
      toast.error(error.message || 'Error saving project');
    }
  };

  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.project_name.toLowerCase().includes(searchQuery.toLowerCase());
    
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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? t('common.edit') : t('projects.addNew')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t('projects.code')}</Label>
                  <Input
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                    className="input-tablet font-mono"
                    placeholder="PROJ-001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('projects.name')}</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    className="input-tablet"
                    placeholder="Project Name"
                    required
                  />
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
              <div>
                <p className="font-mono text-sm text-muted-foreground">{project.project_code}</p>
                <h3 className="font-semibold mt-1">{project.project_name}</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(project)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
            <span className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
              project.status === 'OPEN' ? 'badge-open' : 'badge-closed'
            )}>
              {project.status === 'OPEN' ? t('common.open') : t('common.closed')}
            </span>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="card-elevated p-12 text-center text-muted-foreground">
          {t('common.noData')}
        </div>
      )}
    </MainLayout>
  );
}
