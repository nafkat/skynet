import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Pencil, History, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { isoToDisplay } from '@/lib/dateUtils';
import { resolveRatesForDate, type PayRateRow } from '@/lib/payrollCalc';

interface Row extends PayRateRow {
  id: string;
  notes: string | null;
}

interface PayRateHistoryProps {
  employeeId: string;
  /** Current cached rates on the employees table — used as fallback display. */
  currentRates: {
    regular_hourly_rate: number;
    regular_rate_all_in: number;
    overtime_hourly_rate: number;
  };
  onRatesChanged?: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => (Number(n) || 0).toFixed(3);

export function PayRateHistory({ employeeId, currentRates, onRatesChanged }: PayRateHistoryProps) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const el = language === 'el';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);

  const [regular, setRegular] = useState('');
  const [allIn, setAllIn] = useState('');
  const [overtime, setOvertime] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('employee_pay_rates')
      .select('id, employee_id, effective_from, regular_hourly_rate, regular_rate_all_in, overtime_hourly_rate, notes')
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false });
    if (error) {
      console.error('Pay rate history load error:', error);
      toast.error(el ? 'Σφάλμα φόρτωσης ιστορικού αποδοχών' : 'Failed to load pay rate history');
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  }, [employeeId, el]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayIso();
  const current = resolveRatesForDate(rows, today, {
    effective_from: '0001-01-01',
    regular_hourly_rate: currentRates.regular_hourly_rate || 0,
    regular_rate_all_in: currentRates.regular_rate_all_in || 0,
    overtime_hourly_rate: currentRates.overtime_hourly_rate || 0,
  });

  const openNew = () => {
    setEditingRow(null);
    setRegular(String(current.regular_hourly_rate ?? ''));
    setAllIn(String(current.regular_rate_all_in ?? ''));
    setOvertime(String(current.overtime_hourly_rate ?? ''));
    setEffectiveFrom(today);
    setNotes('');
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditingRow(row);
    setRegular(String(row.regular_hourly_rate ?? ''));
    setAllIn(String(row.regular_rate_all_in ?? ''));
    setOvertime(String(row.overtime_hourly_rate ?? ''));
    setEffectiveFrom(row.effective_from);
    setNotes(row.notes ?? '');
    setDialogOpen(true);
  };

  const valid = () =>
    parseFloat(regular) > 0 && parseFloat(allIn) > 0 && parseFloat(overtime) > 0 && !!effectiveFrom;

  const handleSave = async () => {
    if (!valid()) {
      toast.error(el ? 'Όλες οι τιμές πρέπει να είναι μεγαλύτερες του 0' : 'All rates must be greater than 0');
      return;
    }
    setSaving(true);
    const payload = {
      employee_id: employeeId,
      regular_hourly_rate: parseFloat(regular),
      regular_rate_all_in: parseFloat(allIn),
      overtime_hourly_rate: parseFloat(overtime),
      effective_from: effectiveFrom,
      notes: notes.trim() || null,
    };

    try {
      if (editingRow) {
        const { error } = await supabase
          .from('employee_pay_rates')
          .update(payload)
          .eq('id', editingRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_pay_rates')
          .insert([{ ...payload, created_by: user?.id ?? null }]);
        if (error) throw error;
      }

      // Keep the current-rate cache on employees in sync when the row is effective now.
      const nextRows = editingRow
        ? rows.map(r => (r.id === editingRow.id ? { ...r, ...payload } as Row : r))
        : [...rows, { ...payload, id: 'tmp', notes: payload.notes } as unknown as Row];
      const effectiveNow = resolveRatesForDate(nextRows, todayIso(), {
        effective_from: '0001-01-01',
        ...currentRates,
      });
      if (effectiveFrom <= todayIso()) {
        const { error: empErr } = await supabase
          .from('employees')
          .update({
            regular_hourly_rate: effectiveNow.regular_hourly_rate,
            regular_rate_all_in: effectiveNow.regular_rate_all_in,
            overtime_hourly_rate: effectiveNow.overtime_hourly_rate,
          })
          .eq('id', employeeId);
        if (empErr) throw empErr;
      }

      toast.success(
        editingRow
          ? el ? 'Η τιμή διορθώθηκε' : 'Rate corrected'
          : el ? 'Η νέα τιμή αποθηκεύτηκε' : 'New rate saved'
      );
      setDialogOpen(false);
      await load();
      onRatesChanged?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Pay rate save error:', error);
      toast.error(
        message.includes('duplicate') || message.includes('uniq')
          ? el ? 'Υπάρχει ήδη τιμή για αυτή την ημερομηνία' : 'A rate already exists for this date'
          : message
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <History className="h-4 w-4" />
          {el ? 'Ιστορικό Αποδοχών' : 'Pay Rate History'}
        </h3>
        <Button type="button" size="sm" variant="outline" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          {el ? 'Νέα Τιμή' : 'New Rate'}
        </Button>
      </div>

      {/* Current rates */}
      <div className="rounded-xl bg-muted/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="default">{el ? 'Ισχύει τώρα' : 'Current'}</Badge>
          <span className="text-xs text-muted-foreground">{isoToDisplay(today)}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-sm font-mono">
          <div>
            <p className="text-xs text-muted-foreground font-sans">{el ? 'Κανονική' : 'Regular'}</p>
            €{fmt(current.regular_hourly_rate)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-sans">{el ? 'All-in' : 'All-in'}</p>
            €{fmt(current.regular_rate_all_in)}
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-sans">{el ? 'Υπερωρία' : 'Overtime'}</p>
            €{fmt(current.overtime_hourly_rate)}
          </div>
        </div>
      </div>

      {/* History list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">{el ? 'Φόρτωση...' : 'Loading...'}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {el ? 'Δεν υπάρχουν καταχωρήσεις ιστορικού.' : 'No history rows yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-lg border p-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{isoToDisplay(row.effective_from)}</span>
                  {row.effective_from > today && (
                    <Badge variant="secondary">{el ? 'Προγραμματισμένη' : 'Scheduled'}</Badge>
                  )}
                </div>
                <p className="text-xs font-mono text-muted-foreground">
                  {el ? 'Καν.' : 'Reg.'} €{fmt(row.regular_hourly_rate)} · All-in €{fmt(row.regular_rate_all_in)} ·{' '}
                  {el ? 'Υπερ.' : 'OT'} €{fmt(row.overtime_hourly_rate)}
                </p>
                {row.notes && <p className="text-xs text-muted-foreground break-words">{row.notes}</p>}
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={() => openEdit(row)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground flex items-start gap-1">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        {el
          ? 'Διορθώσεις εδώ επανυπολογίζουν παλιές μισθοδοσίες'
          : 'Corrections here recalculate past payrolls'}
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRow
                ? el ? 'Διόρθωση Τιμής' : 'Correct Rate'
                : el ? 'Νέα Τιμή' : 'New Rate'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{el ? 'Ισχύει από' : 'Effective from'} *</Label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{isoToDisplay(effectiveFrom)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">{el ? 'Κανονική' : 'Regular'} *</Label>
                <Input type="number" step="0.001" min="0.001" value={regular} placeholder="0.000"
                  onChange={(e) => setRegular(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">All-in *</Label>
                <Input type="number" step="0.001" min="0.001" value={allIn} placeholder="0.000"
                  onChange={(e) => setAllIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{el ? 'Υπερωρία' : 'Overtime'} *</Label>
                <Input type="number" step="0.001" min="0.001" value={overtime} placeholder="0.000"
                  onChange={(e) => setOvertime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{el ? 'Σημειώσεις (προαιρετικό)' : 'Notes (optional)'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                {el ? 'Άκυρο' : 'Cancel'}
              </Button>
              <Button type="button" className="flex-1" disabled={saving || !valid()} onClick={handleSave}>
                {saving ? (el ? 'Αποθήκευση...' : 'Saving...') : el ? 'Αποθήκευση' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
