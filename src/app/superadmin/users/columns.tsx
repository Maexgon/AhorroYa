
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
import type { Membership, User, Tenant } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type MembershipRow = {
    membership: Membership;
    user?: User;
    tenant?: Tenant;
}

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export const columns: ColumnDef<MembershipRow>[] = [
  {
    id: "user.displayName", // Explicitly set ID for filtering
    accessorKey: "user.displayName",
    header: "Usuario",
     cell: ({ row }) => {
      const { user } = row.original;
      if (!user) return "Usuario no encontrado";
      return (
         <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.photoURL || ''} alt={user.displayName} />
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{user.displayName}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
        </div>
      );
    },
  },
  {
    id: "tenant.name",
    accessorKey: "tenant.name",
    header: "Tenant",
     cell: ({ row }) => {
        const { tenant } = row.original;
        return <div className="font-medium">{tenant?.name || 'N/A'}</div>;
    },
  },
  {
    accessorKey: "membership.role",
    header: "Rol",
    cell: ({ row }) => {
        const role = row.original.membership.role;
        return <Badge variant={role === 'owner' ? 'default' : 'secondary'} className={cn(role === 'owner' && 'bg-primary')}>{role}</Badge>;
    }
  },
   {
    accessorKey: "membership.joinedAt",
    header: "Fecha de Ingreso",
    cell: ({ row }) => {
        const date = new Date(row.original.membership.joinedAt);
        return <div>{date.toLocaleDateString('es-AR')}</div>;
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const { membership } = row.original
 
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
                <DropdownMenuItem>Ver Usuario</DropdownMenuItem>
                <DropdownMenuItem>Ver Tenant</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                    Revocar Acceso
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
