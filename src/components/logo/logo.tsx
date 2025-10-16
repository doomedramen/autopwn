'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useLogo, LogoFaces } from './logo-context';

interface LogoProps {
  className?: string;
  animate?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  delayInitialLoad?: boolean;
  withBackground?: boolean;
}

export function Logo({
  className,
  animate = true,
  size = 'md',
  delayInitialLoad = false,
  withBackground = false,
}: LogoProps) {
  const { state } = useLogo();
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousFace, setPreviousFace] = useState(state.face);
  const [isInitialLoad, setIsInitialLoad] = useState(!delayInitialLoad);
  const [displayedFace, setDisplayedFace] = useState(state.face);
  const [allowUpdates, setAllowUpdates] = useState(!delayInitialLoad);

  // Initial load fade-in effect
  useEffect(() => {
    if (isInitialLoad) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
        setAllowUpdates(true);
        // Now allow face changes after fade-in complete
        setDisplayedFace(state.face);
        setPreviousFace(state.face);
      }, 300); // 0.3 second fade-in for the face
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, state.face]);

  // Update displayed face when state changes (but only after initial load)
  useEffect(() => {
    if (allowUpdates && state.face !== displayedFace) {
      setDisplayedFace(state.face);
    }
  }, [state.face, allowUpdates, displayedFace]);

  // Trigger animation when face changes (but only after initial load)
  useEffect(() => {
    if (animate && allowUpdates && displayedFace !== previousFace) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
        setPreviousFace(displayedFace);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [displayedFace, previousFace, allowUpdates, animate]);

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-4xl',
  };

  const getAnimationClass = () => {
    if (!animate) return '';

    // Initial load fade-in effect
    if (isInitialLoad) {
      return 'animate-fade-in-slow';
    }

    if (isAnimating) {
      // Special animations for certain faces
      switch (displayedFace) {
        case 'EXCITED':
        case 'HAPPY':
        case 'MOTIVATED':
          return 'animate-bounce scale-110';
        case 'ANGRY':
          return 'animate-pulse scale-110';
        case 'SLEEP':
        case 'SLEEP2':
          return 'animate-pulse';
        case 'UPLOAD':
        case 'UPLOAD1':
        case 'UPLOAD2':
          return 'animate-spin scale-110';
        case 'BROKEN':
          return 'animate-pulse scale-95 opacity-50';
        default:
          return 'transition-all duration-300 ease-in-out scale-110';
      }
    }
    return 'transition-all duration-300 ease-in-out';
  };

  // Get container size animation class
  const getContainerAnimationClass = () => {
    if (!animate) return '';

    if (isInitialLoad) {
      return 'animate-fade-in-slow';
    }

    if (isAnimating) {
      // Different size animations based on face type
      switch (state.face) {
        case 'EXCITED':
        case 'HAPPY':
        case 'MOTIVATED':
        case 'GRATEFUL':
          return 'transition-all duration-300 ease-out scale-110';
        case 'ANGRY':
        case 'BROKEN':
          return 'transition-all duration-300 ease-in-out scale-95';
        case 'SLEEP':
        case 'SLEEP2':
          return 'transition-all duration-500 ease-in-out scale-105';
        case 'UPLOAD':
        case 'UPLOAD1':
        case 'UPLOAD2':
          return 'transition-all duration-200 ease-in-out scale-105 rotate-6';
        case 'INTENSE':
        case 'SMART':
          return 'transition-all duration-250 ease-out scale-108';
        default:
          return 'transition-all duration-300 ease-in-out scale-105';
      }
    }
    return 'transition-all duration-300 ease-in-out';
  };

  const faceContent = (
    <div
      className={cn(
        'select-none inline-block whitespace-nowrap overflow-hidden',
        sizeClasses[size],
        getAnimationClass(),
        getContainerAnimationClass(),
        'drop-shadow-sm'
      )}
      title={state.face}
      style={{
        width: '7ch', // Fixed width for 7 characters to fit wider faces like COOL
        textAlign: 'center',
        fontFamily:
          "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', monospace",
      }}
    >
      {LogoFaces[state.face]}
    </div>
  );

  // If background is requested, wrap the face in the styled container
  if (withBackground) {
    return (
      <div
        className={cn(
          'rounded-lg bg-primary/10 cursor-default p-2 logo-hover-effect',
          animate ? 'animate-fade-in-slow' : '',
          className
        )}
      >
        {faceContent}
      </div>
    );
  }

  return <div className={cn(className)}>{faceContent}</div>;
}
