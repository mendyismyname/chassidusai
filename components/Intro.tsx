import React, { useEffect, useState } from 'react';

const Intro: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsFading(true);
      setTimeout(onComplete, 1000); // Wait for fade out
    }, 2000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-white transition-opacity duration-1000 ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <div className="flex flex-col items-center">
        <h1 className="font-serif text-4xl tracking-[0.3em] font-bold text-gray-900 animate-in fade-in zoom-in duration-1000">
          CHASSIDUS.AI
        </h1>
      </div>
    </div>
  );
};

export default Intro;