import React from 'react';
import { Shield, Monitor, Edit3, Camera, FileText, Activity, Zap, Bell, Sun, Moon, ShieldCheck } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, health, audioEnabled, toggleAudio, theme, toggleTheme, onOpenWhitelistModal }) {
  const isOnline = health?.camera_status === 'ONLINE';

  const tabs = [
    { id: 'monitoring', label: 'LIVE MONITORING', icon: Monitor },
    { id: 'zone_drawer', label: 'VIRTUAL FENCE DRAWER', icon: Edit3 },
    { id: 'camera_sources', label: 'CAMERA SOURCES', icon: Camera },
    { id: 'event_logs', label: 'EVENT AUDIT LOGS', icon: FileText },
  ];

  return (
    <header className="w-full glass-panel border-b border-slate-200 dark:border-slate-800/80 sticky top-0 z-50 backdrop-blur-md">
      {/* Top Telemetry & Brand Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/60">
        
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
            <div className="w-full h-full bg-slate-950 dark:bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold font-heading text-slate-900 dark:text-white tracking-wide">IBVAP</h1>
              <span className="text-[10px] font-semibold font-mono bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                AI SURVEILLANCE v1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">Intelligent Border Video Analytics Platform</p>
          </div>
        </div>

        {/* Live Telemetry Health Bar */}
        <div className="flex items-center gap-3 sm:gap-5 bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-xl font-mono text-xs">
          
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 dark:bg-emerald-400 pulse-dot' : 'bg-rose-500 pulse-red-dot'}`} />
            <span className="text-slate-800 dark:text-slate-200 font-bold">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-800" />

          {/* FPS Gauge */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-slate-500 dark:text-slate-400">FPS:</span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold">{health?.fps ?? 0}</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-slate-800" />

          {/* Latency Gauge */}
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="text-slate-500 dark:text-slate-400">LATENCY:</span>
            <span className="text-amber-600 dark:text-amber-400 font-bold">{health?.latency_ms ?? 0}ms</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 font-mono text-xs">

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold"
            title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">DARK</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">LIGHT</span>
              </>
            )}
          </button>

          {/* Unack Alerts Tally */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold ${
            (health?.unacknowledged_alerts ?? 0) > 0
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400 animate-pulse'
              : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400'
          }`}>
            <Bell className="w-3.5 h-3.5" />
            <span>{health?.unacknowledged_alerts ?? 0} UNACK</span>
          </div>

          {/* Audio Chime Toggle */}
          <button
            onClick={toggleAudio}
            className={`p-1.5 rounded-lg border transition-all ${
              audioEnabled
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400'
                : 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-400'
            }`}
            title={audioEnabled ? "Alert Chime Enabled" : "Alert Chime Muted"}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
        </div>

      </div>

      {/* Primary Workflow Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto py-2 font-mono text-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/40 shadow-md shadow-cyan-500/10'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
