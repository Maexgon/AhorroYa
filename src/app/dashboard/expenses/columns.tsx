
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Expense, Category, Subcategory } from "@/lib/types"
import Link from "next/link"

// This type is used to define the shape of our data.
export type ExpenseRow = Expense & {
  category?: Category;
  subcategory?: Subcategory;
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
    header: () => <div className="text-center">Acciones</div>,
    cell: ({ row, column }) => {
      const expense = row.original
      const { onDelete } = (column.columnDef.meta as { onDelete: (id: string) => void }) || {}

      return (
        <div className="flex items-center justify-center gap-2">
           <Button variant="ghost" size="icon" asChild>
                <Link href={`/dashboard/expenses/edit/${expense.id}`}>
                    <Pencil className="h-4 w-4" />
                </Link>
           </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete?.(expense.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  },
]
