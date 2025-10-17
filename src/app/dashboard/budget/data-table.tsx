
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  onDelete: (id: string) => void
  rowSelection: object
  setRowSelection: React.Dispatch<React.SetStateAction<object>>
  months: { value: number; name: string }[]
  years: { value: number; label: string }[]
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onDelete,
  rowSelection,
  setRowSelection,
  months,
  years,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    meta: {
      onDelete, // Pass the onDelete function to the table's meta
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    initialState: {
        pagination: {
            pageSize: 10,
        },
    },
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
  })

  return (
    <div>
      <div className="flex items-center py-4 gap-4">
        <Select
          value={String(table.getColumn("month")?.getFilterValue() ?? "all")}
          onValueChange={(value) => {
            if (value === 'all') {
              table.getColumn("month")?.setFilterValue(undefined)
            } else {
              table.getColumn("month")?.setFilterValue([Number(value)])
            }
          }}
        >
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por mes..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos los meses</SelectItem>
                {months.map(m => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.name.charAt(0).toUpperCase() + m.name.slice(1)}</SelectItem>
                ))}
            </SelectContent>
        </Select>
        <Select
          value={String(table.getColumn("year")?.getFilterValue() ?? "all")}
          onValueChange={(value) => {
            if (value === 'all') {
              table.getColumn("year")?.setFilterValue(undefined)
            } else {
              table.getColumn("year")?.setFilterValue([Number(value)])
            }
          }}
        >
            <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Filtrar por año..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">Todos los años</SelectItem>
                {years.map(y => (
                    <SelectItem key={y.value} value={String(y.value)}>{y.label}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No se encontraron presupuestos para el período seleccionado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} fila(s) seleccionadas.
        </div>
        <div className="flex items-center space-x-2">
            <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
                table.setPageSize(Number(value))
            }}
            >
            <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
                {[5, 10, 20, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
             <p className="text-sm font-medium">
                Página {table.getState().pagination.pageIndex + 1} de{" "}
                {table.getPageCount()}
            </p>
            <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
            >
                Anterior
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
            >
                Siguiente
            </Button>
        </div>
      </div>
    </div>
  )
}
