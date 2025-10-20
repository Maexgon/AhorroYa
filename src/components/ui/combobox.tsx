
"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"


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
  const [inputValue, setInputValue] = React.useState("")

  React.useEffect(() => {
    const selectedOption = options.find(opt => opt.value === value || opt.label === value);
    setInputValue(selectedOption?.label || value);
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(opt => opt.label === currentValue);
    onSelect(selectedOption ? selectedOption.label : currentValue);
    setInputValue(selectedOption ? selectedOption.label : currentValue);
    setOpen(false);
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onSelect(newValue);
    if (!open) {
      setOpen(true);
    }
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
            <Input
                placeholder={placeholder}
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => {if (inputValue) setOpen(true)}}
                className={cn("w-full justify-between", className)}
            />
            <ChevronsUpDown 
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 cursor-pointer"
                onClick={() => setOpen(!open)}
            />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command filter={(value, search) => {
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
        }}>
          <CommandList>
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
            {inputValue && !options.some(opt => opt.label.toLowerCase() === inputValue.toLowerCase()) && (
                <CommandItem onSelect={() => handleSelect(inputValue)}>
                     <Plus className="mr-2 h-4 w-4" />
                     Crear "{inputValue}"
                </CommandItem>
            )}
             {options.length === 0 && !inputValue && (
                <CommandEmpty>{emptyPlaceholder}</CommandEmpty>
             )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
