import React from 'react';
import logo from '../../assets/logo.jpg';

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img 
    src={logo} 
    alt="All Wave AV Logo" 
    className={className || "h-10 w-auto"} 
  />
);

export default LogoIcon;
