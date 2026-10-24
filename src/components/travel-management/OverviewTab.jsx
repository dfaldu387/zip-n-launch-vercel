import { useState } from 'react';
import { Mail, Inbox, History } from 'lucide-react';
import { buildActivity, formatActivityTime } from '@/lib/travelActivity';
import RequestInfoDialog from './RequestInfoDialog';
import { requestableItems, requestState } from '@/lib/travelRequests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plane, Hotel, Car, DollarSign, Users, Calendar, MapPin, CheckCircle2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CollapsibleCard } from '@/components/shared/CollapsibleCard';
import { stillToBook, bookingBoard, bookedTypes, TRAVEL_ITEMS, missingReceipts } from '@/lib/travelBooking';
import { currency, isDirectExpense } from '@/lib/contractUtils';
import { flightFigures, hotelFigures, rentalFigures, mileageFigures, summarizeLines, travelSpan } from '@/lib/travelActuals';

// Over budget is red, under budget is green; "—" until an actual has been entered.
const VarianceBadge = ({ value }) => {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (value === 0) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">On budget</span>;
  const over = value > 0;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${over ? 'bg-red-500/10 text-red-600' : 'bg-green-500/10 text-green-600'}`}>
      {over ? '' : '−'}{currency(Math.abs(value))} {over ? '↑' : '↓'}
    </span>
  );
};

// "2 of 3" with a small bar, so it is clear how much of the budget has real numbers behind it.
const EnteredMeter = ({ counted, total }) => {
  if (total === 0) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round((counted / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{counted} of {total}</span>
    </div>
  );
};

const WhoPaysCard = ({ title, hint, accent, summary }) => (
  <Card className={accent}>
    <CardContent className="pt-4 pb-4">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mb-3">{hint}</p>
      {summary.total === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing in this group yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="text-lg font-bold">{currency(summary.budget)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actual so far</p>
            <p className="text-lg font-bold">{summary.actual === null ? '—' : currency(summary.actual)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Variance</p>
            <div className="pt-1"><VarianceBadge value={summary.variance} /></div>
          </div>
        </div>
      )}
      {summary.total > 0 && <div className="mt-3"><EnteredMeter counted={summary.counted} total={summary.total} /></div>}
    </CardContent>
  </Card>
);

const OverviewTab = ({ personnel, travelData, contractSettings, onGoToTab, showId, travelRequests, travelSubmissions, travelActivity }) => {
  const [requestRows, setRequestRows] = useState(null); // rows for the open "Request info" dialog
  const [justSent, setJustSent] = useState({}); // memberId -> sentAt, for requests sent in this visit

  const stateOf = (memberId) =>
    requestState(justSent[memberId] ? { sentAt: justSent[memberId] } : travelRequests?.[memberId], travelSubmissions?.[memberId]);
  const requestRowFor = ({ member, items }) => ({ member, options: requestableItems(member, items) });

  const getPersonTravel = (memberId) => travelData[memberId] || {};

  // Get expense amount from contract reimbursable_expenses
  const getContractExpense = (member, expenseKey) => {
    const expense = member.reimbursable_expenses?.[expenseKey];
    if (!expense?.reimbursed) return 0;
    // Per-day expenses use 'total', lump-sum use 'max_value'
    return parseFloat(expense.total) || parseFloat(expense.max_value) || 0;
  };

  // Who buys it: the show (Direct Show Expense) or the staff member (reimbursed later).
  // Nothing is shown when the expense switch is off in Officials & Staff.
  const buyerLabel = (member, expenseKey) => {
    const expense = member.reimbursable_expenses?.[expenseKey];
    if (!expense?.reimbursed) return null;
    return isDirectExpense(expense) ? 'Show buys' : 'Staff buys, reimbursed';
  };

  const CostCell = ({ member, cost, expenseKey, booked }) => {
    const buyer = buyerLabel(member, expenseKey);
    return (
      <td className={`px-4 py-3 text-right ${booked ? 'bg-green-500/10 text-green-700 dark:text-green-400' : ''}`}>
        {booked && <CheckCircle2 className="inline h-3 w-3 mr-1 align-[-1px]" />}
        {cost ? currency(cost) : booked ? 'Booked' : '—'}
        {buyer && (
          <span className={`block text-[10px] ${buyer === 'Show buys' ? 'text-sky-600' : 'text-muted-foreground'}`}>{buyer}</span>
        )}
      </td>
    );
  };

  const getFlightCost = (member) => {
    const travel = getPersonTravel(member.id);
    const travelCost = parseFloat(travel.flight?.cost) || 0;
    return travelCost || getContractExpense(member, 'airfare');
  };

  const getHotelCost = (member) => {
    const travel = getPersonTravel(member.id);
    const travelCost = parseFloat(travel.hotel?.cost) || 0;
    return travelCost || getContractExpense(member, 'hotel');
  };

  const getRentalCost = (member) => {
    const travel = getPersonTravel(member.id);
    const travelCost = parseFloat(travel.rentalCar?.cost) || 0;
    return travelCost || getContractExpense(member, 'rentalCar');
  };

  const getMileageCost = (member) => {
    const travel = getPersonTravel(member.id);
    const travelCost = parseFloat(travel.mileage?.cost) || 0;
    return travelCost || getContractExpense(member, 'mileage');
  };

  const getTotalCost = (member) =>
    getFlightCost(member) + getHotelCost(member) + getRentalCost(member) + getMileageCost(member);

  const grandTotalFlights = personnel.reduce((s, m) => s + getFlightCost(m), 0);
  const grandTotalHotels = personnel.reduce((s, m) => s + getHotelCost(m), 0);
  const grandTotalRentals = personnel.reduce((s, m) => s + getRentalCost(m), 0);
  const grandTotalMileage = personnel.reduce((s, m) => s + getMileageCost(m), 0);
  const grandTotal = grandTotalFlights + grandTotalHotels + grandTotalRentals + grandTotalMileage;

  // One line per person per travel type: its budget (same number as the table below) and its
  // actual once one has been entered. Rows, totals and "who pays" are all built from these.
  const allLines = personnel.flatMap((m) => {
    const t = getPersonTravel(m.id);
    return [
      { type: 'flights', key: 'airfare', budget: getFlightCost(m), actual: flightFigures(t.flight).actual },
      { type: 'hotels', key: 'hotel', budget: getHotelCost(m), actual: hotelFigures(t.hotel).actual },
      { type: 'rentals', key: 'rentalCar', budget: getRentalCost(m), actual: rentalFigures(t.rentalCar).actual },
      { type: 'mileage', key: 'mileage', budget: getMileageCost(m), actual: mileageFigures(t.mileage).actual },
    ].map((line) => ({ ...line, direct: isDirectExpense(m.reimbursable_expenses?.[line.key]) }));
  });
  const rowFor = (type) => summarizeLines(allLines.filter((l) => l.type === type));
  const comparisonRows = [
    { label: 'Flights', Icon: Plane, tone: 'text-blue-500', ...rowFor('flights') },
    { label: 'Hotels', Icon: Hotel, tone: 'text-amber-500', ...rowFor('hotels') },
    { label: 'Rental Cars', Icon: Car, tone: 'text-green-500', ...rowFor('rentals') },
    { label: 'Mileage', Icon: MapPin, tone: 'text-purple-500', ...rowFor('mileage') },
  ];
  const comparisonTotal = summarizeLines(allLines);
  const paidByShow = summarizeLines(allLines.filter((l) => l.direct));
  const reimbursed = summarizeLines(allLines.filter((l) => !l.direct));

  const toBook = stillToBook(personnel, travelData);
  // Everyone with a needed item, booked or not, so the booked ones can show green beside the rest.
  const board = bookingBoard(personnel, travelData);
  const itemOrder = TRAVEL_ITEMS.map((i) => i.type);
  const chipsFor = ({ items, booked }) =>
    [...items.map((i) => ({ ...i, done: false })), ...booked.map((i) => ({ ...i, done: true }))]
      .sort((a, b) => itemOrder.indexOf(a.type) - itemOrder.indexOf(b.type));
  const noReceipt = missingReceipts(personnel, travelData);
  const activity = buildActivity({
    log: travelActivity,
    requests: travelRequests,
    submissions: travelSubmissions,
    nameOf: (id) => personnel.find((m) => m.id === id)?.name,
  });

  const completedCount = personnel.filter((m) => {
    const t = getPersonTravel(m.id);
    return t.flight?.airline || t.hotel?.hotelName || t.rentalCar?.company;
  }).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-2xl font-bold">{personnel.length}</p>
            <p className="text-xs text-muted-foreground">Personnel</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Plane className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{currency(grandTotalFlights)}</p>
            <p className="text-xs text-muted-foreground">Flights</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Hotel className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{currency(grandTotalHotels)}</p>
            <p className="text-xs text-muted-foreground">Hotels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Car className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{currency(grandTotalRentals)}</p>
            <p className="text-xs text-muted-foreground">Rental Cars</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <MapPin className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">{currency(grandTotalMileage)}</p>
            <p className="text-xs text-muted-foreground">Mileage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{currency(grandTotal)}</p>
            <p className="text-xs text-muted-foreground">Total Travel</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Badge variant="outline">{completedCount}/{personnel.length} have travel details</Badge>
        {contractSettings?.effectiveDate && contractSettings?.expirationDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Event: {contractSettings.effectiveDate} to {contractSettings.expirationDate}
          </span>
        )}
      </div>

      {/* Who still needs booking */}
      <CollapsibleCard
        className={toBook.length > 0 ? 'border-amber-500/40' : 'border-green-500/40'}
        title="Who still needs booking?"
        icon={toBook.length > 0 ? <Calendar className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
        description={toBook.length > 0
          ? 'Everything each person needs is listed. Green means it is booked; the others still need booking. Click an item to open its tab.'
          : 'Everything that is needed has been booked.'}
        summary={toBook.length > 0 ? `${toBook.length} to book` : 'All booked'}
        action={showId && toBook.length > 0 && (
          <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRequestRows(toBook.map(requestRowFor))}>
            <Mail className="h-3 w-3 mr-1" />
            Request all
          </Button>
        )}
        contentClassName="space-y-2"
      >
        {board.length > 0 && (
          <>
            {board.map((row) => (
              <div key={row.member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.member.name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{row.member.roleName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {stateOf(row.member.id) && (
                    <span className={`text-[11px] mr-1 ${stateOf(row.member.id) === 'submitted' ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {stateOf(row.member.id) === 'submitted' ? 'Details received' : 'Requested'}
                    </span>
                  )}
                  {showId && row.items.length > 0 && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-600" onClick={() => setRequestRows([requestRowFor(row)])}>
                      <Mail className="h-3 w-3 mr-1" />
                      Request info
                    </Button>
                  )}
                  {chipsFor(row).map((item) => (
                    <Button
                      key={item.type}
                      type="button"
                      size="sm"
                      variant="outline"
                      className={`h-7 px-2 text-xs ${item.done ? 'border-green-500/50 bg-green-500/15 text-green-700 hover:bg-green-500/25 dark:text-green-400' : ''}`}
                      title={item.done ? 'Booked' : 'Not booked yet'}
                      onClick={() => onGoToTab?.(item.tab)}
                    >
                      {item.done && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </CollapsibleCard>

      <RequestInfoDialog
        open={!!requestRows}
        onOpenChange={(v) => { if (!v) setRequestRows(null); }}
        rows={requestRows || []}
        showId={showId}
        onSent={(memberId, sentAt) => setJustSent((s) => ({ ...s, [memberId]: sentAt }))}
      />

      {/* Receipt checklist */}
      <CollapsibleCard
        className={noReceipt.length > 0 ? 'border-amber-500/40' : 'border-green-500/40'}
        title="Receipts to attach"
        icon={noReceipt.length > 0 ? <Paperclip className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-green-600" />}
        description={noReceipt.length > 0
          ? 'These actual amounts have no receipt yet. Click an item to open its tab and use Add Receipt.'
          : 'Every actual amount has a receipt attached (or no actual has been entered yet).'}
        summary={noReceipt.length > 0 ? `${noReceipt.length} to attach` : 'All attached'}
        defaultOpen={false}
        contentClassName="space-y-2"
      >
        {noReceipt.length > 0 && (
          <>
            {noReceipt.map(({ member, items }) => (
              <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{member.roleName}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <Button
                      key={item.type}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => onGoToTab?.(item.tab)}
                    >
                      {item.label} {currency(item.actual)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </CollapsibleCard>

      {/* Budget vs Actual */}
      <CollapsibleCard
        title="Budget vs Actual"
        description="The budget stays fixed and matches the contracts. Actuals are typed on the Flights, Hotels, Rental Cars and Mileage tabs."
        summary={currency(comparisonTotal.budget)}
        defaultOpen={false}
        contentClassName="p-0"
      >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Travel</th>
                  <th className="text-right px-4 py-3 font-medium">Budget</th>
                  <th className="text-right px-4 py-3 font-medium">Actual so far</th>
                  <th className="text-right px-4 py-3 font-medium">Variance</th>
                  <th className="text-left px-4 py-3 font-medium w-44">Actuals entered</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ label, Icon, tone, ...row }) => (
                  <tr key={label} className="border-b">
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-2"><Icon className={`h-4 w-4 ${tone}`} />{label}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{currency(row.budget)}</td>
                    <td className="px-4 py-3 text-right">{row.actual === null ? '—' : currency(row.actual)}</td>
                    <td className="px-4 py-3 text-right"><VarianceBadge value={row.variance} /></td>
                    <td className="px-4 py-3"><EnteredMeter counted={row.counted} total={row.total} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right">{currency(comparisonTotal.budget)}</td>
                  <td className="px-4 py-3 text-right">{comparisonTotal.actual === null ? '—' : currency(comparisonTotal.actual)}</td>
                  <td className="px-4 py-3 text-right"><VarianceBadge value={comparisonTotal.variance} /></td>
                  <td className="px-4 py-3"><EnteredMeter counted={comparisonTotal.counted} total={comparisonTotal.total} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="px-4 py-3 text-xs text-muted-foreground border-t">
            Variance compares each actual with its own budget, so a line with no actual yet is never counted as a saving.
          </p>
      </CollapsibleCard>

      {/* Who pays: Direct Show Expense vs Reimbursement */}
      <div className="grid gap-4 md:grid-cols-2">
        <WhoPaysCard title="Paid by the show" hint="Direct Show Expense: the show pays the vendor." accent="border-sky-500/40 bg-sky-500/5" summary={paidByShow} />
        <WhoPaysCard title="Reimbursed to staff" hint="Staff pay first and are paid back." accent="border-border" summary={reimbursed} />
      </div>

      {/* Employee Travel Overview Table */}
      <CollapsibleCard
        title="Employee Travel Overview"
        summary={`${personnel.length} staff`}
        defaultOpen={false}
        contentClassName="p-0"
      >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Employee</th>
                  <th className="text-left px-4 py-3 font-medium">Role</th>
                  <th className="text-left px-4 py-3 font-medium">Travel Start</th>
                  <th className="text-left px-4 py-3 font-medium">Travel End</th>
                  <th className="text-right px-4 py-3 font-medium">Flight</th>
                  <th className="text-right px-4 py-3 font-medium">Hotel</th>
                  <th className="text-right px-4 py-3 font-medium">Rental Car</th>
                  <th className="text-right px-4 py-3 font-medium">Mileage</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {personnel.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-muted-foreground">
                      No personnel found. Add staff in Contract Management first.
                    </td>
                  </tr>
                ) : (
                  personnel.map((member) => {
                    const travel = getPersonTravel(member.id);
                    // The trip runs from the earliest to the latest date on their travel cards, so it
                    // follows every edit; the first-open default is only the fallback.
                    const span = travelSpan(travel);
                    const travelStart = span?.start || travel.travelStart || '';
                    const travelEnd = span?.end || travel.travelEnd || '';
                    const hasBooking = travel.flight?.airline || travel.hotel?.hotelName || travel.rentalCar?.company;
                    const doneTypes = bookedTypes(travel);
                    const hasExpenses = getTotalCost(member) > 0;
                    const total = getTotalCost(member);

                    return (
                      <tr key={member.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{member.name || 'Unnamed'}</td>
                        <td className="px-4 py-3 text-muted-foreground">{member.roleName}</td>
                        <td className="px-4 py-3">{travelStart || '—'}</td>
                        <td className="px-4 py-3">{travelEnd || '—'}</td>
                        <CostCell member={member} cost={getFlightCost(member)} expenseKey="airfare" booked={doneTypes.has('flight')} />
                        <CostCell member={member} cost={getHotelCost(member)} expenseKey="hotel" booked={doneTypes.has('hotel')} />
                        <CostCell member={member} cost={getRentalCost(member)} expenseKey="rentalCar" booked={doneTypes.has('rentalCar')} />
                        <CostCell member={member} cost={getMileageCost(member)} expenseKey="mileage" booked={doneTypes.has('mileage')} />
                        <td className="px-4 py-3 text-right font-medium">{total ? currency(total) : '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {hasBooking ? (
                            <Badge className="bg-green-500/10 text-green-600 border-green-500/30">Booked</Badge>
                          ) : hasExpenses ? (
                            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">Budgeted</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {personnel.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="px-4 py-3" colSpan={4}>TOTAL</td>
                    <td className="px-4 py-3 text-right">{currency(grandTotalFlights)}</td>
                    <td className="px-4 py-3 text-right">{currency(grandTotalHotels)}</td>
                    <td className="px-4 py-3 text-right">{currency(grandTotalRentals)}</td>
                    <td className="px-4 py-3 text-right">{currency(grandTotalMileage)}</td>
                    <td className="px-4 py-3 text-right">{currency(grandTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
      </CollapsibleCard>

      {/* Activity log: emails sent and details received */}
      <CollapsibleCard
        title="Activity Log"
        icon={<History className="h-4 w-4 text-muted-foreground" />}
        description="Emails sent to staff and details they sent back, newest first. New events appear when you reopen this page."
        summary={`${activity.length} ${activity.length === 1 ? 'event' : 'events'}`}
        defaultOpen={false}
        contentClassName="space-y-2"
      >
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Use Request info above to email a staff member.</p>
        ) : (
          activity.map((e) => (
            <div key={e.key} className="flex flex-wrap items-start gap-3 rounded-md border px-3 py-2">
              {e.kind === 'email_sent'
                ? <Mail className="h-4 w-4 mt-0.5 text-blue-600 shrink-0" />
                : <Inbox className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {e.kind === 'email_sent'
                    ? <>Email sent to <span className="font-medium">{e.name}</span>{e.by ? <span className="text-muted-foreground"> by {e.by}</span> : null}</>
                    : <><span className="font-medium">{e.name}</span> sent details</>}
                </p>
                {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatActivityTime(e.at)}</span>
            </div>
          ))
        )}
      </CollapsibleCard>
    </div>
  );
};

export default OverviewTab;
