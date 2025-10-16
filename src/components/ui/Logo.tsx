'use client';

import React, { useState, useEffect } from 'react';
import { Logo as NewLogo } from '@/components/logo';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  simple?: boolean;
  showReason?: boolean;
}

export function Logo({
  size = 'md',
  className = '',
  simple,
  showReason = false,
}: LogoProps) {
  const [isContainerVisible, setIsContainerVisible] = useState(false);
  const [showFace, setShowFace] = useState(false);

  // Coordinate the fade-in sequence
  useEffect(() => {
    // Container fades in immediately
    setIsContainerVisible(true);

    // Face fades in after 200ms delay
    const faceTimer = setTimeout(() => {
      setShowFace(true);
    }, 200);

    return () => clearTimeout(faceTimer);
  }, []);

  // Map old sizes to new sizes
  const sizeMap = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  };

  if (simple) {
    return (
      <NewLogo size={sizeMap[size]} className={className} animate={false} />
    );
  }

  return (
    <div
      className={`rounded-lg bg-primary/10 hover:bg-primary/20 transition-all duration-300 ease-in-out hover:scale-110 cursor-default p-2 ${className} ${
        isContainerVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        transition:
          'opacity 0.3s ease-in-out, transform 0.3s ease-in-out, background-color 0.2s ease-in-out',
      }}
    >
      <NewLogo
        size={sizeMap[size]}
        animate={showFace}
        // Override the initial load behavior since we're handling it here
        delayInitialLoad={true}
      />
    </div>
  );
}
