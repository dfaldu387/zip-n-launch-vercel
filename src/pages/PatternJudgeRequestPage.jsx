import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Lock, Gavel, Send, ZoomIn, X, UploadCloud, FileText } from 'lucide-react';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';

/** Mirrors the pattern-number parsing used by the builder/PDF renderer. */
const extractPatternNumber = (fileName) => {
  if (!fileName) return null;
  const nameWithoutExt = fileName.replace(/\.(pdf|PDF)$/, '');
  const match = nameWithoutExt.match(/(\d+)(?:\.|$)/);
  if (match) return parseInt(match[1], 10) || null;
  const fallback = nameWithoutExt.match(/(\d+)$/);
  return fallback ? (parseInt(fallback[1], 10) || null) : null;
};

/**
 * Public, no-login page reached from the "Select Your Patterns" link in the
 * judge request email. The token encodes the project + judge email, so the page
 * shows ONLY the disciplines/groups that judge was asked to pick patterns for.
 * The judge picks a pattern per group and submits — saved back into the book.
 */
export default function PatternJudgeRequestPage() {
  const { token } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null); // { showName, showDates, recipientName, status, isPublished, items, patternsByDiscipline }
  const [picks, setPicks] = useState({}); // `${disciplineId}:${groupId}` -> { patternId, patternName, patternNumber }
  const [uploads, setUploads] = useState({}); // `${disciplineId}:${groupId}` -> { uploadedFileName, uploadedFileUrl }
  const [uploadingKey, setUploadingKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null); // full-size image overlay

  // ── Load the scoped request ──
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('get-judge-request', { body: { token } });
      if (error || data?.error) {
        setError(data?.error || 'This link is invalid or has expired.');
      } else {
        setInfo(data);
        // Seed picks + uploads from anything already chosen/uploaded.
        const seedPicks = {};
        const seedUploads = {};
        (data.items || []).forEach((it) => {
          const key = `${it.disciplineId}:${it.groupId}`;
          if (it.uploadedFileName) {
            seedUploads[key] = { uploadedFileName: it.uploadedFileName, uploadedFileUrl: it.uploadedFileUrl };
          } else if (it.currentPatternId) {
            seedPicks[key] = {
              patternId: it.currentPatternId,
              patternName: it.currentPatternName || '',
              patternNumber: extractPatternNumber(it.currentPatternName),
            };
          }
        });
        setPicks(seedPicks);
        setUploads(seedUploads);
      }
    } catch (e) {
      setError('Could not load this request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Candidate patterns come from the edge function (service-role lookup that
  // matches the builder's sources and works for not-logged-in judges).
  const patternsByDiscipline = info?.patternsByDiscipline || {};

  const disciplines = useMemo(() => {
    const map = new Map();
    (info?.items || []).forEach((it) => {
      if (!map.has(it.disciplineId)) map.set(it.disciplineId, it.disciplineName);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [info]);

  const setPick = (disciplineId, groupId, option) => {
    setPicks((prev) => ({
      ...prev,
      [`${disciplineId}:${groupId}`]: option
        ? { patternId: option.id, patternName: option.patternName, patternNumber: option.patternNumber }
        : undefined,
    }));
  };

  // Apply one pattern to every group in a discipline (convenience).
  const setPickForDiscipline = (disciplineId, option) => {
    setPicks((prev) => {
      const next = { ...prev };
      (info?.items || [])
        .filter((it) => it.disciplineId === disciplineId)
        .forEach((it) => {
          next[`${disciplineId}:${it.groupId}`] = {
            patternId: option.id,
            patternName: option.patternName,
            patternNumber: option.patternNumber,
          };
        });
      return next;
    });
  };

  const totalGroups = info?.items?.length || 0;
  // A group is "done" when the judge has either picked a pattern OR uploaded one.
  const doneCount = useMemo(
    () => (info?.items || []).filter((it) => {
      const key = `${it.disciplineId}:${it.groupId}`;
      return uploads[key]?.uploadedFileName || picks[key]?.patternId;
    }).length,
    [info, picks, uploads],
  );

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Judge uploads their own pattern for a group (saved immediately).
  const handleUpload = async (it, file) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload a PDF, JPG, or PNG.' });
      return;
    }
    const key = `${it.disciplineId}:${it.groupId}`;
    setUploadingKey(key);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('submit-pattern-upload', {
        body: { token, disciplineId: it.disciplineId, groupId: it.groupId, fileBase64, fileName: file.name, fileType: file.type },
      });
      if (error || data?.error) {
        toast({ variant: 'destructive', title: 'Upload failed', description: data?.error || 'Please try again.' });
        return;
      }
      setUploads((prev) => ({ ...prev, [key]: { uploadedFileName: data.uploadedFileName, uploadedFileUrl: data.uploadedFileUrl } }));
      setPick(it.disciplineId, it.groupId, null); // upload replaces any library pick
      toast({ title: 'Uploaded', description: `${file.name} received for ${it.groupName}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Something went wrong. Please try again.' });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmit = async () => {
    // Uploads are already saved server-side; only library picks need submitting.
    const selections = Object.entries(picks)
      .filter(([key, v]) => v?.patternId && !uploads[key]?.uploadedFileName)
      .map(([key, v]) => {
        const [disciplineId, groupId] = key.split(':');
        return { disciplineId, groupId, patternId: v.patternId, patternName: v.patternName, patternNumber: v.patternNumber };
      });
    const hasUploads = Object.keys(uploads).length > 0;
    if (selections.length === 0 && !hasUploads) {
      toast({ variant: 'destructive', title: 'Nothing chosen', description: 'Pick or upload a pattern before submitting.' });
      return;
    }
    setSubmitting(true);
    try {
      if (selections.length > 0) {
        const { data, error } = await supabase.functions.invoke('submit-judge-selection', {
          body: { token, selections },
        });
        if (error || data?.error) {
          toast({ variant: 'destructive', title: 'Submit failed', description: data?.error || 'Please try again.' });
          return;
        }
      }
      setSubmitted(true);
      toast({ title: 'Submitted', description: 'Your patterns have been saved to the book.' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Submit failed', description: 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── States ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Link unavailable</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-t-xl p-6 sm:p-8 text-center">
          <Gavel className="w-7 h-7 mx-auto mb-2 opacity-90" />
          <h1 className="text-2xl font-bold">Select Your Patterns</h1>
          <p className="opacity-90 mt-1">{info.showName}</p>
          {info.showDates && (
            <p className="opacity-90 text-sm mt-2 inline-block bg-white/15 rounded-full px-3 py-1">{info.showDates}</p>
          )}
        </div>

        <div className="bg-card border border-t-0 rounded-b-xl p-5 sm:p-8 shadow-sm">
          {info.isPublished ? (
            <div className="text-center py-8">
              <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-semibold text-lg">Selections are closed</h2>
              <p className="text-muted-foreground text-sm mt-1">
                This pattern book has been published, so pattern selections can no longer be changed.
              </p>
            </div>
          ) : submitted ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <h2 className="font-semibold text-lg">Thank you, {info.recipientName}!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Your pattern selections have been saved to the pattern book. You may close this page.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-1">
                Hello {info.recipientName}, for each group below either <strong>pick a pattern</strong> from the list or <strong>upload your own</strong>.
              </p>
              <p className="text-xs text-muted-foreground mb-5">{doneCount} of {totalGroups} done</p>

              <div className="space-y-6">
                {disciplines.map((d) => {
                  const groupItems = (info.items || []).filter((it) => it.disciplineId === d.id);
                  const options = patternsByDiscipline[d.id] || [];
                  return (
                    <div key={d.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <h3 className="font-semibold">{d.name}</h3>
                        {groupItems.length > 1 && options?.length > 0 && (
                          <Select onValueChange={(id) => {
                            const p = options.find((o) => String(o.id) === id);
                            if (p) setPickForDiscipline(d.id, p);
                          }}>
                            <SelectTrigger className="h-8 w-[200px] text-xs">
                              <SelectValue placeholder="Set for all groups…" />
                            </SelectTrigger>
                            <SelectContent>
                              {options.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>{p.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div className="space-y-3">
                        {groupItems.map((it) => {
                          const key = `${it.disciplineId}:${it.groupId}`;
                          const picked = picks[key];
                          const uploaded = uploads[key];
                          const isUploading = uploadingKey === key;
                          const pickedOption = picked?.patternId
                            ? options.find((o) => String(o.id) === String(picked.patternId))
                            : null;
                          return (
                            <div key={it.groupId} className="border-t pt-3 first:border-t-0 first:pt-0">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm">{it.groupName}</span>
                                {uploaded ? (
                                  <span className="inline-flex items-center text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Uploaded
                                  </span>
                                ) : options.length === 0 ? (
                                  <span className="text-xs text-muted-foreground">No library patterns — upload below</span>
                                ) : (
                                  <Select
                                    value={picked?.patternId ? String(picked.patternId) : ''}
                                    onValueChange={(id) => setPick(it.disciplineId, it.groupId, options.find((o) => String(o.id) === id))}
                                  >
                                    <SelectTrigger className="h-9 w-[220px]">
                                      <SelectValue placeholder="Select a pattern…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>{p.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>

                              {/* Preview of the chosen library pattern */}
                              {!uploaded && pickedOption && (
                                pickedOption.imageUrl ? (
                                  <div className="mt-2 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewUrl(pickedOption.imageUrl)}
                                      className="group relative border rounded-md overflow-hidden hover:ring-2 hover:ring-amber-400 transition"
                                      title="Click to enlarge"
                                    >
                                      <img src={pickedOption.imageUrl} alt={pickedOption.label} className="h-32 w-auto object-contain bg-white" />
                                      <span className="absolute bottom-1 right-1 bg-black/60 text-white rounded p-0.5">
                                        <ZoomIn className="w-3.5 h-3.5" />
                                      </span>
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-1 text-right text-[11px] text-muted-foreground">No preview image for {pickedOption.label}</p>
                                )
                              )}

                              {/* Uploaded file name */}
                              {uploaded && (
                                <div className="mt-2 flex items-center gap-2 text-sm bg-muted/50 rounded-md p-2">
                                  <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                  <span className="truncate">{uploaded.uploadedFileName}</span>
                                </div>
                              )}

                              {/* Upload-your-own control (always available) */}
                              <div className="mt-2 flex justify-end">
                                <label className={`inline-flex items-center gap-1.5 text-xs cursor-pointer rounded-md border px-2.5 py-1.5 transition ${isUploading ? 'opacity-60 pointer-events-none' : 'hover:bg-amber-50 hover:border-amber-300'}`}>
                                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                                  {uploaded ? 'Replace with your own file' : (options.length === 0 ? 'Upload your pattern (PDF/JPG/PNG)' : 'or upload your own')}
                                  <input
                                    type="file"
                                    accept={ACCEPT}
                                    className="hidden"
                                    disabled={isUploading}
                                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleUpload(it, f); }}
                                  />
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                className="w-full mt-6 h-11 bg-amber-600 hover:bg-amber-700 text-white"
                disabled={submitting || doneCount === 0}
                onClick={handleSubmit}
              >
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4 mr-2" /> Submit Selections</>}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                You can return to this link anytime to change your selections until the book is published.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Full-size pattern preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/90 hover:text-white"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={previewUrl}
            alt="Pattern preview"
            className="max-h-[90vh] max-w-[90vw] object-contain bg-white rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
