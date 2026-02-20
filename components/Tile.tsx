
import React from 'react';
import { TileState } from '../types';

interface TileProps {
  tile: TileState;
  isBaton: boolean;
  x: number;
  y: number;
}

const Tile: React.FC<TileProps> = ({ tile, isBaton, x, y }) => {
  const getShadowColor = (intensity: number) => {
    if (intensity === 0) return 'transparent';
    const opacity = Math.min(intensity / 6, 1);
    return `rgba(239, 68, 68, ${opacity})`;
  };

  const getSignColor = (sign: number) => {
    if (sign === 1) return 'text-blue-400';
    if (sign === -1) return 'text-purple-400';
    return 'text-white';
  };

  return (
    <div 
      className={`absolute w-24 h-24 flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-300 transform -translate-x-1/2 -translate-y-1/2 ${
        isBaton ? 'border-amber-400 bg-amber-400/10 scale-110 z-10' : 'border-gray-700 bg-gray-900/50'
      }`}
      style={{ 
        left: `${x}px`, 
        top: `${y}px`,
        boxShadow: tile.shadow > 0 ? `0 0 ${tile.shadow * 10}px ${getShadowColor(tile.shadow)}` : 'none'
      }}
    >
      <div className="text-xs text-gray-400 font-bold mb-1">{tile.name}</div>
      <div className={`text-2xl font-mono font-bold ${isBaton ? 'text-amber-400' : getSignColor(tile.sign)}`}>
        {isBaton ? '0' : (tile.sign === 1 ? '+' : '-')}
      </div>
      <div className="text-[10px] mt-1 text-gray-500 font-mono">
        buf: {tile.buffer === 1 ? '+' : '-'}
      </div>
      {tile.shadow > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border border-gray-900 font-bold">
          {tile.shadow}
        </div>
      )}
    </div>
  );
};

export default Tile;
