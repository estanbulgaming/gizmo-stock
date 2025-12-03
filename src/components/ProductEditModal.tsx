import { useState } from 'react';
import { X, Trash2, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { NumpadInput } from './NumpadInput';
import { StockData } from '../types/stock';
import { formatPrice } from '../utils/product';

interface ProductEditModalProps {
  product: StockData;
  onClose: () => void;
  onSave: (updates: {
    name?: string;
    barcode?: string;
    price?: number;
    cost?: number;
    enableStock?: boolean;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
}

export function ProductEditModal({
  product,
  onClose,
  onSave,
  onDelete,
  onRestore,
}: ProductEditModalProps) {
  const [name, setName] = useState(product.name);
  const [barcode, setBarcode] = useState(product.barcode);
  const [price, setPrice] = useState<number | ''>(product.price ?? '');
  const [cost, setCost] = useState<number | ''>(product.cost ?? '');
  const [enableStock, setEnableStock] = useState(product.enableStock ?? false);
  const [saving, setSaving] = useState(false);

  const hasChanges =
    name !== product.name ||
    barcode !== product.barcode ||
    (price !== '' && price !== product.price) ||
    (cost !== '' && cost !== product.cost) ||
    enableStock !== (product.enableStock ?? false);

  const handleSave = async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updates: {
        name?: string;
        barcode?: string;
        price?: number;
        cost?: number;
        enableStock?: boolean;
      } = {};

      if (name !== product.name) updates.name = name;
      if (barcode !== product.barcode) updates.barcode = barcode;
      if (price !== '' && price !== product.price) updates.price = price;
      if (cost !== '' && cost !== product.cost) updates.cost = cost;
      if (enableStock !== (product.enableStock ?? false)) updates.enableStock = enableStock;

      await onSave(updates);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`"${product.name}" ürününü silmek istediğinize emin misiniz?`)) return;
    await onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg w-full max-w-md shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-lg">Ürün Düzenle</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Product ID */}
          <p className="text-sm text-muted-foreground">ID: {product.id}</p>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Ad</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ürün adı"
            />
          </div>

          {/* Barcode */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-barcode">Barkod</Label>
            <Input
              id="edit-barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Barkod"
            />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label>Fiyat</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground min-w-[80px]">
                Mevcut: {formatPrice(product.price)}
              </span>
              <span className="text-muted-foreground">→</span>
              <NumpadInput
                value={price}
                onChange={(v) => setPrice(v === '' ? '' : Number(v))}
                placeholder="Yeni fiyat"
                allowDecimal
                step={0.01}
                className="flex-1"
              />
            </div>
          </div>

          {/* Cost */}
          <div className="space-y-1.5">
            <Label>Maliyet</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground min-w-[80px]">
                Mevcut: {formatPrice(product.cost)}
              </span>
              <span className="text-muted-foreground">→</span>
              <NumpadInput
                value={cost}
                onChange={(v) => setCost(v === '' ? '' : Number(v))}
                placeholder="Yeni maliyet"
                allowDecimal
                step={0.01}
                className="flex-1"
              />
            </div>
          </div>

          {/* Enable Stock */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="edit-enableStock"
              checked={enableStock}
              onCheckedChange={(checked) => setEnableStock(checked as boolean)}
            />
            <label htmlFor="edit-enableStock" className="text-sm cursor-pointer">
              Stok Takibi
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          {product.isDeleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRestore}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Geri Al
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Sil
            </Button>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
