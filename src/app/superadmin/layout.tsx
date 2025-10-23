'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Loader2, ShieldAlert, LayoutDashboard, Users, Building, FileKey } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarMenuItem, SidebarMenu, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';


function SuperAdminUI({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent className="flex flex-col gap-2 p-2">
           <div className="p-2">
            <h2 className="text-lg font-semibold">Super Admin</h2>
          </div>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href="/superadmin" passHref>
                <SidebarMenuButton asChild isActive={pathname === '/superadmin'}>
                  <div>
                    <LayoutDashboard />
                    Dashboard
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/superadmin/tenants" passHref>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/superadmin/tenants')}>
                  <div>
                    <Building />
                    Tenants
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/superadmin/users" passHref>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/superadmin/users')}>
                  <div>
                    <Users />
                    Usuarios
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link href="/superadmin/licenses" passHref>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/superadmin/licenses')}>
                   <div>
                    <FileKey />
                    Licencias
                  </div>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <SidebarTrigger />
            <h1 className="ml-4 font-headline text-xl font-bold">Panel de Superadministrador</h1>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}


export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  const isLoading = isUserLoading || isUserDocLoading;

  useEffect(() => {
    // Wait until all loading is finished before doing anything.
    if (isLoading) {
      return;
    }

    // If, after loading, there is no user, redirect to login.
    if (!user) {
      router.replace('/login');
      return;
    }
    
    // If, after loading, there is user data and they are not a superadmin, redirect.
    if (userData?.isSuperAdmin !== true) {
        router.replace('/dashboard');
    }
    
  }, [user, userData, isLoading, router]);
  
  // While any data is loading, show a full-screen spinner.
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is complete and user is a superadmin, render the UI.
  if (userData?.isSuperAdmin === true) {
    return <SuperAdminUI>{children}</SuperAdminUI>;
  }
  
  // If loading is complete but conditions aren't met (e.g., redirecting), show a placeholder.
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-muted-foreground">Verificando permisos y redirigiendo...</p>
    </div>
  );
}
