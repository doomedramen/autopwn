"use client";

import React from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  simple?: boolean;
}

export function Logo({ size = "md", className = "", simple }: LogoProps) {
  const sizeClasses = {
    sm: "text-lg p-1.5",
    md: "text-2xl p-2",
    lg: "text-4xl p-2",
  };

  if (simple) {
    return (
      <span
        className={`font-mono font-bold select-none cursor-default ${sizeClasses[size]} ${className}`}
      >
        ⌐■_■
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg bg-primary/10 hover:bg-primary/20 transition-all duration-200 hover:scale-110 cursor-default ${sizeClasses[size]} ${className}`}
    >
      <span className="font-mono font-bold select-none">⌐■_■</span>
    </div>
  );
}
