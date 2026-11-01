import React from 'react';
import type { ChartProps } from '../types';

export const SmoothLineChart: React.FC<ChartProps> = ({ data, label, hoveredIndex, setHoveredIndex, gradientId }) => {
  if (!data || data.length === 0) return null;
  const width = 600;
  const height = 260;
  const paddingX = 45;
  const paddingBottom = 30;
  const paddingTop = 30;
  
  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 5);
  
  const points = data.map((d, index) => {
    const x = paddingX + (index * (width - 2 * paddingX) / (data.length - 1));
    const y = height - paddingBottom - (d.value * (height - paddingTop - paddingBottom) / maxValue);
    return { x, y, name: d.name, value: d.value };
  });
  
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 3;
      const cpY1 = p0.y;
      const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
      const cpY2 = p1.y;
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z` : "";
  
  return (
    <div className="relative w-full overflow-x-auto overflow-y-hidden">
      <div className="min-w-[600px] pb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
          </linearGradient>
          <filter id="glowFilter" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = height - paddingBottom - (ratio * (height - paddingTop - paddingBottom));
          const val = Math.round(ratio * maxValue);
          return (
            <g key={idx} className="opacity-20 dark:opacity-10 text-muted-foreground">
              <line x1={paddingX} y1={y} x2={width - 20} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
              <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[11px] font-bold fill-current">{val}</text>
            </g>
          );
        })}
        
        {points.map((p, idx) => (
          <text key={idx} x={p.x} y={height - 10} textAnchor="middle" className="text-[11px] font-bold fill-muted-foreground/80">{p.name}</text>
        ))}
        
        <path d={areaD} fill={`url(#${gradientId})`} />
        
        <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" filter="url(#glowFilter)" className="stroke-primary" />
        
        {hoveredIndex !== null && points[hoveredIndex] && (
          <g>
            <line x1={points[hoveredIndex].x} y1={paddingTop} x2={points[hoveredIndex].x} y2={height - paddingBottom} stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="3 3" className="opacity-55" />
            <circle cx={points[hoveredIndex].x} cy={points[hoveredIndex].y} r="6.5" className="fill-background stroke-primary" strokeWidth="3" />
            <circle cx={points[hoveredIndex].x} cy={points[hoveredIndex].y} r="2" className="fill-primary" />
          </g>
        )}

        {points.map((p, idx) => (
          <g key={idx} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)}>
            <circle cx={p.x} cy={p.y} r={hoveredIndex === idx ? "4.5" : "3.5"} className={`fill-background transition-all duration-150 ${hoveredIndex === idx ? 'stroke-primary' : 'stroke-muted-foreground/30'}`} strokeWidth={hoveredIndex === idx ? "2.5" : "2"} />
            <circle cx={p.x} cy={p.y} r="24" className="fill-transparent cursor-pointer" />
          </g>
        ))}
      </svg>
      
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute z-10 p-2.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl text-xs pointer-events-none transition-all duration-150 zoom-in-95"
          style={{ 
            left: `${(points[hoveredIndex].x / width) * 100}%`, 
            top: `${(points[hoveredIndex].y / height) * 100}%`,
            transform: `translate(${points[hoveredIndex].x / width > 0.5 ? 'calc(-100% - 12px)' : '12px'}, -50%)`
          }}
        >
          <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{points[hoveredIndex].name}</div>
          <div className="text-sm font-bold text-foreground mt-0.5">{label}: <span className="text-primary font-extrabold">{points[hoveredIndex].value}</span></div>
        </div>
      )}
      </div>
    </div>
  );
};

export const CustomBarChart: React.FC<ChartProps> = ({ data, label, hoveredIndex, setHoveredIndex, gradientId }) => {
  if (!data || data.length === 0) return null;
  const width = 600;
  const height = 260;
  const paddingX = 45;
  const paddingBottom = 30;
  const paddingTop = 30;
  
  const values = data.map(d => d.value);
  const maxValue = Math.max(...values, 5);
  
  const barWidth = 28;
  const chartWidth = width - 2 * paddingX;
  const points = data.map((d, index) => {
    const x = paddingX + (index * chartWidth / (data.length - 1)) - barWidth / 2;
    const y = height - paddingBottom - (d.value * (height - paddingTop - paddingBottom) / maxValue);
    const barHeight = height - paddingBottom - y;
    return { x, y, barHeight, name: d.name, value: d.value };
  });
  
  return (
    <div className="relative w-full overflow-x-auto overflow-y-hidden">
      <div className="min-w-[600px] pb-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id={`${gradientId}-hover`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = height - paddingBottom - (ratio * (height - paddingTop - paddingBottom));
          const val = Math.round(ratio * maxValue);
          return (
            <g key={idx} className="opacity-20 dark:opacity-10 text-muted-foreground">
              <line x1={paddingX} y1={y} x2={width - 20} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
              <text x={paddingX - 10} y={y + 4} textAnchor="end" className="text-[11px] font-bold fill-current">{val}</text>
            </g>
          );
        })}
        
        {points.map((p, idx) => (
          <text key={idx} x={p.x + barWidth / 2} y={height - 10} textAnchor="middle" className="text-[11px] font-bold fill-muted-foreground/80">{p.name}</text>
        ))}
        
        {points.map((p, idx) => {
          const isHovered = hoveredIndex === idx;
          return (
            <g key={idx} onMouseEnter={() => setHoveredIndex(idx)} onMouseLeave={() => setHoveredIndex(null)} className="cursor-pointer">
              <rect 
                x={p.x} 
                y={p.y} 
                width={barWidth} 
                height={p.barHeight > 4 ? p.barHeight : 4} 
                rx="4" 
                fill={isHovered ? `url(#${gradientId}-hover)` : `url(#${gradientId})`} 
                className="transition-all duration-200 hover:filter hover:brightness-110"
              />
              <rect x={p.x - 8} y={paddingTop} width={barWidth + 16} height={height - paddingTop - paddingBottom} fill="transparent" />
            </g>
          );
        })}
      </svg>
      
      {hoveredIndex !== null && points[hoveredIndex] && (
        <div 
          className="absolute z-10 p-2.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-xl text-xs pointer-events-none transition-all duration-150 zoom-in-95"
          style={{ 
            left: `${((points[hoveredIndex].x + barWidth / 2) / width) * 100}%`, 
            top: `${(points[hoveredIndex].y / height) * 100}%`,
            transform: `translate(${((points[hoveredIndex].x + barWidth / 2) / width) > 0.5 ? 'calc(-100% - 12px)' : '12px'}, -50%)`
          }}
        >
          <div className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{points[hoveredIndex].name}</div>
          <div className="text-sm font-bold text-foreground mt-0.5">{label}: <span className="text-primary font-extrabold">{points[hoveredIndex].value}</span></div>
        </div>
      )}
      </div>
    </div>
  );
};
