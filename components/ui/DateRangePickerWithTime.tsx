"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "./input";
import { Label } from "./label";

interface DateRangePickerWithTimeProps {
  className?: string;
  value: DateRange | undefined;
  onChange: (value: DateRange | undefined) => void;
  disabled?: boolean;
}

export function DateRangePickerWithTime({
  className,
  value,
  onChange,
  disabled = false,
}: DateRangePickerWithTimeProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(value);
  const [tempStartTime, setTempStartTime] = useState("");
  const [tempEndTime, setTempEndTime] = useState("");
  
  useEffect(() => {
    setTempDateRange(value);
    if (value?.from) {
      const fromDate = new Date(value.from);
      const hasStartTime = fromDate.getUTCHours() !== 0 || fromDate.getUTCMinutes() !== 0;
      setTempStartTime(hasStartTime ? format(fromDate, "HH:mm") : "");
    } else {
      setTempStartTime("");
    }
    if (value?.to) {
      const toDate = new Date(value.to);
      const hasEndTime = toDate.getUTCHours() !== 0 || toDate.getUTCMinutes() !== 0;
      setTempEndTime(hasEndTime ? format(toDate, "HH:mm") : "");
    } else {
      setTempEndTime("");
    }
  }, [value, isOpen]);

  const formatDisplayDate = (date: Date): string => {
    const hasTime = date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
    return hasTime ? format(date, "PPP, HH:mm") : format(date, "PPP");
  };

  const handleSave = () => {
    const combineDateTime = (date: Date | undefined, time: string): Date | undefined => {
        if (!date) return undefined;

        if (time) {
            // If time is provided, set it on the local date.
            const newDate = new Date(date);
            const [hours, minutes] = time.split(':').map(Number);
            if (!isNaN(hours) && !isNaN(minutes)) {
                newDate.setHours(hours, minutes, 0, 0);
            }
            return newDate;
        } else {
            // If no time is provided, create a date at midnight UTC for that calendar day.
            return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        }
    };

    const finalStartDate = combineDateTime(tempDateRange?.from, tempStartTime);
    const finalEndDate = combineDateTime(tempDateRange?.to, tempEndTime);

    onChange({ from: finalStartDate, to: finalEndDate });
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal cursor-pointer",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value?.from ? (
            value.to ? (
              <>
                {formatDisplayDate(value.from)} - {formatDisplayDate(value.to)}
              </>
            ) : (
              formatDisplayDate(value.from)
            )
          ) : (
            <span>Pick a date or date range</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          initialFocus
          mode="range"
          defaultMonth={value?.from}
          selected={tempDateRange}
          onSelect={setTempDateRange}
          numberOfMonths={2}
        />
        <div className="p-4 border-t grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="start-time" className="text-xs">Start time</Label>
                <Input
                    id="start-time"
                    type="time"
                    className="time-input-icon-only"
                    value={tempStartTime}
                    onChange={(e) => setTempStartTime(e.target.value)}
                    disabled={!tempDateRange?.from}
                />
            </div>
            <div>
                <Label htmlFor="end-time" className="text-xs">End time</Label>
                <Input
                    id="end-time"
                    type="time"
                    className="time-input-icon-only"
                    value={tempEndTime}
                    onChange={(e) => setTempEndTime(e.target.value)}
                    disabled={!tempDateRange?.to && !tempDateRange?.from}
                />
            </div>
        </div>
        <div className="p-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
} 