
import React from 'react';
import Link from 'next/link';
import { FileBarChart, LayoutDashboard, Landmark, Settings, HandCoins, Sparkles } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="md:hidden sticky bottom-0 bg-background border-t py-2 mt-auto w-full z-50">
      <div className="container grid grid-cols-5 gap-2 text-center text-xs text-muted-foreground">
        <Link href="/dashboard" className="flex flex-col items-center justify-center gap-1 hover:text-primary">
          <LayoutDashboard className="h-5 w-5" />
          <span>Dashboard</span>
        </Link>
        <Link href="/dashboard/expenses" className="flex flex-col items-center justify-center gap-1 hover:text-primary">
          <Landmark className="h-5 w-5" />
          <span>Gastos</span>
        </Link>
        <Link href="/dashboard/income" className="flex flex-col items-center justify-center gap-1 hover:text-primary">
          <HandCoins className="h-5 w-5" />
          <span>Ingresos</span>
        </Link>
        <Link href="/dashboard/reports" className="flex flex-col items-center justify-center gap-1 hover:text-primary">
          <FileBarChart className="h-5 w-5" />
          <span>Reportes</span>
        </Link>
        <Link href="/dashboard/settings" className="flex flex-col items-center justify-center gap-1 hover:text-primary">
          <Settings className="h-5 w-5" />
          <span>Ajustes</span>
        </Link>
      </div>
    </footer>
  );
}
