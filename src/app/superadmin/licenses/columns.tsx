
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
import type { Tenant, License } from "@/lib/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

export type LicenseRow = {
    license: License;
    tenant?: Tenant;
    userCount: number;
}

export type TableMeta = {
    onEdit: (license: License) => void;
}


export const columns: ColumnDef<LicenseRow>[] = [
  {
    id: "tenant.name",
    accessorKey: "tenant.name",
    header: "Tenant",
     cell: ({ row }) => {
      const { tenant } = row.original;
      return (
        <div>
          <div className="font-medium">{tenant?.name || 'N/A'}</div>
          <div className="text-xs text-muted-foreground hidden md:block">{tenant?.id || ''}</div>
        </div>
      );
    },
  },
  {
    accessorKey: "license.plan",
    header: "Plan",
    cell: ({ row }) => {
        const plan = row.original.license?.plan || "N/A";
        return <div className="md:table-cell"><Badge variant="outline" className="capitalize">{plan}</Badge></div>;
    },
    filterFn: (row, id, value) => {
        const plan = row.original.license?.plan || "";
        return value.includes(plan);
    }
  },
  {
    accessorKey: "license.status",
    header: "Estado",
     cell: ({ row }) => {
        const status = row.original.license?.status;
        if (!status) return <Badge variant="destructive">N/A</Badge>;

        const isActive = status === 'active';
        return (
            <div>
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
    accessorKey: "userCount",
    header: () => <div className="hidden md:table-cell text-center">Usuarios</div>,
    cell: ({ row }) => {
        const { license, userCount } = row.original;
        const usage = `${userCount} / ${license.maxUsers}`;
        const isFull = userCount >= license.maxUsers;
        return <div className={cn("hidden md:table-cell text-center", isFull && "font-bold text-destructive")}>{usage}</div>
    }
  },
  {
    accessorKey: "license.endDate",
    header: () => <div className="hidden md:table-cell">Vencimiento</div>,
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
      const { license } = row.original
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
                <DropdownMenuItem onClick={() => meta?.onEdit(license)}>Editar Licencia</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href="/superadmin/tenants">Ver Tenant</Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
