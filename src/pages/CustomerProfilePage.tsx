import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  User, Shield, Lock, MapPin, Bell, Download, Trash2, CheckCircle2, 
  AlertCircle, ChevronRight, RefreshCw, ArrowLeft, Sparkles, Crown, 
  Edit3, Phone, Mail, Calendar, Globe, Plus, Home, Briefcase, Check, 
  AlertTriangle, ShieldCheck, Clock, FileText, Smartphone, ExternalLink
} from "lucide-react";

export const CustomerProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile data from API
  const [profileData, setProfileData] = useState<any>(null);
  const [completionData, setCompletionData] = useState<any>(null);
  const [securityAudit, setSecurityAudit] = useState<any>(null);

  // Form edit states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Addresses State
  const [addresses, setAddresses] = useState<any[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any | null>(null);
  const [addrForm, setAddrForm] = useState({
    label: "Home",
    recipient_name: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    landmark: "",
    city: "",
    state: "",
    postal_code: "",
    country: "India",
    is_default: false
  });
  const [addrError, setAddrError] = useState<string | null>(null);
  const [isSavingAddr, setIsSavingAddr] = useState(false);

  // Notification Preferences State
  const [notifPrefs, setNotifPrefs] = useState({
    email_transactional: true,
    email_marketing: false,
    whatsapp_transactional: true,
    whatsapp_marketing: false,
    sms_marketing: false,
    push_notifications: true
  });
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Deletion Request Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [deleteSuccessInfo, setDeleteSuccessInfo] = useState<any | null>(null);

  // Data Export State
  const [isExporting, setIsExporting] = useState(false);

  // Load Profile & Security Center
  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/profile/full");
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileData(data.profile);
        setCompletionData(data.completion);
        setSecurityAudit(data.security_audit);

        // Pre-fill Personal Info Form
        setFirstName(data.profile.first_name || "");
        setLastName(data.profile.last_name || "");
        setEmail(data.profile.email || "");
        setBirthday(data.profile.birthday || "");
        setGender(data.profile.gender || "");
        setPreferredLanguage(data.profile.preferred_language || "English");

        // Addresses
        if (Array.isArray(data.profile.addresses)) {
          setAddresses(data.profile.addresses);
        }

        // Preferences
        if (data.profile.marketing_preferences) {
          setNotifPrefs(prev => ({
            ...prev,
            email_marketing: Boolean(data.profile.marketing_preferences.email_marketing_consent),
            whatsapp_marketing: Boolean(data.profile.marketing_preferences.whatsapp_marketing_consent),
            sms_marketing: Boolean(data.profile.marketing_preferences.sms_marketing_consent)
          }));
        }
      } else {
        setError(data.error || "Please verify your mobile via OTP to access your Account Security Center.");
      }
    } catch (err) {
      setError("Network error connecting to Account Center.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Save Personal Info
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/customer/profile/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          birthday,
          gender,
          preferred_language: preferredLanguage
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Personal information updated successfully.");
        fetchProfile(); // Refresh completion & audit
      } else {
        setError(data.error || "Failed to update profile.");
      }
    } catch (err) {
      setError("Network error updating personal profile.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Save Address
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddr(true);
    setAddrError(null);

    try {
      const endpoint = editingAddress 
        ? `/api/customer/addresses/${editingAddress.id}`
        : "/api/customer/addresses";
      const method = editingAddress ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addrForm)
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAddressModalOpen(false);
        setEditingAddress(null);
        fetchProfile();
      } else {
        setAddrError(data.error || "Failed to save address.");
      }
    } catch (err) {
      setAddrError("Network error saving address.");
    } finally {
      setIsSavingAddr(false);
    }
  };

  // Delete Address
  const handleDeleteAddress = async (addrId: string) => {
    if (!window.confirm("Are you sure you want to delete this delivery address?")) return;
    try {
      const res = await fetch(`/api/customer/addresses/${addrId}`, { method: "DELETE" });
      if (res.ok) {
        fetchProfile();
      }
    } catch (err) {
      alert("Failed to delete address.");
    }
  };

  // Set Address as Default
  const handleSetDefaultAddress = async (addrId: string) => {
    try {
      const res = await fetch(`/api/customer/addresses/${addrId}/default`, { method: "PUT" });
      if (res.ok) {
        fetchProfile();
      }
    } catch (err) {
      alert("Failed to update default address.");
    }
  };

  // Save Notification Preferences
  const handleSavePreferences = async () => {
    setIsSavingPrefs(true);
    try {
      const res = await fetch("/api/customer/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketing_preferences: {
            email_marketing_consent: notifPrefs.email_marketing,
            whatsapp_marketing_consent: notifPrefs.whatsapp_marketing,
            sms_marketing_consent: notifPrefs.sms_marketing,
            consent_source: "customer_account_center"
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Communication preferences saved.");
      }
    } catch (err) {
      setError("Failed to save communication preferences.");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Trigger Data Export Download
  const handleDataExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/customer/profile/data-export");
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `kora_linen_account_data_${profileData?.customer_id || "export"}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert("Failed to generate data export.");
      }
    } catch (err) {
      alert("Network error exporting account data.");
    } finally {
      setIsExporting(false);
    }
  };

  // Submit Account Deletion Request
  const handleSubmitAccountDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingDelete(true);
    try {
      const res = await fetch("/api/customer/profile/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setDeleteSuccessInfo(data.deletion_request);
      } else {
        alert(data.error || "Failed to submit account deletion request.");
      }
    } catch (err) {
      alert("Network error processing deletion request.");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <RefreshCw className="w-8 h-8 text-amber-700 animate-spin mb-4" />
          <p className="text-sm font-medium tracking-widest text-stone-600 uppercase">
            Loading Sa and Sha Account Security Center...
          </p>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-screen bg-stone-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto bg-white border border-stone-200 rounded-2xl p-8 shadow-sm text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <Shield className="w-6 h-6 text-amber-800" />
          </div>
          <h2 className="text-xl font-serif text-stone-900 mb-2">Account Security Center</h2>
          <p className="text-xs text-stone-600 mb-6 leading-relaxed">
            {error || "Authentication required. Please verify your OTP to manage personal profile & security settings."}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/account"
              className="px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors"
            >
              Go to Account Dashboard
            </Link>
            <button
              onClick={fetchProfile}
              className="px-5 py-2.5 bg-stone-100 text-stone-800 text-xs font-semibold rounded-lg hover:bg-stone-200 transition-colors border border-stone-200"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link 
            to="/account" 
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-xs text-stone-500 font-mono">
            ID: {profileData.customer_id}
          </span>
        </div>

        {/* Notifications & Alert Banners */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between text-emerald-900 text-xs font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-700 hover:underline">Dismiss</button>
          </div>
        )}

        {/* SECTION 2: PROFILE HOME HERO */}
        <div className="bg-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-stone-950 font-serif text-2xl font-bold shadow-md">
              {profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : "K"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-serif text-amber-50">
                  {profileData.full_name || "Valued Customer"}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-widest">
                  {profileData.admin_metadata?.customer_tier || "Standard Member"}
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono">
                Customer ID: <strong className="text-stone-200">{profileData.customer_id}</strong>
              </p>
              <div className="flex items-center gap-4 text-[11px] text-stone-400 pt-1">
                <span>Phone: +91 {profileData.normalized_phone?.substring(profileData.normalized_phone.length - 10)}</span>
                <span>•</span>
                <span>Member Since: {new Date(profileData.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          <div className="bg-stone-800/80 border border-stone-700 p-4 rounded-2xl flex items-center gap-4 shrink-0">
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-semibold text-stone-400 block">Orders</span>
              <span className="text-lg font-bold font-mono text-stone-100">{profileData.commerce_summary?.total_orders || 0}</span>
            </div>
            <div className="h-8 w-px bg-stone-700" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase font-semibold text-stone-400 block">Lifetime Spend</span>
              <span className="text-lg font-bold font-mono text-amber-300">₹{(profileData.commerce_summary?.lifetime_spend || 0).toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: PROFILE COMPLETION CARD */}
        {completionData && (
          <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-700" />
                <h3 className="text-lg font-serif text-stone-900">Profile Completion</h3>
              </div>
              <span className="text-sm font-bold font-mono text-amber-900 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                {completionData.completion_percent}% Complete
              </span>
            </div>

            <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${completionData.completion_percent}%` }}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {completionData.missing_suggestions.map((item: any) => (
                <div 
                  key={item.key} 
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    item.completed ? "bg-stone-50/60 border-stone-200 text-stone-600" : "bg-amber-50/50 border-amber-200 text-stone-900 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.completed ? (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">+{item.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: EDIT PERSONAL INFORMATION */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
            <User className="w-5 h-5 text-stone-800" />
            <h2 className="text-xl font-serif text-stone-900">Personal Information</h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">First Name</label>
                <input 
                  type="text" 
                  value={firstName} 
                  onChange={(e) => setFirstName(e.target.value)} 
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Last Name</label>
                <input 
                  type="text" 
                  value={lastName} 
                  onChange={(e) => setLastName(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Email Address</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                />
                <p className="text-[10px] text-stone-500 mt-1">Used for order receipts and security alerts.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Mobile Phone (Verified)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={`+91 ${profileData.normalized_phone?.substring(profileData.normalized_phone.length - 10)}`} 
                    disabled 
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 text-stone-600 cursor-not-allowed font-mono"
                  />
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-lg shrink-0">
                    OTP Verified
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Birthday</label>
                <input 
                  type="date" 
                  value={birthday} 
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setBirthday(e.target.value)} 
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900"
                />
                <p className="text-[10px] text-stone-500 mt-1">Receive birthday gift points annually.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Gender (Optional)</label>
                <select 
                  value={gender} 
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2">Preferred Language</label>
                <select 
                  value={preferredLanguage} 
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:border-stone-900 bg-white"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi (हिंदी)</option>
                  <option value="Marathi">Marathi (मराठी)</option>
                  <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                  <option value="Tamil">Tamil (தமிழ்)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="px-6 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                {isUpdatingProfile ? "Saving Changes..." : "Save Personal Info"}
              </button>
            </div>
          </form>
        </div>

        {/* SECTION 5: ADDRESS BOOK INTEGRATION */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-5 h-5 text-stone-800" />
              <div>
                <h2 className="text-xl font-serif text-stone-900">Address Book</h2>
                <p className="text-xs text-stone-500">Manage delivery addresses for seamless checkout</p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditingAddress(null);
                setAddrForm({
                  label: "Home",
                  recipient_name: profileData.full_name || "",
                  phone: profileData.normalized_phone || "",
                  address_line_1: "",
                  address_line_2: "",
                  landmark: "",
                  city: "",
                  state: "",
                  postal_code: "",
                  country: "India",
                  is_default: addresses.length === 0
                });
                setIsAddressModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Address</span>
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <MapPin className="w-8 h-8 text-stone-400 mx-auto mb-2" />
              <p className="text-xs text-stone-600 font-medium">No saved addresses found.</p>
              <p className="text-[11px] text-stone-400 mt-1">Add an address to complete your profile & speed up checkout.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div 
                  key={addr.id} 
                  className={`p-5 rounded-2xl border relative space-y-3 ${
                    addr.is_default ? "bg-amber-50/40 border-amber-300 shadow-2xs" : "bg-stone-50/60 border-stone-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-[10px] font-bold uppercase text-stone-700">
                      {addr.label === "Home" ? <Home className="w-3 h-3 text-stone-600" /> : <Briefcase className="w-3 h-3 text-stone-600" />}
                      <span>{addr.label}</span>
                    </span>

                    {addr.is_default && (
                      <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded-full">
                        Default Address
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-stone-900">{addr.recipient_name}</h4>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {addr.address_line_1}{addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
                      {addr.landmark ? ` (Near ${addr.landmark})` : ""}
                      <br />
                      {addr.city}, {addr.state} - {addr.postal_code}
                    </p>
                    <p className="text-[11px] font-mono text-stone-500 mt-1">Phone: {addr.phone}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 text-xs">
                    {!addr.is_default && (
                      <button 
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="text-stone-600 hover:text-stone-900 font-semibold underline text-[11px]"
                      >
                        Set as Default
                      </button>
                    )}
                    <div className="flex items-center gap-3 ml-auto">
                      <button 
                        onClick={() => {
                          setEditingAddress(addr);
                          setAddrForm(addr);
                          setIsAddressModalOpen(true);
                        }}
                        className="text-stone-700 hover:text-stone-900 font-semibold"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-rose-600 hover:text-rose-800 font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 6: COMMUNICATION PREFERENCES */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
            <Bell className="w-5 h-5 text-stone-800" />
            <div>
              <h2 className="text-xl font-serif text-stone-900">Communication Preferences</h2>
              <p className="text-xs text-stone-500">Choose how Sa and Sha reaches out with order updates and drops</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Transactional Email</h4>
                <p className="text-[11px] text-stone-500">Order receipts, shipping receipts & invoices</p>
              </div>
              <input type="checkbox" checked={notifPrefs.email_transactional} disabled className="w-4 h-4 text-stone-900" />
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Marketing Email</h4>
                <p className="text-[11px] text-stone-500">New seasonal collections & VIP sales</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifPrefs.email_marketing} 
                onChange={(e) => setNotifPrefs({ ...notifPrefs, email_marketing: e.target.checked })} 
                className="w-4 h-4 text-stone-900 accent-stone-900" 
              />
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Transactional WhatsApp</h4>
                <p className="text-[11px] text-stone-500">Real-time order tracking & delivery updates</p>
              </div>
              <input type="checkbox" checked={notifPrefs.whatsapp_transactional} disabled className="w-4 h-4 text-stone-900" />
            </div>

            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900">Marketing WhatsApp</h4>
                <p className="text-[11px] text-stone-500">Exclusive priority drops & tailored linen alerts</p>
              </div>
              <input 
                type="checkbox" 
                checked={notifPrefs.whatsapp_marketing} 
                onChange={(e) => setNotifPrefs({ ...notifPrefs, whatsapp_marketing: e.target.checked })} 
                className="w-4 h-4 text-stone-900 accent-stone-900" 
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSavePreferences}
              disabled={isSavingPrefs}
              className="px-6 py-2.5 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
            >
              {isSavingPrefs ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>

        {/* SECTION 8: SECURITY CENTER */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <div>
              <h2 className="text-xl font-serif text-stone-900">Security Center</h2>
              <p className="text-xs text-stone-500">Verification status, login history & access security</p>
            </div>
          </div>

          {securityAudit && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <span className="text-[10px] text-stone-500 uppercase font-semibold block">Phone Security</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mobile OTP Verified
                </span>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <span className="text-[10px] text-stone-500 uppercase font-semibold block">Email Status</span>
                <span className={`font-bold flex items-center gap-1 ${securityAudit.email_verified ? "text-emerald-700" : "text-amber-700"}`}>
                  {securityAudit.email_verified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {securityAudit.email_verified ? "Email On File" : "Email Pending"}
                </span>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <span className="text-[10px] text-stone-500 uppercase font-semibold block">Account Created</span>
                <span className="font-bold font-mono text-stone-900">
                  {new Date(securityAudit.account_created_at).toLocaleDateString("en-IN")}
                </span>
              </div>

              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <span className="text-[10px] text-stone-500 uppercase font-semibold block">Last OTP Auth Session</span>
                <span className="font-bold font-mono text-stone-900">
                  {new Date(securityAudit.last_otp_login_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 7 & 13 & 14: PRIVACY CENTER & DATA EXPORT & ACCOUNT DELETION */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2.5 border-b border-stone-100 pb-4">
            <Lock className="w-5 h-5 text-stone-800" />
            <div>
              <h2 className="text-xl font-serif text-stone-900">Privacy & Data Governance</h2>
              <p className="text-xs text-stone-500">Download your personal records or request account closure</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Download className="w-4 h-4 text-stone-700" />
                <span>Download My Data (GDPR / DPDP)</span>
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Download a clean, structured JSON file containing your profile info, delivery addresses, order history summaries, rewards points, store credit balance, and communication preferences.
              </p>
              <button
                onClick={handleDataExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? "Exporting..." : "Download Data Archive"}</span>
              </button>
            </div>

            <div className="p-5 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-3">
              <h4 className="text-sm font-bold text-rose-950 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-700" />
                <span>Request Account Deletion</span>
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed">
                Submit an account closure request. Note: To protect against unauthorized fraud, deletion requests undergo an admin review and enter a 30-day grace period during which you can cancel.
              </p>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-rose-700 text-white text-xs font-semibold rounded-xl hover:bg-rose-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Request Account Closure</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ADDRESS ADD / EDIT MODAL */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif text-stone-900">
                {editingAddress ? "Edit Address" : "Add Delivery Address"}
              </h3>
              <button 
                onClick={() => setIsAddressModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {addrError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">{addrError}</p>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Address Label</label>
                  <select 
                    value={addrForm.label} 
                    onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work / Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Recipient Name</label>
                  <input 
                    type="text" 
                    value={addrForm.recipient_name} 
                    onChange={(e) => setAddrForm({ ...addrForm, recipient_name: e.target.value })}
                    required 
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Mobile Phone Number</label>
                <input 
                  type="text" 
                  value={addrForm.phone} 
                  onChange={(e) => setAddrForm({ ...addrForm, phone: e.target.value })}
                  required 
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Address Line 1 (Flat, House no., Building, Street)</label>
                <input 
                  type="text" 
                  value={addrForm.address_line_1} 
                  onChange={(e) => setAddrForm({ ...addrForm, address_line_1: e.target.value })}
                  required 
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Line 2 (Area, Sector)</label>
                  <input 
                    type="text" 
                    value={addrForm.address_line_2} 
                    onChange={(e) => setAddrForm({ ...addrForm, address_line_2: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Landmark (Optional)</label>
                  <input 
                    type="text" 
                    value={addrForm.landmark} 
                    onChange={(e) => setAddrForm({ ...addrForm, landmark: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">City</label>
                  <input 
                    type="text" 
                    value={addrForm.city} 
                    onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })}
                    required 
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">State</label>
                  <input 
                    type="text" 
                    value={addrForm.state} 
                    onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })}
                    required 
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl" 
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">PIN Code</label>
                  <input 
                    type="text" 
                    value={addrForm.postal_code} 
                    onChange={(e) => setAddrForm({ ...addrForm, postal_code: e.target.value })}
                    required 
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl font-mono" 
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="is_default"
                  checked={addrForm.is_default} 
                  onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })} 
                  className="w-4 h-4 text-stone-900 accent-stone-900" 
                />
                <label htmlFor="is_default" className="text-xs text-stone-700 font-medium">Set as default delivery address</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button 
                  type="button" 
                  onClick={() => setIsAddressModalOpen(false)} 
                  className="px-4 py-2 border border-stone-200 text-stone-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSavingAddr} 
                  className="px-5 py-2 bg-stone-900 text-white font-semibold rounded-xl hover:bg-stone-800 transition-colors"
                >
                  {isSavingAddr ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACCOUNT DELETION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-stone-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-serif text-rose-950 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
                <span>Account Deletion Request</span>
              </h3>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {deleteSuccessInfo ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Deletion Request Submitted</span>
                  </div>
                  <p>
                    Request ID: <strong className="font-mono">{deleteSuccessInfo.id}</strong>
                  </p>
                  <p>
                    Your request has been placed under admin review with a <strong>30-day grace period</strong> (scheduled: {new Date(deleteSuccessInfo.scheduled_deletion_date).toLocaleDateString("en-IN")}).
                  </p>
                </div>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full py-2.5 bg-stone-900 text-white font-semibold rounded-xl"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitAccountDeletion} className="space-y-4 text-xs">
                <p className="text-stone-600 leading-relaxed">
                  Please tell us why you are requesting account closure. Once submitted, your profile will enter a 30-day grace period before permanent deletion.
                </p>

                <div>
                  <label className="block font-semibold mb-1">Reason for Deletion</label>
                  <textarea 
                    rows={3} 
                    value={deleteReason} 
                    onChange={(e) => setDeleteReason(e.target.value)} 
                    placeholder="Optional details..."
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setIsDeleteModalOpen(false)} 
                    className="px-4 py-2 border border-stone-200 text-stone-700 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmittingDelete} 
                    className="px-5 py-2 bg-rose-700 text-white font-semibold rounded-xl hover:bg-rose-800 transition-colors"
                  >
                    {isSubmittingDelete ? "Submitting..." : "Confirm Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
