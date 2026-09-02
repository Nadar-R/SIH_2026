import React from 'react';
import { Shield, Activity, Camera, Cpu, Radio, Bell, Settings, Zap } from 'lucide-react';

export default function HealthBar({ health, onOpenSourceSelector, onOpenZoneEditor, audioEnabled, toggleAudio }) {
  const isOnline = health?.camera_status === 'ONLINE';
  const sourceText = health?.current_source === '0' ? 'USB WEBCAM (INDEX 0)' : (health?.current_source || 'DEFAULT CAMERA');

  return (
    <header className="w-full glass-panel border-b border-slate-800/80 px-4 py-3 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Brand / System Identifier */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-heading tracking-wide text-white">IBVAP</h1>
              <span className="text-[10px] font-semibold font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                BORDER AI v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Intelligent Border Video Analytics Platform</p>
          </div>
        </div>

        {/* Center: Live Telemetry Gauges */}
        <div className="flex items-center gap-3 sm:gap-6 bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl font-mono text-xs">
          
          {/* Stream Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 pulse-dot' : 'bg-rose-500 pulse-red-dot'}`} />
            <span className="text-slate-300 font-semibold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Active Source */}
          <div className="hidden md:flex items-center gap-1.5 text-slate-400">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-200 truncate max-w-[140px]" title={sourceText}>{sourceText}</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* FPS Gauge */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">FPS:</span>
            <span className="text-cyan-400 font-bold">{health?.fps ?? 0}</span>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Latency Gauge */}
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">LATENCY:</span>
            <span className="text-amber-400 font-bold">{health?.latency_ms ?? 0}ms</span>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden lg:block" />

          {/* Active Tracks */}
          <div className="hidden lg:flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">TRACKS:</span>
            <span className="text-purple-400 font-bold">{health?.active_tracks ?? 0}</span>
          </div>
        </div>

        {/* Right: Actions & Alerts Indicator */}
        <div className="flex items-center gap-3">
          
          {/* WebSocket Status */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">WS PUSH</span>
          </div>

          {/* Unacknowledged Alert Count */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
            (health?.unacknowledged_alerts ?? 0) > 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
              : 'bg-slate-900 border-slate-800 text-slate-400'
          }`}>
            <Bell className="w-3.5 h-3.5" />
            <span>{health?.unacknowledged_alerts ?? 0} UNACK</span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg border text-xs font-medium transition-all ${
              audioEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={audioEnabled ? "Alert Sound Enabled" : "Alert Sound Muted"}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>

          {/* Source Switcher Button */}
          <button
            onClick={onOpenSourceSelector}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all shadow-sm"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>CAMERA SOURCE</span>
          </button>

          {/* Zone Editor Button */}
          <button
            onClick={onOpenZoneEditor}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20 transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>EDIT ZONES</span>
          </button>

        </div>

      </div>
    </header>
  );
}
