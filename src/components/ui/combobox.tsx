
"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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
    // Sync external value with internal input value
    const selectedOption = options.find(opt => opt.value === value || opt.label === value);
    setInputValue(selectedOption?.label || value);
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(opt => opt.label.toLowerCase() === currentValue.toLowerCase());
    onSelect(selectedOption ? selectedOption.label : currentValue);
    setInputValue(selectedOption ? selectedOption.label : currentValue);
    setOpen(false);
  }
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onSelect(newValue); // Update the form state continuously
  }

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return [];
    return options.filter(option =>
      option.label.toLowerCase().includes(inputValue.toLowerCase())
    );
  }, [inputValue, options]);

  // Logic to control popover visibility based on user requirements
  React.useEffect(() => {
    if (inputValue.length >= 5 && filteredOptions.length > 0) {
      if (!open) setOpen(true);
    } else {
      if (open) setOpen(false);
    }
  }, [inputValue, filteredOptions, open]);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
            <Input
                placeholder={placeholder}
                value={inputValue}
                onChange={handleInputChange}
                className={cn("w-full justify-between", className)}
            />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {filteredOptions.map((option) => (
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
