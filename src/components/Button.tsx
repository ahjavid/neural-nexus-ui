import React from 'react';

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon' | 'accent';
  className?: string;
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: React.ComponentType<any>;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false, 
  icon: Icon, 
  title,
  type = 'button'
}) => {
  const baseStyle = "flex items-center justify-center px-4 py-2 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-theme-bg-primary";
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:translate-y-0.5 focus:ring-indigo-400",
    secondary: "bg-theme-bg-elevated hover:bg-theme-bg-hover text-theme-text-primary border border-theme-border-secondary focus:ring-gray-500",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 focus:ring-red-500",
    ghost: "text-theme-text-muted hover:text-theme-text-primary hover:bg-theme-bg-secondary/50 focus:ring-gray-500",
    icon: "p-2 bg-transparent hover:bg-theme-bg-secondary/50 text-theme-text-muted hover:text-theme-text-primary rounded-md focus:ring-indigo-500/50",
    accent: "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 hover:scale-105 focus:ring-purple-400"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled} 
      title={title} 
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={18} className={children ? "mr-2" : ""} />}
      {children}
    </button>
  );
};
