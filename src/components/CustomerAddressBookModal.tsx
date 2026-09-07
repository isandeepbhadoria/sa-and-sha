import React, { useState } from 'react';
import { MapPin, Plus, Check, Trash2, Edit2, Star, X, Loader2, Home, Briefcase, Tag } from 'lucide-react';
import { CustomerAddress } from '../server/customerProfileHelpers';

interface CustomerAddressBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  verificationToken: string;
  mobile: string;
  addresses: CustomerAddress[];
  selectedAddressId?: string;
  onSelectAddress: (address: CustomerAddress) => void;
  onAddressesUpdated: (updatedAddresses: CustomerAddress[]) => void;
}

const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

export const CustomerAddressBookModal: React.FC<CustomerAddressBookModalProps> = ({
  isOpen,
  onClose,
  verificationToken,
  mobile,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddressesUpdated
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    label: 'Home',
    custom_label: '',
    recipient_name: '',
    phone: mobile || '',
    address_line_1: '',
    address_line_2: '',
    landmark: '',
    city: '',
    state: 'Delhi',
    postal_code: '',
    country: 'India',
    is_default: false
  });

  if (!isOpen) return null;

  const handleOpenAddForm = () => {
    if (addresses.length >= 10) {
      setErrorMsg("Maximum limit of 10 saved addresses reached. Please delete an existing address before adding a new one.");
      return;
    }
    setEditingAddressId(null);
    setForm({
      label: 'Home',
      custom_label: '',
      recipient_name: '',
      phone: mobile || '',
      address_line_1: '',
      address_line_2: '',
      landmark: '',
      city: '',
      state: 'Delhi',
      postal_code: '',
      country: 'India',
      is_default: addresses.length === 0
    });
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleOpenEditForm = (addr: CustomerAddress) => {
    setEditingAddressId(addr.id);
    setForm({
      label: addr.label || 'Home',
      custom_label: addr.custom_label || '',
      recipient_name: addr.recipient_name || '',
      phone: addr.phone || mobile || '',
      address_line_1: addr.address_line_1 || '',
      address_line_2: addr.address_line_2 || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || 'Delhi',
      postal_code: addr.postal_code || '',
      country: addr.country || 'India',
      is_default: addr.is_default
    });
    setErrorMsg(null);
    setIsEditing(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoadingId('save');

    try {
      const endpoint = editingAddressId
        ? `/api/customer/addresses/${editingAddressId}`
        : `/api/customer/addresses`;
      const method = editingAddressId ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationToken,
          mobile,
          address: form,
          set_as_default: form.is_default
        })
      });

      const data = await res.json();
      if (data.success && data.addresses) {
        onAddressesUpdated(data.addresses);
        if (data.address) {
          onSelectAddress(data.address);
        } else {
          const matched = data.addresses.find((a: CustomerAddress) => a.id === editingAddressId) || data.addresses[0];
          if (matched) onSelectAddress(matched);
        }
        setIsEditing(false);
      } else {
        setErrorMsg(data.error || 'Failed to save address.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error saving address.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (addrId: string) => {
    if (!window.confirm('Are you sure you want to delete this address from your address book?')) return;
    setLoadingId(addrId);
    try {
      const res = await fetch(`/api/customer/addresses/${addrId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationToken, mobile })
      });
      const data = await res.json();
      if (data.success && data.addresses) {
        onAddressesUpdated(data.addresses);
      }
    } catch (err) {
      console.error('Failed to delete address:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    setLoadingId(addrId);
    try {
      const res = await fetch(`/api/customer/addresses/${addrId}/default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationToken, mobile })
      });
      const data = await res.json();
      if (data.success && data.addresses) {
        onAddressesUpdated(data.addresses);
      }
    } catch (err) {
      console.error('Failed to set default address:', err);
    } finally {
      setLoadingId(null);
    }
  };

  const getLabelIcon = (label: string) => {
    if (label === 'Home') return <Home className="w-3.5 h-3.5 text-[#B08D57]" />;
    if (label === 'Work') return <Briefcase className="w-3.5 h-3.5 text-[#1E3A8A]" />;
    return <Tag className="w-3.5 h-3.5 text-gray-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden border border-amber-900/10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#FAF7F2]">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#B08D57]" />
            <h3 className="font-serif text-lg font-bold text-[#2A211C]">
              {isEditing ? (editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address') : 'Saved Address Book'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg">
              {errorMsg}
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveForm} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Label Selection */}
                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Address Type Label</label>
                  <div className="flex items-center gap-3">
                    {['Home', 'Work', 'Other'].map(lbl => (
                      <button
                        type="button"
                        key={lbl}
                        onClick={() => setForm(f => ({ ...f, label: lbl }))}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                          form.label === lbl
                            ? 'border-[#B08D57] bg-[#B08D57]/10 text-[#B08D57] font-bold'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {getLabelIcon(lbl)}
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {form.label === 'Other' && (
                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label className="font-bold uppercase text-[10px] text-gray-500">Custom Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Vacation Villa, Parents Home"
                      value={form.custom_label}
                      onChange={e => setForm(f => ({ ...f, custom_label: e.target.value }))}
                      className="p-2 border border-gray-300 rounded-lg text-xs"
                    />
                  </div>
                )}

                {/* Recipient Name */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={form.recipient_name}
                    onChange={e => setForm(f => ({ ...f, recipient_name: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="Full Name"
                  />
                </div>

                {/* Mobile Phone */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="10-digit mobile"
                  />
                </div>

                {/* Address Line 1 */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Address Line 1 *</label>
                  <input
                    type="text"
                    required
                    value={form.address_line_1}
                    onChange={e => setForm(f => ({ ...f, address_line_1: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="House/Flat No., Building, Street"
                  />
                </div>

                {/* Address Line 2 */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Address Line 2 (Optional)</label>
                  <input
                    type="text"
                    value={form.address_line_2}
                    onChange={e => setForm(f => ({ ...f, address_line_2: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="Apartment, Suite, Area"
                  />
                </div>

                {/* Landmark */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Landmark (Optional)</label>
                  <input
                    type="text"
                    value={form.landmark}
                    onChange={e => setForm(f => ({ ...f, landmark: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="Near Park / Temple / Station"
                  />
                </div>

                {/* PIN Code */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={form.postal_code}
                    onChange={e => setForm(f => ({ ...f, postal_code: e.target.value.replace(/\D/g, '') }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs tracking-wider font-mono"
                    placeholder="6-digit PIN"
                  />
                </div>

                {/* City */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">City *</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs"
                    placeholder="City"
                  />
                </div>

                {/* State */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">State *</label>
                  <select
                    value={form.state}
                    onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    className="p-2 border border-gray-300 rounded-lg text-xs bg-white"
                  >
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Country */}
                <div className="flex flex-col gap-1">
                  <label className="font-bold uppercase text-[10px] text-gray-500">Country *</label>
                  <input
                    type="text"
                    disabled
                    value={form.country}
                    className="p-2 border border-gray-200 rounded-lg text-xs bg-gray-50 text-gray-600"
                  />
                </div>

                {/* Set as default checkbox */}
                <div className="sm:col-span-2 pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="modal_is_default"
                    checked={form.is_default}
                    onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                    className="w-4 h-4 accent-[#B08D57] rounded cursor-pointer"
                  />
                  <label htmlFor="modal_is_default" className="text-xs text-gray-700 font-medium cursor-pointer">
                    Set as default delivery address
                  </label>
                </div>

              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loadingId === 'save'}
                  className="px-5 py-2 bg-[#B08D57] text-white rounded-lg text-xs font-bold hover:bg-[#A04D2E] transition-colors flex items-center gap-2"
                >
                  {loadingId === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Address</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Select an address for your order delivery or add a new one:
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddForm}
                  className="px-3 py-1.5 bg-[#B08D57] text-white rounded-lg text-xs font-bold hover:bg-[#A04D2E] transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Address</span>
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="text-center py-8 px-4 bg-amber-50/50 rounded-xl border border-dashed border-amber-200">
                  <MapPin className="w-8 h-8 text-[#B08D57] mx-auto mb-2 opacity-60" />
                  <p className="text-xs font-bold text-[#2A211C]">No Saved Addresses</p>
                  <p className="text-[11px] text-gray-500 mt-1">Add your primary delivery address to your address book for faster checkout.</p>
                  <button
                    type="button"
                    onClick={handleOpenAddForm}
                    className="mt-3 px-4 py-1.5 bg-[#B08D57] text-white rounded-lg text-xs font-bold hover:bg-[#A04D2E]"
                  >
                    + Add First Address
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {addresses.map(addr => {
                    const isSelected = selectedAddressId === addr.id;
                    const labelText = addr.label === 'Other' && addr.custom_label ? addr.custom_label : addr.label;

                    return (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-xl border transition-all relative flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'border-[#B08D57] bg-[#FAF7F2] ring-2 ring-[#B08D57]/20 shadow-sm'
                            : 'border-gray-200 hover:border-amber-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded font-bold text-[10px] flex items-center gap-1">
                                {getLabelIcon(addr.label)}
                                {labelText.toUpperCase()}
                              </span>
                              {addr.is_default && (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[10px] flex items-center gap-1">
                                  <Star className="w-3 h-3 text-amber-600 fill-amber-600" />
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            {isSelected && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
                                <Check className="w-3 h-3" />
                                SELECTED
                              </span>
                            )}
                          </div>

                          <p className="font-bold text-xs text-[#2A211C]">{addr.recipient_name} • <span className="font-mono text-gray-600">{addr.phone}</span></p>
                          <p className="text-xs text-gray-700 mt-1 leading-relaxed">
                            {addr.address_line_1}
                            {addr.address_line_2 ? `, ${addr.address_line_2}` : ''}
                            {addr.landmark ? ` (Landmark: ${addr.landmark})` : ''}
                          </p>
                          <p className="text-xs text-gray-600 font-medium">
                            {addr.city}, {addr.state} - <span className="font-mono font-bold text-[#2A211C]">{addr.postal_code}</span>, {addr.country}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAddress(addr);
                              onClose();
                            }}
                            className="px-3 py-1 bg-[#2A211C] text-white rounded text-[11px] font-bold hover:bg-[#38322B] transition-colors"
                          >
                            Use This Address
                          </button>

                          <div className="flex items-center gap-3">
                            {!addr.is_default && (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(addr.id)}
                                disabled={loadingId === addr.id}
                                className="text-[11px] text-amber-700 font-medium hover:underline flex items-center gap-1"
                              >
                                {loadingId === addr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                                Set Default
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenEditForm(addr)}
                              className="text-[11px] text-gray-600 font-medium hover:text-[#B08D57] flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(addr.id)}
                              disabled={loadingId === addr.id}
                              className="text-[11px] text-red-600 font-medium hover:text-red-800 flex items-center gap-1"
                            >
                              {loadingId === addr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                              Delete
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg text-xs font-bold hover:bg-gray-300"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
