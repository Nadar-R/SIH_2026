import React, { useState, useRef } from 'react';
import { Camera, Edit3, RefreshCw, AlertTriangle, Play, Pause, Maximize2, HardDrive, Globe, Users, Car, Bike, Bus, Truck, Cpu, ShieldCheck } from 'lucide-react';
import AlertRail from './AlertRail';

export default function LiveMonitoringTab({
  health,
  activeAlerts,
  onAcknowledge,
  onViewEvidence,
  onSwitchSource,
  onPlayPause,
  onSeek,
  onGoToZoneDrawer,
  onOpenWhitelistModal
}) {
  const [streamKey, setStreamKey] = useState(0);
  const containerRef = useRef(null);

  const isOnline = health?.camera_status === 'ONLINE';
  const videoMode = health?.playback?.video_mode || 'webcam';
  const isPaused = health?.playback?.is_paused || false;
  const currentSec = health?.playback?.current_sec || 0;
  const durationSec = health?.playback?.duration_sec || 0;
  const isFile = health?.playback?.is_file || videoMode === 'file';
  
  const entityCounts = health?.entity_counts || {};
  const activeTracksCount = health?.active_tracks || 0;

  const [selectedWebcamIndex, setSelectedWebcamIndex] = useState(health?.current_source || '0');

  const handleWebcamChange = async (e) => {
    const val = e.target.value;
    setSelectedWebcamIndex(val);
    await onSwitchSource(val);
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Inline Toolbar Above Stream */}
      <div className="glass-panel p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        
        {videoMode === 'webcam' ? (
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Active Camera Source:</span>
            <select
              value={selectedWebcamIndex}
              onChange={handleWebcamChange}
              className="bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-cyan-700 dark:text-cyan-400 font-bold px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500 shadow-sm"
            >
              <option value="0">💻 Inbuilt System Webcam (Device #0)</option>
              <option value="1">📷 External USB Webcam (Device #1)</option>
              <option value="2">📷 Secondary USB Camera (Device #2)</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-bold">
            {videoMode === 'file' ? <HardDrive className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
            <span className="truncate max-w-md">
              {videoMode === 'file' ? `📁 Local Video File: ${health?.current_source}` : `🌐 Real RTSP Stream: ${health?.current_source}`}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenWhitelistModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition-all shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>WHITELIST STAFF MANAGER</span>
          </button>

          <button
            onClick={onGoToZoneDrawer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-500/20 transition-all shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>DRAW VIRTUAL FENCE ZONE</span>
          </button>

          <button
            onClick={() => setStreamKey(k => k + 1)}
            className="p-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all"
            title="Reconnect Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Main Grid: Stream Player + Live Alert Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-4">
          
          {/* Stream Player Container */}
          <div
            ref={containerRef}
            className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col min-h-[440px] relative group"
          >
            
            {/* Header Bar overlay */}
            <div className="px-4 py-2.5 bg-slate-900/90 dark:bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 pulse-dot' : 'bg-rose-500'}`} />
                <span className="text-white font-bold">LIVE STREAM FEED #1</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-semibold text-[11px]">YOLOv8 + ByteTrack</span>
                <button
                  onClick={handleFullscreenToggle}
                  className="p-1 text-slate-400 hover:text-white rounded transition-all"
                  title="Toggle Fullscreen Mode"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Clean Video Frame */}
            <div className="relative w-full flex-1 bg-slate-950 flex items-center justify-center overflow-hidden min-h-[380px]">
              {isOnline ? (
                <img
                  key={streamKey}
                  src={`/video_feed?key=${streamKey}`}
                  alt="IBVAP Live AI CCTV Stream"
                  className="w-full h-full object-contain max-h-[640px]"
                  onError={() => setTimeout(() => setStreamKey(k => k + 1), 2000)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <h3 className="text-sm font-bold text-white font-heading">Camera Stream Offline</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Unable to connect to camera source. Verify URL or device index in Camera Sources tab.
                  </p>
                  <button
                    onClick={() => setStreamKey(k => k + 1)}
                    className="mt-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded-xl text-xs font-mono font-bold transition-all"
                  >
                    RECONNECT STREAM
                  </button>
                </div>
              )}
            </div>

            {/* Player Controls Bar */}
            <div className="px-4 py-3 bg-slate-900/95 dark:bg-slate-950/95 border-t border-slate-800/80 font-mono text-xs space-y-2">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={onPlayPause}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 dark:bg-slate-900 hover:bg-slate-700 dark:hover:bg-slate-800 border border-slate-700 text-cyan-400 rounded-xl font-bold transition-all"
                >
                  {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
                  <span>{isPaused ? 'PLAY' : 'PAUSE'}</span>
                </button>

                <button
                  onClick={handleFullscreenToggle}
                  className="p-1.5 bg-slate-800 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
                  title="Fullscreen Stream"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                <div className="text-[11px] text-slate-400">
                  FPS: <span className="text-emerald-400 font-bold">{health?.fps || 0}</span> | LATENCY: <span className="text-amber-400 font-bold">{health?.latency_ms || 0}ms</span>
                </div>
              </div>

              {/* Interactive Video Seek Bar */}
              {isFile && durationSec > 0 && (
                <div className="pt-2 border-t border-slate-800/60 flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">{formatTime(currentSec)}</span>
                  <input
                    type="range"
                    min={0}
                    max={durationSec}
                    step={0.5}
                    value={currentSec}
                    onChange={(e) => onSeek(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 rounded-lg bg-slate-800"
                  />
                  <span className="text-[11px] text-slate-400">{formatTime(durationSec)}</span>
                </div>
              )}
            </div>

          </div>

          {/* Active Detected Entities Breakdown Panel */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-slate-900 dark:text-white font-heading">Active Detected Entities Breakdown</h3>
              </div>
              <span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-bold">
                {activeTracksCount} ENTITIES TRACKED
              </span>
            </div>

            {/* Category Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-1">
              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">PERSON</span>
                </div>
                <span className="font-bold text-rose-600 dark:text-rose-400 text-sm">{entityCounts["person"] || 0}</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                  <Car className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">CAR</span>
                </div>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{entityCounts["car"] || 0}</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Bike className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">BIKE</span>
                </div>
                <span className="font-bold text-yellow-600 dark:text-yellow-400 text-sm">{entityCounts["motorcycle"] || 0}</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Bus className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">BUS</span>
                </div>
                <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">{entityCounts["bus"] || 0}</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Truck className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">TRUCK</span>
                </div>
                <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">{entityCounts["truck"] || 0}</span>
              </div>

              <div className="bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                  <Bike className="w-4 h-4" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">BICYCLE</span>
                </div>
                <span className="font-bold text-cyan-600 dark:text-cyan-400 text-sm">{entityCounts["bicycle"] || 0}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Live Alert Rail */}
        <div className="lg:col-span-1">
          <AlertRail
            alerts={activeAlerts}
            onAcknowledge={onAcknowledge}
            onViewEvidence={onViewEvidence}
          />
        </div>

      </div>

    </div>
  );
}
