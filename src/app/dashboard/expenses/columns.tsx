
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Pencil, Trash2, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Expense, Category, Subcategory } from "@/lib/types"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// This type is used to define the shape of our data.
export type ExpenseRow = Expense & {
  category?: Category;
  subcategory?: Subcategory;
  userName?: string;
}

const getInitials = (name: string = "") => {
    const names = name.split(' ');
    if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}


export const columns = (isOwnerOrAdmin: boolean, currentUserId: string): ColumnDef<ExpenseRow>[] => {
  const baseColumns: ColumnDef<ExpenseRow>[] = [
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Fecha
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("date"))
        return <div className="pl-4">{date.toLocaleDateString('es-AR')}</div>
      }
    },
    {
      accessorKey: "entityName",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Entidad
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const notes = row.original.notes
        return (
          <div className="pl-4">
            <div className="font-medium">{row.getValue("entityName")}</div>
            {notes && <div className="text-xs text-muted-foreground">{notes}</div>}
          </div>
        )
      }
    },
    {
      accessorKey: "category",
      header: "Categoría",
      cell: ({ row }) => {
        const category = row.original.category
        if (!category) return null

        // Inline style is used here to apply the dynamic color
        return (
          <Badge
            style={{ backgroundColor: category.color, color: '#fff' }}
            className="text-white"
          >
            {category.name}
          </Badge>
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(row.original.categoryId)
      },
    },
    {
      accessorKey: "subcategory",
      header: "Subcategoría",
      cell: ({ row }) => {
        const subcategory = row.original.subcategory
        return subcategory ? subcategory.name : "N/A"
      },
    },
    {
      accessorKey: "amountARS",
      header: ({ column }) => {
        return (
          <div className="text-right">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              Monto (ARS)
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )
      },
      cell: ({ row }) => {
        const amount = parseFloat(row.getValue("amountARS"))
        const formatted = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
        }).format(amount)

        return <div className="text-right font-mono pr-4">{formatted}</div>
      },
    },
    {
      id: "actions",
      header: () => <div className="text-center">Acciones</div>,
      cell: ({ row, table }) => {
        const expense = row.original
        const { onDelete } = table.options.meta as { onDelete: (id: string) => void };
        const canEdit = expense.userId === currentUserId;

        const editButton = (
          <Button variant="ghost" size="icon" asChild disabled={!canEdit}>
            <Link href={canEdit ? `/dashboard/expenses/edit/${expense.id}` : '#'}>
              {canEdit ? <Pencil className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            </Link>
          </Button>
        );

        const deleteButton = (
           <Button
              variant="ghost"
              size="icon"
              className={canEdit ? "text-destructive hover:text-destructive" : ""}
              onClick={() => canEdit ? onDelete(expense.id) : undefined}
              disabled={!canEdit}
            >
              {canEdit ? <Trash2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            </Button>
        );

        return (
          <div className="flex items-center justify-center gap-2">
            <TooltipProvider>
              {!canEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>{editButton}</TooltipTrigger>
                  <TooltipContent>
                    <p>No puedes editar gastos de otros usuarios.</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                editButton
              )}

              {!canEdit ? (
                <Tooltip>
                  <TooltipTrigger asChild>{deleteButton}</TooltipTrigger>
                  <TooltipContent>
                    <p>No puedes eliminar gastos de otros usuarios.</p>
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
  ];

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
