import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Edit2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface Specialty {
  id: string;
  name_en: string;
  name_el: string;
  code: string;
  created_at: string;
}

export default function Specialties() {
  const { t, language } = useLanguage();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSpecialty, setEditingSpecialty] = useState<Specialty | null>(null);

  // Form state
  const [nameEn, setNameEn] = useState('');
  const [nameEl, setNameEl] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    fetchSpecialties();
  }, []);

  const fetchSpecialties = async () => {
    try {
      const { data } = await supabase
        .from('specialties')
        .select('*')
        .order('code');

      setSpecialties((data as Specialty[]) || []);
    } catch (error) {
      console.error('Error fetching specialties:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNameEn('');
    setNameEl('');
    setCode('');
    setEditingSpecialty(null);
  };

  const openEditDialog = (specialty: Specialty) => {
    setEditingSpecialty(specialty);
    setNameEn(specialty.name_en);
    setNameEl(specialty.name_el);
    setCode(specialty.code);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nameEn || !nameEl || !code) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (code.length !== 4) {
      toast.error('Code must be exactly 4 characters');
      return;
    }

    try {
      if (editingSpecialty) {
        const { error } = await supabase
          .from('specialties')
          .update({
            name_en: nameEn,
            name_el: nameEl,
            code: code.toUpperCase(),
          })
          .eq('id', editingSpecialty.id);

        if (error) throw error;
        toast.success('Specialty updated successfully');
      } else {
        const { error } = await supabase
          .from('specialties')
          .insert({
            name_en: nameEn,
            name_el: nameEl,
            code: code.toUpperCase(),
          });

        if (error) throw error;
        toast.success('Specialty created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSpecialties();
    } catch (error: any) {
      console.error('Error saving specialty:', error);
      toast.error(error.message || 'Error saving specialty');
    }
  };

  const getSpecialtyName = (specialty: Specialty) => {
    return language === 'el' ? specialty.name_el : specialty.name_en;
  };

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
            <h1 className="page-title">{t('specialties.title')}</h1>
            <p className="page-subtitle">
              {specialties.length} {t('specialties.title').toLowerCase()}
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-tablet">
                <Plus className="h-5 w-5 mr-2" />
                {t('specialties.addNew')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingSpecialty ? t('common.edit') : t('specialties.addNew')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>{t('specialties.code')}</Label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
                    className="input-tablet font-mono"
                    placeholder="WELD"
                    maxLength={4}
                    required
                    disabled={!!editingSpecialty}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('specialties.nameEn')}</Label>
                  <Input
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="input-tablet"
                    placeholder="Welder"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('specialties.nameEl')}</Label>
                  <Input
                    value={nameEl}
                    onChange={(e) => setNameEl(e.target.value)}
                    className="input-tablet"
                    placeholder="Συγκολλητής"
                    required
                  />
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

      {/* Specialties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {specialties.map((specialty) => (
          <div key={specialty.id} className="card-elevated p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-mono text-sm text-muted-foreground">{specialty.code}</p>
                  <h3 className="font-semibold">{getSpecialtyName(specialty)}</h3>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(specialty)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {specialties.length === 0 && (
        <div className="card-elevated p-12 text-center text-muted-foreground">
          {t('common.noData')}
        </div>
      )}
    </MainLayout>
  );
}
