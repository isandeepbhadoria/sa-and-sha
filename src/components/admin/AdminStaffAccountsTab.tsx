import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, Power, Loader2, Users } from 'lucide-react';

interface StaffAccount {
  uid: string;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
}

interface AdminStaffAccountsTabProps {
  adminToken: string;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminStaffAccountsTab: React.FC<AdminStaffAccountsTabProps> = ({ adminToken, showToast }) => {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (showToast) showToast(msg, type);
  };

  const loadStaff = useCallback(async () => {
    if (!adminToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/staff', {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStaff(data.staff || []);
      } else {
        notify(data.error || 'Failed to load staff accounts.', 'error');
      }
    } catch (err) {
      notify('Failed to load staff accounts.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`Staff account created for ${data.staff.email}.`, 'success');
        setName('');
        setEmail('');
        setPassword('');
        await loadStaff();
      } else {
        notify(data.error || 'Failed to create staff account.', 'error');
      }
    } catch (err) {
      notify('Failed to create staff account.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (member: StaffAccount) => {
    setBusyUid(member.uid);
    try {
      const res = await fetch(`/api/admin/staff/${member.uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ active: !member.active })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`${member.name} ${!member.active ? 'activated' : 'deactivated'}.`, 'success');
        await loadStaff();
      } else {
        notify(data.error || 'Failed to update staff account.', 'error');
      }
    } catch (err) {
      notify('Failed to update staff account.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  const handleDelete = async (member: StaffAccount) => {
    if (!window.confirm(`Permanently remove ${member.name} (${member.email})? This cannot be undone.`)) return;
    setBusyUid(member.uid);
    try {
      const res = await fetch(`/api/admin/staff/${member.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        notify(`${member.name} removed.`, 'success');
        await loadStaff();
      } else {
        notify(data.error || 'Failed to remove staff account.', 'error');
      }
    } catch (err) {
      notify('Failed to remove staff account.', 'error');
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Add Store Staff
        </h3>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 chars)"
            className="border border-stone-300 rounded-md px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isCreating}
            className="bg-stone-900 text-white text-sm font-semibold rounded-md px-4 py-2 disabled:opacity-60"
          >
            {isCreating ? 'Creating...' : 'Create Login'}
          </button>
        </form>
        <p className="text-xs text-stone-400 mt-2">
          Staff sign in separately at <code>/staff</code> with just email + password — no Authenticator code required.
          They only get access to recording store sales, never the full admin panel.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 p-6 pb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> Store Staff
        </h3>
        {isLoading ? (
          <div className="p-6 text-center text-stone-400 text-sm flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : staff.length === 0 ? (
          <div className="p-6 text-center text-stone-400 text-sm">No staff accounts yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-y border-stone-200 text-left text-xs uppercase tracking-wider text-stone-500">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Status</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.uid} className="border-b border-stone-100 last:border-0">
                  <td className="p-4 font-medium text-stone-900">{member.name}</td>
                  <td className="p-4 text-stone-600">{member.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${member.active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
                      {member.active ? 'Active' : 'Deactivated'}
                    </span>
                  </td>
                  <td className="p-4 text-stone-500">{new Date(member.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleToggleActive(member)}
                        disabled={busyUid === member.uid}
                        title={member.active ? 'Deactivate' : 'Activate'}
                        className="p-1.5 rounded-md border border-stone-300 hover:bg-stone-50 disabled:opacity-50"
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(member)}
                        disabled={busyUid === member.uid}
                        title="Remove permanently"
                        className="p-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
