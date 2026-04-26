import React from 'react';
import { AlertTriangle, X, Trash2, ShieldAlert } from 'lucide-react';

interface AdminConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  variant?: 'danger' | 'warning';
  isLoading?: boolean;
  /** When set, replaces the default shield / warning icon (same danger or warning tint). */
  leadIcon?: React.ReactNode;
}

export const AdminConfirmModal: React.FC<AdminConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  variant = 'danger',
  isLoading = false,
  leadIcon,
}) => {
  if (!isOpen) return null;

  const isDanger = variant === 'danger';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />
      
      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="surface-card relative w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 ease-out"
      >
        
        {/* Header Decore */}
        <div className={`h-2 w-full ${isDanger ? 'bg-red-600' : 'bg-amber-500'}`} />
        
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div className={`p-3 rounded-2xl ${isDanger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
              {leadIcon ?? (isDanger ? <ShieldAlert className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />)}
            </div>
            <button 
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 id="confirm-dialog-title" className="text-xl font-bold text-slate-950 mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed mb-8 whitespace-pre-line">
            {message}
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary flex-1 px-6 py-3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
                isDanger 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-200' 
                  : 'bg-slate-950 hover:bg-slate-800 shadow-slate-200'
              }`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {confirmText}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
