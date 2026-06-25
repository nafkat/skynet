import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Edit2, Save, X, ChevronDown, ChevronUp,
  FileText, Building2, User, Calendar, Clock,
  CheckCircle, Send, Receipt, Plus, Smartphone, Trash2, FileDown,
  ImageIcon, Maximize2,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

interface CostItem {
  id: string;
  description: string;
  calculation_type: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  sort_order: number;
  created_by: string | null;
}

interface CostSection {
  id: string;
  title: string;
  sort_order: number;
  isOpen: boolean;
  cost_items: CostItem[];
}

interface CostReport {
  id: string;
  code: string;
  version_number: number;
  status: string;
  version_notes: string | null;
  created_at: string;
  projects: {
    project_code: string;
    project_name: string;
    customer_company_name: string;
    assigned_shipyard_company: string;
  } | null;
}

const STATUS_CONFIG: Record<
  string,
  { labelEn: string; labelEl: string; color: string; icon: typeof Clock }
> = {
  draft: { labelEn: 'Draft', labelEl: 'Πρόχειρο', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  sent: { labelEn: 'Sent', labelEl: 'Απεστάλη', color: 'bg-purple-100 text-purple-800', icon: Send },
  agreed: { labelEn: 'Agreed', labelEl: 'Συμφωνήθηκε', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  invoiced: { labelEn: 'Invoiced', labelEl: 'Τιμολογήθηκε', color: 'bg-orange-100 text-orange-800', icon: Receipt },
};

const CALC_TYPES = [
  { value: 'unit', labelEn: 'Per Unit', labelEl: 'Ανά Τεμάχιο' },
  { value: 'lumpsum', labelEn: 'Lump Sum', labelEl: "Κατ' Αποκοπή" },
  { value: 'area', labelEn: 'Area (m²)', labelEl: 'Εμβαδόν (m²)' },
  { value: 'linear', labelEn: 'Linear (m)', labelEl: 'Γραμμικά (m)' },
  { value: 'weight', labelEn: 'Weight (kg)', labelEl: 'Βάρος (kg)' },
];

export default function CostingReportDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasPermission, hasElevatedRole } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => (language === 'el' ? el : en);

  const [report, setReport] = useState<CostReport | null>(null);
  const [sections, setSections] = useState<CostSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [confirmDeleteReport, setConfirmDeleteReport] = useState(false);

  const canViewCosts = hasElevatedRole || hasPermission('costing.costs.view');
  const canEditCosts = hasElevatedRole || hasPermission('costing.costs.edit');
  const canChangeStatus = hasElevatedRole || hasPermission('costing.reports.change_status');
  const canCreateReports = hasElevatedRole || hasPermission('costing.reports.create');
  const canDeleteReport = hasElevatedRole || hasPermission('costing.reports.delete');
  const canEditAnyItem = hasElevatedRole || hasPermission('costing.items.edit');
  const canDeleteAnyItem = hasElevatedRole || hasPermission('costing.items.delete');

  const canEditItem = (item: CostItem) =>
    canEditAnyItem || (!!user && item.created_by === user.id);
  const canDeleteItem = (item: CostItem) =>
    canDeleteAnyItem || (!!user && item.created_by === user.id);

  const fetchReport = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: r } = await supabase
        .from('cost_reports')
        .select(
          'id, code, version_number, status, version_notes, created_at, projects(project_code, project_name, customer_company_name, assigned_shipyard_company)',
        )
        .eq('id', id)
        .single();

      const { data: secs } = await supabase
        .from('cost_sections')
        .select(
          'id, title, sort_order, cost_items(id, description, calculation_type, quantity, unit, unit_price, sort_order, created_by)',
        )
        .eq('report_id', id)
        .order('sort_order');

      setReport(r as unknown as CostReport);
      setSections(
        ((secs as any[]) || []).map((s) => ({
          ...s,
          isOpen: true,
          cost_items: [...(s.cost_items || [])].sort(
            (a: CostItem, b: CostItem) => a.sort_order - b.sort_order,
          ),
        })) as CostSection[],
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const calcTotal = (item: CostItem): number | null => {
    if (item.unit_price === null) return null;
    if (item.calculation_type === 'lumpsum') return item.unit_price;
    if (item.quantity === null) return null;
    return item.quantity * item.unit_price;
  };

  const sectionTotal = (sec: CostSection): number | null => {
    const totals = sec.cost_items.map(calcTotal);
    if (totals.some((x) => x === null)) return null;
    return totals.reduce((a, b) => (a as number) + (b as number), 0);
  };

  const grandTotal = (): number | null => {
    const totals = visibleSections.map(sectionTotal);
    if (totals.some((x) => x === null)) return null;
    return totals.reduce((a, b) => (a as number) + (b as number), 0);
  };

  const handleSavePrice = async (itemId: string) => {
    const val = editingPrice[itemId];
    if (val === undefined) return;
    setSavingPrice(itemId);
    const newPrice = val === '' ? null : parseFloat(val);
    const { error } = await supabase
      .from('cost_items')
      .update({ unit_price: newPrice })
      .eq('id', itemId);
    if (error) {
      toast.error(t('Error saving price', 'Σφάλμα αποθήκευσης τιμής'));
    } else {
      toast.success(t('Price saved', 'Η τιμή αποθηκεύτηκε'));
      setEditingPrice((prev) => {
        const n = { ...prev };
        delete n[itemId];
        return n;
      });
      // Local update — no full refetch
      setSections((secs) =>
        secs.map((s) => ({
          ...s,
          cost_items: s.cost_items.map((i) =>
            i.id === itemId ? { ...i, unit_price: newPrice } : i,
          ),
        })),
      );
    }
    setSavingPrice(null);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;
    setUpdatingStatus(true);
    const { error } = await supabase
      .from('cost_reports')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      toast.error(t('Error updating status', 'Σφάλμα ενημέρωσης κατάστασης'));
    } else {
      toast.success(t('Status updated', 'Η κατάσταση ενημερώθηκε'));
      setReport((r) => (r ? { ...r, status: newStatus } : r));
    }
    setUpdatingStatus(false);
  };


  const handleDeleteItem = async () => {
    if (!deleteItemId) return;
    // Find the section so we can cascade-delete if it becomes empty
    const parentSection = sections.find((s) =>
      s.cost_items.some((i) => i.id === deleteItemId),
    );
    const { error } = await supabase.from('cost_items').delete().eq('id', deleteItemId);
    if (error) {
      toast.error(t('Error deleting item', 'Σφάλμα διαγραφής'));
      setDeleteItemId(null);
      return;
    }

    let newSections = sections.map((s) => ({
      ...s,
      cost_items: s.cost_items.filter((i) => i.id !== deleteItemId),
    }));

    // If parent section now has 0 items, delete it too
    if (parentSection && parentSection.cost_items.length - 1 === 0) {
      await supabase.from('cost_sections').delete().eq('id', parentSection.id);
      newSections = newSections.filter((s) => s.id !== parentSection.id);
    }
    setSections(newSections);
    toast.success(t('Item deleted', 'Η εργασία διαγράφηκε'));
    setDeleteItemId(null);
  };

  const handleDeleteSection = async () => {
    if (!deleteSectionId) return;
    // Delete items first (cascade may not be set), then the section
    await supabase.from('cost_items').delete().eq('section_id', deleteSectionId);
    const { error } = await supabase
      .from('cost_sections')
      .delete()
      .eq('id', deleteSectionId);
    if (error) {
      toast.error(t('Error deleting section', 'Σφάλμα διαγραφής τμήματος'));
    } else {
      toast.success(t('Section deleted', 'Το τμήμα διαγράφηκε'));
      setSections((secs) => secs.filter((s) => s.id !== deleteSectionId));
    }
    setDeleteSectionId(null);
  };

  const handleDeleteReport = async () => {
    if (!id) return;
    const { error } = await supabase.from('cost_reports').delete().eq('id', id);
    if (error) {
      toast.error(t('Error deleting report', 'Σφάλμα διαγραφής αναφοράς'));
    } else {
      toast.success(t('Report deleted', 'Η αναφορά διαγράφηκε'));
      navigate('/costing/reports');
    }
  };

  const fmt = (n: number | null) => (n !== null ? `€${n.toFixed(2)}` : '—');

  // Hide empty sections (titles without items)
  const visibleSections = sections.filter((s) => s.cost_items.length > 0);

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t('Loading...', 'Φόρτωση...')}
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {t('Report not found', 'Η αναφορά δεν βρέθηκε')}
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[report.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;
  const gt = grandTotal();

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/costing/reports')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold">
              {report.code}-v{report.version_number}
            </h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}
            >
              <StatusIcon className="h-3.5 w-3.5" />
              {language === 'el' ? statusCfg.labelEl : statusCfg.labelEn}
            </span>
          </div>
          {report.version_notes && (
            <p className="text-sm text-muted-foreground mt-1 italic">
              "{report.version_notes}"
            </p>
          )}
        </div>

        {canChangeStatus && (
          <div className="w-48">
            <Select
              value={report.status}
              onValueChange={handleStatusChange}
              disabled={updatingStatus}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {language === 'el' ? v.labelEl : v.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(`/costing/reports/${id}/print`)}
          title={t('Export PDF', 'Εξαγωγή PDF')}
        >
          <FileDown className="h-4 w-4" />
        </Button>

        {canDeleteReport && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmDeleteReport(true)}
            title={t('Delete Report', 'Διαγραφή Αναφοράς')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>

      {/* Info card */}
      <div className="bg-card border rounded-lg p-4 md:p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <InfoRow
            icon={<FileText className="h-4 w-4" />}
            label={t('Project', 'Έργο')}
            value={`${report.projects?.project_code ?? ''} — ${report.projects?.project_name ?? ''}`}
          />
          <InfoRow
            icon={<User className="h-4 w-4" />}
            label={t('Client', 'Πελάτης')}
            value={report.projects?.customer_company_name || '—'}
          />
          <InfoRow
            icon={<Building2 className="h-4 w-4" />}
            label={t('Our Company', 'Εταιρεία μας')}
            value={report.projects?.assigned_shipyard_company || '—'}
          />
          <InfoRow
            icon={<Calendar className="h-4 w-4" />}
            label={t('Created', 'Δημιουργήθηκε')}
            value={new Date(report.created_at).toLocaleDateString('el-GR')}
          />
        </div>

        {canViewCosts && (
          <div className="border-t pt-4 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {t('Grand Total', 'Γενικό Σύνολο')}
            </span>
            <span className="text-2xl font-bold text-primary">{fmt(gt)}</span>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">{t('Work Sections', 'Τμήματα Εργασιών')}</h2>

        {visibleSections.length === 0 ? (
          <div className="bg-card border rounded-lg p-8 text-center text-muted-foreground">
            {t(
              'No items yet — use Field Entry to add work.',
              'Δεν υπάρχουν εργασίες — χρησιμοποίησε το Field Entry για να προσθέσεις.',
            )}
          </div>
        ) : (
          visibleSections.map((sec) => (
            <div key={sec.id} className="bg-card border rounded-lg overflow-hidden">
              <div className="w-full flex items-center justify-between p-4 hover:bg-muted/50">
                <button
                  className="flex-1 text-left font-medium"
                  onClick={() =>
                    setSections((s) =>
                      s.map((s2) => (s2.id === sec.id ? { ...s2, isOpen: !s2.isOpen } : s2)),
                    )
                  }
                >
                  {sec.title}
                </button>
                <div className="flex items-center gap-3">
                  {canViewCosts && (
                    <span className="text-sm font-semibold text-primary">
                      {fmt(sectionTotal(sec))}
                    </span>
                  )}
                  {canDeleteAnyItem && (
                    <Button
                      size="icon"
                      variant="ghost"
                      title={t('Delete section', 'Διαγραφή τμήματος')}
                      onClick={() => setDeleteSectionId(sec.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                  <button
                    onClick={() =>
                      setSections((s) =>
                        s.map((s2) => (s2.id === sec.id ? { ...s2, isOpen: !s2.isOpen } : s2)),
                      )
                    }
                  >
                    {sec.isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {sec.isOpen && (
                <div className="border-t divide-y">
                  {sec.cost_items.map((item) => (
                    <div key={item.id} className="p-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium break-words">{item.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.calculation_type !== 'lumpsum'
                              ? `${item.quantity ?? '—'} ${item.unit ?? ''} · ${item.calculation_type}`
                              : t('Lump Sum', "Κατ' Αποκοπή")}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {canViewCosts && (
                            <div className="flex items-center gap-3">
                              {/* Unit price cell — always visible for editors */}
                              <div className="flex flex-col items-start">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {t('Unit Price', 'Τιμή Μονάδας')}
                                </span>
                                {canEditCosts ? (
                                  <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">€</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={
                                        editingPrice[item.id] !== undefined
                                          ? editingPrice[item.id]
                                          : item.unit_price?.toString() ?? ''
                                      }
                                      onChange={(e) =>
                                        setEditingPrice((prev) => ({
                                          ...prev,
                                          [item.id]: e.target.value,
                                        }))
                                      }
                                      onBlur={() => {
                                        if (editingPrice[item.id] !== undefined) {
                                          handleSavePrice(item.id);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          (e.target as HTMLInputElement).blur();
                                        }
                                      }}
                                      disabled={savingPrice === item.id}
                                      className="w-28 h-9 pl-6 text-sm bg-background border-primary/30 focus:border-primary"
                                      placeholder="0.00"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-sm font-medium w-28 text-right">
                                    {item.unit_price !== null ? `€${item.unit_price.toFixed(2)}` : '—'}
                                  </span>
                                )}
                              </div>

                              {/* Total cell */}
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                  {t('Total', 'Σύνολο')}
                                </span>
                                <span className="text-sm font-semibold w-24 text-right text-primary h-9 flex items-center justify-end">
                                  {fmt(calcTotal(item))}
                                </span>
                              </div>
                            </div>
                          )}

                          {canEditItem(item) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t('Edit item', 'Επεξεργασία εργασίας')}
                              onClick={() =>
                                navigate(`/costing/reports/${id}/field?edit=${item.id}`)
                              }
                            >
                              <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          {canDeleteItem(item) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title={t('Delete item', 'Διαγραφή εργασίας')}
                              onClick={() => setDeleteItemId(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="flex gap-3 pb-8 flex-wrap">
        <Button
          onClick={() => navigate(`/costing/reports/${id}/field`)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Smartphone className="h-4 w-4 mr-2" />
          {t('Field Entry', 'Καταγραφή Επί Τόπου')}
        </Button>
        {canCreateReports && (
          <Button variant="outline" onClick={() => navigate('/costing/new')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('New Version', 'Νέα Έκδοση')}
          </Button>
        )}
      </div>

      {/* Delete item confirm */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(o) => !o && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this item?', 'Διαγραφή αυτής της εργασίας;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This action cannot be undone.', 'Η ενέργεια δεν αναιρείται.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive text-destructive-foreground">
              {t('Delete', 'Διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete section confirm */}
      <AlertDialog open={!!deleteSectionId} onOpenChange={(o) => !o && setDeleteSectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this section?', 'Διαγραφή αυτού του τμήματος;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'All items in this section will be permanently deleted.',
                'Όλες οι εργασίες αυτού του τμήματος θα διαγραφούν οριστικά.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSection} className="bg-destructive text-destructive-foreground">
              {t('Delete', 'Διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete report confirm */}
      <AlertDialog open={confirmDeleteReport} onOpenChange={setConfirmDeleteReport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete this report?', 'Διαγραφή αυτής της αναφοράς;')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'All sections, items and photos will be permanently deleted.',
                'Όλα τα τμήματα, εργασίες και φωτογραφίες θα διαγραφούν οριστικά.',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel', 'Άκυρο')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteReport} className="bg-destructive text-destructive-foreground">
              {t('Delete', 'Διαγραφή')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
