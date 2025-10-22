import Link from 'next/link';
import { Button } from '@/components/ui/button';
import DashboardPreview from '@/components/landing/dashboard-preview';
import { ArrowRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <section className="relative text-white">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/img/hero-background.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/60" />
      <div className="container relative py-12 md:py-20 lg:py-24">
        <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
          <h1 className="font-headline text-4xl font-bold leading-tight tracking-tighter md:text-5xl lg:text-6xl">
            Toma el control de tus finanzas
          </h1>
          <p className="max-w-[750px] text-lg text-gray-200 sm:text-xl">
            Ahorro Ya te ayuda a gestionar tus gastos, crear presupuestos y
            alcanzar tus metas financieras con inteligencia.
          </p>
          <div className="flex w-full flex-col items-center justify-center space-y-4 py-4 md:flex-row md:space-y-0 md:space-x-4 md:pb-6">
            <Button asChild size="lg" className="w-full text-primary-foreground md:w-auto">
              <Link href="/register">
                Empezar Gratis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full md:w-auto bg-transparent hover:bg-white/10 border-white text-white">
              <Link href="#features">
                Conocer más
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full md:w-auto bg-transparent hover:bg-white/10 border-white text-white">
              <Link href="#pricing">
                Precios
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container relative">
        <div className="relative mx-auto mt-12 max-w-6xl">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-primary/20 rounded-full blur-[120px] -z-10" />
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
