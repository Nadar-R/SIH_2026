import React from 'react';
import { AlertTriangle, CheckCircle, Eye, ShieldAlert, Clock } from 'lucide-react';

export default function AlertRail({ alerts, onAcknowledge, onViewEvidence }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="p-3 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 mb-3">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300 font-heading">Sector Perimeter Secure</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          No virtual fence intrusion violations detected. Watching active feeds continuously...
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col h-full max-h-[640px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 animate-pulse" />
          <h3 className="text-sm font-bold font-heading text-white">Live Intrusion Alerts</h3>
        </div>
        <span className="text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
          {alerts.length} ACTIVE
        </span>
      </div>

      {/* Alert Feed List */}
      <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
        {alerts.map((alert) => {
          const isUnack = alert.status === 'NEW';
          const timeStr = new Date(alert.timestamp * 1000).toLocaleTimeString();

          return (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border transition-all duration-300 ${
                isUnack
                  ? 'bg-rose-950/40 border-rose-500/40 shadow-lg shadow-rose-500/10 animate-fadeIn'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase text-white bg-slate-900 border border-slate-700 px-2 py-0.5 rounded">
                    {alert.object_type} #{alert.track_id}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 font-semibold">
                    {Math.round(alert.confidence * 100)}% CONF
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>{timeStr}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 font-semibold mt-2">
                Virtual Fence Intrusion Detected
              </p>

              {alert.evidence_uri && (
                <div
                  className="relative mt-2.5 rounded-lg overflow-hidden border border-slate-800 group cursor-pointer"
                  onClick={() => onViewEvidence(alert)}
                >
                  <img
                    src={alert.evidence_uri}
                    alt="Evidence Snapshot"
                    className="w-full h-24 object-cover group-hover:scale-105 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100">
                    <span className="flex items-center gap-1 bg-slate-900/90 text-cyan-400 text-[11px] font-mono px-2.5 py-1 rounded-lg border border-cyan-500/30">
                      <Eye className="w-3 h-3" /> INSPECT EVIDENCE
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800/60 font-mono text-xs">
                {isUnack ? (
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold rounded-lg transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>ACKNOWLEDGE ALERT</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>ACKNOWLEDGED ({alert.acknowledged_by || 'OPERATOR'})</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
