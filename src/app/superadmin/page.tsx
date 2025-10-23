
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Building, FileKey, Loader2, LogOut, DollarSign } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Tenant, User as UserType, License } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, LabelList } from 'recharts';


export default function SuperAdminPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();

    const tenantsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'tenants');
    }, [firestore]);
    const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'users');
    }, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useCollection<UserType>(usersQuery);

    const licensesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'licenses');
    }, [firestore]);
    const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licensesQuery);

    const activeLicenses = licenses?.filter(l => l.status === 'active').length || 0;
    
    const monthlyIncomeData = React.useMemo(() => {
        if (!licenses) return [];
        const planCosts = {
            personal: 25200 / 12,
            familiar: 80640 / 12,
            empresa: 176400 / 12,
            demo: 0,
        };

        const incomeByPlan = licenses
            .filter(l => l.status === 'active' && planCosts.hasOwnProperty(l.plan))
            .reduce((acc, license) => {
                const monthlyCost = planCosts[license.plan as keyof typeof planCosts];
                acc[license.plan] = (acc[license.plan] || 0) + monthlyCost;
                return acc;
            }, {} as Record<string, number>);

        return Object.entries(incomeByPlan).map(([name, total]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            total,
        })).sort((a,b) => b.total - a.total);

    }, [licenses]);

    const totalMonthlyIncome = monthlyIncomeData.reduce((acc, item) => acc + item.total, 0);
    const formatCurrency = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(value);

    const isLoading = isLoadingTenants || isLoadingUsers || isLoadingLicenses;
    
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
            <SidebarTrigger className="md:flex hidden" />
            <h1 className="font-headline text-xl font-bold ml-2">Dashboard</h1>
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
         {isLoading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
         ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Tenants</CardTitle>
                    <Building className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{tenants?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Total de clientes registrados.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{users?.length || 0}</div>
                    <p className="text-xs text-muted-foreground">Usuarios en toda la plataforma.</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Licencias Activas</CardTitle>
                    <FileKey className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{activeLicenses}</div>
                    <p className="text-xs text-muted-foreground">Del total de {licenses?.length || 0} licencias.</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ingresos Mensuales Estimados</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalMonthlyIncome)}</div>
                    <p className="text-xs text-muted-foreground">Basado en licencias activas.</p>
                    </CardContent>
                </Card>
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Ingresos Estimados por Plan</CardTitle>
                        <CardDescription>Desglose de ingresos mensuales por tipo de plan activo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={monthlyIncomeData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                                <YAxis stroke="hsl(var(--foreground))" fontSize={12} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="rounded-lg border bg-card p-2 shadow-sm text-sm">
                                                    <p className="font-bold">{label}</p>
                                                    <p style={{ color: 'hsl(var(--chart-1))' }}>Ingreso: {formatCurrency(payload[0].value as number)}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                                    <LabelList
                                        dataKey="total"
                                        position="top"
                                        offset={8}
                                        className="fill-foreground"
                                        fontSize={12}
                                        formatter={(value: number) => formatCurrency(value)}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
         )}
      </main>
    </div>
  );
}
