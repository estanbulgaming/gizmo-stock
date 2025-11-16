import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';

interface NumpadInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  className?: string;
  defaultValue?: number;
}

export function NumpadInput({ value, onChange, placeholder = "0", className = "", defaultValue }: NumpadInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value.toString());
  const [isNewInput, setIsNewInput] = useState(false); // Track if this is a fresh input
  const _inputRef = useRef<HTMLInputElement>(null);
  const previousValueRef = useRef<string>(value === '' ? '' : value.toString());

  useEffect(() => {
    setDisplayValue(value.toString());
    previousValueRef.current = value === '' ? '' : value.toString();
  }, [value]);

  // Keyboard support when popover is open
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      // digits 0-9 (main row)
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleNumberClick(key);
        return;
      }
      // numpad digits via code
      const code: string = (e as KeyboardEvent).code || '';
      if (/^Numpad[0-9]$/.test(code)) {
        e.preventDefault();
        handleNumberClick(code.replace('Numpad', ''));
        return;
      }
      if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }
      if (key === 'Delete') {
        e.preventDefault();
        handleClear();
        return;
      }
      if (key === 'Enter') {
        e.preventDefault();
        handleConfirm();
        return;
      }
      if (key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        handleIncrement();
        return;
      }
      if (key === 'ArrowDown') {
        e.preventDefault();
        handleDecrement();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, displayValue]);

  const handleNumberClick = (num: string) => {
    let newValue: string;
    
    // If this is a new input (first number click after opening), replace the value
    if (isNewInput) {
      newValue = num;
      setIsNewInput(false); // Now we're continuing with this input
    } else {
      // Continue building the current number
      newValue = displayValue === '' || displayValue === '0' ? num : displayValue + num;
    }
    
    setDisplayValue(newValue);
    const numericValue = parseInt(newValue) || 0;
    onChange(numericValue);
  };

  const handleClear = () => {
    setDisplayValue('');
    setIsNewInput(false); // Reset new input flag
    onChange('');
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1);
    setDisplayValue(newValue);
    setIsNewInput(false); // Reset new input flag when editing
    onChange(newValue === '' ? '' : parseInt(newValue) || 0);
  };

  const handleIncrement = () => {
    const currentValue = parseInt(displayValue) || 0;
    const newValue = currentValue + 1;
    setDisplayValue(newValue.toString());
    setIsNewInput(false); // Reset new input flag when using increment
    onChange(newValue);
  };

  const handleDecrement = () => {
    const currentValue = parseInt(displayValue) || 0;
    const newValue = Math.max(0, currentValue - 1);
    setDisplayValue(newValue.toString());
    setIsNewInput(false); // Reset new input flag when using decrement
    onChange(newValue);
  };

  const _handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setDisplayValue(newValue);
    setIsNewInput(false); // Reset new input flag when typing
    onChange(newValue === '' ? '' : parseInt(newValue) || 0);
  };

  const handleConfirm = () => {
    setIsOpen(false);
    setIsNewInput(false); // Reset when closing
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setIsNewInput(false); // Reset when popover closes
      }
    }}>
      <PopoverTrigger asChild>
        <div
          onClick={() => {
            if (defaultValue !== undefined && (value === '' || value === 0)) {
              setDisplayValue(defaultValue.toString());
              onChange(defaultValue);
              setIsNewInput(true); // Mark as new input when showing default value
            } else if (value !== '' && value !== 0) {
              setIsNewInput(true); // Mark as new input when there's an existing value
            } else {
              setIsNewInput(false); // Empty input, continue normally
            }
            setIsOpen(true);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(true);
              setIsNewInput(true);
            }
          }}
          className={`w-full px-2 py-1 border rounded text-center cursor-pointer bg-white ${className}`}
        >
          {displayValue || placeholder}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 sm:w-64 p-2 sm:p-3" 
        align="center"
        side="bottom"
        sideOffset={5}
        avoidCollisions={true}
        collisionPadding={10}
      >
        <div className="space-y-2 sm:space-y-3">
          {/* Display */}
          <div className="text-center p-2 sm:p-3 bg-muted rounded border">
            <div className="text-xl sm:text-2xl font-mono">{displayValue || '0'}</div>
          </div>
          
          {/* Up/Down Controls */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleIncrement}
              className="flex-1"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDecrement}
              className="flex-1"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Number Grid */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                onClick={() => handleNumberClick(num.toString())}
                className="h-10 sm:h-12 text-base sm:text-lg"
              >
                {num}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={handleClear}
              className="h-10 sm:h-12 text-xs sm:text-sm"
            >
              Temizle
            </Button>
            <Button
              variant="outline"
              onClick={() => handleNumberClick('0')}
              className="h-10 sm:h-12 text-base sm:text-lg"
            >
              0
            </Button>
            <Button
              variant="outline"
              onClick={handleBackspace}
              className="h-10 sm:h-12 text-xs sm:text-sm"
            >
              ←
            </Button>
          </div>

          {/* Confirm Button */}
          <Button 
            onClick={handleConfirm}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Tamam
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
