export const datePickerCalendarClassNames = {
  months: 'flex flex-col gap-4',
  month: 'flex flex-col gap-4',
  caption: 'relative flex items-center justify-center px-10 pt-1',
  caption_label: 'text-sm font-semibold text-slate-100',
  nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-0',
  nav_button:
    'h-8 w-8 rounded-full border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white',
  nav_button_previous: 'absolute left-0',
  nav_button_next: 'absolute right-0',
  table: 'w-full border-collapse',
  head_row: 'flex w-full justify-between',
  head_cell: 'w-9 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-400',
  row: 'mt-2 flex w-full justify-between',
  cell: 'relative h-9 w-9 p-0 text-center text-sm',
  day:
    'h-9 w-9 rounded-full text-sm font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white',
  day_range_start: 'bg-[#9dc4ff] text-slate-900 hover:bg-[#9dc4ff] hover:text-slate-900',
  day_range_end: 'bg-[#9dc4ff] text-slate-900 hover:bg-[#9dc4ff] hover:text-slate-900',
  day_selected: 'bg-[#9dc4ff] text-slate-900 hover:bg-[#9dc4ff] hover:text-slate-900',
  day_today: 'border border-[#9dc4ff]/50 text-[#9dc4ff]',
  day_outside: 'text-slate-600 opacity-40',
  day_disabled: 'text-slate-600 opacity-30 line-through',
  day_range_middle: 'bg-white/10 text-slate-100 hover:bg-white/10 hover:text-white',
  day_hidden: 'invisible',
};

export const datePickerCalendarWrapperClass = 'rounded-[24px] bg-[#1f2430] p-4 text-white shadow-2xl';
