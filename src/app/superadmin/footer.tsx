
'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutDashboard, Building, Users, FileKey } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
    { href: "/superadmin", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/superadmin/tenants", icon: Building, label: "Tenants" },
    { href: "/superadmin/users", icon: Users, label: "Usuarios" },
    { href: "/superadmin/licenses", icon: FileKey, label: "Licencias" },
]

export default function SuperAdminFooter() {
  const pathname = usePathname();
  
  return (
    <footer className="md:hidden sticky bottom-0 bg-background border-t py-2 mt-auto w-full z-50">
      <div className="container grid grid-cols-4 gap-1 text-center text-xs text-muted-foreground">
        {navItems.map(item => (
             <Link 
                key={item.href} 
                href={item.href} 
                className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-md p-2 transition-colors hover:bg-accent hover:text-accent-foreground",
                    pathname === item.href && "bg-accent text-accent-foreground"
                )}
            >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
            </Link>
        ))}
      </div>
    </footer>
  );
}
