'use client';

interface ToastProps {
  toast: { message: string; type: 'success' | 'error' } | null;
}

export default function Toast({ toast }: ToastProps) {
  if (!toast) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg border animate-slide-in-right ${
      toast.type === 'success'
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      <div className="flex items-center gap-3">
        <i className={`${toast.type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill'} text-xl w-5 h-5 flex items-center justify-center`}></i>
        <p className="font-medium">{toast.message}</p>
      </div>
    </div>
  );
}