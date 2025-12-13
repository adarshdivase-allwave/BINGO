
import React from 'react';

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 265 60" 
    className={className || "h-10 w-auto"}
    fill="none"
    role="img"
    aria-label="All Wave AV Logo"
  >
    {/* Company Name: all-wave */}
    <text 
      x="5" 
      y="42" 
      fontFamily="'Inter', sans-serif" 
      fontWeight="800" 
      fontSize="34" 
      fill="#003399" 
      className="dark:fill-blue-400"
      style={{ letterSpacing: '-1.5px' }}
    >
      all-wave
    </text>
    
    {/* Suffix: av */}
    <text 
      x="142" 
      y="42" 
      fontFamily="'Inter', sans-serif" 
      fontWeight="800" 
      fontSize="34" 
      fill="#FF9900" 
      style={{ letterSpacing: '-1.5px' }}
    >
      av
    </text>

    {/* 25 Years Badge - Positioned to the right */}
    <g transform="translate(225, 30)">
      {/* Badge Circle Background */}
      <circle cx="0" cy="0" r="24" fill="white" className="dark:fill-slate-800" />
      
      {/* Orange Ring */}
      <circle cx="0" cy="0" r="21" stroke="#FF9900" strokeWidth="2" fill="none" />
      
      {/* Inner Text: 25+ */}
      <text 
        x="0" 
        y="2" 
        textAnchor="middle" 
        fontFamily="'Inter', sans-serif" 
        fontWeight="900" 
        fontSize="14" 
        fill="#003399"
        className="dark:fill-blue-400"
      >
        25+
      </text>
      
      {/* Inner Text: Years */}
      <text 
        x="0" 
        y="13" 
        textAnchor="middle" 
        fontFamily="'Inter', sans-serif" 
        fontWeight="700" 
        fontSize="7" 
        fill="#003399"
        className="dark:fill-blue-400"
        style={{ textTransform: 'uppercase' }}
      >
        Years
      </text>
      
      {/* Decorative Arcs */}
      <path d="M -10 -12 Q 0 -16 10 -12" stroke="#003399" strokeWidth="1.5" fill="none" className="dark:stroke-blue-400" opacity="0.6" />
      <path d="M -10 16 Q 0 20 10 16" stroke="#003399" strokeWidth="1.5" fill="none" className="dark:stroke-blue-400" opacity="0.6" />
    </g>
  </svg>
);

export default LogoIcon;
