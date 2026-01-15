import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  EditIcon,
  TrashIcon,
  SaveIcon,
  XIcon,
  PlusIcon,
} from 'lucide-react';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { AddLaborItemForm } from './AddLaborItemForm';

// Common units for labor
const LABOR_UNITS = [
  { value: "m²", label: "m²" },
  { value: "m", label: "m" },
  { value: "hours", label: "hours" },
  { value: "pcs", label: "pcs" },
  { value: "m³", label: "m³" },
  { value: "kg", label: "kg" },
  { value: "set", label: "set" },
  { value: "room", label: "room" },
  { value: "item", label: "item" },
];

type LaborItem = Doc<"laborItems">;

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

interface EditFormData {
  name?: string;
  notes?: string;
  sectionId?: string | Id<"laborSections">;
  quantity?: number;
  unit?: string;
  unitPrice?: string;
  assignedTo?: string;
}

interface LaborListSectionProps {
  sectionName: string;
  sectionId?: Id<"laborSections">;
  items: LaborItem[];
  currencySymbol: string;
  teamMembers?: TeamMember[];
  sections: Doc<"laborSections">[];
  onUpdateItem: (id: Id<"laborItems">, updates: Partial<LaborItem>) => Promise<void>;
  onDeleteItem: (id: Id<"laborItems">) => Promise<void>;
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
}

export function LaborListSection({
  sectionName,
  sectionId,
  items,
  currencySymbol,
  teamMembers,
  sections,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  isPending
}: LaborListSectionProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [showAddForm, setShowAddForm] = useState(false);

  const sectionTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

  const handleStartEdit = (item: LaborItem) => {
    setEditingItemId(item._id);
    setEditFormData({
      name: item.name,
      notes: item.notes || '',
      sectionId: item.sectionId || 'none',
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
      assignedTo: item.assignedTo || 'none'
    });
  };

  const handleSaveEdit = async (itemId: Id<"laborItems">) => {
    const unitPrice = parseFloat(editFormData.unitPrice || '0') || undefined;

    try {
      await onUpdateItem(itemId, {
        name: editFormData.name?.trim() || '',
        notes: editFormData.notes?.trim() || undefined,
        sectionId: editFormData.sectionId === 'none' ? undefined : editFormData.sectionId as Id<"laborSections">,
        quantity: editFormData.quantity || 1,
        unit: editFormData.unit || 'm²',
        unitPrice: unitPrice,
        assignedTo: editFormData.assignedTo === 'none' ? undefined : editFormData.assignedTo,
      });
      setEditingItemId(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData({});
  };

  const getAssignedMemberName = (assignedTo: string) => {
    const member = teamMembers?.find(m => m.clerkUserId === assignedTo);
    return member?.name || assignedTo;
  };

  return (
    <div className="mb-10 rounded-[24px] sm:rounded-[32px] border border-[#E7E2D9] bg-white p-4 sm:p-8 shadow-[0_24px_60px_rgba(20,20,20,0.08)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h2 className="text-xl sm:text-2xl font-medium font-[var(--font-display-serif)] text-[#1A1A1A]">{sectionName}</h2>
          <span className="inline-flex items-center justify-center rounded-full bg-[#FAF7F2] border border-[#E7E2D9] px-3 py-1 text-xs font-medium text-[#8C8880]">
            {items.length} items
          </span>
          {sectionTotal > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#FAF7F2] border border-[#E7E2D9] px-3 py-1 text-xs font-medium text-[#3C3A37]">
              {sectionTotal.toFixed(2)} {currencySymbol}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="self-end sm:self-auto rounded-full hover:bg-[#FAF7F2]"
          onClick={() => setShowAddForm(!showAddForm)}
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Add Item Form */}
        {showAddForm && (
          <div className="mb-8 rounded-[24px] border border-[#E7E2D9] bg-[#FAF7F2] p-6">
            <AddLaborItemForm
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={async (itemData) => {
                await onAddItem({
                  ...itemData,
                  sectionId: sectionId
                });
                setShowAddForm(false);
              }}
              isPending={isPending}
              defaultSectionId={sectionId}
              isInline={true}
            />
          </div>
        )}

        {/* Items Table */}
        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E7E2D9]">
                  <th className="text-left py-3 px-4 text-sm font-medium text-[#8C8880]">Work Description</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#8C8880] w-24">Qty</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-[#8C8880] w-20">Unit</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#8C8880] w-32">Price/Unit</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#8C8880] w-32">Total</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-[#8C8880] w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-[#E7E2D9]/50 hover:bg-[#FAF7F2]/50 transition-colors">
                    {editingItemId === item._id ? (
                      // Edit Mode
                      <>
                        <td className="py-3 px-4">
                          <Input
                            value={editFormData.name || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            className="h-9 rounded-lg text-sm"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editFormData.quantity || 1}
                            onChange={(e) => setEditFormData({ ...editFormData, quantity: parseFloat(e.target.value) || 1 })}
                            className="h-9 rounded-lg text-sm text-right w-20"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <Select
                            value={editFormData.unit || 'm²'}
                            onValueChange={(value) => setEditFormData({ ...editFormData, unit: value })}
                          >
                            <SelectTrigger className="h-9 rounded-lg text-sm w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LABOR_UNITS.map((unit) => (
                                <SelectItem key={unit.value} value={unit.value}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4">
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.unitPrice || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, unitPrice: e.target.value })}
                            className="h-9 rounded-lg text-sm text-right w-28"
                          />
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-medium text-[#1A1A1A]">
                          {((editFormData.quantity || 0) * (parseFloat(editFormData.unitPrice || '0') || 0)).toFixed(2)} {currencySymbol}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleSaveEdit(item._id)}
                              disabled={isPending}
                            >
                              <SaveIcon className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-[#8C8880] hover:text-[#1A1A1A] hover:bg-[#FAF7F2]"
                              onClick={handleCancelEdit}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // View Mode
                      <>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-[#1A1A1A]">{item.name}</span>
                            {item.assignedTo && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Avatar className="h-6 w-6 border border-white shadow-sm">
                                    <AvatarImage src={teamMembers?.find(m => m.clerkUserId === item.assignedTo)?.imageUrl} />
                                    <AvatarFallback className="text-[10px] bg-[#FAF7F2] text-[#3C3A37]">
                                      {getAssignedMemberName(item.assignedTo)?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                </TooltipTrigger>
                                <TooltipContent>{getAssignedMemberName(item.assignedTo)}</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-xs text-[#8C8880] mt-1">{item.notes}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-[#3C3A37]">{item.quantity}</td>
                        <td className="py-3 px-4 text-center text-sm text-[#8C8880]">{item.unit}</td>
                        <td className="py-3 px-4 text-right text-sm text-[#3C3A37]">
                          {item.unitPrice ? `${item.unitPrice.toFixed(2)} ${currencySymbol}` : '-'}
                        </td>
                        <td className="py-3 px-4 text-right text-sm font-medium text-[#1A1A1A]">
                          {item.totalPrice ? `${item.totalPrice.toFixed(2)} ${currencySymbol}` : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-[#8C8880] hover:text-[#1A1A1A] hover:bg-[#FAF7F2]"
                                  onClick={() => handleStartEdit(item)}
                                >
                                  <EditIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-[#8C8880] hover:bg-red-50 hover:text-red-600"
                                  onClick={() => onDeleteItem(item._id)}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              {/* Section Total Row */}
              <tfoot>
                <tr className="bg-[#FAF7F2]">
                  <td colSpan={4} className="py-3 px-4 text-right text-sm font-medium text-[#3C3A37]">
                    Section Total:
                  </td>
                  <td className="py-3 px-4 text-right text-sm font-semibold text-[#1A1A1A]">
                    {sectionTotal.toFixed(2)} {currencySymbol}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {items.length === 0 && !showAddForm && (
          <div className="text-center py-8 text-[#8C8880]">
            <p className="text-sm">No labor items in this section</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setShowAddForm(true)}
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add first item
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


