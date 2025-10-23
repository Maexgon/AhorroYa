
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, LogOut } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Tenant, License, Membership } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { LicensesDataTable } from './data-table';
import { columns } from './columns';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAuth, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function SuperAdminLicensesPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    // The parent layout now ensures that 'user' is available here.
    // We can safely assume firestore and user exist.
    const licensesQuery = useMemoFirebase(() => collection(firestore, 'licenses'), [firestore]);
    const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licensesQuery);

    const tenantsQuery = useMemoFirebase(() => collection(firestore, 'tenants'), [firestore]);
    const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

    const membershipsQuery = useMemoFirebase(() => collection(firestore, 'memberships'), [firestore]);
    const { data: memberships, isLoading: isLoadingMemberships } = useCollection<Membership>(membershipsQuery);

    const tableData = React.useMemo(() => {
        if (!licenses || !tenants || !memberships) return [];

        const tenantMap = new Map(tenants.map(t => [t.id, t]));
        const userCountMap = new Map<string, number>();
        memberships.forEach(m => {
            userCountMap.set(m.tenantId, (userCountMap.get(m.tenantId) || 0) + 1);
        });

        return licenses.map(license => ({
            license,
            tenant: tenantMap.get(license.tenantId),
            userCount: userCountMap.get(license.tenantId) || 0,
        }));
    }, [licenses, tenants, memberships]);

    const isLoading = isLoadingLicenses || isLoadingTenants || isLoadingMemberships;

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
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-30 w-full border-b bg-background">
          <div className="container flex h-14 items-center">
            <SidebarTrigger />
            <h1 className="font-headline text-xl font-bold ml-2">Licencias</h1>
            <div className="ml-auto flex items-center space-x-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                          <Avatar className="h-9 w-9">
                              <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "Usuario"} />
                              <AvatarFallback className="bg-blue-950 text-white">{getInitials(user?.displayName || "")}</AvatarFallback>
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
      <main className="flex-1 p-4 md:p-8">
         <Card>
            <CardHeader>
                <CardTitle>Gestión de Licencias</CardTitle>
                <CardDescription>Visualiza y administra todas las licencias de la plataforma.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <LicensesDataTable columns={columns} data={tableData} />
                )}
            </CardContent>
         </Card>
      </main>
    </div>
  );
}
