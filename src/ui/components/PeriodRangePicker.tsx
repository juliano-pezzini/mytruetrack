import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  compareMonths,
  formatSpanLabel,
  monthSpanForShortcut,
  shiftYear,
  type CalendarMonth,
  type MonthSpan,
  type PeriodShortcut,
} from '../../domain/period-span.ts';

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const SHORTCUTS: readonly { shortcut: PeriodShortcut; label: string }[] = [
  { shortcut: 'this-month', label: 'This month' },
  { shortcut: 'last-3-months', label: 'Last 3 months' },
  { shortcut: 'this-year', label: 'This year' },
  { shortcut: 'last-12-months', label: 'Last 12 months' },
];

type PeriodRangePickerProps = {
  span: MonthSpan;
  today: CalendarMonth;
  onChange: (span: MonthSpan) => void;
};

export function PeriodRangePicker({ span, today, onChange }: PeriodRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pendingStart, setPendingStart] = useState<CalendarMonth | null>(null);
  const [hoverEnd, setHoverEnd] = useState<CalendarMonth | null>(null);
  const [fromYear, setFromYear] = useState(span.start.year);
  const [toYear, setToYear] = useState(span.end.year);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const dismiss = useCallback(() => {
    setOpen(false);
    setPendingStart(null);
    setHoverEnd(null);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      dismiss();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, dismiss]);

  function openPopover() {
    setFromYear(span.start.year);
    setToYear(span.end.year);
    setPendingStart(null);
    setHoverEnd(null);
    setOpen(true);
  }

  function chooseShortcut(shortcut: PeriodShortcut) {
    onChange(monthSpanForShortcut(today, shortcut));
    dismiss();
  }

  function chooseFrom(month: number) {
    setPendingStart({ year: fromYear, month });
    setHoverEnd(null);
  }

  function chooseTo(month: number) {
    const end = { year: toYear, month };
    if (pendingStart === null || compareMonths(end, pendingStart) < 0) {
      setPendingStart(end);
      setHoverEnd(null);
      return;
    }
    onChange({ start: pendingStart, end });
    dismiss();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Period"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? dismiss() : openPopover())}
        className="min-w-[140px] border border-mtt-border rounded-lg px-3 py-2 text-sm bg-mtt-surface text-mtt-fg focus:outline-none focus:ring-2 focus:ring-mtt-accent"
      >
        {formatSpanLabel(span)}
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-20 mt-1 w-max max-w-[calc(100vw-2rem)] rounded-xl border border-mtt-border bg-mtt-surface p-3 shadow-lg"
        >
          <div className="flex flex-col gap-1 mb-3">
            {SHORTCUTS.map((item) => (
              <button
                key={item.shortcut}
                type="button"
                onClick={() => chooseShortcut(item.shortcut)}
                className="text-left text-sm px-2 py-1.5 rounded-md text-mtt-fg hover:bg-mtt-border/50"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <MonthGrid
              label="From"
              year={fromYear}
              pendingStart={pendingStart}
              hoverEnd={hoverEnd}
              onPreviousYear={() => setFromYear((year) => shiftYear({ year, month: 1 }, -1).year)}
              onNextYear={() => setFromYear((year) => shiftYear({ year, month: 1 }, 1).year)}
              onPick={chooseFrom}
            />
            <MonthGrid
              label="To"
              year={toYear}
              pendingStart={pendingStart}
              hoverEnd={hoverEnd}
              onPreviousYear={() => setToYear((year) => shiftYear({ year, month: 1 }, -1).year)}
              onNextYear={() => setToYear((year) => shiftYear({ year, month: 1 }, 1).year)}
              onPick={chooseTo}
              onHover={(month) => setHoverEnd(month === null ? null : { year: toYear, month })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type MonthGridProps = {
  label: 'From' | 'To';
  year: number;
  pendingStart: CalendarMonth | null;
  hoverEnd: CalendarMonth | null;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onPick: (month: number) => void;
  onHover?: (month: number | null) => void;
};

function MonthGrid({
  label,
  year,
  pendingStart,
  hoverEnd,
  onPreviousYear,
  onNextYear,
  onPick,
  onHover,
}: MonthGridProps) {
  return (
    <div role="group" aria-label={label} className="min-w-[16rem]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Previous year"
          onClick={onPreviousYear}
          className="p-1.5 text-mtt-muted hover:bg-mtt-border/50 rounded-md"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-mtt-fg">{year}</span>
        <button
          type="button"
          aria-label="Next year"
          onClick={onNextYear}
          className="p-1.5 text-mtt-muted hover:bg-mtt-border/50 rounded-md"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {SHORT_MONTHS.map((name, index) => {
          const month = index + 1;
          const cell = { year, month };
          const pending = pendingStart !== null && compareMonths(pendingStart, cell) === 0;
          const preview = inPreview(cell, pendingStart, hoverEnd);
          return (
            <button
              key={name}
              type="button"
              aria-label={longMonthName(year, month)}
              aria-pressed={pending}
              onClick={() => onPick(month)}
              onMouseEnter={onHover ? () => onHover(month) : undefined}
              onMouseLeave={onHover ? () => onHover(null) : undefined}
              className={`px-2 py-1.5 text-sm rounded-md ${
                pending || preview
                  ? 'bg-mtt-accent/20 text-mtt-fg'
                  : 'text-mtt-fg hover:bg-mtt-border/50'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function inPreview(
  cell: CalendarMonth,
  start: CalendarMonth | null,
  hover: CalendarMonth | null,
): boolean {
  if (start === null || hover === null) return false;
  if (compareMonths(hover, start) < 0) return false;
  return compareMonths(cell, start) >= 0 && compareMonths(cell, hover) <= 0;
}

function longMonthName(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
