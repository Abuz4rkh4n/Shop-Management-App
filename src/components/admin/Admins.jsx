import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../contexts/AuthContext";
import { Plus, Pencil, X } from "lucide-react";

const defaultPerms = { products: true, workers: false, sales: true, returns: false };

const Admins = () => {
  const api = import.meta.env.VITE_API_URL;
  const { token, user } = useAuth();

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    address: "",
    role: "admin",
    permissions: defaultPerms,
  });

  const [editForm, setEditForm] = useState({
    id: null,
    name: "",
    email: "",
    password: "",
    address: "",
    role: "admin",
    permissions: defaultPerms,
  });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${api}/admins`, { headers });
      setAdmins(res.data);
    } catch (e) {
      setError(e.response?.data?.message || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function togglePerm(formSetter, form, key) {
    formSetter({ ...form, permissions: { ...form.permissions, [key]: !form.permissions[key] } });
  }

  async function submitAdd(e) {
    e.preventDefault();
    try {
      await axios.post(`${api}/admins`, addForm, { headers });
      setShowAdd(false);
      setAddForm({ name: "", email: "", password: "", address: "", role: "admin", permissions: defaultPerms });
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to create admin");
    }
  }

  function openEdit(a) {
    setEditForm({
      id: a.id,
      name: a.name,
      email: a.email,
      password: "",
      address: a.address || "",
      role: a.role || "admin",
      permissions: { products: false, workers: false, sales: false, returns: false, ...(a.permissions || {}) },
    });
    setShowEdit(true);
  }

  async function submitEdit(e) {
    e.preventDefault();
    const payload = { ...editForm };
    if (!payload.password) delete payload.password;
    try {
      await axios.put(`${api}/admins/${editForm.id}`, payload, { headers });
      setShowEdit(false);
      await load();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to update admin");
    }
  }

  if (user?.role !== "superadmin") {
    return (
      <div className="p-6 w-full">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-red-600">Forbidden: Superadmin only</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full p-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-primary">Admins</h2>
            <div className="text-sm text-gray-500">Manage admin accounts and permissions</div>
          </div>
          <button onClick={() => setShowAdd(true)} className="px-3 py-2 bg-primary text-secondary rounded flex items-center gap-2">
            <Plus size={16} /> Add Admin
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
        )}

        {loading ? (
          <div>Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-primary text-secondary">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Permissions</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="p-2">{a.name}</td>
                    <td className="p-2">{a.email}</td>
                    <td className="p-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{a.role || 'admin'}</span>
                    </td>
                    <td className="p-2 text-xs text-gray-600">
                      {Object.entries({ products: 'Products', workers: 'Workers', sales: 'Sales', returns: 'Returns' })
                        .filter(([k]) => a.permissions?.[k])
                        .map(([, label]) => label)
                        .join(', ') || '-'}
                    </td>
                    <td className="p-2">
                      <button onClick={() => openEdit(a)} className="px-3 py-1 rounded bg-blue-600 text-white flex items-center gap-1">
                        <Pencil size={14} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow p-6 w-full max-w-lg relative">
            <button onClick={() => setShowAdd(false)} className="absolute top-3 right-3 text-gray-500 hover:text-red-500"><X /></button>
            <h3 className="text-lg font-semibold mb-4">Add Admin</h3>
            <form onSubmit={submitAdd} className="space-y-3">
              <div>
                <label className="text-sm">Name</label>
                <input className="border rounded w-full p-2" value={addForm.name} onChange={(e)=>setAddForm({...addForm,name:e.target.value})} required />
              </div>
              <div>
                <label className="text-sm">Email</label>
                <input type="email" className="border rounded w-full p-2" value={addForm.email} onChange={(e)=>setAddForm({...addForm,email:e.target.value})} required />
              </div>
              <div>
                <label className="text-sm">Password</label>
                <input type="password" className="border rounded w-full p-2" value={addForm.password} onChange={(e)=>setAddForm({...addForm,password:e.target.value})} required />
              </div>
              <div>
                <label className="text-sm">Address</label>
                <input className="border rounded w-full p-2" value={addForm.address} onChange={(e)=>setAddForm({...addForm,address:e.target.value})} />
              </div>
              <div>
                <label className="text-sm">Role</label>
                <select className="border rounded w-full p-2" value={addForm.role} onChange={(e)=>setAddForm({...addForm,role:e.target.value})}>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Permissions</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries({ products: 'Products', workers: 'Workers', sales: 'Sales', returns: 'Returns' }).map(([k,label]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={!!addForm.permissions[k]} onChange={()=>togglePerm(setAddForm, addForm, k)} /> {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowAdd(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-secondary rounded">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow p-6 w-full max-w-lg relative">
            <button onClick={() => setShowEdit(false)} className="absolute top-3 right-3 text-gray-500 hover:text-red-500"><X /></button>
            <h3 className="text-lg font-semibold mb-4">Edit Admin</h3>
            <form onSubmit={submitEdit} className="space-y-3">
              <div>
                <label className="text-sm">Name</label>
                <input className="border rounded w-full p-2" value={editForm.name} onChange={(e)=>setEditForm({...editForm,name:e.target.value})} required />
              </div>
              <div>
                <label className="text-sm">Email</label>
                <input disabled className="border rounded w-full p-2 bg-gray-100" value={editForm.email} />
              </div>
              <div>
                <label className="text-sm">New Password (optional)</label>
                <input type="password" className="border rounded w-full p-2" value={editForm.password} onChange={(e)=>setEditForm({...editForm,password:e.target.value})} />
              </div>
              <div>
                <label className="text-sm">Address</label>
                <input className="border rounded w-full p-2" value={editForm.address} onChange={(e)=>setEditForm({...editForm,address:e.target.value})} />
              </div>
              <div>
                <label className="text-sm">Role</label>
                <select className="border rounded w-full p-2" value={editForm.role} onChange={(e)=>setEditForm({...editForm,role:e.target.value})}>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Permissions</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {Object.entries({ products: 'Products', workers: 'Workers', sales: 'Sales', returns: 'Returns' }).map(([k,label]) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={!!editForm.permissions[k]} onChange={()=>togglePerm(setEditForm, editForm, k)} /> {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowEdit(false)} className="px-4 py-2 border rounded">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary text-secondary rounded">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admins;
