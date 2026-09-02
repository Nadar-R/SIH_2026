import React, { useState } from 'react';
import { Search, Download, Eye } from 'lucide-react';

export default function EventHistory({ events, onAcknowledge, onViewEvidence }) {
  const [filterObject, setFilterObject] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = (events || []).filter(evt => {
    if (filterObject !== 'ALL' && evt.object_type.toUpperCase() !== filterObject) return false;
    if (filterStatus !== 'ALL' && evt.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = evt.id.toLowerCase().includes(term);
      const matchObj = evt.object_type.toLowerCase().includes(term);
      const matchTrack = String(evt.track_id).includes(term);
      if (!matchId && !matchObj && !matchTrack) return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!filteredEvents || filteredEvents.length === 0) return;

    const headers = ['Event ID', 'Timestamp', 'Object Type', 'Track ID', 'Confidence', 'Rule ID', 'Status', 'Acknowledged By'];
    const rows = filteredEvents.map(e => [
      e.id,
      new Date(e.timestamp * 1000).toISOString(),
      e.object_type,
      e.track_id,
      `${Math.round(e.confidence * 100)}%`,
      e.rule_id,
      e.status,
      e.acknowledged_by || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ibvap_event_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold font-heading text-white">Security Event Audit History</h3>
          <p className="text-xs text-slate-400">Auditable log of logged intrusion breaches and camera events</p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search Track / Object / ID..."
              className="bg-slate-950 border border-slate-800 text-slate-200 pl-8 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filterObject}
            onChange={(e) => setFilterObject(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">ALL OBJECTS</option>
            <option value="PERSON">PERSON</option>
            <option value="CAR">CAR</option>
            <option value="MOTORCYCLE">MOTORCYCLE</option>
            <option value="BUS">BUS</option>
            <option value="TRUCK">TRUCK</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">ALL STATUS</option>
            <option value="NEW">NEW / UNACK</option>
            <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Events Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase bg-slate-950/60">
              <th className="py-3 px-4">Event ID</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Object Class</th>
              <th className="py-3 px-4">Track ID</th>
              <th className="py-3 px-4">Confidence</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Evidence</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-500">
                  No matching intrusion events found in audit database.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => {
                const isNew = evt.status === 'NEW';
                const dateStr = new Date(evt.timestamp * 1000).toLocaleString();

                return (
                  <tr key={evt.id} className="hover:bg-slate-900/60 transition-all">
                    <td className="py-3 px-4 font-semibold text-slate-300 truncate max-w-[120px]">{evt.id}</td>
                    <td className="py-3 px-4 text-slate-400">{dateStr}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 border border-slate-700 text-white uppercase">
                        {evt.object_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-purple-400 font-bold">#{evt.track_id}</td>
                    <td className="py-3 px-4 text-cyan-400">{Math.round(evt.confidence * 100)}%</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isNew ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onViewEvidence(evt)}
                        className="flex items-center gap-1 text-cyan-400 hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>VIEW JPEG</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isNew ? (
                        <button
                          onClick={() => onAcknowledge(evt.id)}
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-bold transition-all"
                        >
                          ACK
                        </button>
                      ) : (
                        <span className="text-slate-500 text-[11px]">ACKNOWLEDGED</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
