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
  console.log("SuperAdminUI: Rendering UI component.");
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

let renderCount = 0;

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  renderCount++;
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  console.log(`SuperAdminLayout Render #${renderCount}: isUserLoading: ${isUserLoading}, user: ${user?.uid || 'null'}`);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  const isLoading = isUserLoading || isUserDocLoading;

  useEffect(() => {
    console.log(`SuperAdminLayout useEffect triggered. isLoading: ${isLoading}`);

    if (isLoading) {
      console.log("--> Still loading, returning from useEffect.");
      return;
    }

    if (!user) {
      console.log("--> No user found, redirecting to /login.");
      router.replace('/login');
      return;
    }
    
    console.log(`--> Data loaded. user: ${user?.uid}, userData: ${JSON.stringify(userData)}`);

    if (userData) {
      if (userData.isSuperAdmin === true) {
        console.log("--> User is SuperAdmin. Access granted.");
      } else {
        console.log(`--> User is NOT a superadmin (isSuperAdmin: ${userData.isSuperAdmin}), redirecting to /dashboard.`);
        router.replace('/dashboard');
      }
    } else {
        // This case is critical. If userData is null after loading, it means the user doc doesn't exist or there was an error.
        console.log("--> User is authenticated but userData is not available. Redirecting to /dashboard");
        router.replace('/dashboard');
    }
  }, [user, userData, isLoading, router, isUserLoading, isUserDocLoading]);
  
  if (isLoading) {
    console.log("Render: Showing main loading indicator.");
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (userData?.isSuperAdmin !== true) {
    console.log(`Render: Showing 'Access Denied' screen. userData.isSuperAdmin: ${userData?.isSuperAdmin}`);
     return (
        <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
            <ShieldAlert className="h-16 w-16 text-destructive" />
            <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
            <p className="mt-2 text-muted-foreground">Verificando permisos...</p>
        </div>
    );
  }
  
  console.log("Render: Showing SuperAdminUI.");
  return <SuperAdminUI>{children}</SuperAdminUI>;
}