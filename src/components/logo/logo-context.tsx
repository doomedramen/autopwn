'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

// Logo face expressions
export const LogoFaces = {
  LOOK_R: '( ⚆_⚆)',
  LOOK_L: '(☉_☉ )',
  LOOK_R_HAPPY: '( ◕‿◕)',
  LOOK_L_HAPPY: '(◕‿◕ )',
  SLEEP: '(⇀‿‿↼)',
  SLEEP2: '(≖‿‿≖)',
  AWAKE: '(◕‿‿◕)',
  BORED: '(-__-)',
  INTENSE: '(°▃▃°)',
  COOL: '(⌐■_■)',
  HAPPY: '(•‿‿•)',
  GRATEFUL: '(^‿‿^)',
  EXCITED: '(ᵔ◡◡ᵔ)',
  MOTIVATED: '(☼‿‿☼)',
  DEMOTIVATED: '(≖__≖)',
  SMART: '(✜‿‿✜)',
  LONELY: '(ب__ب)',
  SAD: '(╥☁╥ )',
  ANGRY: "(-_-')",
  FRIEND: '(♥‿‿♥)',
  BROKEN: '(☓‿‿☓)',
  DEBUG: '(#__#)',
  UPLOAD: '(1__0)',
  UPLOAD1: '(1__1)',
  UPLOAD2: '(0__1)',
} as const;

export type LogoFace = keyof typeof LogoFaces;

export interface LogoState {
  face: LogoFace;
  reason?: string;
  timestamp: number;
}

export interface LogoContextType {
  state: LogoState;
  setFace: (face: LogoFace, reason?: string) => void;
  resetFace: () => void;
  setTemporaryFace: (
    face: LogoFace,
    duration?: number,
    reason?: string
  ) => void;
}

const LogoContext = createContext<LogoContextType | null>(null);

interface LogoProviderProps {
  children: ReactNode;
}

export function LogoProvider({ children }: LogoProviderProps) {
  const [state, setState] = useState<LogoState>({
    face: 'AWAKE', // Default face for dashboard
    timestamp: Date.now(),
  });

  const setFace = useCallback((face: LogoFace, reason?: string) => {
    setState({
      face,
      reason,
      timestamp: Date.now(),
    });
  }, []);

  const resetFace = useCallback(() => {
    setState({
      face: 'AWAKE', // Reset to default
      timestamp: Date.now(),
    });
  }, []);

  const setTemporaryFace = useCallback(
    (face: LogoFace, duration = 3000, reason?: string) => {
      setState({
        face,
        reason,
        timestamp: Date.now(),
      });

      // Reset back to AWAKE after duration
      setTimeout(() => {
        setState(prev => {
          // Only reset if the temporary face is still active
          if (prev.face === face && prev.timestamp === Date.now() - duration) {
            return {
              face: 'AWAKE',
              timestamp: Date.now(),
            };
          }
          return prev;
        });
      }, duration);
    },
    []
  );

  const value: LogoContextType = {
    state,
    setFace,
    resetFace,
    setTemporaryFace,
  };

  return <LogoContext.Provider value={value}>{children}</LogoContext.Provider>;
}

export function useLogo(): LogoContextType {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
}
