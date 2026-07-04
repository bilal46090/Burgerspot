import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'variant'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  ...props
}) => {
  const variants = {
    primary: "bg-gradient-to-br from-amber-400 to-orange-500 text-white",
    secondary: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white",
    danger: "bg-gradient-to-br from-red-500 to-red-700 text-white",
    warning: "bg-gradient-to-br from-yellow-400 to-orange-500 text-black",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100"
  };

  const sizes = {
    sm: "px-4 py-2 text-xs rounded-lg font-medium",
    md: "px-6 py-3 text-sm rounded-xl font-semibold",
    lg: "px-8 py-4 text-base rounded-2xl font-bold"
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`
        transition-all duration-200 shadow-md hover:shadow-xl
        ${sizes[size]}
        ${variants[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default Button;