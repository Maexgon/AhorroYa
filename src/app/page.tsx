import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { AhorroYaLogo } from '@/components/shared/icons';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-2xl items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <AhorroYaLogo className="h-6 w-6 text-primary" />
            <span className="font-bold font-headline text-foreground">Ahorro Ya</span>
          </Link>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Iniciar Sesión</Link>
              </Button>
              <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/register">Registrarse</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="container relative py-12 md:py-20 lg:py-24">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-primary/20 rounded-full blur-[120px] -z-10" />
            <AhorroYaLogo className="h-20 w-20 text-primary" />
            <h1 className="font-headline text-4xl font-bold leading-tight tracking-tighter text-foreground md:text-5xl lg:text-6xl">
              Toma el control de tus finanzas
            </h1>
            <p className="max-w-[750px] text-lg text-muted-foreground sm:text-xl">
              Ahorro Ya te ayuda a gestionar tus gastos, crear presupuestos y
              alcanzar tus metas financieras con inteligencia.
            </p>
            <div className="flex w-full items-center justify-center space-x-4 py-4 md:pb-6">
              <Button asChild size="lg" className="text-primary-foreground">
                <Link href="/register">
                  Empezar Gratis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-secondary/50">
        <div className="container py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <AhorroYaLogo className="h-5 w-5 text-foreground" />
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                Creado por Ahorro Ya. © {new Date().getFullYear()} Todos los derechos reservados.
              </p>
            </div>
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              Una app para tu bienestar financiero.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
