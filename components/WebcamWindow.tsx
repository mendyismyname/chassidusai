import React, { useEffect, useRef, useState } from 'react';

interface WebcamWindowProps {
  onClose: () => void;
}

const WebcamWindow: React.FC<WebcamWindowProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [size, setSize] = useState({ width: 320, height: 240 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
      }
    };
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={containerRef}
      className="fixed z-50 rounded-xl overflow-hidden shadow-2xl border border-gray-500/30 group"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="absolute inset-0 z-10 bg-transparent hover:bg-black/10 transition-colors cursor-move"
        onMouseDown={handleMouseDown}
      >
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
        
        {/* Resize handle (simple implementation) */}
        <div 
           className="absolute bottom-2 right-2 w-4 h-4 bg-white/50 rounded cursor-se-resize opacity-0 group-hover:opacity-100"
           onMouseDown={(e) => {
             e.stopPropagation();
             const startX = e.clientX;
             const startY = e.clientY;
             const startWidth = size.width;
             const startHeight = size.height;
             
             const handleResize = (moveEvent: MouseEvent) => {
               setSize({
                 width: Math.max(200, startWidth + (moveEvent.clientX - startX)),
                 height: Math.max(150, startHeight + (moveEvent.clientY - startY))
               });
             };
             
             const stopResize = () => {
               window.removeEventListener('mousemove', handleResize);
               window.removeEventListener('mouseup', stopResize);
             };
             
             window.addEventListener('mousemove', handleResize);
             window.addEventListener('mouseup', stopResize);
           }}
        />
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover bg-black"
      />
    </div>
  );
};

export default WebcamWindow;