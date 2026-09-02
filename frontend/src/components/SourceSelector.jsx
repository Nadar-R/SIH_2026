import React, { useState } from 'react';
import { Camera, HardDrive, Globe, X, Check, RefreshCw } from 'lucide-react';

export default function SourceSelector({ isOpen, onClose, currentSource, onSwitchSource }) {
  const [selectedType, setSelectedType] = useState('webcam'); // 'webcam', 'file', 'rtsp'
  const [webcamIndex, setWebcamIndex] = useState('0');
  const [filePath, setFilePath] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    let targetSource = '0';
    if (selectedType === 'webcam') {
      targetSource = webcamIndex;
    } else if (selectedType === 'file') {
      targetSource = filePath.trim();
    } else if (selectedType === 'rtsp') {
      targetSource = rtspUrl.trim();
    }

    try {
      await onSwitchSource(targetSource);
      onClose();
    } catch (err) {
      console.error("Failed to switch video source:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg glass-panel-glow rounded-2xl border border-slate-700/80 p-6 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold font-heading text-white">Select Video Input Source</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          
          {/* Source Type Selector Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/80 border border-slate-800 rounded-xl font-mono text-xs">
            <button
              type="button"
              onClick={() => setSelectedType('webcam')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all ${
                selectedType === 'webcam'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>USB WEBCAM</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('file')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all ${
                selectedType === 'file'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>LOCAL FILE</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedType('rtsp')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold transition-all ${
                selectedType === 'rtsp'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>RTSP STREAM</span>
            </button>
          </div>

          {/* Source Inputs */}
          {selectedType === 'webcam' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 font-mono">Select Connected Camera Device</label>
              <select
                value={webcamIndex}
                onChange={(e) => setWebcamIndex(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="0">Camera Device #0 (Default Integrated / USB Webcam)</option>
                <option value="1">Camera Device #1 (External USB Camera)</option>
                <option value="2">Camera Device #2 (Secondary Camera)</option>
              </select>
            </div>
          )}

          {selectedType === 'file' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 font-mono">Local Test Video File Path</label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="C:/Users/Rajat/Desktop/border_test_clip.mp4"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-cyan-500"
                required
              />
              <p className="text-[11px] text-slate-400 font-mono">
                Provide absolute file path to MP4, AVI, or MKV test clip on your machine.
              </p>
            </div>
          )}

          {selectedType === 'rtsp' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 font-mono">RTSP / HTTP IP Camera Stream URL</label>
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.100:554/live"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs font-mono tracking-wider shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>SWITCHING...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>APPLY STREAM SOURCE</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
