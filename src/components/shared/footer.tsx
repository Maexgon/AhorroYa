"use client";

import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const getFormattedDate = () => {
    return new Date().toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!isClient) {
    return null;
  }

  return (
    <footer className="bg-background border-t py-3 mt-auto w-full z-50">
      <div className="container text-center text-sm text-muted-foreground">
        {`AhorroYa v4.01 - Copyright Acizer 2025 - ${getFormattedDate()}`}
      </div>
    </footer>
  );
}
