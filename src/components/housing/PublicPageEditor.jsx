import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LogoUploader } from '@/components/show-structure/LogoUploader';
import { Eye, EyeOff, RotateCcw, Globe, Users, Hotel, FileText, UploadCloud, Trash2, ExternalLink, Loader2, ImagePlus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import VisibleNowSummary from '@/components/housing/VisibleNowSummary';
import {
    PUBLIC_FIELDS, getAutoValues, resolveContacts, formatShowDateRange,
    realAssociations, realDisciplines, publicList, WELCOME_MAX,
    CONTACT_FIELDS, HOTEL_FIELDS,
} from '@/lib/publicPage';

const VisibleButton = ({ hidden, onClick, disabled }) => (
    <Button
        type="button"
        size="sm"
        variant={hidden ? 'outline' : 'default'}
        className="h-8 gap-1.5 shrink-0"
        onClick={onClick}
        disabled={disabled}
        title={hidden ? 'Hidden from the public page — click to show' : 'Visible on the public page — click to hide'}
    >
        {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        {hidden ? 'Hidden' : 'Visible'}
    </Button>
);

// One row: real value, Hide/Show button, and (for single-value fields) a box to
// change the text the public sees.
const FieldRow = ({ field, auto, hidden, text, onToggle, onSaveText }) => {
    const [draft, setDraft] = useState(text || '');
    useEffect(() => { setDraft(text || ''); }, [text]);
    const shown = text || auto;
    const empty = !auto && !text;

    return (
        <div className={cn('rounded-lg border p-3 space-y-2', hidden && 'bg-muted/40')}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{field.label}</p>
                    <p className={cn('text-xs break-words', hidden || empty ? 'text-muted-foreground' : 'text-foreground')}>
                        {empty ? 'Nothing entered in Show Details' : shown}
                    </p>
                </div>
                <VisibleButton hidden={hidden} onClick={onToggle} disabled={empty} />
            </div>

            {field.editable && !hidden && (
                <div className="flex items-center gap-2">
                    <Input
                        value={draft}
                        placeholder={`Public ${field.label.toLowerCase()} (leave empty to use: ${auto || '—'})`}
                        className="h-8 text-xs flex-1 min-w-0"
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => { if (draft !== (text || '')) onSaveText(draft); }}
                    />
                    {text && (
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1" onClick={() => onSaveText('')} title="Go back to the Show Details value">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

// Associations / Disciplines as tags: × removes one, the box adds one.
// Only the public list changes; the show's real list is untouched.
const TagsRow = ({ field, real, list, edited, hidden, onToggle, onChangeList, onReset }) => {
    const [draft, setDraft] = useState('');
    const empty = real.length === 0 && !edited;

    const add = () => {
        const name = draft.trim();
        if (!name) return;
        if (!list.some(t => t.toLowerCase() === name.toLowerCase())) onChangeList([...list, name]);
        setDraft('');
    };

    return (
        <div className={cn('rounded-lg border p-3 space-y-2', hidden && 'bg-muted/40')}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">{field.label}</p>
                    <p className="text-xs text-muted-foreground">
                        {empty ? 'Nothing entered in Show Details' : `${list.length} shown to the public`}
                    </p>
                </div>
                <VisibleButton hidden={hidden} onClick={onToggle} disabled={empty && !hidden} />
            </div>
            {!hidden && (
                <>
                    <div className="flex flex-wrap gap-1.5">
                        {list.map((tag, i) => (
                            <span key={`${tag}-${i}`} className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium">
                                {tag}
                                <button
                                    type="button"
                                    className="text-muted-foreground hover:text-destructive"
                                    title={`Remove ${tag}`}
                                    onClick={() => onChangeList(list.filter((_, idx) => idx !== i))}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        {list.length === 0 && <span className="text-xs text-muted-foreground">All removed</span>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Input
                            value={draft}
                            placeholder={`+ Add ${field.label.toLowerCase().replace(/s$/, '')}`}
                            className="h-8 text-xs flex-1 min-w-0"
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
                        />
                        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={add} disabled={!draft.trim()}>Add</Button>
                        {edited && (
                            <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1" onClick={onReset} title="Go back to the Show Details list">
                                <RotateCcw className="h-3 w-3" /> Reset
                            </Button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const dayOnly = (v) => (typeof v === 'string' ? v.slice(0, 10) : '');

// Show dates: two date pickers. They start on the real dates; picking a different
// day changes only what the public sees.
const DatesRow = ({ pd, dates, hidden, onToggle, onChangeDates, onReset }) => {
    const realStart = dayOnly(pd?.startDate || pd?.showDetails?.general?.startDate);
    const realEnd = dayOnly(pd?.endDate || pd?.showDetails?.general?.endDate);
    const start = dates.start || realStart;
    const end = dates.end || realEnd;
    const edited = !!(dates.start || dates.end || pd?.publicPage?.text?.showDates);
    const empty = !realStart && !realEnd;

    return (
        <div className={cn('rounded-lg border p-3 space-y-2', hidden && 'bg-muted/40')}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">Show dates</p>
                    <p className={cn('text-xs', hidden || empty ? 'text-muted-foreground' : 'text-foreground')}>
                        {empty ? 'Nothing entered in Show Details' : formatShowDateRange(start, end)}
                    </p>
                </div>
                <VisibleButton hidden={hidden} onClick={onToggle} disabled={empty} />
            </div>
            {!hidden && !empty && (
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">Start date</p>
                        <Input type="date" value={start} max={end || undefined} className="h-8 text-xs w-40" onChange={(e) => onChangeDates({ start: e.target.value, end })} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">End date</p>
                        <Input type="date" value={end} min={start || undefined} className="h-8 text-xs w-40" onChange={(e) => onChangeDates({ start, end: e.target.value })} />
                    </div>
                    {edited && (
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs gap-1" onClick={onReset} title="Go back to the Show Details dates">
                            <RotateCcw className="h-3 w-3" /> Reset
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
};

// A group of typed-in boxes (one contact, or the sponsor hotel) with one Visible/Hidden button.
const InfoGroup = ({ title, fields, values, placeholders = {}, hidden, onToggle, onSave }) => {
    const [draft, setDraft] = useState(values);
    useEffect(() => { setDraft(values); }, [JSON.stringify(values)]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = () => {
        const changed = fields.some(f => (draft[f.key] || '') !== (values[f.key] || ''));
        if (changed) onSave(draft);
    };
    const hasAny = fields.some(f => draft[f.key] || placeholders[f.key]);

    return (
        <div className={cn('rounded-lg border p-3 space-y-2', hidden && 'bg-muted/40')}>
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{title}</p>
                <VisibleButton hidden={hidden} onClick={onToggle} disabled={!hasAny && !hidden} />
            </div>
            {!hidden && (
                <div className="grid gap-2 sm:grid-cols-2">
                    {fields.map(f => (
                        <Input
                            key={f.key}
                            value={draft[f.key] || ''}
                            placeholder={placeholders[f.key] ? `${f.label} (${placeholders[f.key]})` : f.label}
                            className="h-8 text-xs"
                            onChange={(e) => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                            onBlur={save}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Event logo + a short welcome message for the top of the public page.
const BrandingCard = ({ showId, logoUrl, welcome, hidden, onToggle, onChangeLogo, onSaveWelcome }) => {
    const [draft, setDraft] = useState(welcome || '');
    useEffect(() => { setDraft(welcome || ''); }, [welcome]);

    return (
        <Card className="mb-6">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <ImagePlus className="h-4 w-4 text-primary" /> Event logo & welcome message
                </CardTitle>
                <CardDescription className="text-xs">
                    The logo shows in the banner of the public event page. The welcome message is a short note at the top of Show Details.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
                <div className={cn('rounded-lg border p-3 space-y-2', hidden.logo && 'bg-muted/40')}>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Event logo</p>
                        <VisibleButton hidden={!!hidden.logo} onClick={() => onToggle('logo')} disabled={!logoUrl && !hidden.logo} />
                    </div>
                    <div className="flex items-center gap-3">
                        {logoUrl
                            ? <img src={logoUrl} alt="Event logo" className="h-14 w-14 rounded-md border bg-white object-contain p-1" />
                            : <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center"><ImagePlus className="h-5 w-5 text-muted-foreground" /></div>}
                        <LogoUploader fieldId="event_logo" showId={showId} currentLogoUrl={logoUrl || ''} onUploadComplete={onChangeLogo} />
                    </div>
                </div>

                <div className={cn('rounded-lg border p-3 space-y-2', hidden.welcome && 'bg-muted/40')}>
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold">Welcome message</p>
                        <VisibleButton hidden={!!hidden.welcome} onClick={() => onToggle('welcome')} disabled={!welcome && !hidden.welcome} />
                    </div>
                    {!hidden.welcome && (
                        <>
                            <Textarea
                                value={draft}
                                maxLength={WELCOME_MAX}
                                rows={4}
                                placeholder="Welcome to our show! Short note for exhibitors and spectators…"
                                className="text-xs"
                                onChange={(e) => setDraft(e.target.value)}
                                onBlur={() => { if (draft.trim() !== (welcome || '').trim()) onSaveWelcome(draft.trim()); }}
                            />
                            <p className="text-[11px] text-muted-foreground text-right">{draft.length}/{WELCOME_MAX}</p>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const MAX_DOC_MB = 20;

// One document row: the name the public sees (editable), open link, delete.
const DocumentRow = ({ doc, onRename, onDelete }) => {
    const [name, setName] = useState(doc.name);
    useEffect(() => { setName(doc.name); }, [doc.name]);
    return (
        <div className="flex items-center gap-2 rounded-lg border p-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
                value={name}
                className="h-8 text-xs flex-1 min-w-0"
                onChange={(e) => setName(e.target.value)}
                onBlur={() => { if (name.trim() && name.trim() !== doc.name) onRename(name.trim()); else setName(doc.name); }}
            />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Open file" onClick={() => window.open(doc.url, '_blank')}>
                <ExternalLink className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Delete file" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
};

// Show bill, schedule and other files the public can open.
const DocumentsCard = ({ showId, documents, hidden, onToggle, onChange }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const inputRef = useRef(null);
    const [uploading, setUploading] = useState(false);

    const handleFiles = async (fileList) => {
        const file = fileList?.[0];
        if (!file) return;
        if (!user || !showId) {
            toast({ title: 'Upload failed', description: 'Please sign in and open a show first.', variant: 'destructive' });
            return;
        }
        if (file.size > MAX_DOC_MB * 1024 * 1024) {
            toast({ title: 'File too large', description: `Please use a file under ${MAX_DOC_MB} MB.`, variant: 'destructive' });
            return;
        }
        setUploading(true);
        const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf';
        const path = `${user.id}/${showId}/public_docs/${uuidv4()}.${ext}`;
        const { error } = await supabase.storage.from('project_files').upload(path, file, { cacheControl: '3600', upsert: false });
        if (error) {
            setUploading(false);
            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
            return;
        }
        const { data } = supabase.storage.from('project_files').getPublicUrl(path);
        const doc = { id: uuidv4(), name: file.name.replace(/\.[^.]+$/, ''), url: data.publicUrl, path };
        await onChange(cur => ({ ...cur, documents: [...(cur.documents || []), doc] }));
        setUploading(false);
    };

    const remove = async (doc) => {
        if (doc.path) await supabase.storage.from('project_files').remove([doc.path]);
        await onChange(cur => ({ ...cur, documents: (cur.documents || []).filter(d => d.id !== doc.id) }));
    };
    const rename = (doc, name) => onChange(cur => ({ ...cur, documents: (cur.documents || []).map(d => (d.id === doc.id ? { ...d, name } : d)) }));

    return (
        <Card className="mb-6">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-primary" /> Show documents
                        </CardTitle>
                        <CardDescription className="text-xs mt-1.5">
                            Upload the show bill, show schedule or other files. People click a name on the public page to open it.
                        </CardDescription>
                    </div>
                    <VisibleButton hidden={hidden} onClick={onToggle} disabled={documents.length === 0 && !hidden} />
                </div>
            </CardHeader>
            <CardContent className="space-y-2">
                {documents.map(d => (
                    <DocumentRow key={d.id} doc={d} onRename={(n) => rename(d, n)} onDelete={() => remove(d)} />
                ))}
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
                />
                <Button type="button" variant="outline" size="sm" className="h-9" disabled={uploading} onClick={() => inputRef.current?.click()}>
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                    {uploading ? 'Uploading…' : 'Upload document'}
                </Button>
            </CardContent>
        </Card>
    );
};

// pd = show.project_data. onChange(fn) saves immediately; fn gets the newest saved
// publicPage and returns the next one (so quick edits never overwrite each other).
const PublicPageEditor = ({ pd, onChange, showId }) => {
    const auto = getAutoValues(pd);
    const pp = pd?.publicPage || {};
    const hidden = pp.hidden || {};
    const text = pp.text || {};
    const contacts = resolveContacts(pp, pd?.showDetails?.general || {});
    const hotel = pp.hotel || {};

    const toggle = (key) => onChange(cur => ({ ...cur, hidden: { ...(cur.hidden || {}), [key]: !cur.hidden?.[key] } }));
    const saveText = (key, value) => onChange(cur => {
        const next = { ...(cur.text || {}) };
        if (value.trim()) next[key] = value.trim(); else delete next[key];
        return { ...cur, text: next };
    });
    const saveDates = (dates) => onChange(cur => ({ ...cur, dates }));
    const resetDates = () => onChange(cur => {
        const text = { ...(cur.text || {}) };
        delete text.showDates;
        const { dates, ...rest } = cur; // eslint-disable-line no-unused-vars
        return { ...rest, text };
    });
    const saveLogo = (url) => onChange(cur => ({ ...cur, logoUrl: url || '' }));
    const saveWelcome = (value) => onChange(cur => ({ ...cur, welcome: value }));
    const saveList = (key, list) => onChange(cur => ({ ...cur, lists: { ...(cur.lists || {}), [key]: list } }));
    const resetList = (key) => onChange(cur => {
        const lists = { ...(cur.lists || {}) };
        delete lists[key];
        return { ...cur, lists };
    });
    const realLists = { associations: realAssociations(pd), disciplines: realDisciplines(pd) };
    const saveContact = (role, values) => onChange(cur => ({ ...cur, contacts: { ...(cur.contacts || {}), [role]: values } }));
    const saveHotel = (values) => onChange(cur => ({ ...cur, hotel: values }));

    const hiddenCount = [
        ...PUBLIC_FIELDS.map(f => f.key),
        ...contacts.map(c => `contact_${c.key}`),
        'hotel',
        'documents',
        'logo',
        'welcome',
    ].filter(k => hidden[k]).length;

    return (
        <>
            <VisibleNowSummary pd={pd} showId={showId} />

            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Globe className="h-4 w-4 text-primary" /> What the public sees
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Details come from Show Details. Hide anything you do not want on the public event page, or change the text it shows. Your real show data is not changed.
                        {hiddenCount > 0 && <span className="ml-1 font-medium">{hiddenCount} hidden.</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                    {PUBLIC_FIELDS.map(f => f.key === 'showDates' ? (
                        <DatesRow
                            key={f.key}
                            pd={pd}
                            dates={pp.dates || {}}
                            hidden={!!hidden.showDates}
                            onToggle={() => toggle('showDates')}
                            onChangeDates={saveDates}
                            onReset={resetDates}
                        />
                    ) : (f.key === 'associations' || f.key === 'disciplines') ? (
                        <TagsRow
                            key={f.key}
                            field={f}
                            real={realLists[f.key]}
                            list={publicList(pd, f.key, realLists[f.key])}
                            edited={Array.isArray(pp.lists?.[f.key])}
                            hidden={!!hidden[f.key]}
                            onToggle={() => toggle(f.key)}
                            onChangeList={(l) => saveList(f.key, l)}
                            onReset={() => resetList(f.key)}
                        />
                    ) : (
                        <FieldRow
                            key={f.key}
                            field={f}
                            auto={auto[f.key]}
                            hidden={!!hidden[f.key]}
                            text={text[f.key]}
                            onToggle={() => toggle(f.key)}
                            onSaveText={(v) => saveText(f.key, v)}
                        />
                    ))}
                </CardContent>
            </Card>

            <BrandingCard
                showId={showId}
                logoUrl={pp.logoUrl}
                welcome={pp.welcome}
                hidden={hidden}
                onToggle={toggle}
                onChangeLogo={saveLogo}
                onSaveWelcome={saveWelcome}
            />

            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4 text-primary" /> Contact information
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Who exhibitors should call or email. Type it here to show it on the public pages. Show Manager and Show Secretary use Show Details if you leave them empty.
                    </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-3">
                    {contacts.map(c => (
                        <InfoGroup
                            key={c.key}
                            title={c.label}
                            fields={CONTACT_FIELDS}
                            values={pp.contacts?.[c.key] || {}}
                            placeholders={c.auto}
                            hidden={c.hidden}
                            onToggle={() => toggle(`contact_${c.key}`)}
                            onSave={(v) => saveContact(c.key, v)}
                        />
                    ))}
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Hotel className="h-4 w-4 text-primary" /> Sponsor hotel
                    </CardTitle>
                    <CardDescription className="text-xs">
                        Optional. Shows a hotel box on the public pages with a link to its website.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <InfoGroup
                        title="Sponsor hotel"
                        fields={HOTEL_FIELDS}
                        values={hotel}
                        hidden={!!hidden.hotel}
                        onToggle={() => toggle('hotel')}
                        onSave={saveHotel}
                    />
                </CardContent>
            </Card>

            <DocumentsCard
                showId={showId}
                documents={Array.isArray(pp.documents) ? pp.documents : []}
                hidden={!!hidden.documents}
                onToggle={() => toggle('documents')}
                onChange={onChange}
            />
        </>
    );
};

export default PublicPageEditor;
