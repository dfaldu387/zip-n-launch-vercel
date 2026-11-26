import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

// Typing "h" keeps names that start with h first, then names with a word that starts with h.
// Names that only have an h somewhere in the middle are hidden.
export const searchScore = (label, search) => {
  const s = String(search || '').trim().toLowerCase();
  if (!s) return 1;
  const text = String(label || '').toLowerCase();
  if (text.startsWith(s)) return 2;
  return text.split(/[\s(),/-]+/).some((w) => w.startsWith(s)) ? 1 : 0;
};

/**
 * A dropdown you can type in. Pick from the list or type the first letters to narrow it down.
 * options: [{ value, label }]
 */
const DisciplineSearchSelect = ({ value, onChange, options, placeholder = 'Pick...', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => String(o.value) === String(value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
          className="w-full justify-between font-normal">
          <span className={`truncate ${current ? '' : 'text-muted-foreground'}`}>{current ? current.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command filter={(itemValue, search) => searchScore(itemValue, search)}>
          <CommandInput placeholder="Type to search..." />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(String(o.value)); setOpen(false); }}>
                  <Check className={`mr-2 h-4 w-4 ${String(o.value) === String(value) ? 'opacity-100' : 'opacity-0'}`} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default DisciplineSearchSelect;
