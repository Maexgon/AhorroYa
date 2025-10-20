"use client";

import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <footer className="bg-background border-t py-3 mt-auto w-full z-50">
      <div className="container text-center text-sm text-muted-foreground">
        {'Copyright Acizer 2025 - AhorroYa - V3.01 | 17 de octubre de 2025'}
      </div>
    </footer>
  );
}
