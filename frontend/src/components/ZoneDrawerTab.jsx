import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Plus, Trash2, Check, Undo, Shield, Info, AlertTriangle } from 'lucide-react';

export default function ZoneDrawerTab({ activeZones, onSaveZone, onDeleteZone }) {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [zoneName, setZoneName] = useState('Restricted Border Zone');
  const [minConfidence, setMinConfidence] = useState(0.40);
  const [cooldownSeconds, setCooldownSeconds] = useState(5);
  const [severity, setSeverity] = useState('HIGH');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

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
  }, [activeZones]);

  // Redraw polygon canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

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

      // Draw point node handles
      points.forEach((p, idx) => {
        const px = p[0] * width;
        const py = p[1] * height;
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, 2 * Math.PI);
        ctx.fillStyle = '#00F2FE';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`P${idx + 1}`, px + 10, py - 4);
      });
    }
  }, [points]);

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
    setSaveSuccessMsg('');
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
      setSaveSuccessMsg('Virtual fence zone successfully updated and activated!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error saving zone:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Step-by-Step Instructions Banner */}
      <div className="glass-panel p-4 rounded-2xl border border-purple-500/30 bg-purple-500/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-purple-200">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
          <div>
            <strong className="text-white block font-heading text-sm">Interactive Virtual Fence Polygon Drawer</strong>
            <span>Step 1: Click on the camera canvas to place boundary points (P1, P2, P3) $\rightarrow$ Step 2: Set parameters $\rightarrow$ Step 3: Click Save Zone.</span>
          </div>
        </div>
        {saveSuccessMsg && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold animate-fadeIn">
            {saveSuccessMsg}
          </div>
        )}
      </div>

      {/* Main Grid: Interactive Canvas (2/3 width) + Rule Settings & Active Zones (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Canvas Frame */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between font-mono text-xs text-slate-300">
            <span className="font-bold text-white">CAMERA CANVAS VIEW</span>
            <span>POLYGON POINTS: <strong className="text-cyan-400 font-bold">{points.length}</strong></span>
          </div>

          <div className="relative w-full aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-700 shadow-inner flex items-center justify-center">
            <img
              src="/video_feed"
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

          {/* Canvas Controls */}
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="text-slate-400 text-[11px]">Click anywhere on the image to add polygon boundary points.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUndo}
                disabled={points.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl disabled:opacity-40 transition-all"
              >
                <Undo className="w-3.5 h-3.5" />
                <span>UNDO NODE</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={points.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 rounded-xl disabled:opacity-40 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CLEAR ALL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Rule Parameters & Active Zones List */}
        <div className="space-y-6">
          
          {/* Rule Parameters Card */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 font-mono text-xs">
            <h3 className="font-bold text-white uppercase text-sm border-b border-slate-800 pb-2">Fence Configuration</h3>

            <div className="space-y-1.5">
              <label className="text-slate-300">Zone Name</label>
              <input
                type="text"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">Min Confidence Threshold ({Math.round(minConfidence*100)}%)</label>
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
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300">Alert Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 mt-2"
            >
              <Check className="w-4 h-4" />
              <span>SAVE VIRTUAL FENCE ZONE</span>
            </button>
          </div>

          {/* Active Zones List Card */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 font-mono text-xs space-y-3">
            <h3 className="font-bold text-white uppercase text-sm border-b border-slate-800 pb-2">Active Border Zones</h3>
            {activeZones && activeZones.length > 0 ? (
              activeZones.map(z => (
                <div key={z.id} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">{z.name}</span>
                    <span className="text-[11px] text-slate-400">{z.polygon?.length || 0} Points | Cooldown: {z.cooldown_seconds}s</span>
                  </div>
                  <button
                    onClick={() => onDeleteZone(z.id)}
                    className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete Zone"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-[11px]">No active zones defined yet.</p>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
