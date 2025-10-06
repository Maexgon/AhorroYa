import { AhorroYaLogo } from "@/components/shared/icons";

export default function Footer() {
  return (
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
  );
}
