import React, { useState, useEffect } from 'react';
import {
  Mail,
  Search,
  Filter,
  Plus,
  Edit3,
  Eye,
  History,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Sparkles,
  FileCode,
  FileText,
  Sliders,
  Check,
  ChevronRight,
  ArrowLeft,
  Smartphone,
  Monitor,
  Moon,
  Copy,
  RotateCcw,
  Tag,
  Zap,
  Globe,
  X
} from 'lucide-react';
import { DEFAULT_EMAIL_VARIABLES, MOCK_TEST_VARIABLES } from '../../types/emailTemplates';

export interface EmailTemplateItem {
  template_id: string;
  event_id: string;
  name: string;
  subject: string;
  html: string;
  plain_text: string;
  version: number;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  updated_by?: string;
  published: boolean;
  published_at?: string;
  variables: string[];
}

export interface EmailTemplateVersionItem {
  id?: string;
  template_id: string;
  version: number;
  subject: string;
  html: string;
  plain_text: string;
  created_at: string;
  created_by?: string;
}

interface AdminEmailTemplatesTabProps {
  adminToken?: string;
}

export const AdminEmailTemplatesTab: React.FC<AdminEmailTemplatesTabProps> = ({ adminToken }) => {
  const [templates, setTemplates] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'version' | 'updated'>('name');

  // Active Editor State
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplateItem | null>(null);

  // Modals state
  const [historyTemplateId, setHistoryTemplateId] = useState<string | null>(null);
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['x-admin-token'] = adminToken;
    }
    const storedToken = localStorage.getItem('kora_admin_token') || sessionStorage.getItem('kora_admin_token');
    if (!headers['Authorization'] && storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    return headers;
  };

  const fetchTemplates = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.templates)) {
        setTemplates(data.templates);
      } else {
        setErrorMsg(data.error || 'Failed to load email templates.');
      }
    } catch (err: any) {
      console.error('Error fetching email templates:', err);
      setErrorMsg('Network error loading email templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // Filtered & Sorted list
  const filteredTemplates = templates.filter((tpl) => {
    const matchesSearch =
      tpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.template_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'published'
        ? tpl.published
        : statusFilter === 'draft'
        ? tpl.status === 'draft'
        : true;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'version') return b.version - a.version;
    if (sortBy === 'updated') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-[#E5D2BC]/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#B08D57]" />
            <h2 className="text-lg font-serif font-bold text-[#2A211C]">Email Template Engine</h2>
            <span className="bg-[#B08D57]/10 text-[#B08D57] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {templates.length} Templates
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Enterprise HTML &amp; plain text template editor, variable injection, version snapshots, and live rendering.
          </p>
        </div>

        <button
          onClick={fetchTemplates}
          disabled={loading}
          className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TOAST ALERTS */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* IF EDITING A TEMPLATE -> FULL SCREEN EDITOR VIEW */}
      {editingTemplate ? (
        <EmailTemplateEditorView
          template={editingTemplate}
          adminToken={adminToken}
          onBack={() => setEditingTemplate(null)}
          onSaved={(updated) => {
            setEditingTemplate(updated);
            setTemplates((prev) => prev.map((t) => (t.template_id === updated.template_id ? updated : t)));
            triggerSuccess(`Saved draft for ${updated.name}.`);
          }}
          onPublished={(publishedTpl) => {
            setEditingTemplate(publishedTpl);
            setTemplates((prev) => prev.map((t) => (t.template_id === publishedTpl.template_id ? publishedTpl : t)));
            triggerSuccess(`Published Version ${publishedTpl.version} of ${publishedTpl.name}!`);
          }}
          onOpenTestModal={() => setTestTemplateId(editingTemplate.template_id)}
          onOpenHistoryModal={() => setHistoryTemplateId(editingTemplate.template_id)}
        />
      ) : (
        /* TEMPLATES LIST TABLE VIEW */
        <div className="bg-white rounded-2xl border border-[#E5D2BC]/20 shadow-xs overflow-hidden space-y-4 p-5">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search templates by event ID, name or subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#B08D57] focus:bg-white text-[#2A211C]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-600">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-semibold text-stone-500">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-[#2A211C] focus:outline-none cursor-pointer"
                >
                  <option value="all">All Templates</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft Pending</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-stone-600">
                <Sliders className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-semibold text-stone-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="bg-transparent border-none text-xs font-bold text-[#2A211C] focus:outline-none cursor-pointer"
                >
                  <option value="name">Name (A-Z)</option>
                  <option value="version">Version (High-Low)</option>
                  <option value="updated">Recently Updated</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLE OF TEMPLATES */}
          {loading ? (
            <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#B08D57]" />
              <span>Loading email template repository...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-500 bg-stone-50 rounded-xl border border-dashed border-stone-200 p-6">
              <Mail className="w-8 h-8 text-stone-300 mx-auto mb-2" />
              <p className="font-bold text-stone-700">No email templates match criteria</p>
              <p className="text-stone-400 mt-1">Try clearing your search query or status filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 uppercase font-bold text-[10px] tracking-wider border-b border-stone-200">
                    <th className="py-3 px-4">Event ID / Name</th>
                    <th className="py-3 px-4">Subject Line</th>
                    <th className="py-3 px-4 text-center">Version</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Last Updated</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {filteredTemplates.map((tpl) => (
                    <tr key={tpl.template_id} className="hover:bg-stone-50/80 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[#2A211C] text-sm group-hover:text-[#B08D57] transition-colors">
                          {tpl.name}
                        </div>
                        <div className="font-mono text-[11px] text-stone-400 font-normal">
                          {tpl.template_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-stone-700 max-w-xs truncate">
                        {tpl.subject}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full font-bold text-[11px] font-mono">
                          v{tpl.version}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {tpl.published ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <Check className="w-3 h-3" /> Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                            <Clock className="w-3 h-3" /> Draft
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                        <div>{new Date(tpl.updated_at).toLocaleDateString()}</div>
                        <div className="text-[10px] text-stone-400">By {tpl.updated_by || 'Admin'}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingTemplate(tpl)}
                            className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#8C4328] text-white rounded-lg font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="Edit HTML & Plain Text Template"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          <button
                            onClick={() => setTestTemplateId(tpl.template_id)}
                            className="p-1.5 text-stone-500 hover:text-[#B08D57] hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Send Test Email"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setHistoryTemplateId(tpl.template_id)}
                            className="p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                            title="Version History & Restore"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VERSION HISTORY MODAL */}
      {historyTemplateId && (
        <VersionHistoryModal
          templateId={historyTemplateId}
          adminToken={adminToken}
          onClose={() => setHistoryTemplateId(null)}
          onRestored={(restoredTpl) => {
            setTemplates((prev) => prev.map((t) => (t.template_id === restoredTpl.template_id ? restoredTpl : t)));
            if (editingTemplate && editingTemplate.template_id === restoredTpl.template_id) {
              setEditingTemplate(restoredTpl);
            }
            triggerSuccess(`Restored template to Version ${restoredTpl.version}!`);
            setHistoryTemplateId(null);
          }}
        />
      )}

      {/* TEST EMAIL MODAL */}
      {testTemplateId && (
        <SendTestEmailModal
          templateId={testTemplateId}
          adminToken={adminToken}
          onClose={() => setTestTemplateId(null)}
          onSuccess={(msg) => {
            triggerSuccess(msg);
            setTestTemplateId(null);
          }}
        />
      )}
    </div>
  );
};

// =========================================================================
// EMAIL TEMPLATE EDITOR VIEW (FULL SUITE WITH DUAL VIEW & LIVE PREVIEW)
// =========================================================================

interface EmailTemplateEditorViewProps {
  template: EmailTemplateItem;
  adminToken?: string;
  onBack: () => void;
  onSaved: (tpl: EmailTemplateItem) => void;
  onPublished: (tpl: EmailTemplateItem) => void;
  onOpenTestModal: () => void;
  onOpenHistoryModal: () => void;
}

const EmailTemplateEditorView: React.FC<EmailTemplateEditorViewProps> = ({
  template,
  adminToken,
  onBack,
  onSaved,
  onPublished,
  onOpenTestModal,
  onOpenHistoryModal
}) => {
  const [subject, setSubject] = useState<string>(template.subject || '');
  const [html, setHtml] = useState<string>(template.html || '');
  const [plainText, setPlainText] = useState<string>(template.plain_text || '');
  
  const [activeBodyTab, setActiveBodyTab] = useState<'html' | 'plain'>('html');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile' | 'dark' | 'plain'>('desktop');

  const [savingDraft, setSavingDraft] = useState<boolean>(false);
  const [publishing, setPublishing] = useState<boolean>(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{ message: string; latestVersion: number } | null>(null);

  // Focus tracking for cursor variable injection
  const [lastFocusedField, setLastFocusedField] = useState<'subject' | 'html' | 'plain'>('html');

  // Variable Search
  const [varSearch, setVarSearch] = useState<string>('');

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['x-admin-token'] = adminToken;
    }
    const storedToken = localStorage.getItem('kora_admin_token') || sessionStorage.getItem('kora_admin_token');
    if (!headers['Authorization'] && storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    return headers;
  };

  // Insert Variable at cursor position
  const handleInsertVariable = (varName: string) => {
    const tag = `{{${varName}}}`;

    if (lastFocusedField === 'subject') {
      const subjectElem = document.getElementById('template-subject-input') as HTMLInputElement;
      if (subjectElem) {
        const start = subjectElem.selectionStart || subject.length;
        const end = subjectElem.selectionEnd || subject.length;
        const newSub = subject.substring(0, start) + tag + subject.substring(end);
        setSubject(newSub);
      } else {
        setSubject((prev) => prev + tag);
      }
    } else if (lastFocusedField === 'plain') {
      const plainElem = document.getElementById('template-plain-textarea') as HTMLTextAreaElement;
      if (plainElem) {
        const start = plainElem.selectionStart || plainText.length;
        const end = plainElem.selectionEnd || plainText.length;
        const newPlain = plainText.substring(0, start) + tag + plainText.substring(end);
        setPlainText(newPlain);
      } else {
        setPlainText((prev) => prev + tag);
      }
    } else {
      // html
      const htmlElem = document.getElementById('template-html-textarea') as HTMLTextAreaElement;
      if (htmlElem) {
        const start = htmlElem.selectionStart || html.length;
        const end = htmlElem.selectionEnd || html.length;
        const newHtml = html.substring(0, start) + tag + html.substring(end);
        setHtml(newHtml);
      } else {
        setHtml((prev) => prev + tag);
      }
    }

    setCopyNotice(`Inserted {{${varName}}}`);
    setTimeout(() => setCopyNotice(null), 2000);
  };

  // Save Draft
  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          template_id: template.template_id,
          subject,
          html,
          plain_text: plainText
        })
      });
      const data = await res.json();
      if (data.success && data.template) {
        onSaved(data.template);
      } else {
        alert(data.error || 'Failed to save draft.');
      }
    } catch (err) {
      alert('Network error saving draft.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Reload latest version from server on conflict
  const handleReloadLatest = async () => {
    try {
      const res = await fetch(`/api/admin/email-templates/${template.template_id}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.template) {
        setSubject(data.template.subject || '');
        setHtml(data.template.html || '');
        setPlainText(data.template.plain_text || '');
        setConflictState(null);
        onSaved(data.template);
      } else {
        alert('Failed to reload latest template version.');
      }
    } catch (err) {
      alert('Error reloading latest template version.');
    }
  };

  // Publish Template (with expected_version for optimistic lock)
  const handlePublish = async () => {
    if (!confirm(`Are you sure you want to publish this template as Version ${(template.version || 1) + 1}?`)) return;

    setPublishing(true);
    try {
      const res = await fetch('/api/admin/email-templates/publish', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          template_id: template.template_id,
          subject,
          html,
          plain_text: plainText,
          expected_version: template.version // pass expected base version for optimistic locking
        })
      });
      const data = await res.json();
      if (res.status === 409 || data.code === 'VERSION_CONFLICT') {
        setConflictState({
          message: data.error || 'Template was updated by another administrator. Reload before publishing.',
          latestVersion: data.currentVersion || ((template.version || 1) + 1)
        });
        return;
      }
      if (data.success && data.template) {
        setConflictState(null);
        onPublished(data.template);
      } else {
        alert(data.error || 'Failed to publish template.');
      }
    } catch (err) {
      alert('Network error publishing template.');
    } finally {
      setPublishing(false);
    }
  };

  // Defense-in-depth sanitization for client iframe preview
  const sanitizePreviewHtml = (raw: string) => {
    if (!raw) return '';
    let clean = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
    clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
    clean = clean.replace(/<embed\b[^>]*\/?>/gi, '');
    clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
    clean = clean.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    clean = clean.replace(/href\s*=\s*["']?\s*javascript:[^"'>]*["']?/gi, 'href="#"');
    return clean;
  };

  // Render mock HTML preview
  const getRenderedPreviewHtml = () => {
    let rendered = html;
    for (const [k, v] of Object.entries(MOCK_TEST_VARIABLES)) {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      rendered = rendered.replace(regex, v);
    }
    return sanitizePreviewHtml(rendered);
  };

  const getRenderedPreviewPlain = () => {
    let rendered = plainText;
    for (const [k, v] of Object.entries(MOCK_TEST_VARIABLES)) {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      rendered = rendered.replace(regex, v);
    }
    return rendered;
  };

  const filteredVars = DEFAULT_EMAIL_VARIABLES.filter(
    (v) => v.name.toLowerCase().includes(varSearch.toLowerCase()) || v.label.toLowerCase().includes(varSearch.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* EDITOR BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#E5D2BC]/20 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-stone-100 rounded-xl text-stone-600 transition-colors cursor-pointer"
            title="Back to Template List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-serif font-bold text-[#2A211C]">{template.name}</h2>
              <span className="font-mono text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md">
                {template.template_id}
              </span>
              <span className="font-mono font-bold text-[10px] bg-[#B08D57]/10 text-[#B08D57] px-2 py-0.5 rounded-full">
                v{template.version}
              </span>
            </div>
            <p className="text-xs text-stone-500">Editing transactional email template &amp; variables.</p>
          </div>
        </div>

        {/* EDITOR ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenHistoryModal}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-stone-500" />
            <span>History</span>
          </button>

          <button
            onClick={onOpenTestModal}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Test Email</span>
          </button>

          <button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            className="px-3.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {savingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
            <span>Save Draft</span>
          </button>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-1.5 bg-[#B08D57] hover:bg-[#8C4328] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
          >
            {publishing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            <span>Publish Version</span>
          </button>
        </div>
      </div>

      {copyNotice && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>{copyNotice}</span>
        </div>
      )}

      {conflictState && (
        <div className="p-4 bg-amber-50 border-2 border-amber-400 text-amber-900 rounded-2xl text-xs space-y-3 shadow-md animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-amber-950 text-sm">Publish Conflict Detected</p>
              <p className="text-amber-900 font-medium">{conflictState.message}</p>
              <p className="text-[11px] text-amber-800">
                Another administrator published Version {conflictState.latestVersion} while you were editing. Your current draft changes have NOT been overwritten or discarded.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleReloadLatest}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs cursor-pointer transition-colors shadow-2xs"
            >
              Reload Latest (v{conflictState.latestVersion})
            </button>
            <button
              onClick={() => setConflictState(null)}
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
            >
              Keep Editing My Draft
            </button>
          </div>
        </div>
      )}

      {/* WORKSPACE GRID: LEFT (SUBJECT + EDITOR + VARIABLES), RIGHT (LIVE PREVIEW) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: EDITOR (SPAN 7) */}
        <div className="lg:col-span-7 space-y-4">
          {/* SUBJECT LINE INPUT */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5D2BC]/20 shadow-xs space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center justify-between">
              <span>Subject Line</span>
              <span className="text-[10px] text-stone-400 font-normal">Supports variable replacement</span>
            </label>
            <input
              id="template-subject-input"
              type="text"
              value={subject}
              onFocus={() => setLastFocusedField('subject')}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject line..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-[#2A211C] focus:outline-none focus:border-[#B08D57] focus:bg-white"
            />
          </div>

          {/* HTML / PLAIN TEXT TOGGLE TABS */}
          <div className="bg-white rounded-2xl border border-[#E5D2BC]/20 shadow-xs overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 bg-stone-50">
              <div className="flex">
                <button
                  onClick={() => {
                    setActiveBodyTab('html');
                    setLastFocusedField('html');
                  }}
                  className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeBodyTab === 'html'
                      ? 'border-[#B08D57] text-[#B08D57] bg-white'
                      : 'border-transparent text-stone-500 hover:text-[#2A211C]'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>HTML Code</span>
                </button>

                <button
                  onClick={() => {
                    setActiveBodyTab('plain');
                    setLastFocusedField('plain');
                  }}
                  className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeBodyTab === 'plain'
                      ? 'border-[#B08D57] text-[#B08D57] bg-white'
                      : 'border-transparent text-stone-500 hover:text-[#2A211C]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Plain Text</span>
                </button>
              </div>

              <div className="text-[10px] text-stone-400 font-mono">
                {activeBodyTab === 'html' ? `${html.length} chars` : `${plainText.length} chars`}
              </div>
            </div>

            {/* TEXTAREA EDITOR */}
            <div className="p-4">
              {activeBodyTab === 'html' ? (
                <textarea
                  id="template-html-textarea"
                  value={html}
                  onFocus={() => setLastFocusedField('html')}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={20}
                  className="w-full p-3.5 bg-stone-900 text-stone-100 font-mono text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-[#B08D57] leading-relaxed resize-y"
                  placeholder="<html><body>Enter HTML template source code...</body></html>"
                />
              ) : (
                <textarea
                  id="template-plain-textarea"
                  value={plainText}
                  onFocus={() => setLastFocusedField('plain')}
                  onChange={(e) => setPlainText(e.target.value)}
                  rows={20}
                  className="w-full p-3.5 bg-stone-50 text-stone-800 font-mono text-xs rounded-xl border border-stone-200 focus:outline-none focus:border-[#B08D57] leading-relaxed resize-y"
                  placeholder="Enter fallback plain text body..."
                />
              )}
            </div>
          </div>

          {/* VARIABLES INJECTION PANEL */}
          <div className="bg-white p-4 rounded-2xl border border-[#E5D2BC]/20 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-700">
                <Tag className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Available Variables</span>
              </div>
              <input
                type="text"
                placeholder="Search variables..."
                value={varSearch}
                onChange={(e) => setVarSearch(e.target.value)}
                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-[11px] text-[#2A211C] focus:outline-none focus:border-[#B08D57]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
              {filteredVars.map((v) => (
                <button
                  key={v.name}
                  onClick={() => handleInsertVariable(v.name)}
                  className="p-1.5 bg-stone-50 hover:bg-[#B08D57]/10 hover:border-[#B08D57]/30 border border-stone-200 rounded-lg text-left transition-colors cursor-pointer group flex flex-col justify-between"
                  title={`Click to insert {{${v.name}}} into ${lastFocusedField}`}
                >
                  <span className="font-mono text-[10px] font-bold text-[#2A211C] group-hover:text-[#B08D57]">
                    {`{{${v.name}}}`}
                  </span>
                  <span className="text-[9px] text-stone-400 truncate">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE PREVIEW (SPAN 5) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-[#E5D2BC]/20 shadow-xs space-y-3 sticky top-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-700">
                <Eye className="w-4 h-4 text-[#B08D57]" />
                <span>Live Preview</span>
              </div>

              {/* DEVICE MODE TOGGLE BUTTONS */}
              <div className="flex bg-stone-100 p-0.5 rounded-lg text-stone-600">
                <button
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-white text-[#B08D57] shadow-2xs' : 'hover:text-stone-900'
                  }`}
                  title="Desktop View"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-white text-[#B08D57] shadow-2xs' : 'hover:text-stone-900'
                  }`}
                  title="Mobile View (375px)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setPreviewDevice('dark')}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    previewDevice === 'dark' ? 'bg-stone-900 text-amber-300 shadow-2xs' : 'hover:text-stone-900'
                  }`}
                  title="Dark Mode Preview"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setPreviewDevice('plain')}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    previewDevice === 'plain' ? 'bg-white text-[#B08D57] shadow-2xs' : 'hover:text-stone-900'
                  }`}
                  title="Plain Text View"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div className="space-y-2">
              <div className="text-[11px] font-medium text-stone-500 bg-stone-50 p-2 rounded-lg border border-stone-200">
                <span className="font-bold text-stone-700">Subject: </span>
                <span>
                  {renderTemplateString(subject, MOCK_TEST_VARIABLES) || <em className="text-stone-400">No subject defined</em>}
                </span>
              </div>

              {previewDevice === 'plain' ? (
                <div className="p-4 bg-stone-900 text-emerald-400 font-mono text-xs rounded-xl min-h-[480px] max-h-[560px] overflow-y-auto whitespace-pre-wrap leading-relaxed border border-stone-800">
                  {getRenderedPreviewPlain() || 'No plain text content.'}
                </div>
              ) : (
                <div
                  className={`rounded-xl border transition-all overflow-hidden flex justify-center ${
                    previewDevice === 'dark'
                      ? 'bg-stone-950 border-stone-800 p-4'
                      : 'bg-stone-100/80 border-stone-200 p-2'
                  }`}
                >
                  <div
                    className={`w-full transition-all duration-300 ${
                      previewDevice === 'mobile' ? 'max-w-[375px]' : 'w-full'
                    }`}
                  >
                    <iframe
                      title="Email Live Preview"
                      srcDoc={getRenderedPreviewHtml()}
                      sandbox=""
                      className="w-full h-[500px] rounded-lg border border-stone-200 bg-white shadow-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// VERSION HISTORY MODAL
// =========================================================================

interface VersionHistoryModalProps {
  templateId: string;
  adminToken?: string;
  onClose: () => void;
  onRestored: (tpl: EmailTemplateItem) => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({
  templateId,
  adminToken,
  onClose,
  onRestored
}) => {
  const [versions, setVersions] = useState<EmailTemplateVersionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedVersion, setSelectedVersion] = useState<EmailTemplateVersionItem | null>(null);
  const [restoring, setRestoring] = useState<boolean>(false);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['x-admin-token'] = adminToken;
    }
    const storedToken = localStorage.getItem('kora_admin_token') || sessionStorage.getItem('kora_admin_token');
    if (!headers['Authorization'] && storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    return headers;
  };

  useEffect(() => {
    const fetchVersions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/email-templates/versions/${templateId}`, {
          headers: getAuthHeaders()
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.versions)) {
          setVersions(data.versions);
          if (data.versions.length > 0) setSelectedVersion(data.versions[0]);
        }
      } catch (err) {
        console.error('Error loading versions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [templateId]);

  const handleRestore = async (vNum: number) => {
    if (!confirm(`Are you sure you want to restore Version ${vNum}? This will publish it as the latest version.`)) return;

    setRestoring(true);
    try {
      const res = await fetch('/api/admin/email-templates/restore', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          template_id: templateId,
          version: vNum
        })
      });
      const data = await res.json();
      if (data.success && data.template) {
        onRestored(data.template);
      } else {
        alert(data.error || 'Failed to restore version.');
      }
    } catch (err) {
      alert('Network error restoring template version.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E5D2BC]/30 overflow-hidden animate-fade-in">
        {/* MODAL HEADER */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#B08D57]" />
            <h3 className="font-serif font-bold text-base text-[#2A211C]">
              Version History — <span className="font-mono text-xs">{templateId}</span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-500 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-5 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* VERSION TIMELINE LIST (SPAN 4) */}
          <div className="md:col-span-4 border-r border-stone-200 pr-4 space-y-2 max-h-[500px] overflow-y-auto">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
              Snapshots ({versions.length})
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#B08D57]" />
                <span>Loading version timeline...</span>
              </div>
            ) : versions.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-400">No previous versions found.</div>
            ) : (
              versions.map((v) => (
                <div
                  key={v.version}
                  onClick={() => setSelectedVersion(v)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedVersion?.version === v.version
                      ? 'border-[#B08D57] bg-[#B08D57]/5 shadow-2xs'
                      : 'border-stone-200 hover:border-stone-300 bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#2A211C]">Version {v.version}</span>
                    <span className="text-[10px] text-stone-400">{new Date(v.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[11px] text-stone-600 truncate mt-1">{v.subject}</div>
                  <div className="text-[10px] text-stone-400 mt-1">By {v.created_by || 'Admin'}</div>
                </div>
              ))
            )}
          </div>

          {/* SELECTED VERSION DETAIL & PREVIEW (SPAN 8) */}
          <div className="md:col-span-8 space-y-3">
            {selectedVersion ? (
              <>
                <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <div>
                    <div className="font-mono font-bold text-xs text-[#2A211C]">
                      Previewing Version {selectedVersion.version}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Created {new Date(selectedVersion.created_at).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestore(selectedVersion.version)}
                    disabled={restoring}
                    className="px-3 py-1.5 bg-[#B08D57] hover:bg-[#8C4328] text-white rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore Version</span>
                  </button>
                </div>

                <div className="text-xs font-semibold text-stone-700">
                  Subject: <span className="font-normal text-stone-900">{selectedVersion.subject}</span>
                </div>

                <div className="border border-stone-200 rounded-xl overflow-hidden h-[380px]">
                  <iframe
                    title="Version Preview"
                    srcDoc={renderTemplateString(selectedVersion.html, MOCK_TEST_VARIABLES)}
                    className="w-full h-full bg-white"
                  />
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-xs text-stone-400">Select a version from the timeline to preview.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// SEND TEST EMAIL MODAL
// =========================================================================

interface SendTestEmailModalProps {
  templateId: string;
  adminToken?: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const SendTestEmailModal: React.FC<SendTestEmailModalProps> = ({
  templateId,
  adminToken,
  onClose,
  onSuccess
}) => {
  const [recipient, setRecipient] = useState<string>('test@sa-and-sha.com');
  const [sending, setSending] = useState<boolean>(false);
  const [customVars, setCustomVars] = useState<Record<string, string>>(MOCK_TEST_VARIABLES);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
      headers['x-admin-token'] = adminToken;
    }
    const storedToken = localStorage.getItem('kora_admin_token') || sessionStorage.getItem('kora_admin_token');
    if (!headers['Authorization'] && storedToken) {
      headers['Authorization'] = `Bearer ${storedToken}`;
    }
    return headers;
  };

  const handleSend = async () => {
    if (!recipient || !recipient.includes('@')) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/admin/email-templates/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          template_id: templateId,
          recipient_email: recipient,
          variables: customVars
        })
      });
      const data = await res.json();
      if (data.success) {
        onSuccess(data.message || `Test email dispatched to ${recipient}.`);
      } else {
        alert(data.error || 'Failed to send test email.');
      }
    } catch (err) {
      alert('Network error sending test email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-[#E5D2BC]/30 space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-[#B08D57]" />
            <h3 className="font-serif font-bold text-base text-[#2A211C]">Send Test Email</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded-lg text-stone-400 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Recipient Email Address
            </label>
            <input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. admin@sa-and-sha.com"
              className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl font-medium text-[#2A211C] focus:outline-none focus:border-[#B08D57]"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Sample Variables
            </label>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 max-h-48 overflow-y-auto space-y-2">
              {Object.entries(customVars).slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-stone-500 w-32 truncate">{`{{${key}}}`}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => setCustomVars({ ...customVars, [key]: e.target.value })}
                    className="flex-1 px-2 py-1 bg-white border border-stone-200 rounded-md text-[11px] text-[#2A211C]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSend}
            disabled={sending}
            className="px-5 py-2 bg-[#B08D57] hover:bg-[#8C4328] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Dispatch Test Email</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper for template rendering in preview
function renderTemplateString(str: string, variables: Record<string, string>): string {
  if (!str) return '';
  let rendered = str;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    rendered = rendered.replace(regex, value ?? '');
  }
  return rendered;
}
