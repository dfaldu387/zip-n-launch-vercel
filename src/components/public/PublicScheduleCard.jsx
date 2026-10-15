import React from 'react';
import { CalendarDays, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAllClassItems } from '@/lib/showBillUtils';
import { publicDocuments } from '@/lib/publicPage';

// Public "Schedule" card. `schedule` comes from get_public_schedule, which only
// returns something once Schedule & Arena Setup is Published.
//   source 'builtin' → draw the show bill (days → arenas → items)
//   source 'upload'  → link the owner's own showbill PDF(s)
const PublicScheduleCard = ({ schedule, publicPage }) => {
  if (!schedule) return null;

  if (schedule.source === 'upload') {
    const docs = publicDocuments(publicPage);
    if (docs.length === 0) return null;
    return (
      <Card className="bg-secondary border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Schedule</CardTitle>
          <CardDescription>Open the show bill</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {docs.map(d => (
            <a
              key={d.id || d.url}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-background/50 p-3 text-sm text-primary hover:underline"
            >
              <FileText className="h-4 w-4" /> {d.name || 'Show bill'}
            </a>
          ))}
        </CardContent>
      </Card>
    );
  }

  const closed = schedule.showBill?.closedArenas || {};
  // Only arenas that are open and actually have something scheduled.
  const days = (Array.isArray(schedule.showBill?.days) ? schedule.showBill.days : [])
    .map(day => ({
      ...day,
      arenas: (day.arenas || []).filter(a => !closed[`${day.id}::${a.id}`] && (a.items || []).length > 0),
    }))
    .filter(day => day.arenas.length > 0);
  // Nothing scheduled yet — show no card rather than an empty one.
  if (days.length === 0) return null;

  // classBox items hold class ids; turn them into readable names.
  const nameById = {};
  getAllClassItems({ disciplines: schedule.disciplines || [] }).forEach(c => {
    nameById[c.id] = c.name;
    nameById[c.divisionId] = c.name;
  });

  return (
    <Card className="bg-secondary border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Schedule</CardTitle>
        <CardDescription>Class order by day and arena</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {days.map(day => {
          const arenas = day.arenas;
          return (
            <div key={day.id} className="space-y-3">
              <h3 className="text-base font-semibold text-foreground">{day.label || day.date}</h3>
              {arenas.map(arena => (
                <div key={arena.id} className="rounded-lg bg-background/50 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground">{arena.name}</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {arena.items.map(item => {
                      if (item.type === 'classBox') {
                        const names = (item.classes || []).map(id => nameById[id]).filter(Boolean);
                        // A box with no title of its own is named after its first class;
                        // list the classes only when they add something to the title.
                        const title = item.title || names[0] || 'Class';
                        const extra = names.filter(n => n !== title);
                        return (
                          <li key={item.id}>
                            <span className="text-foreground">{item.number ? `${item.number}. ` : ''}{title}</span>
                            {extra.length > 0 && <span> — {extra.join(', ')}</span>}
                          </li>
                        );
                      }
                      return (
                        <li key={item.id} className="italic">{item.title || 'Break'}</li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PublicScheduleCard;
