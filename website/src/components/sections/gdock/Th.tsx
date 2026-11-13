export function Th({
  label,
  tooltip,
  align = 'center',
  onSort,
  sortDir,
}: {
  label: string;
  tooltip: string;
  align?: 'left' | 'right' | 'center';
  onSort?: () => void;
  sortDir?: 'asc' | 'desc' | null;
}) {
  return (
    <th
      className={`text-${align} px-3 py-2 font-medium text-slate-500 dark:text-slate-400${onSort ? ' cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200' : ''}`}
      onClick={onSort}
    >
      <span className="group relative inline-flex items-center gap-1 cursor-default">
        {label}
        {onSort ? (
          <span className="inline-flex flex-col leading-none text-[8px] text-slate-400 dark:text-slate-500">
            <span className={sortDir === 'asc' ? 'text-slate-700 dark:text-slate-200' : ''}>▲</span>
            <span className={sortDir === 'desc' ? 'text-slate-700 dark:text-slate-200' : ''}>▼</span>
          </span>
        ) : (
          <svg className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-xs text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity z-[9999] text-left font-normal shadow-lg">
          {tooltip}
        </span>
      </span>
    </th>
  );
}
