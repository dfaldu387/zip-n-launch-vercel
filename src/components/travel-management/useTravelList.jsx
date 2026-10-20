import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Eraser, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { hasEnteredTravel, clearTravelCard } from '@/lib/travelDefaults';

// Shared by the Flights, Hotels, Rental Cars and Mileage tabs: each person's card can be
// opened or closed, and the list can be searched and filtered by Booked / Not set.
// `isBooked(member)` is supplied by each tab because "booked" means something different
// for a flight, a hotel, a car or a mileage trip.
export function useTravelList(personnel, isBooked) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all'); // all | booked | notset
  const [closed, setClosed] = useState({}); // memberId -> true when the card is closed

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personnel.filter((m) => {
      if (q && !`${m.name || ''} ${m.roleName || ''}`.toLowerCase().includes(q)) return false;
      if (status === 'booked') return !!isBooked(m);
      if (status === 'notset') return !isBooked(m);
      return true;
    });
  }, [personnel, query, status, isBooked]);

  const isOpen = (id) => !closed[id];
  const toggle = (id) => setClosed((prev) => ({ ...prev, [id]: !prev[id] }));
  const openAll = () => setClosed({});
  const closeAll = () => setClosed(Object.fromEntries(personnel.map((m) => [m.id, true])));

  return { filtered, query, setQuery, status, setStatus, isOpen, toggle, openAll, closeAll };
}

export const TravelListToolbar = ({ list, total }) => {
  const { query, setQuery, status, setStatus, openAll, closeAll, filtered } = list;
  if (total === 0) return null;
  const options = [['all', 'All'], ['booked', 'Booked'], ['notset', 'Not set']];
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search staff by name or role"
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-1">
        {options.map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={status === value ? 'default' : 'outline'}
            onClick={() => setStatus(value)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={openAll}>Open all</Button>
        <Button type="button" size="sm" variant="ghost" onClick={closeAll}>Close all</Button>
      </div>
      {filtered.length !== total && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} of {total}</span>
      )}
    </div>
  );
};

export const CardToggle = ({ open, onToggle, label }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    onClick={onToggle}
    aria-expanded={open}
    aria-label={`${open ? 'Close' : 'Open'} ${label}`}
  >
    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
  </Button>
);

// Two-click "Clear": the first click asks, the second wipes what was typed on this one card
// (not the other travel cards, not the staff member). Shown only when something was typed.
export const ClearCardButton = ({ entry, memberId, travelKey, setTravelData, budgetFrozen }) => {
  const [asking, setAsking] = useState(false);
  if (!hasEnteredTravel(entry, travelKey)) return null;
  const clear = () => {
    setTravelData((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [travelKey]: clearTravelCard(prev[memberId]?.[travelKey], budgetFrozen) },
    }));
    setAsking(false);
  };
  if (asking) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button type="button" size="sm" variant="destructive" className="h-8 px-2 text-xs" onClick={clear}>Yes, clear</Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setAsking(false)}>Cancel</Button>
      </span>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-8 px-2 text-xs text-muted-foreground"
      title="Remove everything typed on this card"
      onClick={() => setAsking(true)}
    >
      <Eraser className="h-3.5 w-3.5 mr-1" /> Clear
    </Button>
  );
};

export const NoMatches = () => (
  <div className="py-8 text-center text-sm text-muted-foreground">No staff match this search.</div>
);
