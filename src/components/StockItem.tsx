import { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Label } from './ui/label';

interface StockItemProps {
  id: string;
  name: string;
  currentCount: number;
  onChange: (id: string, newCount: number) => void;
}

export function StockItem({ id, name, currentCount, onChange }: StockItemProps) {
  const [tempCount, setTempCount] = useState(currentCount);

  useEffect(() => {
    setTempCount(currentCount);
  }, [currentCount]);

  const handleChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setTempCount(numValue);
    onChange(id, numValue);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <Label className="text-sm text-muted-foreground">Product</Label>
          <p className="font-medium">{name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">Current</Label>
            <p className="font-medium">{currentCount}</p>
          </div>
          <div className="w-24">
            <Label htmlFor={`stock-${id}`} className="text-sm text-muted-foreground">
              New Count
            </Label>
            <Input
              id={`stock-${id}`}
              type="number"
              value={tempCount}
              onChange={(e) => handleChange(e.target.value)}
              min="0"
              className="text-center"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}