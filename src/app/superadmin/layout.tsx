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
import { Sidebar, SidebarContent, SidebarMenuItem, SidebarMenu, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';

function SuperAdminUI({ children }: { children: React.ReactNode }) {
  console.log("[SuperAdminUI] Rendering component. About to render SidebarProvider.");
  const pathname = usePathname();

  return (
    <SidebarProvider>
       {(() => {
        console.log("[SuperAdminUI] Rendering children of SidebarProvider.");
        return (
          <>
            <Sidebar>
              <SidebarContent className="flex flex-col gap-2 p-2">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Link href="/superadmin" passHref>
                      <SidebarMenuButton asChild isActive={pathname === '/superadmin'}>
                        <a>
                          <LayoutDashboard />
                          Dashboard
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="/superadmin/tenants" passHref>
                      <SidebarMenuButton asChild isActive={pathname.startsWith('/superadmin/tenants')}>
                        <a>
                          <Building />
                          Tenants
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="#" passHref>
                      <SidebarMenuButton asChild>
                        <a>
                          <Users />
                          Usuarios
                        </a>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link href="#" passHref>
                      <SidebarMenuButton asChild>
                        <a>
                          <FileKey />
                          Licencias
                        </a>
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
          </>
        );
      })()}
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

  useEffect(() => {
    const isLoading = isUserLoading || isUserDocLoading;
    if (isLoading) return;

    if (!user) {
      router.replace('/login');
    } else if (userData && userData.isSuperAdmin !== true) {
      router.replace('/dashboard');
    }
  }, [user, userData, isUserLoading, isUserDocLoading, router]);
  
  console.log("[SuperAdminLayout] Rendering. isUserLoading:", isUserLoading, "isUserDocLoading:", isUserDocLoading, "userData:", userData);

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
  
  return <SuperAdminUI>{children}</SuperAdminUI>;
}
