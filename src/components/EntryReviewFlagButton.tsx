import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { raiseEntryReviewFlag, useEntryReviewFlags } from '@/hooks/useEntryReviewFlags';
import { cn } from '@/lib/utils';

interface EntryReviewFlagButtonProps {
  /** One or many time_entry IDs the flag(s) will be attached to */
  timeEntryIds: string[];
  /** Optional label shown next to icon (employee name / context) */
  contextLabel?: string;
  /** Compact icon-only variant (default) or with text */
  variant?: 'icon' | 'compact';
}

/**
 * 🚩 Review-flag button. Visible only to Admin/HR.
 * Shows existing open-flag count as a badge, opens dialog to raise a new flag.
 */
export function EntryReviewFlagButton({
  timeEntryIds,
  contextLabel,
  variant = 'icon',
}: EntryReviewFlagButtonProps) {
  const { language } = useLanguage();
  const { user, hasElevatedRole } = useAuth();
  const { getFlagsForEntries, refetch } = useEntryReviewFlags();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!hasElevatedRole) return null;

  const existingFlags = getFlagsForEntries(timeEntryIds);
  const openCount = existingFlags.length;
  const hasOpen = openCount > 0;

  const handleSubmit = async () => {
    if (!reason.trim() || !user) return;
    setSubmitting(true);
    const result = await raiseEntryReviewFlag(timeEntryIds, reason, user.id);
    setSubmitting(false);

    if (result.success) {
      toast.success(
        language === 'el'
          ? `Σημαία επανελέγχου δημιουργήθηκε (${result.count})`
          : `Review flag raised (${result.count})`
      );
      setReason('');
      setOpen(false);
      refetch();
    } else {
      toast.error(
        language === 'el'
          ? `Σφάλμα: ${result.error}`
          : `Error: ${result.error}`
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 h-8',
            hasOpen && 'text-orange-600 hover:text-orange-700'
          )}
          title={
            hasOpen
              ? language === 'el'
                ? `${openCount} ανοιχτή σημαία επανελέγχου`
                : `${openCount} open review flag(s)`
              : language === 'el'
              ? 'Σήμανση για επανέλεγχο'
              : 'Flag for review'
          }
        >
          <Flag className={cn('h-4 w-4', hasOpen && 'fill-orange-500')} />
          {variant === 'compact' && (
            <span className="text-xs">
              {language === 'el' ? 'Επανέλεγχος' : 'Review'}
            </span>
          )}
          {hasOpen && (
            <Badge
              variant="secondary"
              className="h-5 px-1.5 text-xs bg-orange-100 text-orange-700 border-orange-300"
            >
              {openCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            {language === 'el'
              ? 'Σήμανση Καταχώρησης για Επανέλεγχο'
              : 'Flag Entry for Review'}
          </DialogTitle>
          <DialogDescription>
            {contextLabel && (
              <span className="block font-medium text-foreground mb-1">
                {contextLabel}
              </span>
            )}
            {language === 'el'
              ? 'Η σημαία θα ειδοποιήσει real-time τους άλλους Admin/HR χρήστες. Όταν διορθωθεί η καταχώρηση, η σημαία κλείνει αυτόματα.'
              : 'The flag notifies other Admin/HR users in real-time. When the entry is edited or deleted, the flag auto-resolves.'}
          </DialogDescription>
        </DialogHeader>

        {hasOpen && (
          <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm">
            <p className="font-medium text-orange-900 mb-1">
              {language === 'el'
                ? `${openCount} υπάρχουσα${openCount > 1 ? 'ες' : ''} σημαία${openCount > 1 ? 'ες' : ''}:`
                : `${openCount} existing flag${openCount > 1 ? 's' : ''}:`}
            </p>
            <ul className="text-orange-800 space-y-1">
              {existingFlags.slice(0, 3).map((f) => (
                <li key={f.id} className="truncate">
                  • {f.reason}
                </li>
              ))}
              {existingFlags.length > 3 && (
                <li className="text-orange-700">
                  +{existingFlags.length - 3} {language === 'el' ? 'ακόμα' : 'more'}
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="flag-reason">
            {language === 'el' ? 'Αιτιολογία / Σχόλιο' : 'Reason / Comment'}
            <span className="text-destructive ml-0.5">*</span>
          </Label>
          <Textarea
            id="flag-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              language === 'el'
                ? 'Περιγράψτε τι χρειάζεται επανέλεγχο...'
                : 'Describe what needs to be re-checked...'
            }
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">
            {reason.length}/500
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {language === 'el' ? 'Άκυρο' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Flag className="h-4 w-4 mr-1.5" />
            {submitting
              ? language === 'el'
                ? 'Αποστολή...'
                : 'Submitting...'
              : language === 'el'
              ? 'Σήμανση'
              : 'Raise Flag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
