import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Save, ArrowLeft, Camera, X,
} from 'lucide-react';
import { validateFile, validateImageContent, acceptAttr } from '@/lib/fileValidation';

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  customer_company_name: string;
  assigned_shipyard_company: string;
}

interface PhotoPreview {
  file: File;
  previewUrl: string;
}

interface CostItem {
  tempId: string;
  title: string;
  description: string;
  voice_note_text: string;
  calculation_type: 'unit' | 'lumpsum' | 'area' | 'linear' | 'weight';
  quantity: string;
  unit: string;
  unit_price: string;
  photos: PhotoPreview[];
}

interface CostSection {
  tempId: string;
  title: string;
  isOpen: boolean;
  items: CostItem[];
}

const CALC_TYPES = [
  { value: 'unit', labelEn: 'Per Unit', labelEl: 'Ανά Τεμάχιο' },
  { value: 'lumpsum', labelEn: 'Lump Sum', labelEl: "Κατ' Αποκοπή" },
  { value: 'area', labelEn: 'Area (m²)', labelEl: 'Εμβαδόν (m²)' },
  { value: 'linear', labelEn: 'Linear (m)', labelEl: 'Γραμμικά (m)' },
  { value: 'weight', labelEn: 'Weight (kg)', labelEl: 'Βάρος (kg)' },
] as const;

const newItem = (): CostItem => ({
  tempId: crypto.randomUUID(),
  title: '',
  description: '',
  voice_note_text: '',
  calculation_type: 'unit',
  quantity: '',
  unit: '',
  unit_price: '',
  photos: [],
});

const newSection = (): CostSection => ({
  tempId: crypto.randomUUID(),
  title: '',
  isOpen: true,
  items: [newItem()],
});

export default function CostingReportCreate() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [versionNotes, setVersionNotes] = useState('');
  const [sections, setSections] = useState<CostSection[]>([newSection()]);
  const [saving, setSaving] = useState(false);

  const canSetPrices = hasPermission('costing.costs.edit') || hasPermission('costing.costs.view');

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, project_code, project_name, customer_company_name, assigned_shipyard_company')
      .eq('status', 'OPEN')
      .order('project_code')
      .then(({ data }) => setProjects((data as Project[]) || []));
  }, []);

  useEffect(() => {
    setSelectedProject(projects.find((p) => p.id === selectedProjectId) || null);
  }, [selectedProjectId, projects]);

  const addSection = () => setSections((s) => [...s, newSection()]);
  const removeSection = (tempId: string) =>
    setSections((s) => s.filter((sec) => sec.tempId !== tempId));
  const updateSection = (tempId: string, patch: Partial<CostSection>) =>
    setSections((s) => s.map((sec) => (sec.tempId === tempId ? { ...sec, ...patch } : sec)));
  const toggleSection = (tempId: string) =>
    setSections((s) =>
      s.map((sec) => (sec.tempId === tempId ? { ...sec, isOpen: !sec.isOpen } : sec)),
    );

  const addItem = (sectionTempId: string) =>
    setSections((s) =>
      s.map((sec) =>
        sec.tempId === sectionTempId ? { ...sec, items: [...sec.items, newItem()] } : sec,
      ),
    );
  const removeItem = (sectionTempId: string, itemTempId: string) =>
    setSections((s) =>
      s.map((sec) =>
        sec.tempId === sectionTempId
          ? { ...sec, items: sec.items.filter((i) => i.tempId !== itemTempId) }
          : sec,
      ),
    );
  const updateItem = (sectionTempId: string, itemTempId: string, patch: Partial<CostItem>) =>
    setSections((s) =>
      s.map((sec) =>
        sec.tempId === sectionTempId
          ? {
              ...sec,
              items: sec.items.map((i) => (i.tempId === itemTempId ? { ...i, ...patch } : i)),
            }
          : sec,
      ),
    );

  const addPhotos = async (sectionTempId: string, itemTempId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newPhotos: PhotoPreview[] = [];
    for (const file of Array.from(files)) {
      const v = validateFile(file, 'image');
      if (!v.ok) { toast.error(t(v.errorEn!, v.errorEl!)); continue; }
      const genuine = await validateImageContent(file);
      if (!genuine) {
        toast.error(t(`"${file.name}": file content is not a valid image.`, `Το "${file.name}": το περιεχόμενο δεν είναι έγκυρη εικόνα.`));
        continue;
      }
      newPhotos.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (newPhotos.length === 0) return;
    setSections((s) =>
      s.map((sec) =>
        sec.tempId === sectionTempId
          ? {
              ...sec,
              items: sec.items.map((i) =>
                i.tempId === itemTempId ? { ...i, photos: [...i.photos, ...newPhotos] } : i,
              ),
            }
          : sec,
      ),
    );
  };

  const removePhoto = (sectionTempId: string, itemTempId: string, idx: number) =>
    setSections((s) =>
      s.map((sec) =>
        sec.tempId === sectionTempId
          ? {
              ...sec,
              items: sec.items.map((i) => {
                if (i.tempId !== itemTempId) return i;
                URL.revokeObjectURL(i.photos[idx].previewUrl);
                return { ...i, photos: i.photos.filter((_, k) => k !== idx) };
              }),
            }
          : sec,
      ),
    );

  const calcTotal = (item: CostItem): number | null => {
    if (item.calculation_type === 'lumpsum') {
      const p = parseFloat(item.unit_price);
      return isNaN(p) ? null : p;
    }
    const q = parseFloat(item.quantity);
    const p = parseFloat(item.unit_price);
    if (isNaN(q) || isNaN(p)) return null;
    return q * p;
  };

  const uploadItemPhoto = async (
    reportId: string,
    itemId: string,
    photo: PhotoPreview,
  ): Promise<string | null> => {
    const ext = photo.file.name.split('.').pop() || 'jpg';
    const path = `${reportId}/${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('cost-photos')
      .upload(path, photo.file, { contentType: photo.file.type, upsert: false });
    if (error) {
      console.error('Photo upload error:', error);
      return null;
    }
    return path;
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast.error(t('Please select a project', 'Επιλέξτε έργο'));
      return;
    }
    if (sections.some((s) => !s.title.trim())) {
      toast.error(t('All sections must have a title', 'Όλα τα τμήματα πρέπει να έχουν τίτλο'));
      return;
    }
    if (sections.some((s) => s.items.some((i) => !i.description.trim()))) {
      toast.error(
        t('All items must have a description', 'Όλες οι εργασίες πρέπει να έχουν περιγραφή'),
      );
      return;
    }

    setSaving(true);
    try {
      const { data: report, error: rErr } = await supabase
        .from('cost_reports')
        .insert({
          project_id: selectedProjectId,
          version_notes: versionNotes || null,
          created_by: user?.id,
          status: 'draft',
        })
        .select()
        .single();

      if (rErr || !report) throw rErr;

      for (let si = 0; si < sections.length; si++) {
        const sec = sections[si];
        const { data: section, error: sErr } = await supabase
          .from('cost_sections')
          .insert({ report_id: report.id, title: sec.title, sort_order: si })
          .select()
          .single();

        if (sErr || !section) throw sErr;

        for (let ii = 0; ii < sec.items.length; ii++) {
          const item = sec.items[ii];
          const { data: insertedItem, error: iErr } = await supabase
            .from('cost_items')
            .insert({
              section_id: section.id,
              title: item.title.trim() || null,
              description: item.description,
              voice_note_text: item.voice_note_text || null,
              calculation_type: item.calculation_type,
              quantity:
                item.calculation_type !== 'lumpsum' && item.quantity
                  ? parseFloat(item.quantity)
                  : null,
              unit: item.unit || null,
              unit_price: canSetPrices && item.unit_price ? parseFloat(item.unit_price) : null,
              sort_order: ii,
              created_by: user?.id ?? null,
            })
            .select()
            .single();
          if (iErr || !insertedItem) throw iErr;

          for (const photo of item.photos) {
            const path = await uploadItemPhoto(report.id, insertedItem.id, photo);
            if (path) {
              await supabase.from('cost_item_photos').insert({
                item_id: insertedItem.id,
                storage_path: path,
                caption: '',
                created_by: user?.id ?? null,
              });
            }
            URL.revokeObjectURL(photo.previewUrl);
          }
        }
      }

      toast.success(t('Report created successfully', 'Η αναφορά δημιουργήθηκε επιτυχώς'));
      navigate(`/costing/reports/${report.id}`);
    } catch (err) {
      console.error(err);
      toast.error(t('Error saving report', 'Σφάλμα αποθήκευσης αναφοράς'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/costing')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">
            {t('New Cost Report', 'Νέα Αναφορά Κόστους')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('Draft will be saved on submit', 'Αποθηκεύεται ως πρόχειρο')}
          </p>
        </div>
      </div>

      {/* Project info */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-medium">{t('Report Information', 'Στοιχεία Αναφοράς')}</h2>

        <div className="space-y-2">
          <Label>{t('Project', 'Έργο')} *</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder={t('Select project...', 'Επιλέξτε έργο...')} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} — {p.project_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedProject && (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">{t('Client', 'Πελάτης')}</div>
              <div className="font-medium">{selectedProject.customer_company_name || '—'}</div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">
                {t('Our Company', 'Εταιρεία μας')}
              </div>
              <div className="font-medium">
                {selectedProject.assigned_shipyard_company || '—'}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>{t('Version Notes', 'Σημειώσεις Έκδοσης')}</Label>
          <Textarea
            value={versionNotes}
            onChange={(e) => setVersionNotes(e.target.value)}
            placeholder={t('e.g. Initial estimate...', 'π.χ. Αρχική εκτίμηση...')}
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">{t('Work Sections', 'Τμήματα Εργασιών')}</h2>
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-4 w-4 mr-2" />
            {t('Add Section', 'Προσθήκη Τμήματος')}
          </Button>
        </div>

        {sections.map((sec, si) => (
          <div key={sec.tempId} className="bg-card border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={sec.title}
                onChange={(e) => updateSection(sec.tempId, { title: e.target.value })}
                placeholder={t(
                  `Section ${si + 1} title...`,
                  `Τίτλος τμήματος ${si + 1}...`,
                )}
                className="flex-1 font-medium"
              />
              <Button variant="ghost" size="icon" onClick={() => toggleSection(sec.tempId)}>
                {sec.isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
              {sections.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSection(sec.tempId)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            {sec.isOpen && (
              <div className="space-y-3">
                {sec.items.map((item, ii) => (
                  <div
                    key={item.tempId}
                    className="rounded-md border bg-muted/30 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('Item', 'Εργασία')} {ii + 1}
                      </span>
                      {sec.items.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(sec.tempId, item.tempId)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">{t('Title', 'Τίτλος')}</Label>
                      <Input
                        value={item.title}
                        onChange={(e) =>
                          updateItem(sec.tempId, item.tempId, { title: e.target.value })
                        }
                        placeholder={t('Short title (optional)', 'Σύντομος τίτλος (προαιρετικό)')}
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">{t('Description', 'Περιγραφή')} *</Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) =>
                          updateItem(sec.tempId, item.tempId, { description: e.target.value })
                        }
                        placeholder={t('Describe the work...', 'Περιγράψτε την εργασία...')}
                        rows={2}
                        className="resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('Calc. Type', 'Τύπος Υπολ.')}</Label>
                        <Select
                          value={item.calculation_type}
                          onValueChange={(v) =>
                            updateItem(sec.tempId, item.tempId, {
                              calculation_type: v as CostItem['calculation_type'],
                            })
                          }
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CALC_TYPES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {language === 'el' ? c.labelEl : c.labelEn}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {item.calculation_type !== 'lumpsum' && (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('Quantity', 'Ποσότητα')}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.001"
                              value={item.quantity}
                              onChange={(e) =>
                                updateItem(sec.tempId, item.tempId, {
                                  quantity: e.target.value,
                                })
                              }
                              className="h-9 text-sm"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">{t('Unit', 'Μονάδα')}</Label>
                            <Input
                              value={item.unit}
                              onChange={(e) =>
                                updateItem(sec.tempId, item.tempId, { unit: e.target.value })
                              }
                              className="h-9 text-sm"
                              placeholder={t('m², kg, pcs...', 'm², kg, τεμ...')}
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Photos */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label className="text-xs">{t('Photos', 'Φωτογραφίες')}</Label>
                      {item.photos.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {item.photos.map((p, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-square rounded-md overflow-hidden border"
                            >
                              <img
                                src={p.previewUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(sec.tempId, item.tempId, idx)}
                                className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            addPhotos(sec.tempId, item.tempId, e.target.files);
                            e.currentTarget.value = '';
                          }}
                        />
                        <div className="flex items-center justify-center gap-2 h-10 border-2 border-dashed border-border rounded-md cursor-pointer hover:bg-muted/30 transition-colors">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {item.photos.length > 0
                              ? t('Add more photos', 'Προσθήκη φωτογραφιών')
                              : t('Add photos', 'Προσθήκη φωτογραφιών')}
                          </span>
                        </div>
                      </label>
                    </div>


                    {canSetPrices && (
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                        <div className="space-y-1">
                          <Label className="text-xs text-primary">
                            {item.calculation_type === 'lumpsum'
                              ? t("Lump Sum Price (€)", "Τιμή Κατ' Αποκοπή (€)")
                              : t('Unit Price (€)', 'Τιμή Μονάδας (€)')}
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) =>
                              updateItem(sec.tempId, item.tempId, {
                                unit_price: e.target.value,
                              })
                            }
                            className="h-9 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-primary">{t('Total (€)', 'Σύνολο (€)')}</Label>
                          <div className="h-9 px-3 flex items-center bg-muted rounded-md text-sm font-medium">
                            {calcTotal(item) !== null
                              ? `€${calcTotal(item)!.toFixed(2)}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => addItem(sec.tempId)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('Add Item', 'Προσθήκη Εργασίας')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/costing')}>
          {t('Cancel', 'Ακύρωση')}
        </Button>
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {saving
            ? t('Saving...', 'Αποθήκευση...')
            : t('Save as Draft', 'Αποθήκευση ως Πρόχειρο')}
        </Button>
      </div>
    </div>
  );
}
