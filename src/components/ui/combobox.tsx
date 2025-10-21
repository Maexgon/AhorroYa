
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { label: string; value: string; cuit?: string; }[];
    value: string;
    onSelect: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyPlaceholder?: string;
    className?: string;
}

export function Combobox({ 
    options, 
    value, 
    onSelect, 
    placeholder = "Select option...", 
    searchPlaceholder = "Search...",
    emptyPlaceholder = "No option found.",
    className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (currentValue: string) => {
    onSelect(currentValue === value ? "" : currentValue);
    setOpen(false)
  }

  const selectedLabel = options.find(option => option.label === value)?.label || value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("w-full justify-between font-normal", className)}
            >
                {selectedLabel || placeholder}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command
          filter={(optionValue, search) => {
              if (optionValue.toLowerCase().includes(search.toLowerCase())) return 1;
              return 0;
          }}
        >
            <CommandInput 
                placeholder={searchPlaceholder}
            />
            <CommandList>
                <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
                <CommandGroup>
                    {options.map((option) => (
                    <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={handleSelect}
                    >
                        <Check
                        className={cn(
                            "mr-2 h-4 w-4",
                            value === option.label ? "opacity-100" : "opacity-0"
                        )}
                        />
                        {option.label}
                    </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
