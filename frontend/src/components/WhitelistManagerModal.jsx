import React, { useState, useEffect, useRef } from 'react';
import { X, UserCheck, Plus, Trash2, Upload, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';

export default function WhitelistManagerModal({ isOpen, onClose }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Border Patrol Officer');
  const [selectedFile, setSelectedFile] = useState(null);
  const [msg, setMsg] = useState('');
  const fileInputRef = useRef(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/faces/whitelist').then(r => r.json());
      setProfiles(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Error fetching whitelist profiles:", err);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProfiles();
    }
  }, [isOpen]);

  const handleAddPerson = async (e) => {
    e.preventDefault();
    if (!name.trim() || !selectedFile) {
      alert("Please enter a name and choose a face photo.");
      return;
    }

    setSubmitting(true);
    setMsg('');

    try {
      const formData = new FormData();
      formData.append('person_name', name.trim());
      formData.append('role', role.trim());
      formData.append('file', selectedFile);

      const res = await fetch('/api/v1/faces/whitelist', {
        method: 'POST',
        body: formData
      }).then(r => r.json());

      if (res.status === 'SUCCESS') {
        setMsg(`Successfully registered ${name.trim()} to whitelist!`);
        setName('');
        setSelectedFile(null);
        fetchProfiles();
      } else {
        setMsg('Failed to register face profile.');
      }
    } catch (err) {
      console.error("Error uploading face profile:", err);
      setMsg('Error uploading face profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (faceId) => {
    if (!window.confirm("Remove this staff member from whitelist? Intrusion alerts will no longer be suppressed for this face.")) return;
    try {
      await fetch(`/api/v1/faces/whitelist/${faceId}`, { method: 'DELETE' });
      fetchProfiles();
    } catch (err) {
      console.error("Error deleting face profile:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white font-heading">Whitelisted Personnel Manager</h2>
              <p className="text-[11px] text-slate-400">Registered familiar staff automatically suppress high-severity Virtual Fence alarms</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto font-mono text-xs">
          
          {/* Add Staff Member Form (Method A: GUI Upload) */}
          <form onSubmit={handleAddPerson} className="glass-panel p-4 rounded-xl border border-slate-800/80 space-y-4">
            <h3 className="text-xs font-bold text-white font-heading flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>+ Register New Authorized Staff Face (GUI Upload)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-300 font-semibold block mb-1 text-[11px]">Staff Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Guard Rajat"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1 text-[11px]">Role / Designation</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Sector 1 Patrol"
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* GUI Face Photo Picker */}
            <div>
              <label className="text-slate-300 font-semibold block mb-1 text-[11px]">Choose Face Photo</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border border-dashed border-slate-700 hover:border-emerald-500 bg-slate-950/60 p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-2.5 text-slate-400">
                  <Upload className="w-4 h-4 text-emerald-400" />
                  <span className="truncate max-w-xs">{selectedFile ? selectedFile.name : "Click to select staff face image..."}</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {selectedFile ? "PHOTO SELECTED" : "BROWSE"}
                </span>
              </div>
            </div>

            {msg && (
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 text-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>ADD TO WHITELIST DATABASE</span>
            </button>
          </form>

          {/* Whitelisted Profiles Roster */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white font-heading flex items-center justify-between">
              <span>Active Whitelisted Roster ({profiles.length})</span>
              <button onClick={fetchProfiles} className="text-slate-400 hover:text-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </h3>

            {loading ? (
              <div className="text-center py-6 text-slate-500">Loading whitelist profiles...</div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No familiar faces registered yet. Use form above to add authorized staff.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profiles.map((p) => (
                  <div key={p.id} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.image_uri}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-700 bg-slate-900"
                        onError={(e) => { e.target.src = 'https://via.placeholder.com/40'; }}
                      />
                      <div>
                        <span className="font-bold text-white block text-xs">{p.name}</span>
                        <span className="text-[10px] text-emerald-400 block">{p.role}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                      title="Remove Staff Profile"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
