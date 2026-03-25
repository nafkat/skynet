import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { el } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DatePickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  disabled,
}: DatePickerProps) {
  const selectedDate = value ? new Date(`${value}T12:00:00`) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'input-tablet w-full justify-between text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span>{selectedDate ? formatDate(selectedDate) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? format(date, 'yyyy-MM-dd') : '')}
          locale={el}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
