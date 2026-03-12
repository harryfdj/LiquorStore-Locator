import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ResetConfirmModalProps {
  showResetConfirm: boolean;
  setShowResetConfirm: (v: boolean) => void;
  handleResetDatabase: () => void;
  isResetting: boolean;
}

export const ResetConfirmModal: React.FC<ResetConfirmModalProps> = ({
  showResetConfirm, setShowResetConfirm, handleResetDatabase, isResetting
}) => {
  if (!showResetConfirm) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <AlertCircle className="w-8 h-8" />
          <h2 className="text-xl font-bold">Clear All Data?</h2>
        </div>
        <p className="text-stone-600 mb-6">
          Are you sure you want to delete all products, locations, and images? This action cannot be undone. You will need to upload a new CSV to restore your inventory.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setShowResetConfirm(false)}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl font-medium text-stone-600 hover:bg-stone-100 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleResetDatabase}
            disabled={isResetting}
            className="px-4 py-2 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isResetting ? 'Deleting...' : 'Yes, Delete Everything'}
          </button>
        </div>
      </div>
    </div>
  );
};
