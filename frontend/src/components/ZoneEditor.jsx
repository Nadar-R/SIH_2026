import React, { useState, useEffect, useRef } from 'react';
import { Eye, Plus, Trash2, Check, X, Undo, Shield, RefreshCw } from 'lucide-react';

export default function ZoneEditor({ isOpen, onClose, activeZones, onSaveZone, onDeleteZone }) {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [snapshotTime, setSnapshotTime] = useState(() => Date.now());
  const [zoneName, setZoneName] = useState('Restricted Border Zone');
  const [minConfidence, setMinConfidence] = useState(0.40);
  const [cooldownSeconds, setCooldownSeconds] = useState(5);
  const [severity, setSeverity] = useState('HIGH');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSnapshotTime(Date.now());
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeZones && activeZones.length > 0) {
      const z = activeZones[0];
      setZoneName(z.name || 'Restricted Border Zone');
      setMinConfidence(z.min_confidence || 0.40);
      setCooldownSeconds(z.cooldown_seconds || 5);
      setSeverity(z.severity || 'HIGH');
      if (z.polygon && z.polygon.length > 0) {
        setPoints(z.polygon);
      }
    }
  }, [activeZones, isOpen]);

  // Redraw polygon canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw active polygon
    if (points.length > 0) {
      ctx.beginPath();
      points.forEach((p, idx) => {
        const px = p[0] * width;
        const py = p[1] * height;
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });

      if (points.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 42, 109, 0.25)';
        ctx.fill();
      }

      ctx.strokeStyle = '#FF2A6D';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw point handles
      points.forEach((p, idx) => {
        const px = p[0] * width;
        const py = p[1] * height;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fillStyle = '#00F2FE';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label node index
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`P${idx + 1}`, px + 8, py - 4);
      });
    }
  }, [points, isOpen]);

  if (!isOpen) return null;

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setPoints(prev => [...prev, [round(x), round(y)]]);
  };

  const round = (val) => Math.round(val * 1000) / 1000;

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, prev.length - 1));
  };

  const handleClear = () => {
    setPoints([]);
  };

  const handleSave = async () => {
    if (points.length < 3) {
      alert("A polygon virtual fence requires at least 3 boundary points.");
      return;
    }

    setIsSaving(true);
    try {
      await onSaveZone({
        id: activeZones && activeZones.length > 0 ? activeZones[0].id : 'vf-bop-01',
        camera_id: 'cam-bop-01',
        name: zoneName,
        geometry_type: 'polygon',
        polygon: points,
        min_confidence: parseFloat(minConfidence),
        min_frames: 2,
        cooldown_seconds: parseInt(cooldownSeconds),
        severity: severity,
        enabled: true
      });
      onClose();
    } catch (err) {
      console.error("Error saving zone:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-4xl glass-panel-glow rounded-2xl border border-slate-700/80 p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-bold font-heading text-white">Interactive Polygon Virtual Fence Editor</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas & Controls Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-5 overflow-y-auto">
          
          {/* Left / Top: Canvas Frame */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-xs font-mono text-cyan-400">
              Click anywhere on the canvas frame below to place boundary points. Connect at least 3 points to enclose a protected zone.
            </p>
            
            <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
              <img
                src={`/api/v1/snapshot?t=${snapshotTime}`}
                alt="Camera Frame Reference"
                className="absolute inset-0 w-full h-full object-cover opacity-60"
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={360}
                onClick={handleCanvasClick}
                className="relative z-10 w-full h-full cursor-crosshair"
              />
            </div>

            {/* Canvas Toolbar */}
            <div className="flex items-center justify-between font-mono text-xs text-slate-400">
              <button
                type="button"
                onClick={() => setSnapshotTime(Date.now())}
                className="flex items-center gap-1 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded-lg transition-all"
                title="Refresh Reference Frame"
              >
                <RefreshCw className="w-3 h-3" />
                <span>REFRESH FRAME</span>
              </button>
              <span>POINTS CREATED: <strong className="text-white">{points.length}</strong></span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={points.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg disabled:opacity-40 transition-all"
                >
                  <Undo className="w-3.5 h-3.5" />
                  <span>UNDO POINT</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={points.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-lg disabled:opacity-40 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>CLEAR ALL</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Zone Settings */}
          <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono text-xs">
            <h3 className="font-bold text-white uppercase text-sm border-b border-slate-800 pb-2">Rule Parameters</h3>

            <div className="space-y-1.5">
              <label className="text-slate-300">Zone Name</label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">Min Confidence Threshold ({int(minConfidence*100)}%)</label>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.05"
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
                className="w-full accent-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">Alert Cooldown (Seconds)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={cooldownSeconds}
                onChange={(e) => setCooldownSeconds(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">Alert Severity Level</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
              </select>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>SAVE VIRTUAL FENCE ZONE</span>
              </button>

              {activeZones && activeZones.length > 0 && (
                <button
                  type="button"
                  onClick={() => onDeleteZone(activeZones[0].id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>DELETE EXISTING ZONE</span>
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

function int(val) {
  return Math.round(val);
}
