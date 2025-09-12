import { Button } from '@/components/ui/button';
import { DownloadIcon, PlusIcon } from 'lucide-react';

interface ShoppingListHeaderProps {
  projectName: string;
  grandTotal: number;
  currencySymbol: string;
  onExportClick: () => void;
  onAddProductClick: () => void;
}

export function ShoppingListHeader({ 
  projectName, 
  grandTotal, 
  currencySymbol, 
  onExportClick,
  onAddProductClick
}: ShoppingListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
      <div className="mb-4 sm:mb-0">
        <h1 className="text-2xl font-bold">Shopping List</h1>
        <p className="text-gray-600">
          {projectName} • Total: {grandTotal.toFixed(2)} {currencySymbol}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onAddProductClick} variant="default">
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Product
        </Button>
        <Button onClick={onExportClick} variant="outline">
          <DownloadIcon className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}