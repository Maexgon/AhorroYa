'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState, useRef } from 'react';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, LayoutDashboard, Users, Building, FileKey, LogOut, User as UserIcon } from 'lucide-react';
import type { User as UserType } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sidebar, SidebarContent, SidebarMenuItem, SidebarMenu, SidebarMenuButton, SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


function SuperAdminUI({ children, user }: { children: React.ReactNode; user: UserType | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  const handleLogout = async () => {
    const auth = getAuth();
    try {
      await signOut(auth);
      toast({
        title: 'Sesión cerrada',
        description: 'Has cerrado sesión correctamente.',
      });
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
      });
    }
  };
  
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
            <div className="ml-auto flex items-center space-x-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                          <Avatar className="h-9 w-9">
                              <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "Usuario"} />
                              <AvatarFallback>{getInitials(user?.displayName || "")}</AvatarFallback>
                          </Avatar>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                          <p className="font-medium">{user?.displayName}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Cerrar Sesión</span>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
              </DropdownMenu>
            </div>
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

  const [authStatus, setAuthStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading');

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);
  
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);

  useEffect(() => {
    const isLoading = isUserLoading || isUserDocLoading;

    if (isLoading) {
      setAuthStatus('loading');
      return;
    }

    if (user && userData) {
      if (userData.isSuperAdmin === true) {
        setAuthStatus('authorized');
      } else {
        setAuthStatus('unauthorized');
        router.replace('/dashboard');
      }
    } else if (!user) {
      setAuthStatus('unauthorized');
      router.replace('/login');
    } else {
        setAuthStatus('unauthorized');
        router.replace('/dashboard');
    }
    
  }, [isUserLoading, isUserDocLoading, user, userData, router]);


  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (authStatus === 'authorized') {
    return <SuperAdminUI user={user}>{children}</SuperAdminUI>;
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a esta página. Serás redirigido.</p>
    </div>
  );
}
