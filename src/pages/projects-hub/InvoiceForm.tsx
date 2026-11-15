import { useEffect, useRef, useState } from 'react';
import { Plus, Loader2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calculateInvoiceEur, fetchEcbRates, INVOICE_CURRENCIES, INVOICE_FILE_ACCEPT, validateInvoiceFile } from '@/lib/invoiceCalc';

export type HubProject = Pick<Tables<'projects'>, 'id' | 'project_code' | 'project_name'>;
export type HubSupplier = Pick<Tables<'suppliers'>, 'id' | 'name' | 'vat_number'>;
export type Invoice = Tables<'project_invoices'>;

export default function InvoiceForm({ invoice, projects, suppliers, onSupplierAdded, onClose, onSaved }: {
  invoice: Invoice | null; projects: HubProject[]; suppliers: HubSupplier[];
  onSupplierAdded: (supplier: HubSupplier) => void; onClose: () => void; onSaved: () => void;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const t = (en: string, el: string) => language === 'el' ? el : en;
  const [form, setForm] = useState({ project_id: invoice?.project_id || '', supplier_id: invoice?.supplier_id || '', doc_type: invoice?.doc_type || 'invoice', source: invoice?.source || 'paper', invoice_number: invoice?.invoice_number || '', issue_date: invoice?.issue_date || '', currency: invoice?.currency || 'EUR', amount: invoice ? String(invoice.amount_original) : '', rate: invoice ? String(invoice.exchange_rate) : '1', notes: invoice?.notes || '' });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSaving, setSupplierSaving] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierVat, setSupplierVat] = useState('');
  const [rateUnavailable, setRateUnavailable] = useState(false);
  const rateVersion = useRef(0);
  useEffect(() => () => { rateVersion.current++; }, []);
  const set = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const amount = Number(form.amount);
  const rate = form.currency === 'EUR' ? 1 : Number(form.rate);
  let eur = 0;
  if (amount > 0 && rate > 0) eur = calculateInvoiceEur(amount, rate, form.currency);

  const currencyChanged = async (currency: string) => {
    const version = ++rateVersion.current;
    setForm(current => ({ ...current, currency, rate: currency === 'EUR' ? '1' : '' }));
    setRateUnavailable(false);
    if (currency === 'EUR') return;
    try {
      const rates = await fetchEcbRates();
      if (rateVersion.current !== version) return;
      const fetched = rates[currency];
      if (!fetched) throw new Error('Rate missing');
      set('rate', fetched.toFixed(6));
    } catch {
      if (rateVersion.current === version) setRateUnavailable(true);
    }
  };

  const addSupplier = async () => {
    if (!supplierName.trim()) return;
    setSupplierSaving(true);
    try {
      const { data, error } = await supabase.from('suppliers').insert({ name: supplierName.trim(), trade_name: supplierName.trim(), vat_number: supplierVat.trim() }).select('id,name,vat_number').single();
      if (error) throw error;
      onSupplierAdded(data);
      set('supplier_id', data.id);
      setSupplierOpen(false);
      setSupplierName(''); setSupplierVat('');
      toast.success(t('Supplier added', 'Ο προμηθευτής προστέθηκε'));
    } catch { toast.error(t('Could not add supplier', 'Αποτυχία προσθήκης προμηθευτή')); }
    finally { setSupplierSaving(false); }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || saving) return;
    if (!form.project_id || !form.supplier_id || !form.invoice_number.trim() || !form.issue_date || !(amount > 0) || !(rate > 0) || (!file && !invoice?.file_path)) {
      toast.error(t('Complete all required fields and attach a file', 'Συμπληρώστε όλα τα υποχρεωτικά πεδία και επισυνάψτε αρχείο')); return;
    }
    setSaving(true);
    let uploaded: string | null = null;
    let persisted = false;
    try {
      const normalizedAmount = Number(amount.toFixed(2));
      const normalizedRate = Number(rate.toFixed(6));
      const amountEur = calculateInvoiceEur(normalizedAmount, normalizedRate, form.currency);
      let path = invoice?.file_path || '';
      if (file) {
        const validation = await validateInvoiceFile(file);
        if (!validation.ok) { toast.error(language === 'el' ? validation.errorEl : validation.errorEn); return; }
        path = `${form.project_id}/${crypto.randomUUID()}.${file.name.split('.').pop()?.toLowerCase()}`;
        const { error } = await supabase.storage.from('project-invoices').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        uploaded = path;
      }
      const payload = { project_id: form.project_id, supplier_id: form.supplier_id, doc_type: form.doc_type, source: form.source, invoice_number: form.invoice_number.trim(), issue_date: form.issue_date, currency: form.currency, amount_original: normalizedAmount, exchange_rate: normalizedRate, amount_eur: amountEur, file_path: path, notes: form.notes.trim() || null };
      const result = invoice
        ? await supabase.from('project_invoices').update(payload).eq('id', invoice.id).select('id').single()
        : await supabase.from('project_invoices').insert({ ...payload, created_by: user.id }).select('id').single();
      if (result.error) throw result.error;
      persisted = true;
      if (uploaded && invoice?.file_path) {
        const { error } = await supabase.storage.from('project-invoices').remove([invoice.file_path]);
        if (error) toast.warning(t('Saved, but the previous attachment could not be removed', 'Αποθηκεύτηκε, αλλά το παλιό αρχείο δεν αφαιρέθηκε'));
      }
      toast.success(t('Invoice saved', 'Το παραστατικό αποθηκεύτηκε'));
      onSaved();
    } catch {
      if (uploaded && !persisted) await supabase.storage.from('project-invoices').remove([uploaded]);
      toast.error(t('Could not save invoice. Please try again.', 'Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.'));
    } finally { setSaving(false); }
  };

  const select = (id: string, value: string, onChange: (value: string) => void, options: { value: string; label: string }[], placeholder: string) => <Select value={value} onValueChange={onChange} disabled={saving}><SelectTrigger id={id} className="w-full min-w-0 [&>span]:truncate"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>;
  return <>
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{invoice ? t('Edit invoice', 'Επεξεργασία παραστατικού') : t('New Invoice', 'Νέο Παραστατικό')}</DialogTitle><DialogDescription>{t('Project invoice', 'Παραστατικό έργου')}</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="invoice-project">{t('Project', 'Έργο')} *</Label>{select('invoice-project', form.project_id, v => set('project_id', v), projects.map(p => ({ value: p.id, label: `${p.project_code} — ${p.project_name}` })), t('Select project', 'Επιλογή έργου'))}</div>
          <div className="space-y-2"><div className="flex flex-wrap justify-between items-center gap-2"><Label htmlFor="invoice-supplier">{t('Supplier', 'Προμηθευτής')} *</Label><Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setSupplierOpen(true)}><Plus className="h-4 w-4 mr-1" />{t('New supplier', 'Νέος προμηθευτής')}</Button></div>
            <Select value={form.supplier_id} onValueChange={v => set('supplier_id', v)} disabled={saving}><SelectTrigger id="invoice-supplier" className="[&>span]:truncate"><SelectValue placeholder={t('Select supplier', 'Επιλογή προμηθευτή')} /></SelectTrigger><SelectContent>{suppliers.map(s => <SelectItem value={s.id} key={s.id}>{s.name}{s.vat_number && <span className="text-muted-foreground text-xs ml-2">{s.vat_number}</span>}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="invoice-type">{t('Type', 'Τύπος')} *</Label>{select('invoice-type', form.doc_type, v => set('doc_type', v), [{ value: 'invoice', label: t('Invoice', 'Τιμολόγιο') }, { value: 'receipt', label: t('Receipt', 'Απόδειξη') }, { value: 'credit_note', label: t('Credit note', 'Πιστωτικό') }], '')}</div>
            <div className="space-y-2"><Label htmlFor="invoice-source">{t('Source', 'Πηγή')} *</Label>{select('invoice-source', form.source, v => set('source', v), [{ value: 'paper', label: t('Paper', 'Χαρτί') }, { value: 'electronic', label: t('Electronic', 'Ηλεκτρονικό') }], '')}</div>
            <div className="space-y-2"><Label htmlFor="invoice-number">{t('Invoice number', 'Αριθμός παραστατικού')} *</Label><Input id="invoice-number" required value={form.invoice_number} disabled={saving} onChange={e => set('invoice_number', e.target.value)} /></div>
            <div className="space-y-2"><Label>{t('Issue date', 'Ημερομηνία έκδοσης')} *</Label><DatePicker value={form.issue_date} disabled={saving} onChange={v => set('issue_date', v)} placeholder="DD/MM/YYYY" /></div>
            <div className="space-y-2"><Label htmlFor="invoice-currency">{t('Currency', 'Νόμισμα')} *</Label>{select('invoice-currency', form.currency, currencyChanged, INVOICE_CURRENCIES.map(value => ({ value, label: value })), '')}</div>
            <div className="space-y-2"><Label htmlFor="invoice-amount">{t('Amount', 'Ποσό')} *</Label><Input id="invoice-amount" type="number" min="0.01" step="0.01" required value={form.amount} disabled={saving} onChange={e => set('amount', e.target.value)} /></div>
            {form.currency !== 'EUR' && <div className="space-y-2"><Label htmlFor="invoice-rate">{t('Exchange rate', 'Ισοτιμία')} *</Label><Input id="invoice-rate" type="number" min="0.000001" step="0.000001" required value={form.rate} disabled={saving} onChange={e => { rateVersion.current++; set('rate', e.target.value); }} />{rateUnavailable && <p className="text-sm text-muted-foreground">{t('ECB rate unavailable. Enter a rate.', 'Η ισοτιμία ΕΚΤ δεν είναι διαθέσιμη. Εισαγάγετε ισοτιμία.')}</p>}</div>}
            <div className="space-y-2"><Label>{t('EUR amount', 'Ποσό EUR')}</Label><output className="block py-2 font-mono font-semibold">{eur.toLocaleString(language === 'el' ? 'el-GR' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</output></div>
          </div>
          <div className="space-y-2"><Label htmlFor="invoice-file">{t('File', 'Αρχείο')} *</Label>{invoice?.file_path && <p className="text-xs text-muted-foreground flex items-center gap-1"><Paperclip className="h-3 w-3" />{t('Existing attachment', 'Υπάρχον συνημμένο')}</p>}<Input id="invoice-file" type="file" accept={INVOICE_FILE_ACCEPT} disabled={saving} required={!invoice} onChange={e => setFile(e.target.files?.[0] || null)} /></div>
          <div className="space-y-2"><Label htmlFor="invoice-notes">{t('Notes', 'Σημειώσεις')}</Label><Textarea id="invoice-notes" value={form.notes} disabled={saving} onChange={e => set('notes', e.target.value)} /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>{t('Cancel', 'Ακύρωση')}</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('Save', 'Αποθήκευση')}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={supplierOpen} onOpenChange={open => { if (!supplierSaving) setSupplierOpen(open); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>{t('New supplier', 'Νέος προμηθευτής')}</DialogTitle><DialogDescription>{t('Supplier details', 'Στοιχεία προμηθευτή')}</DialogDescription></DialogHeader>
      <form onSubmit={e => { e.preventDefault(); addSupplier(); }} className="space-y-4"><div className="space-y-2"><Label htmlFor="supplier-name">{t('Name', 'Όνομα')} *</Label><Input id="supplier-name" required value={supplierName} disabled={supplierSaving} onChange={e => setSupplierName(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="supplier-vat">{t('VAT number (optional)', 'ΑΦΜ (προαιρετικό)')}</Label><Input id="supplier-vat" value={supplierVat} disabled={supplierSaving} onChange={e => setSupplierVat(e.target.value)} /></div><DialogFooter><Button type="submit" disabled={supplierSaving || !supplierName.trim()}>{supplierSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{t('Add supplier', 'Προσθήκη προμηθευτή')}</Button></DialogFooter></form>
    </DialogContent></Dialog>
  </>;
}