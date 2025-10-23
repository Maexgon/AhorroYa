
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export type UserRow = {
    user: User;
    tenantCount: number;
}

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export const columns: ColumnDef<UserRow>[] = [
  {
    accessorKey: "user.displayName",
    header: "Usuario",
     cell: ({ row }) => {
      const { user } = row.original;
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
    accessorKey: "tenantCount",
    header: "Tenants",
    cell: ({ row }) => {
        const count = row.original.tenantCount;
        return <div className="text-center">{count}</div>
    }
  },
  {
    accessorKey: "user.isSuperadmin",
    header: "Superadmin",
    cell: ({ row }) => {
        const isSuperadmin = row.original.user.isSuperadmin;
        return (
            <div className="flex justify-center">
                {isSuperadmin ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
            </div>
        )
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const { user } = row.original
 
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
                <DropdownMenuItem>Ver Detalles</DropdownMenuItem>
                <DropdownMenuItem>Convertir en Superadmin</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                    Borrar Usuario
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
