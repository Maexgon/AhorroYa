
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
import type { Membership } from "@/lib/types"
import { cn } from "@/lib/utils"

export type TableMeta = {
    onPromote: (member: Membership) => void;
    onDemote: (member: Membership) => void;
    onDelete: (member: Membership) => void;
    currentUserId: string;
    adminCount: number;
    maxAdmins: number;
}

export const getColumns = (): ColumnDef<Membership>[] => [
  {
    accessorKey: "displayName",
    header: "Miembro",
    cell: ({ row }) => {
        const member = row.original;
        return (
            <div>
                <div className="font-medium">{member.displayName}</div>
                <div className="text-sm text-muted-foreground">{member.email}</div>
            </div>
        )
    },
  },
  {
    accessorKey: "role",
    header: "Rol",
    cell: ({ row }) => {
        const role = row.getValue("role") as string;
        const variant = role === 'owner' ? 'default' : (role === 'admin' ? 'secondary' : 'outline');
        const roleText = role.charAt(0).toUpperCase() + role.slice(1);

        return (
            <Badge 
                variant={variant}
                className={cn({
                    'bg-primary text-primary-foreground': role === 'owner',
                    'bg-accent text-accent-foreground': role === 'admin',
                })}
            >
                {roleText}
            </Badge>
        )
    }
  },
  {
    accessorKey: "status",
    header: "Estado",
    cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const variant = status === 'active' ? 'default' : 'destructive';
         return <Badge variant={variant} className={status === 'active' ? 'bg-green-600' : ''}>{status}</Badge>
    }
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const member = row.original
      const meta = table.options.meta as TableMeta | undefined;
      
      const isCurrentUser = member.uid === meta?.currentUserId;
      const canPromote = meta ? meta.adminCount < meta.maxAdmins : false;

      // The owner cannot be demoted or deleted via this menu.
      if (member.role === 'owner' || !meta) {
        return null;
      }
 
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
                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(member.email)}>
                    Copiar Email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {member.role === 'member' && (
                    <DropdownMenuItem onClick={() => meta.onPromote(member)} disabled={!canPromote}>
                        Promover a Administrador
                    </DropdownMenuItem>
                )}
                {member.role === 'admin' && (
                    <DropdownMenuItem onClick={() => meta.onDemote(member)}>
                        Revocar Admin
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => meta.onDelete(member)}
                >
                    Eliminar miembro
                </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
