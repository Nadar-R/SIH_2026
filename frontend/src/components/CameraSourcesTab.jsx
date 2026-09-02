import React, { useState, useRef } from 'react';
import { Camera, HardDrive, Globe, Check, RefreshCw, Upload, AlertCircle, Info } from 'lucide-react';

export default function CameraSourcesTab({ currentSource, onSwitchSource, onUploadFile }) {
  const [selectedType, setSelectedType] = useState('webcam'); // 'webcam', 'file', 'rtsp'
  const [webcamIndex, setWebcamIndex] = useState('0');
  const [rtspUrl, setRtspUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      if (selectedType === 'webcam') {
        await onSwitchSource(webcamIndex);
        setStatusMsg(`Active source updated to USB Webcam Device #${webcamIndex}`);
      } else if (selectedType === 'file') {
        if (!selectedFile) {
          alert("Please select a local video file first.");
          setLoading(false);
          return;
        }
        await onUploadFile(selectedFile);
        setStatusMsg(`Uploaded & Playing: ${selectedFile.name}`);
      } else if (selectedType === 'rtsp') {
        const url = rtspUrl.trim();
        if (!url) {
          alert("Please enter a valid RTSP URL.");
          setLoading(false);
          return;
        }

        if (url.includes("windy.com") || (url.startsWith("http") && !url.includes(".m3u8") && !url.includes(".mp4"))) {
          setErrorMsg("Note: Webpage URLs (like windy.com or html embeds) are HTML websites, not raw video streams. OpenCV requires raw RTSP (rtsp://...) or direct stream URLs (.m3u8).");
        }

        const res = await onSwitchSource(url);
        if (res && res.status === "SUCCESS") {
          setStatusMsg(`RTSP stream connected successfully: ${url}`);
        }
      }
    } catch (err) {
      console.error("Failed to set camera source:", err);
      setErrorMsg(err.message || 'Unable to connect to stream URL. Please ensure it is a valid RTSP stream (rtsp://...).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading text-white">Camera Input Sources Setup</h2>
            <p className="text-xs font-mono text-slate-400">Configure video feeds from Connected USB Webcams, GUI Local Video Files, or Real RTSP IP CCTV Cameras</p>
          </div>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
        
        {/* Source Type Selector */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
          <button
            type="button"
            onClick={() => setSelectedType('webcam')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              selectedType === 'webcam'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-6 h-6" />
            <span>USB WEBCAM</span>
            <span className="text-[10px] text-slate-400 font-normal">System Inbuilt (#0) or USB Webcams</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('file')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              selectedType === 'file'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <HardDrive className="w-6 h-6" />
            <span>GUI FILE PICKER</span>
            <span className="text-[10px] text-slate-400 font-normal">Select test MP4 / MKV video file</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('rtsp')}
            className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              selectedType === 'rtsp'
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-6 h-6" />
            <span>REAL RTSP STREAM</span>
            <span className="text-[10px] text-slate-400 font-normal">Connect live network RTSP CCTV URL</span>
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-slate-800">
          
          {selectedType === 'webcam' && (
            <div className="space-y-3 font-mono text-xs">
              <label className="text-slate-300 font-semibold block">Select Connected Camera Device</label>
              <select
                value={webcamIndex}
                onChange={(e) => setWebcamIndex(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value="0">💻 Inbuilt System Webcam (Device #0)</option>
                <option value="1">📷 External USB Webcam (Device #1)</option>
                <option value="2">📷 Secondary USB Camera (Device #2)</option>
              </select>
            </div>
          )}

          {selectedType === 'file' && (
            <div className="space-y-3 font-mono text-xs">
              <label className="text-slate-300 font-semibold block">Choose Video File from Computer</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950/80 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all hover:bg-slate-900/60"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/mkv,video/avi"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl">
                  <Upload className="w-6 h-6" />
                </div>
                {selectedFile ? (
                  <div className="text-center">
                    <span className="font-bold text-white block text-sm">{selectedFile.name}</span>
                    <span className="text-[11px] text-cyan-400">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to stream</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <span className="font-bold text-slate-200 block text-sm">Click to Browse or Drag & Drop Video File</span>
                    <span className="text-[11px] text-slate-400">Supports MP4, MKV, AVI test files</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedType === 'rtsp' && (
            <div className="space-y-3 font-mono text-xs">
              <label className="text-slate-300 font-semibold block">Real RTSP / Live Stream Stream URL</label>
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://admin:password@192.168.1.100:554/live"
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-cyan-500"
                required
              />
              
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <Info className="w-3.5 h-3.5" />
                  <span>RTSP Stream Format Guide</span>
                </div>
                <p>Must be a direct RTSP feed (e.g. <code className="text-slate-200">rtsp://admin:pass@192.168.1.100:554/stream1</code>) or HLS stream link (<code className="text-slate-200">.m3u8</code>).</p>
                <p className="text-amber-400/90">Webpage links (like windy.com or html embeds) are website pages, not raw video streams.</p>
              </div>
            </div>
          )}

          {statusMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl font-mono text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl font-mono text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl font-mono text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>CONNECTING CAMERA STREAM...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>APPLY CAMERA SOURCE</span>
              </>
            )}
          </button>

        </form>

      </div>
    </div>
  );
}
