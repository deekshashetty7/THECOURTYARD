import { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { cn } from './ui/utils';
import { datePickerCalendarClassNames } from './datePickerStyles';

type DatePickerFieldProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  className?: string;
};

const toLocalDate = (value: string) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const DatePickerField = ({
  label,
  value,
  onChange,
  minDate,
  disabled = false,
  required = false,
  error,
  placeholder = 'Select date',
  className,
}: DatePickerFieldProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | undefined>(toLocalDate(value));

  useEffect(() => {
    if (!isOpen) {
      setDraftDate(toLocalDate(value));
    }
  }, [isOpen, value]);

  const minDateValue = useMemo(() => toLocalDate(minDate || ''), [minDate]);
  const selectedDate = toLocalDate(value);

  const openPicker = () => {
    if (!disabled) {
      setDraftDate(selectedDate || minDateValue || new Date());
      setIsOpen(true);
    }
  };

  const closePicker = () => {
    setIsOpen(false);
  };

  const handleClear = () => {
    const fallbackDate = minDateValue || new Date();
    setDraftDate(fallbackDate);
    onChange(toDateKey(fallbackDate));
    setIsOpen(false);
  };

  const handleSet = () => {
    if (!draftDate) {
      return;
    }

    onChange(toDateKey(draftDate));
    setIsOpen(false);
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {label}{required ? <span className="text-red-500"> *</span> : null}
        </label>
      )}

      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#808000]',
          error && 'border-red-500 focus:ring-red-500',
          disabled && 'cursor-not-allowed bg-gray-100 text-gray-400',
        )}
      >
        <span className={cn('truncate', value ? 'text-gray-800' : 'text-gray-400')}>
          {value ? format(new Date(`${value}T12:00:00`), 'EEE, MMM d, yyyy') : placeholder}
        </span>
        <CalendarIcon className="h-4 w-4 text-gray-400" />
      </button>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {isOpen && !disabled && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-[28px] bg-[#1f2430] text-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {draftDate ? format(draftDate, 'yyyy') : ''}
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-white">
                  {draftDate ? format(draftDate, 'EEE, MMM d') : 'Select Date'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePicker}
                className="rounded-full p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close date picker"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              <Calendar
                mode="single"
                selected={draftDate}
                onSelect={(date) => {
                  if (date) {
                    setDraftDate(date);
                  }
                }}
                disabled={minDateValue ? { before: minDateValue } : undefined}
                className="p-0"
                classNames={datePickerCalendarClassNames}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={handleClear}
                className="text-sm font-medium text-[#9dc4ff] transition-colors hover:text-white"
              >
                Clear
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closePicker}
                  className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSet}
                  className="rounded-full bg-[#9dc4ff] px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-[#b7d6ff]"
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
