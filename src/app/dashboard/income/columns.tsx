"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import type { Income } from "@/lib/types"
import Link from "next/link"

export const getColumns = (
    onDelete: (id: string) => void,
    formatCurrency: (amount: number) => string
): ColumnDef<Income>[] => [
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
    cell: ({ row }) => {
      const income = row.original

      return (
        <div className="flex items-center justify-center gap-1">
           <Button variant="ghost" size="icon" asChild>
                <Link href={`/dashboard/income/edit/${income.id}`}>
                    <Pencil className="h-4 w-4" />
                </Link>
           </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(income.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
  },
]
