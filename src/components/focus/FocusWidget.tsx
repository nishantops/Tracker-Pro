import { useState } from 'react';
import { useFocus, formatDuration, formatDurationShort } from '../../hooks/useFocus';
import { useToast } from '../common/Toast';

export function FocusWidget() {
  const { active, elapsed, history, todayTotal, weekTotal, start, stop } = useFocus();
  const { showToast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);

  const handleToggle = async () => {
    if (active) {
      const dur = await stop();
      if (dur) showToast(`Session saved: ${formatDuration(dur)}`, 'success');
    } else {
      await start();
      showToast('Focus mode started!', 'info');
    }
  };

  return (
    <>
      {/* Compact widget in header */}
      <button
        className={`focus-widget ${active ? 'focus-active' : ''}`}
        onClick={() => setPanelOpen((o) => !o)}
        title="Focus Mode"
      >
        <span className="focus-icon">🎯</span>
        <span className="focus-timer-mini">
          {active ? formatDuration(elapsed) : 'FOCUS'}
        </span>
      </button>

      {/* Panel */}
      {panelOpen && (
        <div className="focus-panel" onClick={(e) => e.stopPropagation()}>
          <div className="focus-panel-header">
            <h3>Focus Mode</h3>
            <button className="modal-close" onClick={() => setPanelOpen(false)}>×</button>
          </div>

          <div className="focus-big-timer">{formatDuration(active ? elapsed : 0)}</div>

          <button
            className={`focus-toggle-btn ${active ? 'focus-stop' : 'focus-start'}`}
            onClick={handleToggle}
          >
            {active ? 'STOP SESSION' : 'START SESSION'}
          </button>

          <div className="focus-stats">
            <div className="focus-stat">
              <span className="focus-stat-label">Today</span>
              <span className="focus-stat-value">{formatDurationShort(todayTotal)}</span>
            </div>
            <div className="focus-stat">
              <span className="focus-stat-label">This Week</span>
              <span className="focus-stat-value">{formatDurationShort(weekTotal)}</span>
            </div>
          </div>

          {history.length > 0 && (
            <div className="focus-history">
              <h4 className="focus-hist-title">Recent Sessions</h4>
              {history.slice(0, 10).map((s) => (
                <div key={s.id} className="focus-hist-row">
                  <span className="focus-hist-date">
                    {new Date(s.started_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <span className="focus-hist-time">
                    {new Date(s.started_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </span>
                  <span className="focus-hist-dur">
                    {formatDurationShort(s.duration_seconds ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
