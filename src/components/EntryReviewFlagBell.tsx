import { Bell, Flag, CheckCircle2, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useEntryReviewFlags } from '@/hooks/useEntryReviewFlags';
import { format } from 'date-fns';
import { el, enUS } from 'date-fns/locale';

/**
 * Bell icon (top bar) showing open + recently resolved review-flag counts.
 */
export function EntryReviewFlagBell() {
  const { language } = useLanguage();
  const { hasElevatedRole } = useAuth();
  const { flags, resolvedRecent, openCount, resolvedRecentCount } = useEntryReviewFlags();

  if (!hasElevatedRole) return null;

  const dateLocale = language === 'el' ? el : enUS;
  const t = (en: string, gr: string) => (language === 'el' ? gr : en);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={`${openCount} ${t('open', 'ανοιχτές')} • ${resolvedRecentCount} ${t('recently resolved', 'πρόσφατα επιλυμένες')}`}
        >
          <Bell className="h-5 w-5" />
          {openCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-orange-500 hover:bg-orange-600 border-2 border-background">
              {openCount > 99 ? '99+' : openCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-4 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4 text-orange-500" />
            {t('Review Flags', 'Σημαίες Επανελέγχου')}
          </h4>
        </div>
        <div className="max-h-[28rem] overflow-y-auto divide-y">
          {/* OPEN section */}
          <div>
            <div className="px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Flag className="h-3 w-3 text-orange-500" />
                {t('Open', 'Ανοιχτές')}
              </span>
              <Badge variant="secondary" className="h-5">{openCount}</Badge>
            </div>
            {openCount === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                {t('No open flags 🎉', 'Καμία ανοιχτή σημαία 🎉')}
              </p>
            ) : (
              <ul className="divide-y">
                {flags.slice(0, 10).map((f) => (
                  <li key={f.id} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start gap-2">
                      <Flag className="h-4 w-4 text-orange-500 mt-0.5 fill-orange-200 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm break-words">{f.reason}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(f.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* RESOLVED (72h) section */}
          {resolvedRecentCount > 0 && (
            <div>
              <div className="px-4 py-2 bg-muted/40 text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {t('Recently resolved (72h)', 'Επιλύθηκαν πρόσφατα (72ώ)')}
                </span>
                <Badge variant="secondary" className="h-5">{resolvedRecentCount}</Badge>
              </div>
              <ul className="divide-y">
                {resolvedRecent.slice(0, 8).map((f) => (
                  <li key={f.id} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm break-words text-muted-foreground line-through decoration-1">
                          {f.reason}
                        </p>
                        {f.resolution_notes && (
                          <p className="text-xs text-green-800 mt-1 break-words">
                            ✓ {f.resolution_notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {f.resolved_at &&
                            format(new Date(f.resolved_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="p-2 border-t bg-muted/30">
          <Button asChild variant="ghost" size="sm" className="w-full justify-center gap-1.5">
            <Link to="/admin/review-flags">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('View all pending reviews', 'Όλα τα εκκρεμή επανελέγχου')}
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
