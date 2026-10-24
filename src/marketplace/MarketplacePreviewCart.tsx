import { createContext } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Cart } from '@/runtime/intentExecutor';

export const MarketplaceCartCountContext = createContext(0);

export function MarketplacePreviewCart({ cart, open, onClose, onUpdate }: {
  cart: Cart;
  open: boolean;
  onClose: () => void;
  onUpdate: (productId: string, quantity: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Shopping bag</DialogTitle></DialogHeader>
        {cart.items.length === 0 ? <p>Your bag is empty.</p> : (
          <ul style={{ display: 'grid', gap: 'var(--ut-density-gap)' }}>
            {cart.items.map((item) => (
              <li key={item.productId} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--ut-density-gap)' }}>
                <div><p>{item.name}</p><p>${((item.price ?? 0) * (item.quantity ?? 1)).toFixed(2)}</p></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ut-density-gap)' }}>
                  <Button variant="outline" size="icon" aria-label={`Decrease ${item.name}`} onClick={() => onUpdate(item.productId, (item.quantity ?? 1) - 1)}><Minus /></Button>
                  <output aria-label={`${item.name} quantity`}>{item.quantity ?? 1}</output>
                  <Button variant="outline" size="icon" aria-label={`Increase ${item.name}`} onClick={() => onUpdate(item.productId, (item.quantity ?? 1) + 1)}><Plus /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Remove ${item.name}`} onClick={() => onUpdate(item.productId, 0)}><Trash2 /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p>Total: ${cart.total.toFixed(2)}</p>
        <p>Sample bag only. No payment is taken.</p>
        <Button variant="outline" onClick={onClose}>Continue shopping</Button>
      </DialogContent>
    </Dialog>
  );
}