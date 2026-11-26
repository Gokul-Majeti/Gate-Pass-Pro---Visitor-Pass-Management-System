import { Plus, Search, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, extractErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function StaffManagementPage() {
  const { organization, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Password@123',
    role: 'host',
    department: 'Engineering',
    locationName: organization?.locations?.[0]?.name || 'Main Campus',
  });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const { data } = await api.get(`/users?${params.toString()}`);
      setUsers(data.users || []);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', form);
      setShowCreate(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        password: 'Password@123',
        role: 'host',
        department: 'Engineering',
        locationName: organization?.locations?.[0]?.name || 'Main Campus',
      });
      await loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to create staff member'));
    }
  };

  const toggleActive = async (target) => {
    try {
      await api.patch(`/users/${target._id}`, { isActive: !target.isActive });
      await loadUsers();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff & User Management</h1>
          <p className="text-sm text-slate-500">
            Provision Hosts, Security Frontdesk officers, and Admins across campus locations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Add Staff Member
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl border border-blue-200 p-6 space-y-4 shadow-xs"
        >
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-blue-600" />
            New Organization Staff Account
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <input
              type="text"
              required
              placeholder="Full Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="email"
              required
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="host">Employee / Host</option>
              <option value="security">Security / Frontdesk</option>
              <option value="admin">Admin</option>
            </select>
            <input
              type="text"
              placeholder="Department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
            />
            <select
              value={form.locationName}
              onChange={(e) => setForm({ ...form, locationName: e.target.value })}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              {(organization?.locations || [{ name: 'Main Campus' }]).map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Initial Password"
              className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or department..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="security">Security</option>
            <option value="host">Host</option>
            <option value="visitor">Visitor</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading staff...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Department & Campus</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-5 py-3.5 capitalize font-medium text-slate-800">{u.role}</td>
                    <td className="px-5 py-3.5 text-xs text-slate-600">
                      <div>{u.department}</div>
                      <div className="text-slate-400">{u.locationName}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          u.isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {u._id !== currentUser?._id && (
                        <button
                          type="button"
                          onClick={() => toggleActive(u)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
