"use client"

import { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import type { Expense, Category, Subcategory } from "@/lib/types"

// This type is used to define the shape of our data.
// You can use a Zod schema here if you want.
export type ExpenseRow = Expense & {
  category?: Category;
  subcategory?: Subcategory;
}

// We need to add a meta property to our column definitions
// to pass the delete function to the cell renderer.
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    onDelete: (expenseId: string) => void
  }
}


export const columns: ColumnDef<ExpenseRow>[] = [
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
    cell: ({ row }) => <div className="pl-4 font-medium">{row.getValue("entityName")}</div>,
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
    cell: ({ row, column }) => {
      const expense = row.original
      const onDelete = column.columnDef.meta?.onDelete;

      return (
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
              onClick={() => navigator.clipboard.writeText(expense.id)}
            >
              Copiar ID de gasto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Editar Gasto</DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={() => onDelete?.(expense.id)}
            >
              Eliminar Gasto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
