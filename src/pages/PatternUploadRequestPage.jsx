import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, CheckCircle2, FileText, AlertCircle, Lock } from 'lucide-react';

const ACCEPT = '.pdf,.jpg,.jpeg,.png';

/**
 * Public, no-login page reached from the "Upload Your Patterns" link in the
 * custom-pattern-request email. The token encodes the project + discipline, so
 * the page shows ONLY that discipline's groups and nothing else.
 */
export default function PatternUploadRequestPage() {
  const { token } = useParams();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null); // { showName, disciplineName, status, isPublished, groups }
  const [uploadingGroupId, setUploadingGroupId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase.functions.invoke('get-upload-request', {
        body: { token },
      });
      if (error || data?.error) {
        setError(data?.error || 'This link is invalid or has expired.');
      } else {
        setInfo(data);
      }
    } catch (e) {
      setError('Could not load this request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleUpload = async (group, file) => {
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please upload a PDF, JPG, or PNG.' });
      return;
    }
    setUploadingGroupId(group.groupId);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('submit-pattern-upload', {
        body: { token, disciplineId: group.disciplineId, groupId: group.groupId, fileBase64, fileName: file.name, fileType: file.type },
      });
      if (error || data?.error) {
        toast({ variant: 'destructive', title: 'Upload failed', description: data?.error || 'Please try again.' });
        return;
      }
      // Update just this group's state in place (match on discipline + group).
      setInfo((prev) => ({
        ...prev,
        groups: prev.groups.map((g) =>
          g.groupId === group.groupId && g.disciplineId === group.disciplineId
            ? { ...g, uploadedFileName: data.uploadedFileName, uploadedFileUrl: data.uploadedFileUrl, requestStatus: 'uploaded' }
            : g
        ),
      }));
      toast({ title: 'Uploaded', description: `${file.name} received for ${group.groupName}.` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Upload failed', description: 'Something went wrong. Please try again.' });
    } finally {
      setUploadingGroupId(null);
    }
  };

  // ---- States ----
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
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-xl p-6 sm:p-8 text-center">
          <h1 className="text-2xl font-bold">Upload Your Patterns</h1>
          <p className="opacity-90 mt-1">{info.showName}</p>
          <p className="opacity-90 text-sm mt-2 inline-block bg-white/15 rounded-full px-3 py-1">
            {info.disciplineName}
          </p>
        </div>

        <div className="bg-card border border-t-0 rounded-b-xl p-5 sm:p-8 shadow-sm">
          {info.isPublished ? (
            <div className="text-center py-8">
              <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="font-semibold text-lg">Uploads are closed</h2>
              <p className="text-muted-foreground text-sm mt-1">
                This pattern book has been published, so new patterns can no longer be uploaded.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-5">
                Please upload a custom pattern for each group below. Accepted files: PDF, JPG, or PNG.
              </p>

              <div className="space-y-4">
                {info.groups.map((group) => {
                  const isUploaded = group.requestStatus === 'uploaded' && group.uploadedFileName;
                  const isBusy = uploadingGroupId === group.groupId;
                  return (
                    <div key={`${group.disciplineId}:${group.groupId}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          {group.disciplineName && (
                            <p className="text-xs text-muted-foreground">{group.disciplineName}</p>
                          )}
                          <h3 className="font-semibold">{group.groupName}</h3>
                        </div>
                        {isUploaded && (
                          <span className="inline-flex items-center text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Uploaded
                          </span>
                        )}
                      </div>

                      {isUploaded && (
                        <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-2 mb-3">
                          <FileText className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="truncate">{group.uploadedFileName}</span>
                        </div>
                      )}

                      <label
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md py-6 cursor-pointer transition-colors ${
                          isBusy ? 'opacity-60 pointer-events-none' : 'hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        {isBusy ? (
                          <><Loader2 className="w-6 h-6 animate-spin text-primary mb-1" /><span className="text-sm text-muted-foreground">Uploading…</span></>
                        ) : (
                          <><UploadCloud className="w-6 h-6 text-primary mb-1" /><span className="text-sm text-muted-foreground">
                            {isUploaded ? 'Click to replace file' : 'Drop or click to upload PDF, JPG, or PNG'}
                          </span></>
                        )}
                        <input
                          type="file"
                          accept={ACCEPT}
                          className="hidden"
                          disabled={isBusy}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            handleUpload(group, file);
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground text-center mt-6">
                You can return to this link anytime to add or replace patterns until the book is published.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
