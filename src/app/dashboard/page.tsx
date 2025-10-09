'use client';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AhorroYaLogo } from '@/components/shared/icons';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { collection, query, where } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Tenant, License, User as AppUser, Category } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, UserPlus, FileText, Repeat, XCircle, Plus, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MultiSelect } from '@/components/shared/multi-select';

function OwnerDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();

  // 1. Fetch current user's active tenant
  const tenantsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'tenants'),
      where('ownerUid', '==', user.uid),
      where('status', '==', 'active')
    );
  }, [firestore, user]);
  const { data: tenants, isLoading: isLoadingTenants } = useCollection<Tenant>(tenantsQuery);
  const activeTenant = tenants?.[0];

  // 2. Fetch the license for the active tenant
  const licenseQuery = useMemoFirebase(() => {
    if (!firestore || !activeTenant) return null;
    return query(
      collection(firestore, 'licenses'),
      where('tenantId', '==', activeTenant.id)
    );
  }, [firestore, activeTenant]);
  const { data: licenses, isLoading: isLoadingLicense } = useCollection<License>(licenseQuery);
  const activeLicense = licenses?.[0];

  // 3. Fetch members of the active tenant
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !activeTenant) return null;
    return query(
        collection(firestore, 'memberships'),
        where('tenantId', '==', activeTenant.id)
    );
  }, [firestore, activeTenant]);
  const { data: memberships, isLoading: isLoadingMemberships } = useCollection<any>(membersQuery);
  
  const userIds = useMemoFirebase(() => memberships?.map(m => m.uid) || [], [memberships]);
  
  // 4. Fetch user details for the members
  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !userIds || userIds.length === 0) return null;
    return query(
        collection(firestore, 'users'),
        where('uid', 'in', userIds)
    );
  }, [firestore, userIds]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<AppUser>(usersQuery);

  // 5. Fetch categories for the active tenant
    const categoriesQuery = useMemoFirebase(() => {
    if (!firestore || !activeTenant) return null;
    return query(
        collection(firestore, 'categories'),
        where('tenantId', '==', activeTenant.id)
    );
  }, [firestore, activeTenant]);
  const { data: categories, isLoading: isLoadingCategories } = useCollection<Category>(categoriesQuery);


  const [date, setDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });

  const isLoading = isLoadingTenants || isLoadingLicense || isLoadingMemberships || isLoadingUsers || isLoadingCategories;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const userOptions = users?.map(u => ({ value: u.uid, label: u.displayName })) || [];
  const categoryOptions = categories?.map(c => ({ value: c.id, label: c.name })) || [];
  const currencyOptions = [{ value: 'ARS', label: 'ARS' }, { value: 'USD', label: 'USD' }];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
        <div className="bg-card shadow rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <AhorroYaLogo className="h-10 w-10 text-primary" />
                <div>
                    <h2 className="text-lg font-bold text-foreground">
                        Licencia {activeLicense?.plan.charAt(0).toUpperCase() + activeLicense?.plan.slice(1)} - Hasta {activeLicense?.maxUsers} usuarios.
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Vencimiento: {activeLicense ? format(new Date(activeLicense.endDate), 'P', { locale: es }) : 'N/A'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant={activeLicense?.status === 'active' ? 'default' : 'destructive'} className={activeLicense?.status === 'active' ? 'bg-green-500 hover:bg-green-600' : ''}>
                    {activeLicense?.status === 'active' ? 'Activa' : 'Inactiva'}
                </Badge>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem><UserPlus className="mr-2 h-4 w-4" />Invitar usuarios</DropdownMenuItem>
                        <DropdownMenuItem><FileText className="mr-2 h-4 w-4" />Administrar licencia</DropdownMenuItem>
                        <DropdownMenuItem><Repeat className="mr-2 h-4 w-4" />Renovar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10"><XCircle className="mr-2 h-4 w-4" />Cancelar</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>

        <Button className='w-full md:w-auto'>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto
        </Button>

        <div className="bg-card shadow rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4">Filtros</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                 <MultiSelect
                    options={userOptions}
                    selected={[]}
                    onChange={() => {}}
                    placeholder="Miembros"
                    className="w-full"
                />
                <MultiSelect
                    options={categoryOptions}
                    selected={[]}
                    onChange={() => {}}
                    placeholder="Categorías"
                    className="w-full"
                />
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <span>ARS</span>
                            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        {/* Placeholder for currency select */}
                        <div className="p-2">ARS</div>
                    </PopoverContent>
                </Popover>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className="w-full justify-start text-left font-normal"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {format(date.from, "LLL dd, y", { locale: es })} -{" "}
                                        {format(date.to, "LLL dd, y", { locale: es })}
                                    </>
                                ) : (
                                    format(date.from, "LLL dd, y", { locale: es })
                                )
                            ) : (
                                <span>Selecciona un rango</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={date?.from}
                            selected={date}
                            onSelect={setDate}
                            numberOfMonths={2}
                            locale={es}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
        
        {/* Placeholder for charts */}
        <div className="text-center py-10">
            <p className="text-muted-foreground">Los gráficos se mostrarán aquí.</p>
        </div>

    </div>
  );
}


export default function DashboardPageContainer() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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

  if (isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <AhorroYaLogo className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }
  
  // TODO: Add logic to differentiate between owner and member dashboard
  const isOwner = true; 

  return (
    <div className="flex min-h-screen flex-col">
       <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="container flex h-16 items-center">
          <div  className="mr-6 flex items-center space-x-2">
            <AhorroYaLogo className="h-6 w-6 text-primary" />
            <span className="font-bold font-headline text-foreground">Ahorro Ya</span>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
             <Button onClick={handleLogout} variant="ghost">Cerrar Sesión</Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {isOwner ? <OwnerDashboard /> : <div className="p-8"><p>Dashboard de Miembro Próximamente</p></div>}
      </main>
    </div>
  );
}
