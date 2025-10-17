"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
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
import { useCollection } from "@/firebase"
import { useFirestore, useMemoFirebase } from "@/firebase/provider"
import { collection, query, where } from "firebase/firestore"
import { useMemo } from "react"


const MemberCell = ({ uid }: { uid: string }) => {
    const firestore = useFirestore();
    const userQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('uid', '==', uid));
    }, [firestore, uid]);

    const { data: userData } = useCollection<User>(userQuery);
    const email = useMemo(() => userData?.[0]?.email || uid, [userData, uid]);
    
    return <div className="lowercase text-muted-foreground">{email}</div>;
};


export const columns: ColumnDef<Membership>[] = [
  {
    accessorKey: "displayName",
    header: "Nombre",
  },
  {
    accessorKey: "uid",
    header: "Email",
    cell: ({ row }) => <MemberCell uid={row.getValue("uid")} />,
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
