/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React, { useState, useEffect } from 'react';
import * as Dialog from '../../unison/ui/radix/dialog';
import { X, Sparkles, Send, CheckCircle2, Calendar, Clock } from '../../unison/ui/icons';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

export interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (formData: any) => void;
  preselectedProjectName?: string;
  isSubmitted?: boolean;
  onReset?: () => void;
}

export const ConsultationModal: React.FC<ConsultationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  preselectedProjectName = '',
  isSubmitted,
  onReset,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    focus: preselectedProjectName || 'UI/UX Architecture',
  });
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');

  useEffect(() => {
    if (preselectedProjectName) {
      setFormData((prev) => ({ ...prev, focus: preselectedProjectName }));
    }
  }, [preselectedProjectName]);
  
  useEffect(() => {
    if (isOpen && !isSubmitted) {
        setFormData({
            name: '',
            email: '',
            focus: preselectedProjectName || 'UI/UX Architecture',
        });
        setSelectedDate(undefined);
        setSelectedTime('');
    }
  }, [isOpen, isSubmitted, preselectedProjectName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && selectedDate && selectedTime) {
      onSubmit({ ...formData, date: selectedDate.toLocaleDateString(), time: selectedTime });
    }
  };
  
  const handleReset = () => {
    if (onReset) onReset();
  }

  const availableTimes = ['09:00 AM', '10:00 AM', '11:00 AM', '02:00 PM', '03:00 PM', '04:00 PM'];
  const today = new Date();

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 animate-fade-in-up" />
        <Dialog.Content
          onEscapeKeyDown={onClose}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-4xl max-h-[85vh] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="relative h-full w-full animate-fade-in-up p-6 sm:p-8 overflow-y-auto" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:72:11" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors z-10"
                aria-label="Close"
               data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:74:15" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#6490c038c3cfc6bc" data-ut-source-hash="39ef65771ed4d77b">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>

              {isSubmitted ? (
                <div className="text-center py-12 flex flex-col items-center justify-center h-full" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:85:17" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                  <CheckCircle2 className="w-16 h-16 text-primary mb-6" />
                  <h2 className="text-2xl font-heading text-foreground mb-2" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:87:19" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#5a365ec2913588f6" data-ut-source-hash="39ef65771ed4d77b">Consultation Booked!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:88:19" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#0d77c964d5966720" data-ut-source-hash="39ef65771ed4d77b">
                    Thank you for scheduling a session. We've sent a confirmation and a calendar invite to your email. We look forward to speaking with you.
                  </p>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="btn-secondary py-2 px-6 text-sm"
                   data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:91:19" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#6490c038c3cfc6bc" data-ut-source-hash="39ef65771ed4d77b">
                    Book Another
                  </button>
                </div>
              ) : (
                <div data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:100:17" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                  <Dialog.Title className="text-2xl sm:text-3xl font-heading uppercase tracking-tight text-foreground mb-1">
                    Schedule Strategic Consultation
                  </Dialog.Title>
                  <Dialog.Description className="text-muted-foreground mb-8">
                    Select a date and time, then provide your details to book a 30-minute session.
                  </Dialog.Description>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:108:19" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                    {/* Left Column: Calendar & Time */}
                    <div className="space-y-6" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:110:21" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                      <div data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:111:23" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                        <h3 className="text-sm font-[number:var(--ut-weight-display)] uppercase tracking-wider text-primary mb-3 flex items-center gap-2" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:112:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#4a2cfba55db85a01" data-ut-source-hash="39ef65771ed4d77b">
                          <Calendar className="w-4 h-4" />
                          <span data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:114:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c0400984453dbb70" data-ut-source-hash="39ef65771ed4d77b">1. Select a Date</span>
                        </h3>
                        <div className="bg-background/50 border border-border rounded-md p-1" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:116:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                           <style data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:117:28" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#6707e9f9a4d44205" data-ut-source-hash="39ef65771ed4d77b">{`
                              .rdp { --rdp-cell-size: 40px; --rdp-accent-color: hsl(var(--primary)); --rdp-background-color: hsl(var(--muted)); color: hsl(var(--foreground)); }
                              .rdp-day_selected, .rdp-day_selected:hover { background-color: hsl(var(--primary)) !important; color: hsl(var(--primary-foreground)) !important; }
                              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: hsl(var(--muted)); }
                              .rdp-nav_button { color: hsl(var(--foreground)) !important; }
                              .rdp-head_cell { color: hsl(var(--muted-foreground)); }
                              .rdp-caption_label { color: hsl(var(--foreground)); }
                              .rdp-day_today { font-weight: bold; color: hsl(var(--primary)) !important; }
                           `}</style>
                          <DayPicker
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={{ before: today }}
                            fromMonth={today}
                            className="text-sm"
                          />
                        </div>
                      </div>
                      {selectedDate && (
                        <div className="animate-fade-in-up" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:137:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                          <h3 className="text-sm font-[number:var(--ut-weight-display)] uppercase tracking-wider text-primary mb-3 flex items-center gap-2" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:138:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#4a2cfba55db85a01" data-ut-source-hash="39ef65771ed4d77b">
                            <Clock className="w-4 h-4" />
                            <span data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:140:29" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c0400984453dbb70" data-ut-source-hash="39ef65771ed4d77b">2. Select a Time</span>
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:142:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                            {availableTimes.map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setSelectedTime(time)}
                                className={`px-3 py-2 text-xs rounded-md border text-center transition-colors ${
                                  selectedTime === time
                                    ? 'bg-primary border-primary text-primary-foreground font-bold'
                                    : 'bg-muted border-border text-muted-foreground hover:bg-border hover:text-foreground'
                                }`}
                               data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:144:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#6490c038c3cfc6bc" data-ut-source-hash="39ef65771ed4d77b">
                                {time}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Form */}
                    <div className={`transition-opacity duration-500 ${selectedDate && selectedTime ? 'opacity-100' : 'opacity-40 pointer-events-none'}`} data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:163:21" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                       <h3 className="text-sm font-[number:var(--ut-weight-display)] uppercase tracking-wider text-primary mb-3 flex items-center gap-2" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:164:24" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#4a2cfba55db85a01" data-ut-source-hash="39ef65771ed4d77b">
                          <Sparkles className="w-4 h-4" />
                          <span data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:166:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c0400984453dbb70" data-ut-source-hash="39ef65771ed4d77b">3. Your Details</span>
                        </h3>
                      <form onSubmit={handleSubmit} className="space-y-4" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:168:23" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#0b51997255acd6ee" data-ut-source-hash="39ef65771ed4d77b">
                        <div data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:169:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                          <label htmlFor="name" className="block text-xs font-medium text-muted-foreground mb-1" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:170:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#2471b542518e8d86" data-ut-source-hash="39ef65771ed4d77b">Your Name *</label>
                          <input type="text" id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="ut-shadcn-input"  data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:171:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#44a18dd54c2e7bc9" data-ut-source-hash="39ef65771ed4d77b"/>
                        </div>
                        <div data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:173:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                          <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:174:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#2471b542518e8d86" data-ut-source-hash="39ef65771ed4d77b">Work Email *</label>
                          <input type="email" id="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="ut-shadcn-input"  data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:175:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c99eca6ca6c34bf0" data-ut-source-hash="39ef65771ed4d77b"/>
                        </div>
                        <div data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:177:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#7c781427412a3ae3" data-ut-source-hash="39ef65771ed4d77b">
                          <label htmlFor="focus" className="block text-xs font-medium text-muted-foreground mb-1" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:178:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#2471b542518e8d86" data-ut-source-hash="39ef65771ed4d77b">Project Focus</label>
                          <select id="focus" value={formData.focus} onChange={(e) => setFormData({ ...formData, focus: e.target.value })} className="ut-shadcn-input appearance-none" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:179:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#f781f65837725524" data-ut-source-hash="39ef65771ed4d77b">
                              <option data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:180:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c293e00d8d42cb29" data-ut-source-hash="39ef65771ed4d77b">UI/UX Architecture</option>
                              <option data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:181:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c293e00d8d42cb29" data-ut-source-hash="39ef65771ed4d77b">Design System</option>
                              <option data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:182:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c293e00d8d42cb29" data-ut-source-hash="39ef65771ed4d77b">Mobile App Redesign</option>
                              <option data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:183:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c293e00d8d42cb29" data-ut-source-hash="39ef65771ed4d77b">SaaS Platform Design</option>
                              <option data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:184:31" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c293e00d8d42cb29" data-ut-source-hash="39ef65771ed4d77b">General Consultation</option>
                          </select>
                        </div>
                        <button type="submit" data-ut-intent="contact.submit" className="w-full btn-primary py-3 justify-center text-sm font-bold uppercase tracking-wider mt-4" disabled={!selectedDate || !selectedTime || !formData.name || !formData.email} data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:187:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#6490c038c3cfc6bc" data-ut-source-hash="39ef65771ed4d77b">
                          <Send className="w-4 h-4" />
                          <span data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:189:27" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#c0400984453dbb70" data-ut-source-hash="39ef65771ed4d77b">Book 30-Min Session</span>
                        </button>
                        <p className="text-xs text-muted-foreground text-center" data-ut-source-locator="/src/project-components/home/ConsultationModal.tsx:191:25" data-ut-source-ast="/src/project-components/home/ConsultationModal.tsx#0d77c964d5966720" data-ut-source-hash="39ef65771ed4d77b">Your information is confidential and will not be shared.</p>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default ConsultationModal;

// [sandpack] missing toggle state for: isOpen
