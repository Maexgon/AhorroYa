
'use client';

import Link from 'next/link';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AhorroYaLogo } from '@/components/shared/icons';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { getFirestore, writeBatch, doc } from "firebase/firestore";
import { FirebaseError } from 'firebase/app';
import { errorEmitter, FirestorePermissionError } from '@/firebase';
import { defaultCategories } from '@/lib/default-categories';


export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [accountType, setAccountType] = React.useState('personal');

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  const [num1, setNum1] = React.useState(0);
  const [num2, setNum2] = React.useState(0);
  const [captcha, setCaptcha] = React.useState('');

  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // These will only run on the client, after initial hydration
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  const passwordValidations = {
    length: password.length >= 8,
    specialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password),
    number: /\d/.test(password),
  };

  const allPasswordReqsMet = Object.values(passwordValidations).every(Boolean);
  const passwordsMatch = password && password === confirmPassword;
  const isCaptchaCorrect = num1 > 0 && parseInt(captcha) === num1 + num2;
  const isFormValid = firstName && lastName && email && allPasswordReqsMet && passwordsMatch && isCaptchaCorrect;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      toast({
        variant: "destructive",
        title: "Error de validación",
        description: "Por favor, completa todos los campos correctamente.",
      });
      return;
    }
    
    setIsLoading(true);

    try {
      const auth = getAuth();
      const firestore = getFirestore();
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const displayName = `${firstName} ${lastName}`;

      await updateProfile(user, { displayName });
      await sendEmailVerification(user);

      const batch = writeBatch(firestore);
      let writes: any[] = [];

      const userRef = doc(firestore, "users", user.uid);
      const tenantRef = doc(firestore, "tenants", crypto.randomUUID());
      const membershipRef = doc(firestore, "memberships", `${tenantRef.id}_${user.uid}`);
      
      const userData = {
        uid: user.uid,
        displayName: displayName,
        email: user.email,
        photoURL: user.photoURL,
        tenantIds: [tenantRef.id],
        isSuperadmin: false,
      };
      batch.set(userRef, userData);
      writes.push({path: userRef.path, data: userData});
      
      const tenantNameMapping = {
        personal: `Espacio de ${firstName}`,
        familiar: `Familia ${lastName}`,
        empresa: `Empresa de ${firstName}`,
      }

      const tenantData = {
        id: tenantRef.id,
        type: accountType.toUpperCase(),
        name: tenantNameMapping[accountType as keyof typeof tenantNameMapping] || `Espacio de ${firstName}`,
        baseCurrency: "ARS",
        createdAt: new Date().toISOString(),
        ownerUid: user.uid,
        status: "pending",
        settings: JSON.stringify({ quietHours: true, rollover: false }),
      };
      batch.set(tenantRef, tenantData);
      writes.push({path: tenantRef.path, data: tenantData});

      const membershipData = {
        tenantId: tenantRef.id,
        uid: user.uid,
        displayName: displayName,
        email: user.email,
        role: 'owner',
        status: 'active',
        joinedAt: new Date().toISOString()
      };
      batch.set(membershipRef, membershipData);
      writes.push({path: membershipRef.path, data: membershipData});
      
      // Add default categories and subcategories
      defaultCategories.forEach((category, catIndex) => {
        const categoryId = crypto.randomUUID();
        const categoryRef = doc(firestore, "categories", categoryId);
        const categoryData = {
            id: categoryId,
            tenantId: tenantRef.id,
            name: category.name,
            color: category.color,
            order: catIndex
        };
        batch.set(categoryRef, categoryData);
        writes.push({path: categoryRef.path, data: categoryData});

        category.subcategories.forEach((subcategoryName, subCatIndex) => {
            const subcategoryId = crypto.randomUUID();
            const subcategoryRef = doc(firestore, "subcategories", subcategoryId);
            const subcategoryData = {
                id: subcategoryId,
                tenantId: tenantRef.id,
                categoryId: categoryId,
                name: subcategoryName,
                order: subCatIndex
            };
            batch.set(subcategoryRef, subcategoryData);
            writes.push({path: subcategoryRef.path, data: subcategoryData});
        });
      });
      
      // If account is personal, create a DEMO license and activate tenant
      if (accountType === 'personal') {
          const licenseRef = doc(firestore, "licenses", crypto.randomUUID());
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + 15); // 15 day demo

          const licenseData = {
              id: licenseRef.id,
              tenantId: tenantRef.id,
              plan: 'demo',
              status: 'active',
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              maxUsers: 1,
          };
          batch.set(licenseRef, licenseData);
          writes.push({path: licenseRef.path, data: licenseData});

          batch.update(tenantRef, { status: "active" });
          writes.push({path: tenantRef.path, data: { status: "active" }});
      }


      await batch.commit()
        .then(() => {
          if (accountType === 'personal') {
             toast({
                title: "¡Cuenta Creada!",
                description: "Tu plan DEMO está activo. Bienvenido a Ahorro Ya.",
            });
            router.push('/dashboard');
          } else {
            toast({
              title: "¡Cuenta creada!",
              description: "Te hemos enviado un correo de verificación. Ahora elige tu plan.",
            });
            router.push('/subscribe');
          }
        })
        .catch(error => {
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({
                path: 'batch-write',
                operation: 'write', 
                requestResourceData: writes,
              })
            );
        });


    } catch (error) {
      let title = "Error al crear la cuenta";
      let description = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
      if (error instanceof FirebaseError) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            title = "Email en uso";
            description = "El correo electrónico que ingresaste ya está registrado.";
            break;
          case 'auth/invalid-email':
            title = "Email inválido";
            description = "Por favor, ingresa un correo electrónico válido.";
            break;
          case 'auth/weak-password':
            title = "Contraseña débil";
            description = "La contraseña debe tener al menos 6 caracteres.";
            break;
          default:
            description = error.message;
            break;
        }
      }
      toast({
        variant: "destructive",
        title,
        description,
      });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <AhorroYaLogo className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl">Crea tu cuenta</CardTitle>
          <CardDescription>Comienza a tomar el control de tus finanzas hoy mismo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input id="firstName" type="text" placeholder="Tu Nombre" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input id="lastName" type="text" placeholder="Tu Apellido" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                {allPasswordReqsMet && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[2.25rem] text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {password.length > 0 && (
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-x-4">
                 <div className={`flex items-center gap-2 ${passwordValidations.length ? 'text-green-500' : ''}`}>
                  {passwordValidations.length ? <CheckCircle2 className="h-3 w-3" /> : null} 8+ caracteres
                </div>
                <div className={`flex items-center gap-2 ${passwordValidations.number ? 'text-green-500' : ''}`}>
                   {passwordValidations.number ? <CheckCircle2 className="h-3 w-3" /> : null} Un número
                </div>
                 <div className={`flex items-center gap-2 ${passwordValidations.specialChar ? 'text-green-500' : ''}`}>
                  {passwordValidations.specialChar ? <CheckCircle2 className="h-3 w-3" /> : null} Un carácter especial
                </div>
              </div>
            )}
             <div className="space-y-2 relative">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                {passwordsMatch && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input 
                id="confirmPassword" 
                type={showConfirmPassword ? 'text' : 'password'} 
                required 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
               <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[2.25rem] text-muted-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="space-y-3">
              <Label>Tipo de cuenta</Label>
              <RadioGroup value={accountType} onValueChange={setAccountType} className="grid grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="personal" id="personal" className="peer sr-only" />
                  <Label
                    htmlFor="personal"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Personal
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="familiar" id="familiar" className="peer sr-only" />
                  <Label
                    htmlFor="familiar"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Familiar
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="empresa" id="empresa" className="peer sr-only" />
                  <Label
                    htmlFor="empresa"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    Empresa
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="captcha">¿Cuánto es {num1} + {num2}?</Label>
                {isCaptchaCorrect && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <Input 
                id="captcha" 
                type="number" 
                required 
                value={captcha}
                onChange={(e) => setCaptcha(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="underline">
              Inicia Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );

    



    


    

    


