import { Button } from '@/components/ui/button';
import { DownloadIcon } from 'lucide-react';

interface ShoppingListHeaderProps {
  projectName: string;
  grandTotal: number;
  currencySymbol: string;
  onExportClick: () => void;
}

export function ShoppingListHeader({ 
  projectName, 
  grandTotal, 
  currencySymbol, 
  onExportClick 
}: ShoppingListHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
      <div className="mb-4 sm:mb-0">
        <h1 className="text-2xl font-bold">Shopping List</h1>
        <p className="text-gray-600">
          {projectName} • Total: {currencySymbol}{grandTotal.toFixed(2)}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={onExportClick} variant="outline">
          <DownloadIcon className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}