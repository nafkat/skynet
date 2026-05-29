import { Bell, Flag } from 'lucide-react';
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
 * Bell icon (top bar) showing open review-flag count.
 * Click → popover with list of recent flags. Real-time updates.
 */
export function EntryReviewFlagBell() {
  const { language } = useLanguage();
  const { hasElevatedRole } = useAuth();
  const { flags, openCount } = useEntryReviewFlags();

  if (!hasElevatedRole) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={
            language === 'el'
              ? `${openCount} ανοιχτές σημαίες επανελέγχου`
              : `${openCount} open review flags`
          }
        >
          <Bell className="h-5 w-5" />
          {openCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-orange-500 hover:bg-orange-600 border-2 border-background"
            >
              {openCount > 99 ? '99+' : openCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-4 border-b">
          <h4 className="font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4 text-orange-500" />
            {language === 'el'
              ? 'Σημαίες Επανελέγχου'
              : 'Review Flags'}
            {openCount > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {openCount}
              </Badge>
            )}
          </h4>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {openCount === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {language === 'el'
                ? 'Καμία ενεργή σημαία 🎉'
                : 'No open flags 🎉'}
            </div>
          ) : (
            <ul className="divide-y">
              {flags.slice(0, 20).map((f) => (
                <li key={f.id} className="p-3 hover:bg-muted/50">
                  <div className="flex items-start gap-2">
                    <Flag className="h-4 w-4 text-orange-500 mt-0.5 fill-orange-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground break-words">
                        {f.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(f.created_at), 'dd/MM/yyyy HH:mm', {
                          locale: language === 'el' ? el : enUS,
                        })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
              {flags.length > 20 && (
                <li className="p-3 text-center text-xs text-muted-foreground">
                  +{flags.length - 20} {language === 'el' ? 'ακόμα' : 'more'}
                </li>
              )}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
