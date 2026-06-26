import { useTracker } from '../../hooks/useTracker';
import { useScrollLock } from '../../hooks/useScrollLock';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ClearProgressModal({ open, onClose }: Props) {
  useScrollLock(open);
  const { clearAllProgress } = useTracker();

  if (!open) return null;

  const handleConfirm = () => {
    clearAllProgress();
    onClose();
  };

  return (
    <div id="clear-progress-modal" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-card">
        <div className="modal-icon">⚠️</div>
        <div className="modal-title">Reset All Syllabus Progress?</div>
        <div className="modal-desc">
          This will uncheck all topics across Prelims, Mains and Anthropology. Your notes will be preserved. This cannot be undone.
        </div>
        <div className="modal-btns">
          <button className="modal-cancel" onClick={onClose}>Cancel</button>
          <button className="modal-confirm" onClick={handleConfirm}>Yes, Reset</button>
        </div>
      </div>
    </div>
  );
}
