
"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Progress } from "@/components/ui/progress"
import type { Budget } from "@/lib/types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type BudgetRow = {
  id: string;
  categoryName: string;
  categoryColor: string;
  month: number;
  year: number;
  amountARS: number;
  spent: number;
  remaining: number;
  percentage: number;
  categoryId: string;
  details: Budget[];
}

export const getColumns = (
  onDelete: (id: string) => void,
  formatCurrency: (amount: number) => string
): ColumnDef<BudgetRow>[] => [
  {
    id: "expander",
    header: () => null,
    cell: ({ row }) => {
      return row.getCanExpand() ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={row.getToggleExpandedHandler()}
          className="h-8 w-8"
        >
          {row.getIsExpanded() ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ) : null
    },
  },
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
    accessorKey: "categoryName",
    header: "Categoría",
    cell: ({ row }) => {
      return (
        <Badge style={{ backgroundColor: row.original.categoryColor, color: '#fff' }} className="w-fit">
            {row.original.categoryName}
        </Badge>
      )
    },
  },
  {
    accessorKey: "month",
    header: "Mes",
    cell: ({ row }) => {
        const date = new Date(row.original.year, row.original.month - 1);
        const monthName = date.toLocaleString('es', { month: 'long' });
        return <div className="capitalize">{monthName}</div>;
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "year",
    header: "Año",
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: "amountARS",
    header: () => <div className="text-right">Presupuestado</div>,
    cell: ({ row }) => <div className="text-right font-mono">{formatCurrency(row.original.amountARS)}</div>,
  },
  {
    accessorKey: "spent",
    header: () => <div className="text-right">Gastado</div>,
    cell: ({ row }) => <div className="text-right font-mono">{formatCurrency(row.original.spent)}</div>,
  },
  {
    accessorKey: "remaining",
    header: () => <div className="text-right">Restante</div>,
    cell: ({ row }) => (
        <div className={`text-right font-mono ${row.original.remaining < 0 ? 'text-destructive' : 'text-green-600'}`}>
            {formatCurrency(row.original.remaining)}
        </div>
    ),
  },
  {
    accessorKey: "percentage",
    header: "Progreso",
    cell: ({ row }) => {
        const percentage = row.original.percentage;
        return (
            <div className='flex items-center gap-2'>
                <Progress value={percentage > 100 ? 100 : percentage} className="h-2" />
                <span className='text-xs font-mono'>{Math.round(percentage)}%</span>
            </div>
        )
    }
  },
]
