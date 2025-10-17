'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, writeBatch, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Loader2, ShieldAlert, Plus, Trash2, Pencil, Palette, GripVertical, Check, X } from 'lucide-react';
import { DataTable } from '@/app/dashboard/expenses/data-table';
import { columns as memberColumns } from './columns';
import type { Tenant, User as UserType, License, Membership, Category, Subcategory } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';


function ManageCategories({ tenantId }: { tenantId: string }) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<Array<Category & { subcategories: Subcategory[] }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'newCat' | 'editCat' | 'newSub' | 'editSub'>('newCat');
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [currentSubCategory, setCurrentSubCategory] = useState<Subcategory | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#00C2A8');
  const [isProcessing, setIsProcessing] = useState(false);

  const categoriesQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'categories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: rawCategories } = useCollection<Category>(categoriesQuery);

  const subcategoriesQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'subcategories'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: rawSubcategories } = useCollection<Subcategory>(subcategoriesQuery);


  useMemo(() => {
      if(rawCategories && rawSubcategories) {
          const grouped = rawCategories.map(cat => ({
              ...cat,
              subcategories: rawSubcategories.filter(sub => sub.categoryId === cat.id).sort((a,b) => a.order - b.order)
          })).sort((a,b) => a.order - b.order);
          setCategories(grouped);
          setIsLoading(false);
      }
  }, [rawCategories, rawSubcategories]);

  const openDialog = (mode: 'newCat' | 'editCat' | 'newSub' | 'editSub', category?: Category, subCategory?: Subcategory) => {
    setDialogMode(mode);
    setCurrentCategory(category || null);
    setCurrentSubCategory(subCategory || null);
    if(mode === 'editCat' && category) {
      setName(category.name);
      setColor(category.color);
    } else if (mode === 'editSub' && subCategory) {
      setName(subCategory.name);
    } else {
      setName('');
      setColor('#00C2A8');
    }
    setIsDialogOpen(true);
  };
  
  const handleSave = async () => {
    if (!name || !firestore) return;
    setIsProcessing(true);

    try {
      if (dialogMode === 'newCat') {
        const newCatRef = doc(collection(firestore, 'categories'));
        const newCategoryData = { tenantId, name, color, order: categories.length };
        await addDoc(collection(firestore, 'categories'), newCategoryData);
      } else if (dialogMode === 'editCat' && currentCategory) {
        const catRef = doc(firestore, 'categories', currentCategory.id);
        const updatedData = { name, color };
        await updateDoc(catRef, updatedData);
      } else if (dialogMode === 'newSub' && currentCategory) {
        const newSubRef = doc(collection(firestore, 'subcategories'));
        const newSubcategoryData = { tenantId, categoryId: currentCategory.id, name, order: currentCategory.subcategories.length };
        await addDoc(collection(firestore, 'subcategories'), newSubcategoryData);
      } else if (dialogMode === 'editSub' && currentSubCategory) {
        const subCatRef = doc(firestore, 'subcategories', currentSubCategory.id);
        await updateDoc(subCatRef, { name });
      }
      toast({ title: "¡Éxito!", description: "La operación se completó correctamente." });
    } catch(e) {
      toast({ variant: 'destructive', title: "Error", description: "No se pudo guardar el cambio." });
    } finally {
      setIsProcessing(false);
      setIsDialogOpen(false);
    }
  }

  const handleDelete = async (type: 'category' | 'subcategory', id: string) => {
      if (!firestore) return;

      const performDelete = async () => {
        setIsProcessing(true);
        try {
          if (type === 'category') {
            const catToDelete = categories.find(c => c.id === id);
            if (catToDelete && catToDelete.subcategories.length > 0) {
              toast({ variant: 'destructive', title: "Error", description: "No puedes eliminar una categoría con subcategorías. Elimínalas primero." });
              return;
            }
            await deleteDoc(doc(firestore, 'categories', id));
          } else {
            await deleteDoc(doc(firestore, 'subcategories', id));
          }
          toast({ title: "Eliminado", description: "El elemento ha sido eliminado." });
        } catch (e) {
          toast({ variant: 'destructive', title: "Error", description: "No se pudo eliminar el elemento." });
        } finally {
          setIsProcessing(false);
        }
      };
      
      // Simple confirmation for now
      if (window.confirm("¿Estás seguro de que quieres eliminar este elemento? Esta acción no se puede deshacer.")) {
        performDelete();
      }
  }


  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Categorías y Subcategorías</CardTitle>
          <CardDescription>Organiza tus clasificaciones de gastos.</CardDescription>
        </div>
        <Button onClick={() => openDialog('newCat')}> <Plus className="mr-2 h-4 w-4" /> Nueva Categoría</Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          {categories.map(category => (
            <div key={category.id} className="border-b last:border-b-0">
              <div className="flex items-center p-4 bg-muted/50">
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                  <div className="w-4 h-4 rounded-full mx-4" style={{ backgroundColor: category.color }} />
                  <span className="flex-1 font-semibold">{category.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => openDialog('newSub', category)}>Agregar Subcategoría</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog('editCat', category)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete('category', category.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {category.subcategories.length > 0 && (
                 <div className="pl-12 py-2 space-y-1">
                    {category.subcategories.map(sub => (
                      <div key={sub.id} className="flex items-center group">
                          <span className="flex-1 text-sm text-muted-foreground">{sub.name}</span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openDialog('editSub', category, sub)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete('subcategory', sub.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                      </div>
                    ))}
                 </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>
                    {dialogMode === 'newCat' && 'Nueva Categoría'}
                    {dialogMode === 'editCat' && 'Editar Categoría'}
                    {dialogMode === 'newSub' && `Nueva Subcategoría en "${currentCategory?.name}"`}
                    {dialogMode === 'editSub' && 'Editar Subcategoría'}
                  </DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                  <div className="space-y-2">
                      <Label htmlFor="name">Nombre</Label>
                      <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  {(dialogMode === 'newCat' || dialogMode === 'editCat') && (
                    <div className="space-y-2">
                      <Label htmlFor="color">Color</Label>
                      <div className="relative">
                        <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} className="pl-8" />
                        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute left-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 border-none cursor-pointer" />
                      </div>
                  </div>
                  )}
              </div>
              <DialogFooter>
                  <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={isProcessing}>{isProcessing ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

    </Card>
  );
}


export default function SettingsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [isOwner, setIsOwner] = React.useState(false);

  // Fetch user's data to get the tenantId
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData, isLoading: isUserDocLoading } = useDoc<UserType>(userDocRef);
  
  React.useEffect(() => {
    if (userData?.tenantIds && userData.tenantIds.length > 0) {
      setTenantId(userData.tenantIds[0]);
    }
  }, [userData]);
  
  // Fetch tenant data to check for ownership
  const tenantDocRef = useMemoFirebase(() => {
    if (!firestore || !tenantId) return null;
    return doc(firestore, 'tenants', tenantId);
  }, [firestore, tenantId]);
  const { data: tenantData, isLoading: isTenantLoading } = useDoc<Tenant>(tenantDocRef);
  
  React.useEffect(() => {
    if(tenantData && user) {
        setIsOwner(tenantData.ownerUid === user.uid);
    }
  }, [tenantData, user]);

  const membersQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'memberships'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: members, isLoading: isLoadingMembers } = useCollection<Membership>(membersQuery);

  const licenseQuery = useMemoFirebase(() => {
      if (!firestore || !tenantId) return null;
      return query(collection(firestore, 'licenses'), where('tenantId', '==', tenantId));
  }, [firestore, tenantId]);
  const { data: licenses, isLoading: isLoadingLicenses } = useCollection<License>(licenseQuery);

  const activeLicense = licenses?.[0];

  const isLoading = isUserLoading || isUserDocLoading || isTenantLoading || isLoadingMembers || isLoadingLicenses;
  
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-secondary/50 p-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="mt-4 font-headline text-2xl font-bold">Acceso Denegado</h1>
        <p className="mt-2 text-muted-foreground">Solo el propietario de la cuenta puede acceder a esta sección.</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard">Volver al Dashboard</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/50">
        <header className="sticky top-0 z-40 w-full border-b bg-background">
            <div className="container flex h-16 items-center">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/dashboard">
                        <ArrowLeft />
                    </Link>
                </Button>
                <h1 className="ml-4 font-headline text-xl font-bold">Administración</h1>
            </div>
        </header>

        <main className="flex-1 p-4 md:p-8">
             <Tabs defaultValue="members" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="members">Miembros</TabsTrigger>
                    <TabsTrigger value="categories">Categorías</TabsTrigger>
                    <TabsTrigger value="license">Licencia</TabsTrigger>
                </TabsList>
                <TabsContent value="members">
                    <Card>
                        <CardHeader>
                            <CardTitle>Miembros del Tenant</CardTitle>
                            <CardDescription>
                                Administra los usuarios que tienen acceso a este espacio de trabajo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <DataTable columns={memberColumns} data={members || []} categories={[]} onDelete={() => {}} />
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="categories">
                   {tenantId && <ManageCategories tenantId={tenantId} />}
                </TabsContent>
                <TabsContent value="license">
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles de la Licencia</CardTitle>
                             <CardDescription>
                                Información sobre tu plan actual y límites.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {activeLicense ? (
                                <>
                                    <p><strong>Plan:</strong> <Badge>{activeLicense.plan}</Badge></p>
                                    <p><strong>Estado:</strong> <Badge variant={activeLicense.status === 'active' ? 'default' : 'destructive'} className={activeLicense.status === 'active' ? 'bg-green-500' : ''}>{activeLicense.status}</Badge></p>
                                    <p><strong>Usuarios:</strong> {members?.length || 0} de {activeLicense.maxUsers}</p>
                                    <p><strong>Válida hasta:</strong> {new Date(activeLicense.endDate).toLocaleDateString()}</p>
                                </>
                            ) : (
                                <p>No se encontró información de la licencia.</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
             </Tabs>
        </main>
    </div>
  );
}
