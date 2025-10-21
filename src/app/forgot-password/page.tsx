
'use client';

import Link from 'next/link';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AhorroYaLogo } from '@/components/shared/icons';
import { useToast } from "@/hooks/use-toast";
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSent, setIsSent] = React.useState(false);

  React.useEffect(() => {
    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery) {
      setEmail(emailFromQuery);
    }
  }, [searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      
      setIsSent(true);
      toast({
        title: "Correo enviado",
        description: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.",
      });

    } catch (error) {
      let title = "Error al enviar el correo";
      let description = "Ocurrió un error inesperado. Por favor, inténtalo de nuevo.";
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/invalid-email') {
          title = "Email inválido";
          description = "Por favor, ingresa un correo electrónico válido.";
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
          <div className="mx-auto mb-4 w-40 h-auto">
            <AhorroYaLogo className="h-full w-full" />
          </div>
          <CardTitle className="font-headline text-2xl">Recuperar Contraseña</CardTitle>
          <CardDescription>
            {isSent 
                ? "Revisa tu bandeja de entrada (y la carpeta de spam)." 
                : "Ingresa tu correo para recibir un enlace de recuperación."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
        {isSent ? (
            <div className="text-center text-muted-foreground">
                <p>Se ha enviado un enlace para restablecer tu contraseña a <span className="font-bold text-foreground">{email}</span>.</p>
                <p className="mt-2 text-sm">Puede tardar unos minutos en llegar.</p>
            </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Enviando...' : 'Enviar Correo de Recuperación'}
            </Button>
          </form>
        )}
        </CardContent>
        <CardFooter>
            <Button variant="outline" className="w-full" asChild>
                <Link href="/login">
                    <ArrowLeft className="mr-2 h-4 w-4"/> Volver a Iniciar Sesión
                </Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
