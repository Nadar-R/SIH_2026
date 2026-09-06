import React, { useState } from 'react';
import { Maximize2, RefreshCw, Eye, AlertTriangle } from 'lucide-react';

export default function LiveStream({ isOnline, onOpenZoneEditor }) {
  const [streamKey, setStreamKey] = useState(0);

  const handleRefreshStream = () => {
    setStreamKey(prev => prev + 1);
  };

  return (
    <div className="relative glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col h-full min-h-[420px]">
      
      {/* Stream Header Control Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-950/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3 py-1 rounded-full text-xs font-mono">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 pulse-dot' : 'bg-rose-500'}`} />
            <span className="text-slate-200 font-semibold tracking-wider">LIVE FEED #1</span>
          </div>

          <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
            AI OVERLAY ACTIVE
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenZoneEditor}
            className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-purple-400 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all"
            title="Configure Virtual Fence Polygon"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>DRAW ZONE</span>
          </button>

          <button
            onClick={handleRefreshStream}
            className="p-2 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-lg transition-all"
            title="Reconnect Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full min-h-[380px] bg-slate-950 flex items-center justify-center overflow-hidden">
        {isOnline ? (
          <img
            key={streamKey}
            src={window.location.port === '3000' ? `http://${window.location.hostname}:8000/video_feed?key=${streamKey}` : `/video_feed?key=${streamKey}`}
            alt="IBVAP Live AI CCTV Feed"
            className="w-full h-full object-contain max-h-[640px]"
            onError={() => {
              // Retry stream on transient error
              setTimeout(() => setStreamKey(k => k + 1), 2000);
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">Video Stream Offline</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              The camera stream could not be reached. Please check camera connections or select another source.
            </p>
            <button
              onClick={handleRefreshStream}
              className="mt-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 rounded-xl text-xs font-semibold font-mono transition-all"
            >
              RETRY CONNECTION
            </button>
          </div>
        )}
      </div>

      {/* Footer Info HUD */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div>
          STREAM: <span className="text-slate-200 font-semibold">MJPEG/H.264</span>
        </div>
        <div className="flex items-center gap-4">
          <span>MODEL: <span className="text-cyan-400">YOLOv8n-COCO</span></span>
          <span>TRACKER: <span className="text-purple-400">ByteTrack</span></span>
        </div>
      </div>

    </div>
  );
}
