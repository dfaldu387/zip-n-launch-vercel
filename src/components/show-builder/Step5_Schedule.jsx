import { useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Download, RotateCcw, Hash, Type, PanelTop, PanelBottom, AlertTriangle, Image } from 'lucide-react';
import BackgroundManager from '@/components/BackgroundManager';
import { useToast } from '@/components/ui/use-toast';
import { getAllClassItems, getUnplacedClasses, initializeShowBill, renumberShowBill } from '@/lib/showBillUtils';
import { generateShowBillPdf } from '@/lib/showBillPdfGenerator';

const DEFAULT_LAYOUT = {
  showNumbers: true,
  numberingMode: 'global',
  startClassNumber: 1,
  showAssociations: true,
  showDayHeaders: true,
  showArenaHeaders: true,
  daySeparatorStyle: 'boxed',
  arenaSeparatorStyle: 'line',
  lineSpacing: 'normal',
  fontSize: 'medium',
  showHeader: true,
  showVenue: true,
  showJudges: true,
  showFooter: true,
  customFooterText: '',
  background: { id: 'none', type: 'none', value: '' },
};

// --- Layout Controls Panel ---
const LayoutControls = ({ settings, onChange, onExportPdf, onReset, exportDisabled = false }) => {
  const update = (key, value) => onChange({ ...settings, [key]: value });

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-1">Layout Controls</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Customize how your show bill looks. Changes update the preview instantly.
      </p>

      <ScrollArea className="flex-grow">
        <Accordion type="multiple" defaultValue={['numbering', 'display', 'headers', 'footer']} className="space-y-2">
          {/* Numbering */}
          <AccordionItem value="numbering" className="border rounded-lg px-3">
            <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Hash className="h-4 w-4" /> Numbering</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showNumbers" className="text-sm">Show class numbers</Label>
                <Switch id="showNumbers" checked={settings.showNumbers} onCheckedChange={(v) => update('showNumbers', v)} />
              </div>
              {settings.showNumbers && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Numbering mode</Label>
                    <Select value={settings.numberingMode} onValueChange={(v) => update('numberingMode', v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Global (sequential)</SelectItem>
                        <SelectItem value="per-day">Per Day</SelectItem>
                        <SelectItem value="per-arena">Per Arena</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start class number</Label>
                    <Input
                      type="number"
                      min="1"
                      value={settings.startClassNumber || 1}
                      onChange={(e) => update('startClassNumber', Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-sm"
                      placeholder="1"
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Display */}
          <AccordionItem value="display" className="border rounded-lg px-3">
            <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Type className="h-4 w-4" /> Display</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showAssociations" className="text-sm">Show association badges</Label>
                <Switch id="showAssociations" checked={settings.showAssociations} onCheckedChange={(v) => update('showAssociations', v)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Font size</Label>
                <Select value={settings.fontSize} onValueChange={(v) => update('fontSize', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Line spacing</Label>
                <Select value={settings.lineSpacing} onValueChange={(v) => update('lineSpacing', v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="relaxed">Relaxed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Headers & Sections */}
          <AccordionItem value="headers" className="border rounded-lg px-3">
            <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><PanelTop className="h-4 w-4" /> Headers & Sections</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showHeader" className="text-sm">Show header</Label>
                <Switch id="showHeader" checked={settings.showHeader} onCheckedChange={(v) => update('showHeader', v)} />
              </div>
              {settings.showHeader && (
                <>
                  <div className="flex items-center justify-between pl-4">
                    <Label htmlFor="showVenue" className="text-sm text-muted-foreground">Show venue</Label>
                    <Switch id="showVenue" checked={settings.showVenue} onCheckedChange={(v) => update('showVenue', v)} />
                  </div>
                  <div className="flex items-center justify-between pl-4">
                    <Label htmlFor="showJudges" className="text-sm text-muted-foreground">Show judges</Label>
                    <Switch id="showJudges" checked={settings.showJudges} onCheckedChange={(v) => update('showJudges', v)} />
                  </div>
                </>
              )}
              <hr className="border-border" />
              <div className="flex items-center justify-between">
                <Label htmlFor="showDayHeaders" className="text-sm">Show day headers</Label>
                <Switch id="showDayHeaders" checked={settings.showDayHeaders} onCheckedChange={(v) => update('showDayHeaders', v)} />
              </div>
              {settings.showDayHeaders && (
                <div className="space-y-1 pl-4">
                  <Label className="text-xs text-muted-foreground">Day separator style</Label>
                  <Select value={settings.daySeparatorStyle} onValueChange={(v) => update('daySeparatorStyle', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boxed">Boxed</SelectItem>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="showArenaHeaders" className="text-sm">Show arena headers</Label>
                <Switch id="showArenaHeaders" checked={settings.showArenaHeaders} onCheckedChange={(v) => update('showArenaHeaders', v)} />
              </div>
              {settings.showArenaHeaders && (
                <div className="space-y-1 pl-4">
                  <Label className="text-xs text-muted-foreground">Arena separator style</Label>
                  <Select value={settings.arenaSeparatorStyle} onValueChange={(v) => update('arenaSeparatorStyle', v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line">Line</SelectItem>
                      <SelectItem value="bold-line">Bold Line</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Footer */}
          <AccordionItem value="footer" className="border rounded-lg px-3">
            <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><PanelBottom className="h-4 w-4" /> Footer</span>
            </AccordionTrigger>
            <AccordionContent className="space-y-3 pb-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="showFooter" className="text-sm">Show page footer</Label>
                <Switch id="showFooter" checked={settings.showFooter} onCheckedChange={(v) => update('showFooter', v)} />
              </div>
              {settings.showFooter && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Custom footer text</Label>
                  <Input
                    value={settings.customFooterText}
                    onChange={(e) => update('customFooterText', e.target.value)}
                    placeholder="e.g., All times are approximate"
                    className="h-8 text-sm"
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Background */}
          <AccordionItem value="background" className="border rounded-lg px-3">
            <AccordionTrigger className="py-2 text-sm font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Image className="h-4 w-4" /> Background</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <BackgroundManager
                value={settings.background}
                onChange={(bg) => update('background', bg)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>

      <div className="mt-4 space-y-2 pt-3 border-t">
        <Button onClick={onExportPdf} size="lg" className="w-full text-sm font-semibold" disabled={exportDisabled}>
          <Download className="mr-2 h-5 w-5" /> Export Print-Ready PDF
        </Button>
        {exportDisabled && (
          <p className="text-xs text-muted-foreground text-center">
            Approve & Lock your show in Save & Manage to enable export.
          </p>
        )}
        <Button variant="outline" onClick={onReset} className="w-full">
          <RotateCcw className="mr-2 h-4 w-4" /> Reset to Defaults
        </Button>
      </div>
    </div>
  );
};

// --- Font/Spacing CSS map ---
const FONT_SIZE_MAP = { small: 'text-xs', medium: 'text-sm', large: 'text-base' };
const FONT_SIZE_HEADER_MAP = { small: 'text-base', medium: 'text-lg', large: 'text-xl' };
const FONT_SIZE_DAY_MAP = { small: 'text-sm', medium: 'text-base', large: 'text-lg' };
const SPACING_MAP = { compact: 'space-y-0.5', normal: 'space-y-1.5', relaxed: 'space-y-3' };
const ITEM_PADDING_MAP = { compact: 'py-0.5', normal: 'py-1', relaxed: 'py-2' };

// --- Live Preview ---
const ShowBillPreview = ({ showBill, settings, allClassItems, associationsData }) => {
  if (!showBill) return <p className="text-muted-foreground text-center py-10">No schedule data yet.</p>;

  const header = showBill.header || {};
  const fontSize = FONT_SIZE_MAP[settings.fontSize] || FONT_SIZE_MAP.medium;
  const headerFontSize = FONT_SIZE_HEADER_MAP[settings.fontSize] || FONT_SIZE_HEADER_MAP.medium;
  const dayFontSize = FONT_SIZE_DAY_MAP[settings.fontSize] || FONT_SIZE_DAY_MAP.medium;
  const itemPadding = ITEM_PADDING_MAP[settings.lineSpacing] || ITEM_PADDING_MAP.normal;

  const getAssocTags = (classIds) => {
    const uniqueAssocs = new Set();
    (classIds || []).forEach(cid => {
      const cls = allClassItems.find(c => c.divisionId === cid || c.id === cid);
      if (cls) {
        const assoc = associationsData?.find(a => a.id === cls.assocId);
        uniqueAssocs.add(assoc?.abbreviation || cls.assocId);
      }
    });
    return Array.from(uniqueAssocs);
  };

  // Renumber based on current settings
  const numberedBill = useMemo(() => {
    const sb = JSON.parse(JSON.stringify(showBill));
    sb.settings = { ...sb.settings, numberingMode: settings.numberingMode, startClassNumber: settings.startClassNumber || 1 };
    return renumberShowBill(sb);
  }, [showBill, settings.numberingMode, settings.startClassNumber]);

  return (
    <div className="bg-white text-black rounded-lg mx-auto max-w-[680px] px-10 py-8 min-h-[600px] print:shadow-none"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      {settings.showHeader && (
        <div className="text-center mb-4">
          <h2 className={`font-bold ${headerFontSize === 'text-lg' ? 'text-xl' : headerFontSize === 'text-xl' ? 'text-2xl' : 'text-lg'}`}>
            {header.showName || 'Show Bill'}
          </h2>
          {settings.showVenue && header.venue && (
            <p className={`${fontSize} text-gray-600 mt-0.5`}>{header.venue}</p>
          )}
          {header.dates && (
            <p className={`${fontSize} text-gray-600`}>{header.dates}</p>
          )}
          {settings.showJudges && header.judges?.length > 0 && (
            <p className={`${fontSize} text-gray-500 mt-0.5`}>Judges: {header.judges.join(', ')}</p>
          )}
          {header.customText && (
            <p className={`${fontSize} text-gray-400 italic mt-0.5`}>{header.customText}</p>
          )}
          <hr className="mt-3 border-gray-800 border-t-2" />
        </div>
      )}

      {/* Days */}
      {numberedBill.days?.map((day, dayIndex) => (
        <div key={day.id} className={dayIndex > 0 ? 'mt-4' : ''}>
          {/* Day Header */}
          {settings.showDayHeaders && (
            <>
              {settings.daySeparatorStyle === 'boxed' && (
                <div className="bg-gray-100 border border-gray-300 rounded text-center py-1.5 mb-3 mt-2">
                  <p className={`font-bold ${dayFontSize}`}>{day.label || day.date}</p>
                </div>
              )}
              {settings.daySeparatorStyle === 'line' && (
                <div className="mb-3 mt-2">
                  <hr className="border-gray-400 mb-1" />
                  <p className={`font-bold ${dayFontSize} text-center`}>{day.label || day.date}</p>
                  <hr className="border-gray-400 mt-1" />
                </div>
              )}
              {settings.daySeparatorStyle === 'none' && (
                <p className={`font-bold ${dayFontSize} text-center mb-2 mt-2`}>{day.label || day.date}</p>
              )}
            </>
          )}

          {/* Arenas */}
          {day.arenas?.map((arena, arenaIndex) => {
            // Skip closed arenas in preview
            if ((numberedBill.closedArenas || {})[`${day.id}::${arena.id}`]) return null;
            return (
            <div key={arena.id} className={arenaIndex > 0 ? 'mt-3' : ''}>
              {/* Arena Header */}
              {settings.showArenaHeaders && (
                <>
                  {settings.arenaSeparatorStyle === 'bold-line' && (
                    <div className="mb-2">
                      <hr className="border-gray-800 border-t-2" />
                      <p className={`font-bold ${fontSize} text-center mt-0.5`}>{arena.name}</p>
                    </div>
                  )}
                  {settings.arenaSeparatorStyle === 'line' && (
                    <div className="mb-2">
                      <hr className="border-gray-400" />
                      <p className={`font-bold ${fontSize} text-center mt-0.5`}>{arena.name}</p>
                    </div>
                  )}
                  {settings.arenaSeparatorStyle === 'none' && (
                    <p className={`font-bold ${fontSize} text-center mb-1`}>{arena.name}</p>
                  )}
                </>
              )}

              {/* Items */}
              <div className={SPACING_MAP[settings.lineSpacing] || SPACING_MAP.normal}>
                {arena.items?.map(item => {
                  if (item.type === 'sectionHeader') {
                    return (
                      <div key={item.id} className={`text-center ${itemPadding}`}>
                        <p className={`font-bold ${fontSize} underline`}>{item.title}</p>
                      </div>
                    );
                  }

                  if (item.type === 'break') {
                    return (
                      <div key={item.id} className={`text-center ${itemPadding}`}>
                        <p className={`${fontSize} font-semibold italic text-gray-600`}>
                          {item.duration ? `${item.title} — ${item.duration}` : item.title}
                        </p>
                      </div>
                    );
                  }

                  if (item.type === 'drag') {
                    return (
                      <div key={item.id} className={`text-center ${itemPadding}`}>
                        <p className={`${fontSize} font-semibold italic text-gray-600`}>{item.title}</p>
                      </div>
                    );
                  }

                  if (item.type === 'custom') {
                    return (
                      <div key={item.id} className={`${itemPadding}`}>
                        <p className={`${fontSize} text-gray-700`}>
                          {item.content ? `${item.title}: ${item.content}` : item.title}
                        </p>
                      </div>
                    );
                  }

                  if (item.type === 'classBox') {
                    const classDetails = (item.classes || []).map(cid => allClassItems.find(c => c.divisionId === cid || c.id === cid)).filter(Boolean);
                    const assocTags = settings.showAssociations ? getAssocTags(item.classes) : [];

                    if (classDetails.length <= 1) {
                      const titleText = item.title || classDetails[0]?.name || 'Untitled';
                      const assocSuffix = assocTags.length > 0 ? ` - ${assocTags.join(', ')}` : '';
                      return (
                        <div key={item.id} className={`flex items-center gap-2 ${itemPadding}`}>
                          {settings.showNumbers && item.number && (
                            <span className={`${fontSize} font-bold text-gray-800 w-8 text-right shrink-0`}>{item.number}.</span>
                          )}
                          <span className={fontSize}>{titleText}{assocSuffix}</span>
                        </div>
                      );
                    }

                    return (
                      <div key={item.id} className={itemPadding}>
                        <div className="flex items-baseline gap-2">
                          {settings.showNumbers && item.number && (
                            <span className={`${fontSize} font-bold text-gray-800 w-8 text-right shrink-0`}>{item.number}.</span>
                          )}
                          <span className={`${fontSize} font-bold`}>{item.title || 'Grouped Classes'}</span>
                        </div>
                        <div className="pl-10 space-y-0.5">
                          {classDetails.map(cls => {
                            const assoc = associationsData?.find(a => a.id === cls.assocId);
                            const assocText = settings.showAssociations && assoc ? ` - ${assoc.abbreviation}` : '';
                            return (
                              <div key={cls.id} className={`${fontSize} text-gray-700`}>
                                {cls.name}{assocText}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          );
          })}
        </div>
      ))}

      {/* Footer */}
      {settings.showFooter && (
        <div className="mt-6 pt-2 border-t border-gray-300 text-center">
          <p className="text-xs text-gray-400">{header.showName || 'Show Bill'}</p>
          {settings.customFooterText && (
            <p className="text-xs text-gray-500 mt-0.5">{settings.customFooterText}</p>
          )}
        </div>
      )}
    </div>
  );
};

// --- Main Step Component ---
export const Step5_Schedule = ({ formData, setFormData, associationsData, stepNumber = 6, stepTitle = 'Design & Finalize Layout' }) => {
  const { toast } = useToast();

  // Initialize showBill if needed (auto-populates all classes)
  useEffect(() => {
    if (!formData.showBill) {
      const initial = initializeShowBill(formData);
      setFormData(prev => ({ ...prev, showBill: initial }));
    }
  }, [!formData.showBill]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize layoutSettings from showBill.settings or defaults
  useEffect(() => {
    if (!formData.layoutSettings && formData.showBill) {
      const fromBill = formData.showBill.settings || {};
      setFormData(prev => ({
        ...prev,
        layoutSettings: {
          ...DEFAULT_LAYOUT,
          showNumbers: fromBill.showNumbers ?? DEFAULT_LAYOUT.showNumbers,
          showAssociations: fromBill.showAssociations ?? DEFAULT_LAYOUT.showAssociations,
          numberingMode: fromBill.numberingMode ?? DEFAULT_LAYOUT.numberingMode,
          startClassNumber: fromBill.startClassNumber ?? DEFAULT_LAYOUT.startClassNumber,
        },
      }));
    }
  }, [formData.layoutSettings, formData.showBill, setFormData]);

  const layoutSettings = formData.layoutSettings || DEFAULT_LAYOUT;

  const allClassItems = useMemo(() => getAllClassItems(formData), [formData]);
  const unplacedClasses = useMemo(() => getUnplacedClasses(formData), [formData]);

  const handleChange = useCallback((newSettings) => {
    setFormData(prev => ({ ...prev, layoutSettings: newSettings }));
  }, [setFormData]);

  const handleReset = useCallback(() => {
    setFormData(prev => ({ ...prev, layoutSettings: { ...DEFAULT_LAYOUT } }));
  }, [setFormData]);

  const handleExportPdf = useCallback(async () => {
    try {
      await generateShowBillPdf(formData.showBill, allClassItems, associationsData, layoutSettings);
      toast({ title: 'PDF Generated', description: 'Your show bill PDF has been downloaded.' });
    } catch (err) {
      toast({ title: 'PDF Error', description: err.message, variant: 'destructive' });
    }
  }, [formData.showBill, allClassItems, associationsData, layoutSettings, toast]);

  if (!formData.disciplines || formData.disciplines.length === 0) {
    return (
      <motion.div key="step6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
        <CardHeader>
          <CardTitle>{`${stepNumber}. ${stepTitle}`}</CardTitle>
          <CardDescription>
            Customize how your show bill will look when printed or exported to PDF.
            <span className="block mt-1 text-xs text-muted-foreground/70">This step only changes presentation — class structure is already locked.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-10 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">No classes to preview yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Go back to earlier steps to build your class list and schedule.</p>
          </div>
        </CardContent>
      </motion.div>
    );
  }

  return (
    <motion.div key="step6" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <CardHeader>
        <CardTitle>{`${stepNumber}. ${stepTitle}`}</CardTitle>
        <CardDescription>
          Customize how your show bill will look when printed or exported to PDF.
          <span className="block mt-1 text-xs text-muted-foreground/70">This step only changes presentation — class structure is already locked.</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unplacedClasses.length > 0 && (
          <div className="flex items-center justify-between gap-2 p-3 mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-400">
                {unplacedClasses.length} class{unplacedClasses.length > 1 ? 'es' : ''} not yet placed in the schedule.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const rebuilt = initializeShowBill(formData);
              setFormData(prev => ({ ...prev, showBill: rebuilt }));
              toast({ title: 'Schedule Rebuilt', description: 'All classes have been placed into the schedule.' });
            }}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Rebuild Schedule
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel: Controls */}
          <div className="lg:col-span-4">
            <LayoutControls
              settings={layoutSettings}
              onChange={handleChange}
              onExportPdf={handleExportPdf}
              onReset={handleReset}
              exportDisabled={formData.showStatus !== 'locked' && formData.showStatus !== 'published'}
            />
          </div>

          {/* Right Panel: Preview */}
          <div className="lg:col-span-8">
            <div className="bg-gray-50 dark:bg-muted/10 rounded-lg p-6 min-h-[600px] flex justify-center" style={{ background: 'repeating-conic-gradient(rgb(243 244 246) 0% 25%, rgb(249 250 251) 0% 50%) 50% / 20px 20px' }}>
              <ScrollArea className="h-[700px] w-full">
                <ShowBillPreview
                  showBill={formData.showBill}
                  settings={layoutSettings}
                  allClassItems={allClassItems}
                  associationsData={associationsData}
                />
              </ScrollArea>
            </div>
          </div>
        </div>
      </CardContent>
    </motion.div>
  );
};
