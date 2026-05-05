import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, MessageCircle, X, Send, Search, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/supabaseClient';

const FAQ_ITEMS = [
  {
    id: 'what-is-equipatterns',
    question: 'What is EquiPatterns?',
    answer: 'EquiPatterns is a platform for managing equestrian patterns, score sheets, and show materials. It helps show managers, judges, and contributors organize, build, and distribute pattern books for horse shows across multiple associations and disciplines.',
  },
  {
    id: 'how-to-upload',
    question: 'How do I upload patterns?',
    answer: 'Navigate to "Upload Patterns" from the main menu. You will be guided through a wizard that lets you select the association, discipline, and division, then upload your pattern files. Supported file formats include PDF, PNG, JPG, and SVG. Each upload is reviewed by an admin before being published to the library.',
  },
  {
    id: 'file-formats',
    question: 'What file formats are accepted for pattern uploads?',
    answer: 'We accept PDF, PNG, JPG/JPEG, and SVG files. For best results, upload high-resolution images (300 DPI or higher) or vector PDFs. Each file should contain a single pattern. Maximum file size is 10MB per file.',
  },
  {
    id: 'approval-process',
    question: 'How does the pattern approval process work?',
    answer: 'After you submit patterns, they enter a review queue. An EquiPatterns admin will verify the pattern matches the correct association, discipline, and division. You will receive a notification when your patterns are approved or if changes are needed. Most reviews are completed within 1-2 business days.',
  },
  {
    id: 'pattern-book-builder',
    question: 'How do I build a pattern book?',
    answer: 'Use the Pattern Book Builder from the main menu. Select your show, choose the disciplines and classes, pick patterns from the library, and arrange them in your desired order. The builder generates a professional PDF that can be printed or distributed digitally.',
  },
  {
    id: 'show-builder',
    question: 'How do I create and manage a horse show?',
    answer: 'Go to Horse Show Manager and click "Create Show." The wizard walks you through defining the show, adding venues and dates, building your class list, creating the show schedule, and designing the layout. You can save drafts and return at any time.',
  },
  {
    id: 'score-sheets',
    question: 'Where can I find score sheets?',
    answer: 'Score sheets are available in the Score Sheet Library. You can search by association and discipline, preview sheets, and download them individually or as part of a pattern book package.',
  },
  {
    id: 'account-subscription',
    question: 'How do subscriptions and billing work?',
    answer: 'Visit the Pricing page to see available plans. Subscriptions are managed through Stripe. You can view your billing history, update your payment method, and manage your subscription from your Profile page.',
  },
  {
    id: 'equipment-management',
    question: 'How does Equipment Management work?',
    answer: 'Equipment Management is available from the Horse Show Manager. It provides an 8-step planning process: master inventory, discipline planner, arena scheduling, distribution plans, location management, check-in/check-out tracking, reconciliation, and reports.',
  },
  {
    id: 'contract-management',
    question: 'How do I manage contracts for show officials?',
    answer: 'Go to Horse Show Manager > Employee Management > Contracts. The 6-step wizard guides you through selecting associations, adding officials and staff, choosing contract templates, generating contracts, tracking documents, and closing out. You can send contracts via email and track signing status.',
  },
  {
    id: 'pattern-tagging',
    question: 'How do pattern tags and levels work?',
    answer: 'Patterns can be tagged with levels (Walk-Trot, Green, Intermediate, Advanced, Championship, Open) and types (Reining, Trail, Horsemanship, etc.). Tags help organize and filter patterns in the library. Admins can assign tags during the review process, and an AI auto-tagger is also available.',
  },
  {
    id: 'publishing-show',
    question: 'How do I publish a show to the Events page?',
    answer: 'In the Show Builder, go to the Save & Manage step. Use the "Make Schedule Public" button to publish your schedule. Published schedules automatically appear on the public Events page with your show details, location, dates, and any website/Facebook links you provide.',
  },
  {
    id: 'membership-tiers',
    question: 'What membership tiers are available?',
    answer: 'We offer three tiers: Founding Insider ($79.99/year, limited to first 50 members, includes 3 free pattern books/year), Founding Member ($79.99/year, next 950 members, 1 free pattern book/year), and Standard ($99.99/year). Founding member pricing is locked in for life.',
  },
  {
    id: 'pattern-numbering',
    question: 'How does pattern numbering work?',
    answer: 'Patterns are assigned unique numbers in the format DISCIPLINE-YEAR-SEQUENCE (e.g., RN-2026-001 for Reining). Numbers are auto-generated when patterns are approved but can be manually adjusted by admins. This ensures consistent identification across the platform.',
  },
];

const QUICK_ACTIONS = [
  { label: 'Upload Patterns', href: '/upload-patterns', icon: '📤' },
  { label: 'Pattern Book Builder', href: '/pattern-book-builder', icon: '📖' },
  { label: 'Horse Show Manager', href: '/horse-show-manager', icon: '🐴' },
  { label: 'My Profile', href: '/profile', icon: '👤' },
  { label: 'Pricing & Plans', href: '/pricing', icon: '💳' },
  { label: 'Score Sheets', href: '/score-sheets', icon: '📋' },
];

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('faq');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [faqSearch, setFaqSearch] = useState('');

  const filteredFaqItems = faqSearch.trim()
    ? FAQ_ITEMS.filter(item =>
        item.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
        item.answer.toLowerCase().includes(faqSearch.toLowerCase())
      )
    : FAQ_ITEMS;

  const { user, profile } = useAuth();
  const { toast } = useToast();

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Only render for logged-in users
  if (!user) return null;

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'Unknown User';
  const userEmail = user?.email;

  const handleSubmit = async () => {
    if (!subject.trim()) {
      toast({ title: 'Subject required', description: 'Please enter a subject for your message.', variant: 'destructive' });
      return;
    }
    if (!message.trim()) {
      toast({ title: 'Message required', description: 'Please enter a message.', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-support-email', {
        body: {
          userName,
          userEmail,
          subject: subject.trim(),
          message: message.trim(),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'Message Sent!',
        description: "We've received your message and will get back to you soon.",
      });

      setSubject('');
      setMessage('');
      setActiveTab('faq');
    } catch (error) {
      console.error('Error sending support email:', error);
      toast({
        title: 'Failed to Send',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-40 h-12 w-12 md:h-14 md:w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          size="icon"
          aria-label="Open help and support"
        >
          <HelpCircle className="h-6 w-6 text-primary-foreground" />
        </Button>
      )}

      {/* Slide-out panel (portaled) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
                onClick={() => setIsOpen(false)}
              />

              {/* Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-xl z-50 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">Help & Support</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} aria-label="Close help panel">
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
                    <TabsTrigger value="faq" className="flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4" />
                      FAQ
                    </TabsTrigger>
                    <TabsTrigger value="contact" className="flex items-center gap-1.5">
                      <MessageCircle className="h-4 w-4" />
                      Contact Us
                    </TabsTrigger>
                  </TabsList>

                  {/* FAQ Tab */}
                  <TabsContent value="faq" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full px-4 pb-4">
                      {/* Search */}
                      <div className="relative mt-3 mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search FAQs..."
                          value={faqSearch}
                          onChange={(e) => setFaqSearch(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>

                      {/* Quick Actions */}
                      {!faqSearch.trim() && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</p>
                          <div className="grid grid-cols-2 gap-2">
                            {QUICK_ACTIONS.map((action) => (
                              <Link
                                key={action.href}
                                to={action.href}
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted text-sm transition-colors"
                              >
                                <span>{action.icon}</span>
                                <span className="truncate">{action.label}</span>
                                <ExternalLink className="h-3 w-3 ml-auto text-muted-foreground shrink-0" />
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* FAQ List */}
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        {faqSearch.trim() ? `${filteredFaqItems.length} result(s)` : 'Frequently Asked Questions'}
                      </p>
                      {filteredFaqItems.length === 0 ? (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          <p>No matching questions found.</p>
                          <Button variant="link" size="sm" onClick={() => { setFaqSearch(''); setActiveTab('contact'); }}>
                            Contact us instead
                          </Button>
                        </div>
                      ) : (
                        <Accordion type="single" collapsible className="w-full">
                          {filteredFaqItems.map((item) => (
                            <AccordionItem key={item.id} value={item.id}>
                              <AccordionTrigger className="text-left text-sm">
                                {item.question}
                              </AccordionTrigger>
                              <AccordionContent className="text-sm text-muted-foreground">
                                {item.answer}
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  {/* Contact Tab */}
                  <TabsContent value="contact" className="flex-1 overflow-hidden mt-0">
                    <ScrollArea className="h-full px-4 pb-4">
                      <p className="text-sm text-muted-foreground mb-4 mt-3">
                        Have a question not covered in the FAQ? Send us a message.
                      </p>

                      {/* Auto-filled user info */}
                      <div className="space-y-2 mb-5 p-3 rounded-md bg-muted/50">
                        <div>
                          <Label className="text-xs text-muted-foreground">Name</Label>
                          <p className="text-sm font-medium">{userName}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Email</Label>
                          <p className="text-sm font-medium">{userEmail}</p>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="space-y-2 mb-4">
                        <Label htmlFor="support-subject">Subject *</Label>
                        <Input
                          id="support-subject"
                          placeholder="Brief description of your question..."
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          maxLength={100}
                        />
                      </div>

                      {/* Message */}
                      <div className="space-y-2 mb-4">
                        <Label htmlFor="support-message">Message *</Label>
                        <Textarea
                          id="support-message"
                          placeholder="Describe your question or issue in detail..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          maxLength={2000}
                          rows={6}
                        />
                        <p className="text-xs text-muted-foreground text-right">
                          {message.length}/2000
                        </p>
                      </div>

                      {/* Submit */}
                      <Button
                        onClick={handleSubmit}
                        disabled={isSending || !subject.trim() || !message.trim()}
                        className="w-full"
                      >
                        {isSending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        {isSending ? 'Sending...' : 'Send Message'}
                      </Button>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
