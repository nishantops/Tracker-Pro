import { STAGES, CA_SECTION } from '../../data/syllabus';
import { useTracker } from '../../hooks/useTracker';
import { TopicList } from './TopicList';
import { MetricsHUD } from './MetricsHUD';
import type { StageTab } from '../../lib/navigation';

interface Props {
  stage: StageTab;
}

export function SyllabusView({ stage }: Props) {
  const { progress, loading, syncStatus, toggleCheck, updateNote, getMetrics, getGlobalMetrics } =
    useTracker();

  const stageData = STAGES.find((s) => s.id === stage);
  if (!stageData) return null;

  const statusClass =
    syncStatus === 'synced' ? 'sync-ok' : syncStatus === 'saving' ? 'sync-saving' : 'sync-fail';
  const statusText =
    syncStatus === 'synced'
      ? 'CLOUD SYNCED ACROSS DEVICES'
      : syncStatus === 'saving'
        ? 'SAVING...'
        : 'OFFLINE: DB CONNECTION REJECTED';

  return (
    <div className="syllabus-view">
      {/* Sync badge */}
      <div className="sync-bar">
        <span className={`sync-dot ${statusClass}`} />
        <span className="sync-text">{statusText}</span>
      </div>

      {/* Metrics HUD */}
      <MetricsHUD getMetrics={getMetrics} getGlobalMetrics={getGlobalMetrics} />

      {loading ? (
        <div className="welcome-card">
          <p>Loading progress...</p>
        </div>
      ) : (
        <>
          {stageData.sections.map((sec) => (
            <TopicList
              key={sec.key}
              section={sec}
              progress={progress}
              onToggle={toggleCheck}
              onNote={updateNote}
            />
          ))}

          {/* Current Affairs in all stages */}
          {stage === 'prelims' && (
            <TopicList
              section={CA_SECTION}
              progress={progress}
              onToggle={toggleCheck}
              onNote={updateNote}
            />
          )}
        </>
      )}
    </div>
  );
}
