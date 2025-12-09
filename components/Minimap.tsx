
import React from 'react';

interface MinimapItem {
  title: string;
  index: number;
}

interface MinimapProps {
  currentChunkIndex: number;
  items: MinimapItem[];
  onItemClick: (index: number) => void;
  theme: string;
  isVisible: boolean;
}

const Minimap: React.FC<MinimapProps> = ({ currentChunkIndex, items, onItemClick, theme, isVisible }) => {
  // Find which item is currently active (the last item whose index is <= currentChunkIndex)
  const activeItemIndex = items.reduce((acc, item, idx) => {
     if (item.index <= currentChunkIndex) return idx;
     return acc;
  }, 0);

  return (
    <div 
      className={`
        fixed left-8 top-1/2 transform -translate-y-1/2 z-30 flex flex-col gap-3 transition-all duration-500
        ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0 pointer-events-none'}
      `}
    >
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 group cursor-pointer" onClick={() => onItemClick(item.index)}>
          <div
            className={`
              transition-all duration-300 rounded-full border border-current flex-shrink-0
              ${idx === activeItemIndex 
                ? 'w-2 h-2 bg-current opacity-100' 
                : 'w-1.5 h-1.5 bg-transparent opacity-40 group-hover:opacity-80'}
            `}
          />
          <span 
            className={`
              text-[10px] uppercase tracking-widest transition-opacity duration-300 font-hebrew-serif whitespace-nowrap
              ${idx === activeItemIndex ? 'opacity-100 font-bold' : 'opacity-40 group-hover:opacity-100'}
              ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}
            `}
          >
            {item.title}
          </span>
        </div>
      ))}
    </div>
  );
};

export default Minimap;
