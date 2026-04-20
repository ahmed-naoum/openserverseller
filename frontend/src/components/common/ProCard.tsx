import React from 'react';

interface ProCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'glass' | 'white' | 'soft';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const ProCard: React.FC<ProCardProps> = ({ 
  children, 
  className = '', 
  variant = 'glass',
  padding = 'md',
  hoverable = true
}) => {
  const baseStyles = "relative overflow-hidden transition-all duration-500 ease-out";
  
  const variantStyles = {
    glass: "glass-panel rounded-[2rem]",
    white: "bg-white border border-slate-200/50 shadow-sm rounded-[2rem]",
    soft: "bg-slate-50 border border-slate-100 rounded-[2rem]"
  };
  
  const paddingStyles = {
    none: "p-0",
    sm: "p-4",
    md: "p-6 sm:p-8",
    lg: "p-10"
  };
  
  const hoverStyles = hoverable 
    ? "hover:shadow-[0_20px_50px_rgba(0,0,0,0.06)] hover:-translate-y-1" 
    : "";

  return (
    <div className={`
      ${baseStyles} 
      ${variantStyles[variant]} 
      ${paddingStyles[padding]} 
      ${hoverStyles} 
      ${className}
    `}>
      {/* Decorative Gradient Blob */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-accent-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export { ProCard };
