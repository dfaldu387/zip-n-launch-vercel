import { useMemo, useState } from 'react';
import { AlertTriangle, Briefcase, CalendarDays, GanttChart, List, ChevronLeft, ChevronRight, CheckCircle2, CircleDashed, AlertCircle, Plane, Hotel, Car, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { currency } from '@/lib/contractUtils';
import { shiftDate, toDayString } from '@/lib/travelDefaults';
import {
  buildTravelEvents, buildWorkEvents, findConflicts, assignmentsInShow, filterEvents, personTotals, eventsInWindow, groupByDay, dayRange, eventSpan, formatDay,
  EVENT_TYPES, STATUS_LABELS,
} from '@/lib/travelCalendar';

const PAGE_DAYS = 7;

export const TYPE_STYLE = {
  flight: { Icon: Plane, bar: 'border-blue-500/40 bg-blue-500/10', icon: 'text-blue-600' },
  hotel: { Icon: Hotel, bar: 'border-orange-500/40 bg-orange-500/10', icon: 'text-orange-600' },
  rentalCar: { Icon: Car, bar: 'border-purple-500/40 bg-purple-500/10', icon: 'text-purple-600' },
  mileage: { Icon: MapPin, bar: 'border-green-500/40 bg-green-500/10', icon: 'text-green-600' },
  work: { Icon: Briefcase, bar: 'border-sky-400/40 bg-sky-400/10', icon: 'text-sky-600' },
};

const STATUS_STYLE = {
  booked: { Icon: CheckCircle2, text: 'text-green-600', badge: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  budgeted: { Icon: CircleDashed, text: 'text-orange-500', badge: 'bg-orange-500/10 text-orange-600' },
  missing: { Icon: AlertCircle, text: 'text-red-500', badge: 'bg-red-500/10 text-red-600' },
};

export const StatusMark = ({ status, className = 'h-4 w-4' }) => {
  if (!status) return null; // work days carry no booking status
  const { Icon, text } = STATUS_STYLE[status];
  return <Icon className={`${className} ${text} shrink-0`} aria-label={STATUS_LABELS[status]} />;
};

const timeRange = (e) => [e.startTime, e.endTime && e.endDay === e.startDay ? e.endTime : ''].filter(Boolean).join(' – ');
const dateRange = (e) =>
  e.endDay === e.startDay
    ? formatDay(e.startDay, { month: 'short', day: 'numeric' })
    : `${formatDay(e.startDay, { month: 'short', day: 'numeric' })} – ${formatDay(e.endDay, { month: 'short', day: 'numeric' })}`;

const ListView = ({ events, onOpen }) => {
  const groups = groupByDay(events);
  if (groups.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No travel matches these filters.</p>;
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left">
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Employee</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Details</th>
            <th className="px-3 py-2 font-medium">Dates</th>
            <th className="px-3 py-2 text-right font-medium">Budget</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        {groups.map(({ day, events: list }) => (
          <tbody key={day}>
            <tr className="border-b bg-blue-500/5">
              <td colSpan={9} className="px-3 py-2 font-semibold">
                {formatDay(day)} <span className="ml-2 text-xs font-normal text-muted-foreground">{list.length} {list.length === 1 ? 'event' : 'events'}</span>
              </td>
            </tr>
            {list.map((e) => {
              const { Icon, icon } = TYPE_STYLE[e.type];
              return (
                <tr key={e.key} className="border-b hover:bg-muted/30">
                  <td className="whitespace-nowrap px-3 py-2">{e.startTime || '—'}</td>
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-1.5"><Icon className={`h-4 w-4 ${icon}`} />{e.label}</span></td>
                  <td className="px-3 py-2 font-medium">{e.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.role}</td>
                  <td className="px-3 py-2 text-muted-foreground">{e.detail || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{dateRange(e)}</td>
                  <td className="px-3 py-2 text-right">{e.cost ? currency(e.cost) : '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[e.status].badge}`}>
                      <StatusMark status={e.status} className="h-3 w-3" />{STATUS_LABELS[e.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onOpen(e.tab)}>View</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
};

const CalendarView = ({ events, people, days, onOpen }) => {
  if (people.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No travel matches these filters.</p>;
  const cols = `repeat(${days.length}, minmax(70px, 1fr))`;
  const today = toDayString(new Date());
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[640px]">
        <div className="grid border-b bg-muted/50" style={{ gridTemplateColumns: `170px ${cols}` }}>
          <div className="px-3 py-2 font-medium text-sm">Personnel</div>
          {days.map((d) => (
            <div key={d} className={`border-l px-2 py-2 text-center text-xs ${d === today ? 'bg-blue-500/10 font-semibold' : ''}`}>
              <div className="font-medium">{formatDay(d, { weekday: 'short' })}</div>
              <div className="text-muted-foreground">{formatDay(d, { month: 'short', day: 'numeric' })}</div>
            </div>
          ))}
        </div>
        {people.map((p) => {
          const mine = events.filter((e) => e.memberId === p.memberId && e.endDay >= days[0] && e.startDay <= days[days.length - 1]);
          return (
            <div key={p.memberId} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `170px 1fr` }}>
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.role}</p>
              </div>
              <div className="grid gap-1 border-l p-1" style={{ gridTemplateColumns: cols }}>
                {mine.map((e) => {
                  const s = Math.max(days.indexOf(e.startDay), 0);
                  const last = e.endDay > days[days.length - 1] ? days.length - 1 : days.indexOf(e.endDay);
                  const { Icon, bar, icon } = TYPE_STYLE[e.type];
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => onOpen(e.tab)}
                      title={`${e.label}${e.detail ? ` – ${e.detail}` : ''} (${STATUS_LABELS[e.status]}). Click to open.`}
                      className={`flex min-w-0 items-start gap-1.5 rounded border px-1.5 py-1 text-left text-xs hover:brightness-95 ${bar}`}
                      style={{ gridColumn: `${s + 1} / ${last + 2}` }}
                    >
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${icon}`} />
                      <span className="min-w-0 flex-1 break-words">
                        <span className="block font-medium">{e.label}{e.startTime ? ` · ${e.startTime}` : ''}</span>
                        {e.detail && <span className="block text-muted-foreground">{e.detail}</span>}
                      </span>
                      <StatusMark status={e.status} className="mt-0.5 h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LANES = ['work', 'flight', 'hotel', 'rentalCar', 'mileage'];

// One lane per travel type for each person, so nothing stacks, with their totals on the right.
const TimelineView = ({ events, people, days, onOpen }) => {
  if (people.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No travel matches these filters.</p>;
  const cols = `repeat(${days.length}, minmax(70px, 1fr))`;
  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[760px]">
        <div className="grid border-b bg-muted/50" style={{ gridTemplateColumns: `170px 1fr 130px` }}>
          <div className="px-3 py-2 text-sm font-medium">Personnel</div>
          <div className="grid border-l" style={{ gridTemplateColumns: cols }}>
            {days.map((d) => (
              <div key={d} className="border-l px-2 py-2 text-center text-xs first:border-l-0">
                <div className="font-medium">{formatDay(d, { weekday: 'short' })}</div>
                <div className="text-muted-foreground">{formatDay(d, { month: 'short', day: 'numeric' })}</div>
              </div>
            ))}
          </div>
          <div className="border-l px-2 py-2 text-xs font-medium">Totals</div>
        </div>
        {people.map((p) => {
          const mine = events.filter((e) => e.memberId === p.memberId);
          const t = personTotals(mine);
          const lanes = LANES.filter((l) => mine.some((e) => e.type === l));
          return (
            <div key={p.memberId} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `170px 1fr 130px` }}>
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.role}</p>
              </div>
              <div className="space-y-1 border-l p-1">
                {lanes.map((lane) => (
                  <div key={lane} className="grid gap-1" style={{ gridTemplateColumns: cols }}>
                    {mine.filter((e) => e.type === lane).map((e) => {
                      const s = Math.max(days.indexOf(e.startDay), 0);
                      const last = e.endDay > days[days.length - 1] ? days.length - 1 : days.indexOf(e.endDay);
                      const { Icon, bar, icon } = TYPE_STYLE[e.type];
                      return (
                        <button
                          key={e.key}
                          type="button"
                          onClick={() => onOpen(e.tab)}
                          title={`${e.label}${e.detail ? ` – ${e.detail}` : ''} (${STATUS_LABELS[e.status]}). Click to open.`}
                          className={`flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-1 text-left text-xs hover:brightness-95 ${bar}`}
                          style={{ gridColumn: `${s + 1} / ${last + 2}`, gridRow: 1 }}
                        >
                          <Icon className={`h-3.5 w-3.5 shrink-0 ${icon}`} />
                          <span className="min-w-0 flex-1 break-words">{e.label}{e.startTime ? ` · ${e.startTime}` : ''}{e.detail ? ` · ${e.detail}` : ''}</span>
                          <StatusMark status={e.status} className="h-3.5 w-3.5" />
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 border-l px-2 py-2 text-xs text-muted-foreground">
                <p>{t.flights} {t.flights === 1 ? 'flight' : 'flights'}</p>
                <p>{t.nights} hotel {t.nights === 1 ? 'night' : 'nights'}</p>
                <p>{t.rentalDays ? `${t.rentalDays} rental days` : 'No rental car'}</p>
                <p>{t.miles ? `${t.miles} miles` : 'No mileage'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Legend = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {Object.entries(EVENT_TYPES).map(([type, { label }]) => {
      const { Icon, icon } = TYPE_STYLE[type];
      return <span key={type} className="inline-flex items-center gap-1"><Icon className={`h-3.5 w-3.5 ${icon}`} />{label}</span>;
    })}
    <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-sky-600" />On Site / Working</span>
    <span className="mx-1 h-3 border-l" />
    {Object.entries(STATUS_LABELS).map(([status, label]) => (
      <span key={status} className="inline-flex items-center gap-1"><StatusMark status={status} className="h-3.5 w-3.5" />{label}</span>
    ))}
  </div>
);

const TravelCalendarTab = ({ personnel, travelData, contractSettings, assignments, onGoToTab }) => {
  const [view, setView] = useState('calendar');
  const [memberId, setMemberId] = useState('all');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [wholeShow, setWholeShow] = useState(false);
  const [pageStart, setPageStart] = useState(null);

  const all = useMemo(() => buildTravelEvents(personnel, travelData), [personnel, travelData]);
  const inShow = useMemo(
    () => assignmentsInShow(assignments, toDayString(contractSettings?.effectiveDate), toDayString(contractSettings?.expirationDate)),
    [assignments, contractSettings?.effectiveDate, contractSettings?.expirationDate],
  );
  const work = useMemo(() => buildWorkEvents(personnel, inShow), [personnel, inShow]);
  const conflicts = useMemo(() => findConflicts(personnel, all, inShow), [personnel, all, inShow]);
  const events = useMemo(() => filterEvents([...all, ...work], { memberId, type, status }), [all, work, memberId, type, status]);
  const listEvents = events.filter((e) => e.type !== 'work');
  const shownConflicts = conflicts.filter((c) => memberId === 'all' || c.memberId === memberId);
  const open = (tab) => { if (tab) onGoToTab(tab); };

  // The calendar covers the show dates and every travel date, so early arrivals are never cut off.
  const span = eventSpan([...all, ...work]);
  const first = [toDayString(contractSettings?.effectiveDate), span?.first].filter(Boolean).sort()[0];
  const last = [toDayString(contractSettings?.expirationDate), span?.last].filter(Boolean).sort().reverse()[0];
  const allDays = first && last ? dayRange(first, last) : [];
  // Opens on the show's first day, so one early flight does not push the show off the screen.
  const showStart = toDayString(contractSettings?.effectiveDate);
  const defaultStart = showStart && showStart >= first && showStart <= last ? showStart : first;
  const start = pageStart && pageStart >= first && pageStart <= last ? pageStart : defaultStart;
  const days = wholeShow ? allDays : allDays.slice(allDays.indexOf(start), allDays.indexOf(start) + PAGE_DAYS);
  const people = personnel
    .filter((m) => events.some((e) => e.memberId === m.id))
    .map((m) => ({ memberId: m.id, name: m.name || 'Unnamed', role: m.roleName }));
  const shown = days.length ? eventsInWindow(events, days[0], days.length) : [];
  const counts = { booked: 0, budgeted: 0, missing: 0 };
  for (const e of all) counts[e.status] += 1;

  const move = (n) => setPageStart(shiftDate(start, n * PAGE_DAYS));

  if (all.length === 0) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        No dated travel yet. Add flights, hotels, rental cars or mileage on their tabs and they will appear here.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border p-0.5">
          {[['calendar', 'Calendar', CalendarDays], ['timeline', 'Timeline', GanttChart], ['list', 'List', List]].map(([value, label, Icon]) => (
            <Button key={value} type="button" size="sm" variant={view === value ? 'secondary' : 'ghost'} className="h-8 gap-1.5" onClick={() => setView(value)}>
              <Icon className="h-4 w-4" />{label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1"><StatusMark status="booked" className="h-3.5 w-3.5" />{counts.booked} booked</span>
          <span className="inline-flex items-center gap-1"><StatusMark status="budgeted" className="h-3.5 w-3.5" />{counts.budgeted} budgeted</span>
          <span className="inline-flex items-center gap-1"><StatusMark status="missing" className="h-3.5 w-3.5" />{counts.missing} need booking</span>
        </div>
      </div>

      {shownConflicts.length > 0 && (
        <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {shownConflicts.length} scheduling {shownConflicts.length === 1 ? 'conflict' : 'conflicts'}
          </p>
          <div className="space-y-1.5">
            {shownConflicts.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><span className="font-medium">{c.name}:</span> {c.message}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => open(c.tab)}>
                  Open {c.tab === 'hotels' ? 'Hotels' : 'Flights'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={memberId} onValueChange={setMemberId}>
          <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Personnel</SelectItem>
            {personnel.filter((m) => all.some((e) => e.memberId === m.id)).map((m) => <SelectItem key={m.id} value={m.id}>{m.name || 'Unnamed'}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Travel Types</SelectItem>
            {Object.entries(EVENT_TYPES).map(([value, { label }]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>

        {view !== 'list' && (
          <div className="ml-auto flex items-center gap-2">
            {!wholeShow && (
              <>
                <Button type="button" size="icon" variant="outline" className="h-9 w-9" disabled={start <= first} onClick={() => move(-1)} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-[140px] text-center text-sm">{days.length > 0 && `${formatDay(days[0], { month: 'short', day: 'numeric' })} – ${formatDay(days[days.length - 1], { month: 'short', day: 'numeric', year: 'numeric' })}`}</span>
                <Button type="button" size="icon" variant="outline" className="h-9 w-9" disabled={allDays.indexOf(start) + PAGE_DAYS >= allDays.length} onClick={() => move(1)} aria-label="Next week"><ChevronRight className="h-4 w-4" /></Button>
              </>
            )}
            <Button type="button" size="sm" variant={wholeShow ? 'secondary' : 'outline'} className="h-9" onClick={() => setWholeShow((v) => !v)}>
              Whole show
            </Button>
          </div>
        )}
      </div>

      {view === 'calendar' && <CalendarView events={shown} people={people} days={days} onOpen={open} />}
      {view === 'timeline' && <TimelineView events={shown} people={people} days={days} onOpen={open} />}
      {view === 'list' && <ListView events={listEvents} onOpen={open} />}

      <Legend />
    </div>
  );
};

export default TravelCalendarTab;
