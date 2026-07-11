'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function SupportPage() {
  const [ticket, setTicket] = useState({ subject: '', category: 'General', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "How does the agentic scheduling pipeline resolve conflicts?",
      a: "CineSched routes your project parameters through specialized AI agents (Cast Availability, Budget limits, Locations constraints). If the constraints make scheduling mathematically impossible, the agents collaborate to propose optimal relaxations. Once relaxed parameters are agreed upon, the Google OR-Tools CP-SAT solver computes the final schedule. The LLM never invents the schedule dates directly."
    },
    {
      q: "How do I map equipment packages to specific scenes?",
      a: "Open the Constraints Editor, click on the 'Scenes' tab, and select 'Edit' on the scene of interest. Under the edit options, you will find checklists for all cast members and equipment items registered to the active project. Check the required equipment items and click 'Save'. The solver will automatically enforce equipment inventory caps on overlap days."
    },
    {
      q: "What does 'S', 'W', 'H', 'F' signify in the DOOD report?",
      a: "This refers to the standard Cast Day-Out-of-Days representation: 'S' for Start (first shoot day), 'W' for Work (shooting days), 'H' for Hold (paid non-working days where the actor must remain on standby between shooting blocks), and 'F' for Finish (last scheduled day of work)."
    },
    {
      q: "Can I run What-If scenarios using voice or natural language text?",
      a: "Yes! Navigate to the Master Schedule page, locate the 'What-If Scenario' chat block on the right panel, and type any hypothetical scenario (e.g., 'What if David Fincher is unavailable on Day 2?'). The AI will interpret the constraint relaxation, invoke the OR-Tools solver, and instantly recalculate your schedule timeline."
    }
  ];

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Simulate ticket upload
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSuccess(true);
      setTicket({ subject: '', category: 'General', message: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="py-stack-md max-w-4xl mx-auto animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="pb-4 mb-stack-md border-b border-outline-variant/30">
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">Support Center</h1>
          <p className="text-on-surface-variant font-body-md mt-1 font-sans">Browse FAQs or submit support inquiries directly to our engineering team.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* FAQ Area (2 Columns) */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="font-headline-md text-[18px] text-on-surface flex items-center gap-2 mb-2 font-bold">
              <span className="material-symbols-outlined text-primary-container">help_center</span>
              Frequently Asked Questions
            </h3>
            {faqs.map((faq, idx) => (
              <Card 
                key={idx} 
                className="overflow-hidden border border-outline-variant/30 bg-surface-container-low transition-all"
              >
                <button 
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-4 flex justify-between items-center hover:bg-surface-variant/20 transition-colors"
                >
                  <span className="font-bold text-sm text-on-surface font-sans">{faq.q}</span>
                  <span className="material-symbols-outlined text-on-surface-variant transition-transform duration-200" style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0)' }}>
                    expand_more
                  </span>
                </button>
                {openFaq === idx && (
                  <div className="p-4 bg-surface-container/30 border-t border-outline-variant/10 text-xs text-on-surface-variant leading-relaxed font-sans">
                    {faq.a}
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Contact Support Form (1 Column) */}
          <div>
            <Card className="p-6 bg-surface-container-low border border-outline-variant/30 h-full flex flex-col">
              <h3 className="font-headline-md text-[18px] text-on-surface flex items-center gap-2 mb-4 font-bold border-b border-outline-variant/20 pb-2">
                <span className="material-symbols-outlined text-primary-container">mail</span>
                Submit Ticket
              </h3>
              
              {success ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                  <span className="material-symbols-outlined text-[48px] text-green-400 mb-3">check_circle</span>
                  <h4 className="font-bold text-on-surface text-sm">Ticket Submitted!</h4>
                  <p className="text-xs text-on-surface-variant mt-2 leading-relaxed font-sans">Our support engineers have received your request and will contact you via email shortly.</p>
                  <button 
                    onClick={() => setSuccess(false)}
                    className="mt-6 text-xs text-primary-container hover:underline uppercase font-bold"
                  >
                    Submit another ticket
                  </button>
                </div>
              ) : (
                <form onSubmit={handleTicketSubmit} className="space-y-4 flex-1 flex flex-col">
                  <Input 
                    label="Subject" 
                    value={ticket.subject} 
                    onChange={e => setTicket({ ...ticket, subject: e.target.value })} 
                    placeholder="e.g. solver feasibility failed" 
                    required 
                  />
                  <div>
                    <label className="text-[12px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1.5 block">Category</label>
                    <select 
                      value={ticket.category} 
                      onChange={e => setTicket({ ...ticket, category: e.target.value })}
                      className="w-full bg-surface-container border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:border-primary-container focus:outline-none"
                    >
                      <option value="General">General / Other</option>
                      <option value="Solver">CP-SAT Solver error</option>
                      <option value="Billing">Billing & Plan Limits</option>
                      <option value="Team">Collaboration & Invites</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label className="text-[12px] font-label-md uppercase tracking-wider text-on-surface-variant mb-1.5 block">Message Details</label>
                    <textarea 
                      value={ticket.message} 
                      onChange={e => setTicket({ ...ticket, message: e.target.value })} 
                      rows={5} 
                      className="w-full bg-surface-container border border-outline-variant rounded px-3 py-2 text-sm text-on-surface focus:border-primary-container focus:outline-none flex-1 font-sans resize-none"
                      placeholder="Explain your problem..."
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={submitting} 
                    className="w-full py-2.5 bg-primary-container text-on-primary-fixed-variant font-bold font-label-md uppercase rounded shadow hover:brightness-110 active:scale-95 transition-all"
                  >
                    {submitting ? 'Submitting ticket...' : 'Submit Support Ticket'}
                  </button>
                </form>
              )}
            </Card>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
