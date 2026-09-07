import React from "react";
import { HelpCircle, Send, CheckCircle2, X } from "lucide-react";

interface OrderHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
}

export const OrderHelpModal: React.FC<OrderHelpModalProps> = ({
  isOpen,
  onClose,
  orderNumber
}) => {
  const [subject, setSubject] = React.useState(`Inquiry regarding Order #${orderNumber}`);
  const [message, setMessage] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl p-6 relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-sky-50 text-sky-800 border border-sky-200">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-serif font-bold text-stone-900">Need Order Assistance?</h3>
            <p className="text-xs text-stone-500">Contact Sa and Sha Concierge Support</p>
          </div>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-stone-900">Support Ticket Logged</h4>
            <p className="text-xs text-stone-600 max-w-xs mx-auto">
              Your inquiry regarding Order #{orderNumber} has been dispatched to our support concierge. Expect a reply within 2-4 hours.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 text-xs font-bold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 focus:outline-hidden font-medium text-stone-900"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-800 mb-1.5">How can we help?</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your query or issue regarding shipment, sizing, customization, or invoices..."
                rows={4}
                required
                className="w-full text-xs bg-stone-50 border border-stone-200 rounded-xl p-3 focus:outline-hidden focus:border-stone-400 font-medium text-stone-900 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-800 rounded-xl transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 text-xs font-bold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors inline-flex items-center gap-2 shadow-xs"
              >
                {loading ? (
                  <span>Sending...</span>
                ) : (
                  <>
                    <span>Submit Inquiry</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
