"use client";

import { useEffect, useState } from 'react';

export default function Footer() {
  const [footerText, setFooterText] = useState('');

  useEffect(() => {
    // This ensures the text is only set on the client-side after hydration
    setFooterText('Copyright Acizer 2025 - AhorroYa - V3.01 | 17 de octubre de 2025');
  }, []);

  return (
    <footer className="bg-background border-t py-3 mt-auto w-full z-50">
      <div className="container text-center text-sm text-muted-foreground">
        {footerText || <>&nbsp;</>}
      </div>
    </footer>
  );
}
