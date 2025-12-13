import React from 'react';

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }> = ({ children, variant = 'primary', className = '', ...props }) => {
  const baseStyle = "px-4 py-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white hover:bg-slate-800 focus:ring-slate-900",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus:ring-slate-300",
    danger: "bg-danger text-white hover:bg-red-600 focus:ring-red-500",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  };
  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Card: React.FC<{ children: React.ReactNode; title?: string; className?: string }> = ({ children, title, className = '' }) => (
  <div className={`bg-white rounded-lg border border-slate-200 shadow-sm ${className}`}>
    {title && <div className="px-4 py-3 border-b border-slate-100 font-semibold text-slate-800">{title}</div>}
    <div className="p-4">{children}</div>
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="mb-2">
    {label && <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{label}</label>}
    <input className={`w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary ${className}`} {...props} />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
  <div className="mb-2">
    {label && <label className="block text-xs font-medium text-slate-500 uppercase mb-1">{label}</label>}
    <select className={`w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-secondary bg-white ${className}`} {...props}>
      {children}
    </select>
  </div>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }> = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-0">
      <div className={`bg-white rounded-lg shadow-xl w-full flex flex-col max-h-[90vh] ${className || 'max-w-md'}`}>
        <div className="px-4 py-3 bg-slate-50 border-b flex justify-between items-center shrink-0 rounded-t-lg">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <div className="p-4 overflow-y-auto overscroll-contain">
            {children}
        </div>
      </div>
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = 'bg-slate-100 text-slate-800' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
    {children}
  </span>
);