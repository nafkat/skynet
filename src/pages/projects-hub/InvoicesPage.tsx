import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Plus, Trash2, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { signedInvoiceAmount, totalInvoiceEur } from '@/lib/invoiceCalc';
import { formatDate } from '@/lib/dateUtils';
import InvoiceForm, { type Invoice, type HubProject, type HubSupplier } from './InvoiceForm';

export default function InvoicesPage() {
  const { language } = useLanguage();
  const t = (en: string, el: string) => language === 'el' ? el : en;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<HubProject[]>([]);
  const [suppliers, setSuppliers] = useState<HubSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [projectFilter, setProjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const [invoiceResult, projectResult, supplierResult] = await Promise.all([
        supabase.from('project_invoices').select('*').order('issue_date', { ascending: false }),
        supabase.from('projects').select('id,project_code,project_name').order('project_code'),
        supabase.from('suppliers').select('id,name,vat_number').order('name'),
      ]);
      if (invoiceResult.error || projectResult.error || supplierResult.error) throw new Error('Could not load');
      setInvoices(invoiceResult.data || []); setProjects(projectResult.data || []); setSuppliers(supplierResult.data || []);
    } catch { setFailed(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => invoices.filter(i => (projectFilter === 'all' || i.project_id === projectFilter) && (typeFilter === 'all' || i.doc_type === typeFilter)), [invoices, projectFilter, typeFilter]);
  const money = (amount: number, currency = 'EUR') => Number(amount).toLocaleString(language === 'el' ? 'el-GR' : 'en-GB', { style: 'currency', currency });
  const typeName = (type: string) => type === 'invoice' ? t('Invoice', 'Τιμολόγιο') : type === 'receipt' ? t('Receipt', 'Απόδειξη') : t('Credit note', 'Πιστωτικό');
  const download = async (invoice: Invoice) => {
    setDownloading(invoice.id);
    try {
      const { data, error } = await supabase.storage.from('project-invoices').createSignedUrl(invoice.file_path, 3600, { download: true });
      if (error || !data) throw error;
      const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener'; a.target = '_blank'; a.click();
    } catch { toast.error(t('Could not download attachment', 'Αποτυχία λήψης συνημμένου')); }
    finally { setDownloading(null); }
  };
  const remove = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('project_invoices').delete().eq('id', deleting.id).select('id').single();
      if (error) throw error;
      const cleanup = await supabase.storage.from('project-invoices').remove([deleting.file_path]);
      if (cleanup.error) toast.warning(t('Invoice deleted; attachment cleanup failed', 'Το παραστατικό διαγράφηκε· το αρχείο δεν αφαιρέθηκε'));
      setInvoices(current => current.filter(i => i.id !== deleting.id)); setDeleting(null);
      toast.success(t('Invoice deleted', 'Το παραστατικό διαγράφηκε'));
    } catch { toast.error(t('Could not delete invoice', 'Αποτυχία διαγραφής παραστατικού')); }
    finally { setBusy(false); }
  };
  const metrics = [{ label: t('Total cost EUR', 'Συνολικό κόστος €'), value: money(totalInvoiceEur(filtered)) }, { label: t('Document count', 'Αριθμός παραστατικών'), value: filtered.length }, ...['invoice', 'receipt', 'credit_note'].map(type => ({ label: typeName(type), value: filtered.filter(i => i.doc_type === type).length }))];
  return <div className="space-y-6">
    <h2 className="text-2xl font-semibold flex items-center gap-2"><FileText className="h-6 w-6 text-primary" />{t('Invoices', 'Παραστατικά')}</h2>
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{metrics.map((metric, i) => <div key={metric.label} className={`border rounded-lg bg-card p-4 min-w-0 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-sm text-muted-foreground">{metric.label}</p><p className="text-xl font-semibold font-mono break-words mt-2">{loading ? '—' : metric.value}</p></div>)}</div>
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="space-y-1 sm:w-80 min-w-0"><Label htmlFor="filter-project">{t('Project', 'Έργο')}</Label><Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger id="filter-project" className="[&>span]:truncate"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('All projects', 'Όλα τα έργα')}</SelectItem>{projects.map(p => <SelectItem value={p.id} key={p.id}>{p.project_code} — {p.project_name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1 sm:w-52"><Label htmlFor="filter-type">{t('Type', 'Τύπος')}</Label><Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger id="filter-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t('All types', 'Όλοι οι τύποι')}</SelectItem>{['invoice', 'receipt', 'credit_note'].map(type => <SelectItem key={type} value={type}>{typeName(type)}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {loading ? <div className="py-12 text-muted-foreground flex justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />{t('Loading…', 'Φόρτωση…')}</div> : failed ? <div className="py-8 text-center space-y-3"><p className="text-destructive">{t('Could not load invoices', 'Αποτυχία φόρτωσης παραστατικών')}</p><Button variant="outline" onClick={load}>{t('Retry', 'Επανάληψη')}</Button></div> : filtered.length === 0 ? <p className="py-12 text-center text-muted-foreground border-y">{t('No invoices found', 'Δεν βρέθηκαν παραστατικά')}</p> : <div className="border-y overflow-x-auto"><Table><TableHeader><TableRow>{[t('Issue date', 'Ημερομηνία'), t('Number', 'Αριθμός'), t('Project', 'Έργο'), t('Supplier', 'Προμηθευτής'), t('Type', 'Τύπος'), t('Original amount', 'Αρχικό ποσό'), t('EUR amount', 'Ποσό EUR'), t('Actions', 'Ενέργειες')].map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{filtered.map(invoice => <TableRow key={invoice.id}>
      <TableCell className="whitespace-nowrap">{formatDate(new Date(`${invoice.issue_date}T12:00:00`))}</TableCell><TableCell>{invoice.invoice_number}</TableCell><TableCell className="font-mono whitespace-nowrap">{projects.find(p => p.id === invoice.project_id)?.project_code || '—'}</TableCell><TableCell className="min-w-40">{suppliers.find(s => s.id === invoice.supplier_id)?.name || '—'}</TableCell><TableCell><Badge variant={invoice.doc_type === 'credit_note' ? 'destructive' : 'secondary'} className="whitespace-nowrap">{typeName(invoice.doc_type)}</Badge></TableCell><TableCell className="font-mono whitespace-nowrap">{money(invoice.amount_original, invoice.currency)}</TableCell><TableCell className="font-mono whitespace-nowrap">{money(signedInvoiceAmount(invoice))}</TableCell>
      <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" title={t('Download attachment', 'Λήψη συνημμένου')} aria-label={t('Download attachment', 'Λήψη συνημμένου')} disabled={downloading === invoice.id} onClick={() => download(invoice)}>{downloading === invoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button><Button variant="ghost" size="icon" title={t('Edit invoice', 'Επεξεργασία παραστατικού')} aria-label={t('Edit invoice', 'Επεξεργασία παραστατικού')} onClick={() => { setEditing(invoice); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title={t('Delete invoice', 'Διαγραφή παραστατικού')} aria-label={t('Delete invoice', 'Διαγραφή παραστατικού')} className="text-destructive" onClick={() => setDeleting(invoice)}><Trash2 className="h-4 w-4" /></Button></div></TableCell>
    </TableRow>)}</TableBody></Table></div>}
    <Button disabled={loading || failed} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="h-4 w-4 mr-2" />{t('New Invoice', 'Νέο Παραστατικό')}</Button>
    {formOpen && <InvoiceForm invoice={editing} projects={projects} suppliers={suppliers} onSupplierAdded={s => setSuppliers(current => [...current, s].sort((a, b) => a.name.localeCompare(b.name)))} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />}
    <AlertDialog open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('Delete invoice?', 'Διαγραφή παραστατικού;')}</AlertDialogTitle><AlertDialogDescription>{t('The invoice and its attachment will be deleted.', 'Το παραστατικό και το συνημμένο του θα διαγραφούν.')} {deleting?.invoice_number}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>{t('Cancel', 'Ακύρωση')}</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); remove(); }}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('Delete', 'Διαγραφή')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}