"use client";

import React from "react";

interface SphereProps {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  size?: number;
  color?: string;
  onClick?: () => void;
  isLoading?: boolean;
}

export default function Sphere({ icon : Icon, size = 100, color = "#337180", onClick, isLoading = false }: SphereProps) {
  return (
    <>
      <style jsx global>{`
        @keyframes sphere-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div 
        onClick={onClick}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.4,
          cursor: onClick ? "pointer" : "default",
          opacity: isLoading ? 0.6 : 1,
          transition: "opacity 0.2s ease",
          position: "relative",
        }}
      >
        {isLoading ? (
          <div 
            style={{
              width: size * 0.3,
              height: size * 0.3,
              border: `${size * 0.05}px solid rgba(255, 255, 255, 0.3)`,
              borderTop: `${size * 0.05}px solid white`,
              borderRadius: "50%",
              animation: "sphere-spin 1s linear infinite",
            }} 
          />
        ) : (
          <Icon size={size * 0.5} color="white" />
        )}
      </div>
    </>
  );
}
