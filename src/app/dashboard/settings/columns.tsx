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
import type { Membership, User } from "@/lib/types"
import { useDoc } from "@/firebase/firestore/use-doc"
import { useFirestore, useMemoFirebase } from "@/firebase/provider"
import { doc } from "firebase/firestore"
import { useMemo } from "react"


const MemberCell = ({ uid, displayName }: { uid: string, displayName: string }) => {
    const firestore = useFirestore();
    const userDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'users', uid);
    }, [firestore, uid]);

    const { data: userData } = useDoc<User>(userDocRef);
    const email = useMemo(() => userData?.email || 'cargando...', [userData]);
    
    return (
        <div>
            <div className="font-medium">{displayName}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
        </div>
    )
};


export const columns: ColumnDef<Membership>[] = [
  {
    accessorKey: "displayName",
    header: "Miembro",
    cell: ({ row }) => <MemberCell uid={row.original.uid} displayName={row.original.displayName} />,
  },
  {
    accessorKey: "role",
    header: "Rol",
    cell: ({ row }) => {
        const role = row.getValue("role") as string;
        const variant = role === 'owner' ? 'default' : 'secondary';
        return <Badge variant={variant} className={role === 'owner' ? 'bg-primary' : ''}>{role}</Badge>
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
    cell: ({ row }) => {
      const member = row.original
 
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
                <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(member.uid)}
                >
                Copiar Email
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Editar rol</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">Eliminar miembro</DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      )
    },
  },
]
