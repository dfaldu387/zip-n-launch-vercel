import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, Download, Printer } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// A printable QR code that opens the public event page (Robert: "a QR code they could
// print that brings them to this event page").
const EventQrCard = ({ show, className }) => {
    const { toast } = useToast();
    const [dataUrl, setDataUrl] = useState('');
    const eventUrl = `${window.location.origin}/event-detail/${show.id}`;
    const showName = show.project_name || 'Event';

    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(eventUrl, { errorCorrectionLevel: 'M', margin: 2, width: 640 })
            .then(url => { if (!cancelled) setDataUrl(url); })
            .catch(() => { if (!cancelled) setDataUrl(''); });
        return () => { cancelled = true; };
    }, [eventUrl]);

    const download = () => {
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `${showName.replace(/[^\w-]+/g, '_')}_event_qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const print = () => {
        if (!dataUrl) return;
        const w = window.open('', '_blank');
        if (!w) {
            toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for this site, or use Download PNG and print the image.', variant: 'destructive' });
            return;
        }
        const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        w.document.write(`<!doctype html><html><head><title>${esc(showName)} QR</title>
<style>body{font-family:Arial,sans-serif;text-align:center;margin:0;padding:48px}h1{font-size:32px;margin:0 0 8px}p{color:#555;margin:6px 0}img{width:420px;height:420px;margin:24px 0}</style>
</head><body><h1>${esc(showName)}</h1><p>Scan to see the event details</p><img src="${dataUrl}" alt="QR code"/><p>${esc(eventUrl)}</p>
<script>window.onload=function(){window.print();}<\/script></body></html>`);
        w.document.close();
    };

    return (
        <Card className={cn('mb-6', className)}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <QrCode className="h-4 w-4 text-primary" /> Event QR Code
                </CardTitle>
                <CardDescription className="text-xs">
                    Scanning opens your public event page.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
                <div className="h-28 w-28 shrink-0 rounded-lg border bg-white p-1 flex items-center justify-center">
                    {dataUrl
                        ? <img src={dataUrl} alt="Event QR code" className="h-full w-full" />
                        : <span className="text-xs text-muted-foreground">Making QR…</span>}
                </div>
                <div className="min-w-0">
                    <div className="flex flex-col gap-2">
                        <Button type="button" size="sm" onClick={download} disabled={!dataUrl}>
                            <Download className="h-3.5 w-3.5 mr-1.5" /> Download PNG
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={print} disabled={!dataUrl}>
                            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EventQrCard;
