import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Wallet, ScanLine, Target, BarChart, WifiOff, Sparkles } from "lucide-react";

const features = [
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Soporte Multi-Tenant",
    description: "Gestiona finanzas personales, familiares o de tu pequeña empresa, todo en un solo lugar con roles y permisos definidos."
  },
  {
    icon: <Wallet className="h-8 w-8 text-primary" />,
    title: "Seguimiento de Gastos",
    description: "Registra tus gastos con detalles como categoría, moneda y método de pago, con conversión automática a tu moneda base."
  },
  {
    icon: <ScanLine className="h-8 w-8 text-primary" />,
    title: "OCR para Recibos",
    description: "Sube una foto de tus recibos y deja que nuestra IA extraiga los datos para crear borradores de gastos automáticamente."
  },
  {
    icon: <Target className="h-8 w-8 text-primary" />,
    title: "Presupuestos Inteligentes",
    description: "Crea presupuestos mensuales por categoría, aprovecha el saldo no gastado (rollover) y recibe alertas para no excederte."
  },
  {
    icon: <BarChart className="h-8 w-8 text-primary" />,
    title: "Reportes y Exportación",
    description: "Visualiza tus hábitos de gasto con gráficos claros y exporta tus datos a Excel para un análisis más profundo."
  },
  {
    icon: <Sparkles className="h-8 w-8 text-primary" />,
    title: "Análisis con IA",
    description: "Recibe sugerencias personalizadas para reasignar tu presupuesto y optimizar tus ahorros basadas en tu historial."
  }
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-secondary/50 py-16 md:py-24 lg:py-32">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-headline text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Una herramienta para cada necesidad financiera
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Desde el registro automático de gastos hasta la planificación de presupuestos, Ahorro Ya te da el poder de mejorar tu salud financiera.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="flex flex-col items-start text-left bg-card hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                  {feature.icon}
                </div>
                <CardTitle className="font-headline text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
