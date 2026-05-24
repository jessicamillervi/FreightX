'use client';

import { ShieldCheck, Clock, XCircle, Activity } from 'lucide-react';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface ToastContainerProps {
  toasts: Toast[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  const getBorderColor = (type: Toast['type']): string => {
    switch (type) {
      case 'success': return 'var(--success)';
      case 'warning': return 'var(--warning)';
      case 'error': return 'var(--danger)';
      default: return 'var(--primary)';
    }
  };

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return <ShieldCheck size={18} style={{ color: 'var(--success)' }} />;
      case 'warning': return <Clock size={18} style={{ color: 'var(--warning)' }} />;
      case 'error': return <XCircle size={18} style={{ color: 'var(--danger)' }} />;
      default: return <Activity size={18} style={{ color: 'var(--primary)' }} />;
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className="toast"
          style={{ borderLeftColor: getBorderColor(t.type) }}
        >
          {getIcon(t.type)}
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
