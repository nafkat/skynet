import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RefreshButtonProps {
  onRefresh: () => Promise<void>;
  lastRefresh: Date | null;
}

export function RefreshButton({ onRefresh, lastRefresh }: RefreshButtonProps) {
  const { t } = useLanguage();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Refresh failed:', error);
      toast.error(t('common.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={refreshing}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        {t('common.refresh')}
      </Button>
      {lastRefresh && (
        <span className="text-xs text-muted-foreground">
          {t('common.lastRefresh')}: {format(lastRefresh, 'dd/MM/yyyy HH:mm')}
        </span>
      )}
    </div>
  );
}
