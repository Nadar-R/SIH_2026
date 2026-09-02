import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import LiveMonitoringTab from './components/LiveMonitoringTab';
import ZoneDrawerTab from './components/ZoneDrawerTab';
import CameraSourcesTab from './components/CameraSourcesTab';
import EventLogsTab from './components/EventLogsTab';
import EvidenceModal from './components/EvidenceModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [health, setHealth] = useState(null);
  const [zones, setZones] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [selectedEvidenceEvent, setSelectedEvidenceEvent] = useState(null);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const wsRef = useRef(null);

  const playAlertSound = () => {
    if (!audioEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio playback context error:", e);
    }
  };

  const fetchData = async () => {
    try {
      const [hRes, zRes, eRes] = await Promise.all([
        fetch('/api/v1/health').then(r => r.json()),
        fetch('/api/v1/zones').then(r => r.json()),
        fetch('/api/v1/events?limit=50').then(r => r.json())
      ]);

      setHealth(hRes);
      setZones(zRes);
      setEvents(eRes);
      setActiveAlerts(eRes.filter(e => e.status === 'NEW'));
    } catch (err) {
      console.error("Error fetching system state:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 1000); // Polling health telemetry every 1s for smooth seek bar & FPS
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/alerts`;
    
    const connectWS = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to IBVAP push alert channel.");
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === 'NEW_ALERT' && msg.data) {
            const newAlert = msg.data;
            playAlertSound();
            
            setActiveAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
            setEvents(prev => [newAlert, ...prev.filter(e => e.id !== newAlert.id)]);
          }
        } catch (e) {
          console.error("Error parsing WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWS, 3000);
      };
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [audioEnabled]);

  const handleSwitchSource = async (newSource) => {
    const res = await fetch('/api/v1/cameras/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ camera_id: 'cam-bop-01', source: newSource })
    }).then(r => r.json());

    fetchData();
    return res;
  };

  const handleUploadFile = async (fileObj) => {
    const formData = new FormData();
    formData.append('file', fileObj);

    const res = await fetch('/api/v1/cameras/upload', {
      method: 'POST',
      body: formData
    }).then(r => r.json());

    fetchData();
    setActiveTab('monitoring');
    return res;
  };

  const handlePlayPause = async () => {
    const res = await fetch('/api/v1/cameras/play_pause', { method: 'POST' }).then(r => r.json());
    fetchData();
    return res;
  };

  const handleSeek = async (targetSec) => {
    const res = await fetch('/api/v1/cameras/seek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_sec: targetSec })
    }).then(r => r.json());

    fetchData();
    return res;
  };

  const handleSaveZone = async (zonePayload) => {
    const res = await fetch('/api/v1/zones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(zonePayload)
    }).then(r => r.json());

    fetchData();
    return res;
  };

  const handleDeleteZone = async (zoneId) => {
    await fetch(`/api/v1/zones/${zoneId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAcknowledge = async (eventId) => {
    try {
      const updatedEvt = await fetch(`/api/v1/events/${eventId}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_name: 'Security-Operator-01' })
      }).then(r => r.json());

      setActiveAlerts(prev => prev.filter(a => a.id !== eventId));
      setEvents(prev => prev.map(e => e.id === eventId ? updatedEvt : e));
      if (selectedEvidenceEvent?.id === eventId) {
        setSelectedEvidenceEvent(updatedEvt);
      }
    } catch (err) {
      console.error("Error acknowledging alert:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19] text-slate-100 font-sans antialiased">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        audioEnabled={audioEnabled}
        toggleAudio={() => setAudioEnabled(!audioEnabled)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'monitoring' && (
          <LiveMonitoringTab
            health={health}
            activeAlerts={activeAlerts}
            onAcknowledge={handleAcknowledge}
            onViewEvidence={(evt) => setSelectedEvidenceEvent(evt)}
            onSwitchSource={handleSwitchSource}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onGoToZoneDrawer={() => setActiveTab('zone_drawer')}
          />
        )}

        {activeTab === 'zone_drawer' && (
          <ZoneDrawerTab
            activeZones={zones}
            onSaveZone={handleSaveZone}
            onDeleteZone={handleDeleteZone}
          />
        )}

        {activeTab === 'camera_sources' && (
          <CameraSourcesTab
            currentSource={health?.current_source}
            onSwitchSource={handleSwitchSource}
            onUploadFile={handleUploadFile}
          />
        )}

        {activeTab === 'event_logs' && (
          <EventLogsTab
            events={events}
            onAcknowledge={handleAcknowledge}
            onViewEvidence={(evt) => setSelectedEvidenceEvent(evt)}
          />
        )}
      </main>

      <EvidenceModal
        event={selectedEvidenceEvent}
        onClose={() => setSelectedEvidenceEvent(null)}
        onAcknowledge={handleAcknowledge}
      />

      <footer className="w-full border-t border-slate-900 py-4 px-6 text-center text-xs font-mono text-slate-500">
        IBVAP &copy; 2026 Intelligent Border Video Analytics Platform | SIH 2026 Software-Defined Surveillance Layer
      </footer>
    </div>
  );
}
