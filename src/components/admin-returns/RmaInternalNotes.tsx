import React, { useState } from "react";
import { MessageSquare, Send, ShieldCheck, Tag } from "lucide-react";

export interface RmaInternalNotesProps {
  notes: any[];
  onAddNote: (note: string, noteType: string) => Promise<boolean>;
}

export const RmaInternalNotes: React.FC<RmaInternalNotesProps> = ({ notes, onAddNote }) => {
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim() || submitting) return;

    setSubmitting(true);
    const success = await onAddNote(noteText, noteType);
    setSubmitting(false);
    if (success) {
      setNoteText("");
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-stone-200 pb-2">
        <h4 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-[#B85C38]" />
          Internal Staff Notes ({notes?.length || 0})
        </h4>
        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Internal Only - Hidden from Customer
        </span>
      </div>

      {/* Note Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className="py-1.5 px-2.5 rounded-lg border border-stone-200 bg-stone-50 font-medium text-stone-800 focus:outline-none focus:border-[#B85C38]"
          >
            <option value="general">General Note</option>
            <option value="customer_contact">Customer Contact</option>
            <option value="policy_review">Policy Review</option>
            <option value="pickup_issue">Pickup Issue</option>
            <option value="warehouse_instruction">Warehouse Instruction</option>
            <option value="fraud_review">Fraud Review</option>
            <option value="finance_note">Finance Note</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Type confidential staff note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="flex-1 px-3 py-2 text-xs rounded-lg border border-stone-200 bg-stone-50 focus:outline-none focus:border-[#B85C38]"
          />
          <button
            type="submit"
            disabled={!noteText.trim() || submitting}
            className="px-4 py-2 bg-[#1F1B16] text-white rounded-lg font-semibold hover:bg-black transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Add Note
          </button>
        </div>
      </form>

      {/* Notes List Thread */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {notes && notes.length > 0 ? (
          notes.map((n: any, idx: number) => (
            <div key={n.id || idx} className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-stone-900">{n.created_by || "Admin Staff"}</span>
                <span className="text-stone-400">{n.created_at ? new Date(n.created_at).toLocaleString("en-IN") : ""}</span>
              </div>
              <p className="text-stone-700 font-medium">{n.note}</p>
              <div className="pt-1">
                <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded uppercase bg-stone-200 text-stone-700">
                  {n.note_type?.replace("_", " ") || "general"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-stone-400 italic text-center py-2">No internal notes added yet.</p>
        )}
      </div>
    </div>
  );
};
