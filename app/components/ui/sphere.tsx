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
        }}
      >
        {isLoading ? (
          <div 
            style={{
              animation: "sphere-spin linear infinite",
            }} 
          />
        ) : (
          <Icon size={size * 0.5} color="white" />
        )}
      </div>
    </>
  );
}
