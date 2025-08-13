import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ChevronDownIcon, 
  ChevronUpIcon, 
  PlusIcon, 
  CalendarIcon 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Doc, Id } from '@/convex/_generated/dataModel';

type TeamMember = {
  _id: Id<"teamMembers">;
  _creationTime: number;
  teamId: Id<"teams">;
  clerkUserId: string;
  clerkOrgId: string;
  role: string;
  permissions: string[];
  name: string;
  email: string;
  imageUrl?: string;
  joinedAt?: number;
  projectIds?: Id<"projects">[];
  isActive: boolean;
};

interface AddItemFormProps {
  sections: Doc<"shoppingListSections">[];
  teamMembers?: TeamMember[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    productLink?: string;
    imageUrl?: string;
    priority: "low" | "medium" | "high" | "urgent";
    realizationStatus: "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED";
    assignedTo?: string;
    buyBefore?: number;
  }) => Promise<void>;
  isPending: boolean;
  defaultSectionId?: Id<"shoppingListSections">;
  isInline?: boolean;
}

export function AddItemForm({ 
  sections, 
  teamMembers, 
  currencySymbol, 
  onAddItem, 
  isPending,
  defaultSectionId,
  isInline = false
}: AddItemFormProps) {
  const [isExpanded, setIsExpanded] = useState(isInline);
  
  // Form states
  const [newItemName, setNewItemName] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"shoppingListSections"> | "none" | "">(defaultSectionId || "");
  const [newItemCatalogNumber, setNewItemCatalogNumber] = useState('');
  const [newItemDimensions, setNewItemDimensions] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemProductLink, setNewItemProductLink] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>('none');
  const [newItemBuyBefore, setNewItemBuyBefore] = useState<Date | undefined>(undefined);

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    try {
      await onAddItem({
        name: newItemName.trim(),
        supplier: newItemSupplier.trim() || undefined,
        category: newItemCategory.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        catalogNumber: newItemCatalogNumber.trim() || undefined,
        dimensions: newItemDimensions.trim() || undefined,
        quantity: newItemQuantity,
        unitPrice: unitPrice,
        productLink: newItemProductLink.trim() || undefined,
        imageUrl: newItemImageUrl.trim() || undefined,
        priority: "medium",
        realizationStatus: "PLANNED",
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
        buyBefore: newItemBuyBefore?.getTime(),
      });

      // Reset form
      setNewItemName('');
      setNewItemSupplier('');
      setNewItemCategory('');
      setNewItemSectionId(defaultSectionId || '');
      setNewItemCatalogNumber('');
      setNewItemDimensions('');
      setNewItemQuantity(1);
      setNewItemUnitPrice('');
      setNewItemProductLink('');
      setNewItemImageUrl('');
      setNewItemAssignedTo('none');
      setNewItemBuyBefore(undefined);
      
      if (!isInline) {
        setIsExpanded(false);
      }
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const formContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium">Product Name *</label>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Kitchen Countertop Navona"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Section</label>
          <Select 
            value={newItemSectionId} 
            onValueChange={(value) => setNewItemSectionId(value as Id<"shoppingListSections"> | "none")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Category</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section._id} value={section._id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Supplier</label>
          <Input
            value={newItemSupplier}
            onChange={(e) => setNewItemSupplier(e.target.value)}
            placeholder="e.g. kronosfera.pl"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Catalog Number</label>
          <Input
            value={newItemCatalogNumber}
            onChange={(e) => setNewItemCatalogNumber(e.target.value)}
            placeholder="e.g. BU1K367PH-3BC1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Category</label>
          <Input
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value)}
            placeholder="e.g. Furniture"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Dimensions</label>
          <Input
            value={newItemDimensions}
            onChange={(e) => setNewItemDimensions(e.target.value)}
            placeholder="e.g. 4100 x 1200"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Quantity</label>
          <Input
            type="number"
            min="1"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Unit Price ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Product Link</label>
          <Input
            value={newItemProductLink}
            onChange={(e) => setNewItemProductLink(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="text-sm font-medium">Image URL</label>
          <Input
            value={newItemImageUrl}
            onChange={(e) => setNewItemImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="text-sm font-medium">Assign To</label>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {teamMembers?.map((member: TeamMember) => (
                <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.imageUrl} />
                      <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                    </Avatar>
                    {member.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Buy Before</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !newItemBuyBefore && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {newItemBuyBefore ? format(newItemBuyBefore, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={newItemBuyBefore}
                onSelect={setNewItemBuyBefore}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleAddItem} disabled={isPending || !newItemName.trim()}>
          {isPending ? 'Adding...' : 'Add Product'}
        </Button>
        {!isInline && (
          <Button 
            variant="outline" 
            onClick={() => setIsExpanded(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return formContent;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:text-gray-600 transition-colors"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <PlusIcon className="h-5 w-5" />
            Add New Product
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </Button>
        </CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {formContent}
        </CardContent>
      )}
    </Card>
  );
} 