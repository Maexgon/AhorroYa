'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { Loader2, ShieldAlert, LayoutDashboard, Users, Building, FileKey } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarMenuItem, SidebarMenu, SidebarMenuButton } from '@/components/ui/sidebar';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  useEffect(() => {
    const isLoading = isUserLoading || isUserDocLoading;
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (userData && userData.isSuperAdmin !== true) {
      router.replace('/dashboard');
    }
  }, [user, userData, isUserLoading, isUserDocLoading, router]);

  const isLoading = isUserLoading || isUserDocLoading;
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData?.isSuperAdmin) {
     return (
        <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
            <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            <Button asChild className="mt-6">
            <Link href="/dashboard">Volver al Dashboard</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="flex">
        <Sidebar>
            <SidebarContent className="flex flex-col gap-2 p-2">
                 <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton href="/superadmin" isActive={pathname === '/superadmin'} tooltip="Dashboard">
                            <LayoutDashboard />
                            Dashboard
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         <SidebarMenuButton href="/superadmin/tenants" isActive={pathname.startsWith('/superadmin/tenants')} tooltip="Tenants">
                            <Building />
                            Tenants
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         <SidebarMenuButton href="#" tooltip="Users">
                            <Users />
                            Usuarios
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                         <SidebarMenuButton href="#" tooltip="Licenses">
                            <FileKey />
                            Licencias
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>
        <main className="flex-1">
            {children}
        </main>
    </div>
    );
}
