import React from 'react';
import { X, CheckCircle, Download, ShieldAlert } from 'lucide-react';

export default function EvidenceModal({ event, onClose, onAcknowledge }) {
  if (!event) return null;

  const dateStr = new Date(event.timestamp * 1000).toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-3xl glass-panel-glow rounded-2xl border border-slate-700/80 p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="text-base font-bold font-heading text-white">Security Evidence Snapshot</h2>
              <p className="text-xs font-mono text-slate-400">EVENT ID: {event.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Evidence Image */}
        <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-inner">
          {event.evidence_uri ? (
            <img
              src={event.evidence_uri}
              alt="Evidence Snapshot"
              className="w-full h-full object-contain"
            />
          ) : (
            <p className="text-xs font-mono text-slate-500">No snapshot image attached.</p>
          )}
        </div>

        {/* Event Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">DATE & TIME</span>
            <span className="text-white font-semibold">{dateStr}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">OBJECT CLASS</span>
            <span className="text-cyan-400 font-semibold uppercase">{event.object_type} #{event.track_id}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">CONFIDENCE</span>
            <span className="text-emerald-400 font-semibold">{Math.round(event.confidence * 100)}%</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">STATUS</span>
            <span className={`font-semibold ${event.status === 'NEW' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {event.status}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2">
          <a
            href={event.evidence_uri}
            download={`evidence_${event.id}.jpg`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl text-xs font-mono hover:bg-slate-800 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>DOWNLOAD JPEG EVIDENCE</span>
          </a>

          {event.status === 'NEW' && (
            <button
              onClick={() => {
                onAcknowledge(event.id);
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs font-mono transition-all shadow-lg shadow-emerald-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              <span>ACKNOWLEDGE BREACH</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
