import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Doc, Id } from '@/convex/_generated/dataModel';
import type { TeamMember } from '@/lib/teamMember';

// Common units for labor
const LABOR_UNITS = [
  { value: "m²", label: "Square meters (m²)" },
  { value: "m", label: "Linear meters (m)" },
  { value: "hours", label: "Hours" },
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "m³", label: "Cubic meters (m³)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "set", label: "Complete set" },
  { value: "room", label: "Per room" },
  { value: "item", label: "Per item" },
];


interface AddLaborItemFormProps {
  sections: Doc<"laborSections">[];
  teamMembers?: TeamMember[];
  currencySymbol: string;
  onAddItem: (itemData: {
    name: string;
    notes?: string;
    sectionId?: Id<"laborSections">;
    quantity: number;
    unit: string;
    unitPrice?: number;
    assignedTo?: string;
  }) => Promise<void>;
  isPending: boolean;
  defaultSectionId?: Id<"laborSections">;
  isInline?: boolean;
}

export function AddLaborItemForm({
  sections,
  teamMembers,
  currencySymbol,
  onAddItem,
  isPending,
  defaultSectionId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isInline = false
}: AddLaborItemFormProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"laborSections"> | "none" | "">(defaultSectionId || "");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('m²');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>('none');

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    try {
      await onAddItem({
        name: newItemName.trim(),
        notes: newItemNotes.trim() || undefined,
        sectionId: newItemSectionId === "none" ? undefined : (newItemSectionId || undefined),
        quantity: newItemQuantity,
        unit: newItemUnit,
        unitPrice: unitPrice,
        assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
      });

      // Reset form
      setNewItemName('');
      setNewItemNotes('');
      setNewItemSectionId(defaultSectionId || '');
      setNewItemQuantity(1);
      setNewItemUnit('m²');
      setNewItemUnitPrice('');
      setNewItemAssignedTo('none');
    } catch (error) {
      console.error('Error creating item:', error);
    }
  };

  const totalPrice = newItemUnitPrice ? newItemQuantity * parseFloat(newItemUnitPrice) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Work Description *</label>
          <Input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g. Tile installation"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Section</label>
          <Select
            value={newItemSectionId}
            onValueChange={(value) => setNewItemSectionId(value as Id<"laborSections"> | "none")}
          >
            <SelectTrigger className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]">
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
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Quantity *</label>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(parseFloat(e.target.value) || 0)}
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Unit *</label>
          <Select value={newItemUnit} onValueChange={setNewItemUnit}>
            <SelectTrigger className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]">
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              {LABOR_UNITS.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Price per Unit ({currencySymbol})</label>
          <Input
            type="number"
            step="0.01"
            value={newItemUnitPrice}
            onChange={(e) => setNewItemUnitPrice(e.target.value)}
            placeholder="0.00"
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Assign To (Contractor)</label>
          <Select
            value={newItemAssignedTo}
            onValueChange={setNewItemAssignedTo}
          >
            <SelectTrigger className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]">
              <SelectValue placeholder="Select contractor" />
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
        <div className="lg:col-span-2">
          <label className="text-sm font-medium text-[#3C3A37] mb-1.5 block">Notes</label>
          <Input
            value={newItemNotes}
            onChange={(e) => setNewItemNotes(e.target.value)}
            placeholder="Additional notes..."
            className="h-12 rounded-[18px] border-[#E7E2D9] bg-white text-sm focus-visible:ring-[#6D8B73]"
          />
        </div>
      </div>

      {/* Total preview */}
      {totalPrice > 0 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="text-[#8C8880]">Total:</span>
          <span className="font-medium text-[#1A1A1A]">
            {totalPrice.toFixed(2)} {currencySymbol}
          </span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button
          onClick={handleAddItem}
          disabled={isPending || !newItemName.trim()}
          className="rounded-full bg-[#0E0E0E] px-6 h-11 text-white shadow-[0_14px_36px_rgba(14,14,14,0.18)] hover:bg-[#1F1F1F]"
        >
          {isPending ? 'Adding...' : 'Add Labor Item'}
        </Button>
      </div>
    </div>
  );
}
