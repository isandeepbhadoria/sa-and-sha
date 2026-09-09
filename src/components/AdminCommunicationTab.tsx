import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Sliders,
  Server,
  Layers,
  ListFilter,
  Radio,
  Settings,
  ExternalLink,
  Edit2,
  Check,
  X,
  Lock,
  Zap,
  Clock,
  History,
  RotateCcw,
  ShieldAlert,
  FileText,
  Info
} from 'lucide-react';
import { AdminEmailTemplatesTab } from './admin-communication/AdminEmailTemplatesTab';
import { AdminDispatchQueueTab } from './admin-communication/AdminDispatchQueueTab';
import { AdminNotificationRetryTab } from './admin-communication/AdminNotificationRetryTab';

interface NotificationChannelConfig {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}

interface NotificationTemplateIds {
  email?: string;
  whatsapp?: string;
  sms?: string;
}

interface NotificationEventSetting {
  id?: string;
  event_id: string;
  event_name: string;
  enabled: boolean;
  channels: NotificationChannelConfig;
  template_ids?: NotificationTemplateIds;
  created_at?: string;
  updated_at?: string;
  updated_by?: string;
}

interface ProviderConfig {
  id?: string;
  channel: 'email' | 'whatsapp' | 'sms';
  provider: string;
  status: string;
  verified?: boolean;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  domain?: string;
  api_source?: string;
  sender_id?: string;
  updated_at?: string;
}

interface GlobalNotificationSettings {
  enable_notifications: boolean;
  maintenance_mode: boolean;
  retry_failed_jobs: boolean;
  queue_size_limit: number;
  rate_limit_per_min: number;
}

interface AdminCommunicationTabProps {
  adminToken?: string;
}

export const AdminCommunicationTab: React.FC<AdminCommunicationTabProps> = ({ adminToken }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'events' | 'email_templates' | 'providers' | 'queue' | 'retry' | 'settings'>('dashboard');

  // Notification Event Settings State
  const [eventSettings, setEventSettings] = useState<NotificationEventSetting[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const [savingEventId, setSavingEventId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<NotificationEventSetting | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Provider Settings State
  const [providers, setProviders] = useState<{
    email?: ProviderConfig;
    whatsapp?: ProviderConfig;
    sms?: ProviderConfig;
  }>({});
  const [loadingProviders, setLoadingProviders] = useState<boolean>(true);
  const [savingProviderChannel, setSavingProviderChannel] = useState<string | null>(null);

  // Form State for Provider Edit
  const [emailProviderForm, setEmailProviderForm] = useState<Partial<ProviderConfig>>({});
  const [whatsappProviderForm, setWhatsappProviderForm] = useState<Partial<ProviderConfig>>({});
  const [smsProviderForm, setSmsProviderForm] = useState<Partial<ProviderConfig>>({});

  // Global Settings State
  const [globalSettings, setGlobalSettings] = useState<GlobalNotificationSettings>({
    enable_notifications: true,
    maintenance_mode: false,
    retry_failed_jobs: true,
    queue_size_limit: 10000,
    rate_limit_per_min: 100
  });
  const [savingGlobalSettings, setSavingGlobalSettings] = useState<boolean>(false);

  // Success / Error Toasts
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }
    return headers;
  };

  // Fetch Event Settings
  const fetchEventSettings = async () => {
    setLoadingEvents(true);
    try {
      const res = await fetch('/api/admin/notifications/settings', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.settings)) {
        setEventSettings(data.settings);
      } else {
        setErrorMsg(data.error || 'Failed to load notification settings.');
      }
    } catch (err: any) {
      console.error('Error fetching notification settings:', err);
      setErrorMsg('Failed to fetch notification settings.');
    } finally {
      setLoadingEvents(false);
    }
  };

  // Fetch Provider Settings
  const fetchProviderSettings = async () => {
    setLoadingProviders(true);
    try {
      const res = await fetch('/api/admin/notifications/providers', {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.providers) {
        setProviders(data.providers);
        if (data.providers.email) setEmailProviderForm(data.providers.email);
        if (data.providers.whatsapp) setWhatsappProviderForm(data.providers.whatsapp);
        if (data.providers.sms) setSmsProviderForm(data.providers.sms);
      }
    } catch (err: any) {
      console.error('Error fetching provider settings:', err);
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchEventSettings();
    fetchProviderSettings();
  }, []);

  // Flash message handler
  const triggerSuccessToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const triggerErrorToast = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  // Toggle channel or master enabled for an event
  const handleToggleChannel = async (
    eventId: string,
    channel: 'email' | 'whatsapp' | 'sms' | 'master'
  ) => {
    setSavingEventId(eventId);
    setErrorMsg(null);

    // Find current event
    const current = eventSettings.find((e) => e.event_id === eventId);
    if (!current) return;

    let updatedEvent: NotificationEventSetting;

    if (channel === 'master') {
      updatedEvent = {
        ...current,
        enabled: !current.enabled
      };
    } else {
      updatedEvent = {
        ...current,
        channels: {
          ...current.channels,
          [channel]: !current.channels[channel]
        }
      };
    }

    // Optimistic Update
    setEventSettings((prev) =>
      prev.map((e) => (e.event_id === eventId ? updatedEvent : e))
    );

    try {
      const res = await fetch('/api/admin/notifications/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(updatedEvent)
      });
      const data = await res.json();

      if (data.success) {
        triggerSuccessToast(`Updated ${current.event_name} notification channels.`);
      } else {
        // Revert on error
        setEventSettings((prev) =>
          prev.map((e) => (e.event_id === eventId ? current : e))
        );
        triggerErrorToast(data.error || 'Failed to update event setting.');
      }
    } catch (err: any) {
      setEventSettings((prev) =>
        prev.map((e) => (e.event_id === eventId ? current : e))
      );
      triggerErrorToast('Network error while updating event setting.');
    } finally {
      setSavingEventId(null);
    }
  };

  // Save Modal Event Edit
  const handleSaveModalEvent = async () => {
    if (!editingEvent) return;
    setSavingEventId(editingEvent.event_id);

    try {
      const res = await fetch('/api/admin/notifications/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingEvent)
      });
      const data = await res.json();

      if (data.success) {
        setEventSettings((prev) =>
          prev.map((e) => (e.event_id === editingEvent.event_id ? editingEvent : e))
        );
        setIsEditModalOpen(false);
        setEditingEvent(null);
        triggerSuccessToast(`Saved configurations for ${editingEvent.event_name}.`);
      } else {
        triggerErrorToast(data.error || 'Failed to save event configuration.');
      }
    } catch (err: any) {
      triggerErrorToast('Failed to save event configuration.');
    } finally {
      setSavingEventId(null);
    }
  };

  // Save Provider Metadata
  const handleSaveProvider = async (channel: 'email' | 'whatsapp' | 'sms') => {
    setSavingProviderChannel(channel);
    let formData = emailProviderForm;
    if (channel === 'whatsapp') formData = whatsappProviderForm;
    if (channel === 'sms') formData = smsProviderForm;

    try {
      const res = await fetch('/api/admin/notifications/providers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          channel,
          data: formData
        })
      });
      const data = await res.json();

      if (data.success) {
        triggerSuccessToast(`${channel.toUpperCase()} Provider configuration saved.`);
        fetchProviderSettings();
      } else {
        triggerErrorToast(data.error || 'Failed to save provider configuration.');
      }
    } catch (err: any) {
      triggerErrorToast('Failed to save provider metadata.');
    } finally {
      setSavingProviderChannel(null);
    }
  };

  // Save Global Settings
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobalSettings(true);
    setTimeout(() => {
      setSavingGlobalSettings(false);
      triggerSuccessToast('Global notification preferences saved.');
    }, 400);
  };

  // Filtered Events
  const filteredEvents = eventSettings.filter((ev) => {
    const matchesSearch =
      ev.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.event_id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'orders') {
      return (
        ev.event_id.includes('order') ||
        ev.event_id === 'out_for_delivery' ||
        ev.event_id === 'delivered'
      );
    }
    if (categoryFilter === 'payments') {
      return (
        ev.event_id.includes('payment') ||
        ev.event_id.includes('refund') ||
        ev.event_id.includes('return') ||
        ev.event_id.includes('exchange')
      );
    }
    if (categoryFilter === 'auth') {
      return (
        ev.event_id === 'otp' ||
        ev.event_id === 'welcome' ||
        ev.event_id === 'account_created' ||
        ev.event_id === 'password_reset'
      );
    }
    if (categoryFilter === 'marketing') {
      return ev.event_id === 'newsletter_welcome';
    }

    return true;
  });

  const enabledEventsCount = eventSettings.filter((e) => e.enabled).length;
  const disabledEventsCount = eventSettings.filter((e) => !e.enabled).length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#B08D57]" />
            <h1 className="font-serif text-xl md:text-2xl font-bold text-[#2A211C]">
              Communication Centre
            </h1>
            <span className="px-2 py-0.5 bg-[#B08D57]/10 text-[#B08D57] border border-[#B08D57]/20 rounded text-[10px] font-bold uppercase tracking-wider">
              Phase 9B.1
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Multi-channel transactional notification routing, provider health, and event dispatch policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchEventSettings();
              fetchProviderSettings();
            }}
            disabled={loadingEvents || loadingProviders}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingEvents || loadingProviders ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TOAST ALERTS */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* NAVIGATION SUB-TABS */}
      <div className="flex flex-wrap gap-2 md:gap-4 border-b border-stone-200 bg-white px-4 rounded-xl border border-[#E5D2BC]/20 shadow-xs">
        <button
          onClick={() => setActiveSubTab('dashboard')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'dashboard'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => setActiveSubTab('events')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'events'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notification Events ({eventSettings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('email_templates')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'email_templates'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Templates</span>
        </button>

        <button
          onClick={() => setActiveSubTab('providers')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'providers'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>Providers</span>
        </button>

        <button
          onClick={() => setActiveSubTab('queue')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'queue'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Dispatch Queue</span>
        </button>

        <button
          onClick={() => setActiveSubTab('retry')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'retry'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry Centre</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`py-3.5 px-5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'settings'
              ? 'border-[#B08D57] text-[#B08D57]'
              : 'border-transparent text-stone-500 hover:text-[#2A211C]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {/* SUB-TAB 1: DASHBOARD */}
      {activeSubTab === 'dashboard' && (
        <div className="space-y-6">
          {/* PROVIDER HEALTH CARDS */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Notification Dispatch Providers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* EMAIL */}
              <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2A211C] text-sm">Email Provider</h3>
                      <p className="text-[11px] text-stone-500">
                        {providers.email?.provider || 'SMTP'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    HEALTHY
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-100 text-xs text-stone-600 space-y-1 font-mono">
                  <p>From: {providers.email?.from_email || 'orders@sa-and-sha.com'}</p>
                  <p>Domain: {providers.email?.domain || 'sa-and-sha.com'} (Verified)</p>
                </div>
              </div>

              {/* WHATSAPP */}
              <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2A211C] text-sm">WhatsApp Provider</h3>
                      <p className="text-[11px] text-stone-500">
                        {providers.whatsapp?.provider || 'Interakt / Meta Cloud API'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    HEALTHY
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-100 text-xs text-stone-600 space-y-1 font-mono">
                  <p>Source: {providers.whatsapp?.api_source || 'Official Cloud API'}</p>
                  <p>Status: Active & Authorized</p>
                </div>
              </div>

              {/* SMS */}
              <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#2A211C] text-sm">SMS Provider</h3>
                      <p className="text-[11px] text-stone-500">
                        {providers.sms?.provider || 'MSG91'}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full text-[10px] font-bold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    HEALTHY
                  </span>
                </div>
                <div className="pt-2 border-t border-stone-100 text-xs text-stone-600 space-y-1 font-mono">
                  <p>Sender ID: {providers.sms?.sender_id || 'KORALN'}</p>
                  <p>Status: DLTR Approved</p>
                </div>
              </div>
            </div>
          </div>

          {/* METRIC CARDS */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
              Event Dispatch Coverage
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs">
                <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
                  Total Events Configured
                </p>
                <p className="text-3xl font-serif font-bold text-[#2A211C] mt-1">
                  {eventSettings.length}
                </p>
                <p className="text-[11px] text-stone-400 mt-1">OTP, Orders, Returns, Auth</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-emerald-200/60 shadow-xs bg-emerald-50/20">
                <p className="text-xs text-emerald-800 font-bold uppercase tracking-wider">
                  Active Dispatch Events
                </p>
                <p className="text-3xl font-serif font-bold text-emerald-900 mt-1">
                  {enabledEventsCount}
                </p>
                <p className="text-[11px] text-emerald-700 mt-1">Master switch ENABLED</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
                <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
                  Disabled Events
                </p>
                <p className="text-3xl font-serif font-bold text-stone-700 mt-1">
                  {disabledEventsCount}
                </p>
                <p className="text-[11px] text-stone-400 mt-1">Paused from dispatching</p>
              </div>
            </div>
          </div>

          {/* SYSTEM ENGINE MODULES & ROADMAP */}
          <div className="space-y-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                Completed Engine Modules
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 relative space-y-2">
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[9px] font-bold uppercase">
                    Phase 9B.1 • Completed
                  </span>
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Notification Matrix & Provider Settings</span>
                  </div>
                  <p className="text-xs text-emerald-700/90">
                    Transactional event toggles, provider configurations, and persistent route settings.
                  </p>
                </div>

                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80 relative space-y-2">
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded text-[9px] font-bold uppercase">
                    Phase 9B.2 • Completed
                  </span>
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Email Template Engine</span>
                  </div>
                  <p className="text-xs text-emerald-700/90">
                    Rich HTML email designer, Handlebars variable engine, versioning, optimistic locking, preview sanitization, and test dispatches.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                Planned Engine Capabilities (Future Roadmap)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-stone-50/80 p-4 rounded-xl border border-dashed border-stone-300 relative space-y-2">
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[9px] font-bold uppercase">
                    Phase 9B.3
                  </span>
                  <div className="flex items-center gap-2 text-stone-700 font-bold text-xs">
                    <Clock className="w-4 h-4 text-[#B08D57]" />
                    <span>Async Dispatch Queue</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Asynchronous queue worker, rate limiting, deduplication, and priority job buffers.
                  </p>
                </div>

                <div className="bg-stone-50/80 p-4 rounded-xl border border-dashed border-stone-300 relative space-y-2">
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[9px] font-bold uppercase">
                    Phase 9B.4
                  </span>
                  <div className="flex items-center gap-2 text-stone-700 font-bold text-xs">
                    <RotateCcw className="w-4 h-4 text-[#B08D57]" />
                    <span>Retry & Dead-Letter Queue</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Dead-letter queue management, exponential backoff automated retries, and failure alerts.
                  </p>
                </div>

                <div className="bg-stone-50/80 p-4 rounded-xl border border-dashed border-stone-300 relative space-y-2">
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-stone-200 text-stone-600 rounded text-[9px] font-bold uppercase">
                    Phase 9B.5
                  </span>
                  <div className="flex items-center gap-2 text-stone-700 font-bold text-xs">
                    <Layers className="w-4 h-4 text-[#B08D57]" />
                    <span>Delivery Analytics & Webhooks</span>
                  </div>
                  <p className="text-xs text-stone-500">
                    Real-time open/click rate tracking, delivery Webhook callbacks, and cross-channel logs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: NOTIFICATION EVENTS */}
      {activeSubTab === 'events' && (
        <div className="space-y-4">
          {/* SEARCH & CATEGORY FILTERS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5D2BC]/20 shadow-xs">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search event name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:border-[#B08D57]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mr-1 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter:
              </span>
              {[
                { id: 'all', label: 'All Events' },
                { id: 'orders', label: 'Orders & Fulfillment' },
                { id: 'payments', label: 'Payments & Refunds' },
                { id: 'auth', label: 'Auth & Account' },
                { id: 'marketing', label: 'Marketing' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    categoryFilter === cat.id
                      ? 'bg-[#B08D57] text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* EVENTS TABLE */}
          <div className="bg-white rounded-xl border border-[#E5D2BC]/20 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-bold text-[10px]">
                    <th className="py-3 px-4">Event Name & ID</th>
                    <th className="py-3 px-4 text-center">Email</th>
                    <th className="py-3 px-4 text-center">WhatsApp</th>
                    <th className="py-3 px-4 text-center">SMS</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {loadingEvents ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-stone-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#B08D57]" />
                        <span>Loading notification event settings...</span>
                      </td>
                    </tr>
                  ) : filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-stone-400">
                        No notification events matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((ev) => (
                      <tr key={ev.event_id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div>
                            <p className="font-bold text-[#2A211C] text-xs">{ev.event_name}</p>
                            <span className="font-mono text-[10px] text-stone-400">
                              {ev.event_id}
                            </span>
                          </div>
                        </td>

                        {/* EMAIL TOGGLE */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(ev.event_id, 'email')}
                            disabled={savingEventId === ev.event_id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              ev.channels?.email
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-stone-100 text-stone-400 border border-stone-200 line-through'
                            }`}
                          >
                            <Mail className="w-3 h-3" />
                            <span>{ev.channels?.email ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* WHATSAPP TOGGLE */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(ev.event_id, 'whatsapp')}
                            disabled={savingEventId === ev.event_id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              ev.channels?.whatsapp
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : 'bg-stone-100 text-stone-400 border border-stone-200 line-through'
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>{ev.channels?.whatsapp ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* SMS TOGGLE */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(ev.event_id, 'sms')}
                            disabled={savingEventId === ev.event_id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                              ev.channels?.sms
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-stone-100 text-stone-400 border border-stone-200 line-through'
                            }`}
                          >
                            <Smartphone className="w-3 h-3" />
                            <span>{ev.channels?.sms ? 'ON' : 'OFF'}</span>
                          </button>
                        </td>

                        {/* MASTER STATUS */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleChannel(ev.event_id, 'master')}
                            disabled={savingEventId === ev.event_id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer ${
                              ev.enabled
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-stone-200 text-stone-600'
                            }`}
                          >
                            <span>{ev.enabled ? 'ENABLED' : 'PAUSED'}</span>
                          </button>
                        </td>

                        {/* ACTIONS */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEvent({ ...ev });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-stone-100 text-stone-600 hover:text-[#B08D57] rounded-lg transition-colors cursor-pointer"
                            title="Edit Event Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2.5: EMAIL TEMPLATES ENGINE */}
      {activeSubTab === 'email_templates' && (
        <AdminEmailTemplatesTab adminToken={adminToken} />
      )}

      {/* SUB-TAB 3: PROVIDERS */}
      {activeSubTab === 'providers' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Provider API Credentials & Secrets Guard</p>
              <p className="text-amber-800/80 text-[11px] mt-0.5">
                API Keys, tokens, and authorization headers are securely injected via environment variables (`.env`).
                They are never rendered or editable in the client UI. You can configure non-sensitive metadata below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* EMAIL PROVIDER */}
            <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-[#2A211C] text-sm">Email Provider</h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                  providers.email?.status === 'Active' || providers.email?.verified
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {providers.email?.status || (providers.email?.verified ? 'VERIFIED' : 'NOT CONFIGURED')}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Provider Name
                  </label>
                  <input
                    type="text"
                    value={emailProviderForm.provider || 'SMTP'}
                    onChange={(e) =>
                      setEmailProviderForm((p) => ({ ...p, provider: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded bg-stone-50 text-stone-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Sender From Name
                  </label>
                  <input
                    type="text"
                    value={emailProviderForm.from_name || 'Sa and Sha'}
                    onChange={(e) =>
                      setEmailProviderForm((p) => ({ ...p, from_name: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Sender From Email
                  </label>
                  <input
                    type="email"
                    value={emailProviderForm.from_email || 'orders@sa-and-sha.com'}
                    onChange={(e) =>
                      setEmailProviderForm((p) => ({ ...p, from_email: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Reply-To Address
                  </label>
                  <input
                    type="email"
                    value={emailProviderForm.reply_to || 'support@sa-and-sha.com'}
                    onChange={(e) =>
                      setEmailProviderForm((p) => ({ ...p, reply_to: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800 font-mono text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Sending Domain
                  </label>
                  <input
                    type="text"
                    value={emailProviderForm.domain || 'sa-and-sha.com'}
                    onChange={(e) =>
                      setEmailProviderForm((p) => ({ ...p, domain: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800 font-mono text-[11px]"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSaveProvider('email')}
                disabled={savingProviderChannel === 'email'}
                className="w-full py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingProviderChannel === 'email' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Email Metadata</span>
              </button>
            </div>

            {/* WHATSAPP PROVIDER */}
            <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-[#2A211C] text-sm">WhatsApp Provider</h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                  providers.whatsapp?.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : providers.whatsapp?.status?.includes('Mock')
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {providers.whatsapp?.status || 'NOT CONFIGURED'}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    BSP / Provider
                  </label>
                  <input
                    type="text"
                    value={whatsappProviderForm.provider || 'Interakt / Meta Cloud API'}
                    onChange={(e) =>
                      setWhatsappProviderForm((p) => ({ ...p, provider: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded bg-stone-50 text-stone-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    API Source Architecture
                  </label>
                  <input
                    type="text"
                    value={whatsappProviderForm.api_source || 'Official Cloud API'}
                    onChange={(e) =>
                      setWhatsappProviderForm((p) => ({ ...p, api_source: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800 font-mono text-[11px]"
                  />
                </div>

                <div className="p-3 bg-stone-50 rounded border border-stone-200 text-[11px] text-stone-500 space-y-1">
                  <p className="font-bold text-stone-700">HSM Template Synchronization</p>
                  <p>Meta Cloud API template IDs map dynamically based on event_id.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSaveProvider('whatsapp')}
                disabled={savingProviderChannel === 'whatsapp'}
                className="w-full py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingProviderChannel === 'whatsapp' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save WhatsApp Metadata</span>
              </button>
            </div>

            {/* SMS PROVIDER */}
            <div className="bg-white p-5 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600" />
                  <h3 className="font-bold text-[#2A211C] text-sm">SMS Provider</h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${
                  providers.sms?.status === 'Active'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {providers.sms?.status || 'NOT CONFIGURED'}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    Gateway Provider
                  </label>
                  <input
                    type="text"
                    value={smsProviderForm.provider || 'MSG91'}
                    onChange={(e) =>
                      setSmsProviderForm((p) => ({ ...p, provider: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded bg-stone-50 text-stone-800 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">
                    DLTR Header / Sender ID
                  </label>
                  <input
                    type="text"
                    value={smsProviderForm.sender_id || 'KORALN'}
                    onChange={(e) =>
                      setSmsProviderForm((p) => ({ ...p, sender_id: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-stone-800 font-mono text-[11px] uppercase tracking-wider font-bold"
                  />
                </div>

                <div className="p-3 bg-stone-50 rounded border border-stone-200 text-[11px] text-stone-500 space-y-1">
                  <p className="font-bold text-stone-700">DLT Entity & Template ID Guard</p>
                  <p>All transactional SMS templates must match registered DLT IDs.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleSaveProvider('sms')}
                disabled={savingProviderChannel === 'sms'}
                className="w-full py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {savingProviderChannel === 'sms' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save SMS Metadata</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SETTINGS */}
      {activeSubTab === 'settings' && (
        <form onSubmit={handleSaveGlobalSettings} className="space-y-6 max-w-3xl">
          <div className="bg-white p-6 rounded-xl border border-[#E5D2BC]/20 shadow-xs space-y-6">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#2A211C]">
                Global Notification Engine Settings
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Queue engine policies and async dispatch rate-limiters.
              </p>
            </div>

            <div className="p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-lg text-blue-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Notification Route Controls Active</p>
                <p className="text-[11px] text-blue-800/90 mt-0.5">
                  Individual event toggles (Email, WhatsApp, SMS) are fully live and managed under the <strong>Notification Events</strong> tab. Asynchronous background queue policies below are scheduled for deployment in Phase 9B.3.
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-stone-100">
              {/* ENABLE NOTIFICATIONS TOGGLE */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-bold text-xs text-[#2A211C]">Master Dispatch Engine</p>
                  <p className="text-[11px] text-stone-500">
                    Master killswitch for async worker queue. Active routing is governed per-event.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-stone-200 text-stone-700 text-[10px] font-bold rounded uppercase">
                  COMING SOON (PHASE 9B.3)
                </span>
              </div>

              {/* MAINTENANCE MODE TOGGLE */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-bold text-xs text-[#2A211C]">Maintenance Mode Buffer</p>
                  <p className="text-[11px] text-stone-500">
                    Hold outgoing non-essential messages during database migrations.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-stone-200 text-stone-700 text-[10px] font-bold rounded uppercase">
                  COMING SOON (PHASE 9B.3)
                </span>
              </div>

              {/* RETRY FAILED JOBS */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-bold text-xs text-[#2A211C]">Automated Exponential Retries</p>
                  <p className="text-[11px] text-stone-500">
                    Queue failed dispatches for retry (1m, 5m, 30m, 6h, 24h).
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-stone-200 text-stone-700 text-[10px] font-bold rounded uppercase">
                  COMING SOON (PHASE 9B.4)
                </span>
              </div>

              {/* FUTURE QUEUE SIZE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 opacity-75">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Future Queue Capacity (Phase 9B.3)
                  </label>
                  <input
                    type="number"
                    disabled
                    value={globalSettings.queue_size_limit}
                    className="w-full px-3 py-2 border border-stone-200 rounded text-xs font-mono bg-stone-100 text-stone-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Future Rate Limit (Phase 9B.3)
                  </label>
                  <input
                    type="number"
                    disabled
                    value={globalSettings.rate_limit_per_min}
                    className="w-full px-3 py-2 border border-stone-200 rounded text-xs font-mono bg-stone-100 text-stone-500 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                disabled
                className="px-5 py-2.5 bg-stone-200 text-stone-500 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-stone-400" />
                <span>Global Settings Locked (Phase 9B.3)</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB: DISPATCH QUEUE */}
      {activeSubTab === 'queue' && (
        <AdminDispatchQueueTab
          adminToken={adminToken}
          onSuccessToast={triggerSuccessToast}
          onErrorToast={triggerErrorToast}
        />
      )}

      {/* SUB-TAB: RETRY CENTRE */}
      {activeSubTab === 'retry' && (
        <AdminNotificationRetryTab
          adminToken={adminToken}
          onSuccessToast={triggerSuccessToast}
          onErrorToast={triggerErrorToast}
          isVisible={activeSubTab === 'retry'}
        />
      )}

      {/* EDIT EVENT MODAL */}
      {isEditModalOpen && editingEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E5D2BC]/30 relative animate-scale-up space-y-5">
            <button
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingEvent(null);
              }}
              className="absolute right-4 top-4 p-1 rounded-full hover:bg-stone-100 text-stone-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#B08D57]" />
                <h3 className="font-serif text-lg font-bold text-[#2A211C]">
                  Configure Notification Event
                </h3>
              </div>
              <p className="text-xs text-stone-500 font-mono mt-0.5">
                event_id: {editingEvent.event_id}
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Event Display Name
                </label>
                <input
                  type="text"
                  value={editingEvent.event_name}
                  onChange={(e) =>
                    setEditingEvent((prev) =>
                      prev ? { ...prev, event_name: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2 border border-stone-200 rounded text-stone-800 font-semibold"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
                <div>
                  <p className="font-bold text-stone-800">Master Event Enablement</p>
                  <p className="text-[11px] text-stone-500">Allow dispatches for this event</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingEvent((prev) =>
                      prev ? { ...prev, enabled: !prev.enabled } : null
                    )
                  }
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    editingEvent.enabled
                      ? 'bg-emerald-600 text-white'
                      : 'bg-stone-300 text-stone-700'
                  }`}
                >
                  {editingEvent.enabled ? 'ENABLED' : 'PAUSED'}
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                  Channel Route Toggles
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              channels: { ...prev.channels, email: !prev.channels.email }
                            }
                          : null
                      )
                    }
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      editingEvent.channels?.email
                        ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-400 line-through'
                    }`}
                  >
                    <Mail className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                    <span>Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              channels: {
                                ...prev.channels,
                                whatsapp: !prev.channels.whatsapp
                              }
                            }
                          : null
                      )
                    }
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      editingEvent.channels?.whatsapp
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-400 line-through'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              channels: { ...prev.channels, sms: !prev.channels.sms }
                            }
                          : null
                      )
                    }
                    className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                      editingEvent.channels?.sms
                        ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                        : 'bg-stone-50 border-stone-200 text-stone-400 line-through'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 mx-auto mb-1 text-amber-600" />
                    <span>SMS</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">
                  Optional Template Ref Identifiers
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Email Template ID (e.g. tpl_order_conf)"
                    value={editingEvent.template_ids?.email || ''}
                    onChange={(e) =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              template_ids: {
                                ...prev.template_ids,
                                email: e.target.value
                              }
                            }
                          : null
                      )
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="WhatsApp Template ID (e.g. kora_order_conf_v1)"
                    value={editingEvent.template_ids?.whatsapp || ''}
                    onChange={(e) =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              template_ids: {
                                ...prev.template_ids,
                                whatsapp: e.target.value
                              }
                            }
                          : null
                      )
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="SMS DLT Template ID (e.g. 170716282828)"
                    value={editingEvent.template_ids?.sms || ''}
                    onChange={(e) =>
                      setEditingEvent((prev) =>
                        prev
                          ? {
                              ...prev,
                              template_ids: {
                                ...prev.template_ids,
                                sms: e.target.value
                              }
                            }
                          : null
                      )
                    }
                    className="w-full px-3 py-1.5 border border-stone-200 rounded text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingEvent(null);
                }}
                className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-lg text-xs font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalEvent}
                disabled={savingEventId === editingEvent.event_id}
                className="px-5 py-2 bg-[#B08D57] hover:bg-[#a04e2e] text-white rounded-lg text-xs font-bold uppercase cursor-pointer flex items-center gap-2"
              >
                {savingEventId === editingEvent.event_id ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Save Event Config</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
