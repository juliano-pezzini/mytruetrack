import { ImportSection } from './ImportSection.tsx';

type ImportModalProps = {
  accountId: string;
  accountName: string;
  onClose: () => void;
  onImported?: () => void;
};

export function ImportModal({ accountId, accountName, onClose, onImported }: ImportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Import Statement — <span className="text-blue-700">{accountName}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <ImportSection initialAccountId={accountId} onImportComplete={onImported} />
      </div>
    </div>
  );
}
