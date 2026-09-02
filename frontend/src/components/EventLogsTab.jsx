import React from 'react';
import EventHistory from './EventHistory';

export default function EventLogsTab({ events, onAcknowledge, onViewEvidence }) {
  return (
    <div className="space-y-6">
      <EventHistory
        events={events}
        onAcknowledge={onAcknowledge}
        onViewEvidence={onViewEvidence}
      />
    </div>
  );
}
