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
    options: { label: string; value: string }[];
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
  const [inputValue, setInputValue] = React.useState(value || "")
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
      const selectedOption = options.find(opt => opt.value === value);
      setInputValue(selectedOption?.label || value);
  }, [value, options]);

  const handleSelect = (currentValue: string) => {
    const selectedOption = options.find(opt => opt.label.toLowerCase() === currentValue.toLowerCase());
    onSelect(selectedOption ? selectedOption.value : currentValue);
    setInputValue(selectedOption ? selectedOption.label : currentValue);
    setOpen(false);
    setSearch("");
  }
  
  const filteredOptions = React.useMemo(() => {
    if (!search || search.length < 5) return [];
    return options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()));
  }, [search, options]);


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSearch(newValue); // Update search term as user types
    onSelect(newValue); // Allow free text entry by updating form state

    if (newValue.length >= 5) {
        const matchingOptions = options.filter(opt => opt.label.toLowerCase().includes(newValue.toLowerCase()));
        setOpen(matchingOptions.length > 0);
    } else {
        setOpen(false);
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
                onBlur={() => setOpen(false)} // Close popover on blur
                onFocus={(e) => {
                    const value = e.target.value;
                    if(value.length >= 5) {
                        const matchingOptions = options.filter(opt => opt.label.toLowerCase().includes(value.toLowerCase()));
                        setOpen(matchingOptions.length > 0);
                    }
                }}
                className={cn("w-full justify-between", className)}
            />
            <ChevronsUpDown 
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 cursor-pointer"
                onClick={() => setOpen(!open)}
            />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
            <CommandList>
                {filteredOptions.length === 0 ? (
                  <div className="py-6 text-center text-sm">{emptyPlaceholder}</div>
                ) : (
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
                            value === option.value ? "opacity-100" : "opacity-0"
                            )}
                        />
                        {option.label}
                        </CommandItem>
                    ))}
                  </CommandGroup>
                )}
            </CommandList>
          </Command>
      </PopoverContent>
    </Popover>
  )
}
