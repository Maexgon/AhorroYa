"use client";

import { useEffect, useState } from 'react';

export default function Footer() {
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    // This will run only on the client, after hydration
    const date = new Date();
    const formattedDate = new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
    setCurrentDate(formattedDate);
  }, []);

  return (
    <footer className="bg-background border-t py-3 mt-auto w-full z-50">
      <div className="container text-center text-sm text-muted-foreground">
        Copyright Acizer 2025 - AhorroYa - v1.05 | {currentDate || 'Cargando fecha...'}
      </div>
    </footer>
  );
}
