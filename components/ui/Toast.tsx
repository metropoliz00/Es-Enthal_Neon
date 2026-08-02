import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
    message: string;
    type: ToastType;
    onClose: () => void;
}

const Toast = ({ message, type, onClose }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const icons = {
        success: <CheckCircle className="text-emerald-500" size={20} />,
        error: <XCircle className="text-rose-500" size={20} />,
        info: <AlertCircle className="text-indigo-500" size={20} />,
        warning: <AlertCircle className="text-yellow-500" size={20} />
    };

    const bgColors = {
        success: 'bg-emerald-50 border-emerald-200',
        error: 'bg-rose-50 border-rose-200',
        info: 'bg-indigo-50 border-indigo-200',
        warning: 'bg-yellow-50 border-yellow-200'
    };

    return (
        <div className={`fixed bottom-4 right-4 flex items-center gap-3 p-4 rounded-xl border shadow-lg ${bgColors[type]} animate-in slide-in-from-bottom-4`}>
            {icons[type]}
            <p className="text-sm font-bold text-slate-700">{message}</p>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
            </button>
        </div>
    );
};

export default Toast;
