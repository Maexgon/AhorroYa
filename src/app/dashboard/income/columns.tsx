
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Pencil, Trash2, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Income } from "@/lib/types"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export type IncomeRow = Income & {
    userName?: string;
}

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export const getColumns = (
    onDelete: (id: string) => void,
    formatCurrency: (amount: number) => string,
    isOwnerOrAdmin: boolean,
    currentUserId: string
): ColumnDef<IncomeRow>[] => {
    const baseColumns: ColumnDef<IncomeRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Fecha
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
     cell: ({ row }) => {
      const date = new Date(row.getValue("date"))
      return <div className="pl-4">{date.toLocaleDateString('es-AR')}</div>
    }
  },
  {
    accessorKey: "description",
    header: "Descripción",
    cell: ({ row }) => <div className="font-medium">{row.getValue("description")}</div>,
  },
  {
    accessorKey: "category",
    header: "Categoría",
    cell: ({ row }) => {
      const category = row.getValue("category") as string
      const categoryColors: { [key: string]: string } = {
        salarios: "bg-green-500",
        inversiones: "bg-blue-500",
        "premios o comisiones": "bg-yellow-500",
        otros: "bg-gray-500",
      }
      return (
        <Badge
          className={`text-white ${categoryColors[category] || 'bg-gray-400'}`}
        >
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "amountARS",
    header: ({ column }) => (
      <div className="text-right">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Monto (ARS)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    ),
    cell: ({ row }) => <div className="text-right font-mono pr-4">{formatCurrency(row.getValue("amountARS"))}</div>,
  },
   {
    id: "actions",
    header: () => <div className="text-center">Acciones</div>,
    cell: ({ row, table }) => {
      const income = row.original
      const canEdit = income.userId === currentUserId;

      const editButton = (
        <Button variant="ghost" size="icon" asChild disabled={!canEdit}>
          <Link href={canEdit ? `/dashboard/income/edit/${income.id}` : '#'}>
            {canEdit ? <Pencil className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
          </Link>
        </Button>
      );

      const deleteButton = (
         <Button
            variant="ghost"
            size="icon"
            className={canEdit ? "text-destructive hover:text-destructive" : ""}
            onClick={() => canEdit ? onDelete(income.id) : undefined}
            disabled={!canEdit}
          >
            {canEdit ? <Trash2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
          </Button>
      );

      return (
        <div className="flex items-center justify-center gap-1">
          <TooltipProvider>
            {!canEdit ? (
              <Tooltip>
                <TooltipTrigger asChild>{editButton}</TooltipTrigger>
                <TooltipContent>
                  <p>No puedes editar ingresos de otros usuarios.</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              editButton
            )}

            {!canEdit ? (
              <Tooltip>
                <TooltipTrigger asChild>{deleteButton}</TooltipTrigger>
                <TooltipContent>
                  <p>No puedes eliminar ingresos de otros usuarios.</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              deleteButton
            )}
          </TooltipProvider>
        </div>
      )
    },
  },
]

    if (isOwnerOrAdmin) {
        baseColumns.splice(3, 0, {
            accessorKey: "userName",
            header: "Usuario",
            cell: ({ row }) => {
                const userName = row.original.userName || "";
                return (
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium hidden lg:table-cell">{userName}</span>
                    </div>
                )
            },
        });
    }

    return baseColumns;
}
