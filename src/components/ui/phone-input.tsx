import * as React from "react";
import { cn } from "@/lib/utils";

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Remove all non-numeric characters
      const numericValue = e.target.value.replace(/\D/g, '');
      onChange?.(numericValue);
    };

    // Format phone for display: (XX) XXXXX-XXXX
    const formatPhone = (phone: string): string => {
      if (!phone) return '';
      const cleaned = phone.replace(/\D/g, '');
      
      if (cleaned.length <= 2) return `(${cleaned}`;
      if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
      if (cleaned.length <= 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
      }
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
    };

    return (
      <input
        type="tel"
        inputMode="numeric"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={formatPhone(value || '')}
        onChange={handleChange}
        maxLength={16}
        {...props}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput };
