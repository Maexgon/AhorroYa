
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import type { Tenant, License, User } from "@/lib/types"
import { cn } from "@/lib/utils"

export type TenantRow = {
    tenant: Tenant;
    license?: License;
    owner?: User;
}

export type TableMeta = {
    onViewDetails: (tenantId: string) => void;
}

export const columns: ColumnDef<TenantRow>[] = [
  {
    id: "tenant.name", // Explicitly set the column ID here
    accessorKey: "tenant.name",
    header: "Tenant",
     cell: ({ row }) => {
      const { tenant, owner } = row.original;
      return (
        <div>
          <div className="font-medium">{tenant.name}</div>
          <div className="text-xs text-muted-foreground md:hidden">{owner?.email || ''}</div>
          <div className="text-xs text-muted-foreground hidden md:block">{owner?.email || 'N/A'}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "license.plan",
    header: ({ header }) => <div className="hidden md:table-cell">Plan</div>,
    cell: ({ row }) => {
        const plan = row.original.license?.plan || "N/A";
        return <div className="hidden md:table-cell"><Badge variant="outline" className="capitalize">{plan}</Badge></div>;
    },
    filterFn: (row, id, value) => {
        const plan = row.original.license?.plan || "";
        return value.includes(plan);
    }
  },
  {
    accessorKey: "license.status",
    header: () => <div className="hidden md:table-cell">Estado Licencia</div>,
     cell: ({ row }) => {
        const status = row.original.license?.status;
        if (!status) return <div className="hidden md:table-cell"><Badge variant="destructive">Sin Licencia</Badge></div>;

        const isActive = status === 'active';
        return (
            <div className="hidden md:table-cell">
                <Badge variant={isActive ? 'default' : 'secondary'} className={cn(isActive && 'bg-green-600')}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                </Badge>
            </div>
        )
    },
     filterFn: (row, id, value) => {
        const status = row.original.license?.status || "";
        return value.includes(status);
    }
  },
  {
    accessorKey: "tenant.createdAt",
    header: () => <div className="hidden md:table-cell">Fecha Creación</div>,
    cell: ({ row }) => {
        const date = new Date(row.original.tenant.createdAt);
        return <div className="hidden md:table-cell">{date.toLocaleDateString('es-AR')}</div>;
    }
  },
  {
    accessorKey: "license.endDate",
    header: () => <div className="hidden md:table-cell">Vencimiento Licencia</div>,
     cell: ({ row }) => {
        const endDate = row.original.license?.endDate;
        if(!endDate) return <div className="hidden md:table-cell">N/A</div>;
        const date = new Date(endDate);
        const isPast = date < new Date();
        return <div className={cn("hidden md:table-cell", isPast && 'text-destructive')}>{date.toLocaleDateString('es-AR')}</div>;
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const { tenant } = row.original
      const meta = table.options.meta as TableMeta | undefined;
 
      return (
        <div className="text-right">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => meta?.onViewDetails(tenant.id)}>Ver Detalles</DropdownMenuItem>
                <DropdownMenuItem>Administrar Licencia</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                    Borrar Tenant
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
