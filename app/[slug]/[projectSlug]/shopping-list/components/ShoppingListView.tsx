'use client';

import { useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  PlusIcon, 
  TrashIcon, 
  ShoppingCartIcon,

  LinkIcon,

  ChevronDownIcon,
  ChevronUpIcon,
  FolderPlusIcon,
  PenIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

type ShoppingListItem = Doc<"shoppingListItems">;
type Priority = ShoppingListItem["priority"];
type Status = ShoppingListItem["realizationStatus"];

interface EditFormData {
  name?: string;
  supplier?: string;
  category?: string;
  sectionId?: string | Id<"shoppingListSections">;
  catalogNumber?: string;
  dimensions?: string;
  quantity?: number;
  unitPrice?: string;
  productLink?: string;
  imageUrl?: string;
  priority?: Priority;
  buyBefore?: string;
  assigneeId?: string;
}

const statusColors: Record<Status, string> = {
  PLANNED: 'bg-gray-100 text-gray-800',
  ORDERED: 'bg-blue-100 text-blue-800',
  IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
  DELIVERED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabels: Record<Status, string> = {
  PLANNED: 'Planned',
  ORDERED: 'Ordered',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function ShoppingListViewSkeleton() {
  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div className="mb-4 sm:mb-0">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-36" />
        </div>
      </div>

      {/* Add Item Form Skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-7 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>

      {/* Items List Skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-1/3" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(2)].map((_, j) => (
                  <div key={j} className="flex items-center gap-4 p-2 border rounded-md">
                    <Skeleton className="h-12 w-12 rounded" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ShoppingListView() {
  const params = useParams<{ slug: string, projectSlug: string }>();
  const [isPending, startTransition] = useTransition();

  const project = useQuery(api.projects.getProjectBySlug, {
    teamSlug: params.slug,
    projectSlug: params.projectSlug,
  });

  const items = useQuery(api.shopping.listShoppingListItems, project ? { projectId: project._id } : 'skip');
  const sections = useQuery(api.shopping.listShoppingListSections, project ? { projectId: project._id } : 'skip');

  const createItem = useMutation(api.shopping.createShoppingListItem);
  const updateItem = useMutation(api.shopping.updateShoppingListItem);
  const deleteItem = useMutation(api.shopping.deleteShoppingListItem);
  const createSection = useMutation(api.shopping.createShoppingListSection);
  const deleteSection = useMutation(api.shopping.deleteShoppingListSection);

  // Form states
  const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
  const [isAddSectionExpanded, setIsAddSectionExpanded] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemSectionId, setNewItemSectionId] = useState<Id<"shoppingListSections"> | "none" | "">("");
  const [newItemCatalogNumber, setNewItemCatalogNumber] = useState('');
  const [newItemDimensions, setNewItemDimensions] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState('');
  const [newItemProductLink, setNewItemProductLink] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  
  // Edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});

  if (!project || items === undefined || sections === undefined) {
    // This will be handled by Suspense
    return null;
  }
  
  if (project === null) {
      return <div>Project not found</div>
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;
    
    startTransition(async () => {
      try {
        await createSection({ name: newSectionName.trim(), projectId: project._id });
        setNewSectionName('');
        setIsAddSectionExpanded(false);
        toast.success("Section created");
      } catch (error) {
        console.error('Error creating section:', error);
        toast.error("Error creating section");
      }
    });
  };

  const handleDeleteSection = async (sectionId: Id<"shoppingListSections">) => {
    const section = sections.find(s => s._id === sectionId);
    if (!section) return;

    const hasItems = items.some(item => item.sectionId === sectionId);
    if (hasItems) {
      if (!confirm(`Section "${section.name}" contains products. Are you sure you want to delete it? Products will be moved to "No Category".`)) {
        return;
      }
    }
    
    startTransition(async () => {
        try {
            await deleteSection({ sectionId });
            toast.success("Section deleted");
        } catch (error) {
            console.error('Error deleting section:', error);
            toast.error("Error deleting section");
        }
    });
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;

    const unitPrice = parseFloat(newItemUnitPrice) || undefined;

    startTransition(async () => {
      try {
        await createItem({
            projectId: project._id,
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
            priority: "MEDIUM",
            realizationStatus: "PLANNED",
        });

        // Reset form
        setNewItemName('');
        setNewItemSupplier('');
        setNewItemCategory('');
        setNewItemSectionId('');
        setNewItemCatalogNumber('');
        setNewItemDimensions('');
        setNewItemQuantity(1);
        setNewItemUnitPrice('');
        setNewItemProductLink('');
        setNewItemImageUrl('');
        setIsAddFormExpanded(false);
        toast.success("Product added");
      } catch (error) {
        console.error('Error creating item:', error);
        toast.error("Error adding product");
      }
    });
  };

  const handleUpdateItem = async (id: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => {
    startTransition(async () => {
      try {
        await updateItem({ itemId: id, ...updates });
      } catch (error) {
        console.error('Error updating item:', error);
        toast.error("Error updating item");
      }
    });
  };

  const handleDeleteItem = async (id: Id<"shoppingListItems">) => {
    startTransition(async () => {
        try {
            await deleteItem({ itemId: id });
            toast.success("Item deleted");
        } catch(error) {
            console.error('Error deleting item:', error);
            toast.error("Error deleting item");
        }
    });
  };

  const handleRejectItem = (id: Id<"shoppingListItems">) => {
    handleUpdateItem(id, { realizationStatus: 'CANCELLED' });
  };

  const handleStartEdit = (item: ShoppingListItem) => {
    setEditingItemId(item._id);
    setEditFormData({
      name: item.name,
      supplier: item.supplier || '',
      category: item.category || '',
      sectionId: item.sectionId || 'none',
      catalogNumber: item.catalogNumber || '',
      dimensions: item.dimensions || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
      productLink: item.productLink || '',
      imageUrl: item.imageUrl || '',
      priority: item.priority,
      buyBefore: item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
      assigneeId: item.assignedTo || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItemId) return;
    
    startTransition(async () => {
        try {
            await updateItem({
                itemId: editingItemId as Id<"shoppingListItems">,
                name: editFormData.name?.trim(),
                supplier: editFormData.supplier?.trim() || undefined,
                category: editFormData.category?.trim() || undefined,
                sectionId: editFormData.sectionId === 'none' ? undefined : editFormData.sectionId as Id<"shoppingListSections">,
                catalogNumber: editFormData.catalogNumber?.trim() || undefined,
                dimensions: editFormData.dimensions?.trim() || undefined,
                quantity: editFormData.quantity,
                unitPrice: editFormData.unitPrice ? parseFloat(editFormData.unitPrice) || undefined : undefined,
                productLink: editFormData.productLink?.trim() || undefined,
                imageUrl: editFormData.imageUrl?.trim() || undefined,
                priority: editFormData.priority,
                buyBefore: editFormData.buyBefore ? new Date(editFormData.buyBefore).getTime() : undefined,
                assignedTo: editFormData.assigneeId?.trim() || undefined
            });
            setEditingItemId(null);
            toast.success("Item updated");
        } catch (error) {
            console.error('Error updating item:', error);
            toast.error("Error updating item");
        }
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
  };

  const toggleNotes = (id: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      const item = items.find(i => i._id === id);
      if (item && localNotes[id] === undefined) {
        setLocalNotes(prev => ({ ...prev, [id]: item.notes || '' }));
      }
    }
    setExpandedNotes(newExpanded);
  };

  const handleNotesLocalChange = (id: string, value: string) => {
    setLocalNotes(prev => ({ ...prev, [id]: value }));
  };

  const handleSaveNotes = (id: Id<"shoppingListItems">) => {
    const notes = localNotes[id] || '';
    handleUpdateItem(id, { notes });
  };

  const getNotesValue = (id: string, itemNotes: string | null | undefined) => {
    return localNotes[id] !== undefined ? localNotes[id] : (itemNotes || '');
  };

  const hasUnsavedNotes = (id: string, itemNotes: string | null | undefined) => {
    return localNotes[id] !== undefined && localNotes[id] !== (itemNotes || '');
  };

  const sectionMap = new Map(sections.map(s => [s._id, s.name]));

  const itemsBySection = items.reduce((acc, item) => {
    const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
    if (!acc[sectionName]) acc[sectionName] = [];
    acc[sectionName].push(item);
    return acc;
  }, {} as Record<string, ShoppingListItem[]>);

  sections.forEach(section => {
    if (!itemsBySection[section.name]) {
      itemsBySection[section.name] = [];
    }
  });
  
  const hasItemsWithoutSection = items.some(item => !item.sectionId);
  if (!hasItemsWithoutSection && itemsBySection['No Category']) {
    delete itemsBySection['No Category'];
  }

  const sectionTotals = Object.entries(itemsBySection).map(([section, sectionItems]) => {
    const total = sectionItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
    return { section, total, itemCount: sectionItems.length };
  });

  const grandTotal = sectionTotals.reduce((sum, section) => sum + section.total, 0);

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer hover:text-gray-600 transition-colors"
                onClick={() => setIsAddSectionExpanded(!isAddSectionExpanded)}
              >
                <FolderPlusIcon className="h-5 w-5" />
                Manage Sections
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddSectionExpanded(!isAddSectionExpanded)}
              >
                {isAddSectionExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {isAddSectionExpanded && (
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="New section name (e.g. Kitchen, Living Room)"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                />
                <Button onClick={handleAddSection} disabled={isPending || !newSectionName.trim()}>
                  Add Section
                </Button>
              </div>
              
              {sections.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Existing sections:</h4>
                  <div className="flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <Badge key={section._id} variant="outline" className="flex items-center gap-2">
                        {section.name}
                        <button
                          onClick={() => handleDeleteSection(section._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div 
                className="flex items-center gap-2 cursor-pointer hover:text-gray-600 transition-colors"
                onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
              >
                <PlusIcon className="h-5 w-5" />
                Add New Product
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
              >
                {isAddFormExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          {isAddFormExpanded && (
            <CardContent className="space-y-4">
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
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddItem} disabled={isPending || !newItemName.trim()}>
                  {isPending ? 'Adding...' : 'Add Product'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddFormExpanded(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .map(([sectionName, sectionItems]) => (
          <Card key={sectionName}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{sectionName}</span>
                <Badge variant="secondary">
                  {sectionItems.length} {sectionItems.length === 1 ? 'product' : 'products'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sectionItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCartIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No products in this section</p>
                  <p className="text-sm mt-1">Add products using the form above</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sectionItems.map((item) => (
                    <div key={item._id} className={cn(
                      "border rounded-lg p-4 space-y-4",
                      item.realizationStatus === 'CANCELLED' && "bg-gray-50 border-gray-300 opacity-75"
                    )}>
                      {editingItemId === item._id ? (
                        // Edit form
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                              <label className="text-sm font-medium">Product Name *</label>
                              <Input
                                value={editFormData.name}
                                onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                                placeholder="e.g. Kitchen Countertop Navona"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Section</label>
                              <Select 
                                value={editFormData.sectionId} 
                                onValueChange={(value) => setEditFormData({...editFormData, sectionId: value})}
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
                                value={editFormData.supplier}
                                onChange={(e) => setEditFormData({...editFormData, supplier: e.target.value})}
                                placeholder="e.g. kronosfera.pl"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Catalog Number</label>
                              <Input
                                value={editFormData.catalogNumber}
                                onChange={(e) => setEditFormData({...editFormData, catalogNumber: e.target.value})}
                                placeholder="e.g. BU1K367PH-3BC1"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Category</label>
                              <Input
                                value={editFormData.category}
                                onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                                placeholder="e.g. Furniture"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Dimensions</label>
                              <Input
                                value={editFormData.dimensions}
                                onChange={(e) => setEditFormData({...editFormData, dimensions: e.target.value})}
                                placeholder="e.g. 4100 x 1200"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Quantity</label>
                              <Input
                                type="number"
                                min="1"
                                value={editFormData.quantity}
                                onChange={(e) => setEditFormData({...editFormData, quantity: parseInt(e.target.value) || 1})}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Unit Price ({currencySymbol})</label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editFormData.unitPrice}
                                onChange={(e) => setEditFormData({...editFormData, unitPrice: e.target.value})}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Product Link</label>
                              <Input
                                value={editFormData.productLink}
                                onChange={(e) => setEditFormData({...editFormData, productLink: e.target.value})}
                                placeholder="https://..."
                              />
                            </div>
                            <div className="md:col-span-2 lg:col-span-3">
                              <label className="text-sm font-medium">Image URL</label>
                              <Input
                                value={editFormData.imageUrl}
                                onChange={(e) => setEditFormData({...editFormData, imageUrl: e.target.value})}
                                placeholder="https://..."
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Priority</label>
                              <Select 
                                value={editFormData.priority} 
                                onValueChange={(value) => setEditFormData({...editFormData, priority: value as Priority})}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="LOW">Low</SelectItem>
                                  <SelectItem value="MEDIUM">Medium</SelectItem>
                                  <SelectItem value="HIGH">High</SelectItem>
                                  <SelectItem value="URGENT">Urgent</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Buy Before</label>
                              <Input
                                type="date"
                                value={editFormData.buyBefore}
                                onChange={(e) => setEditFormData({...editFormData, buyBefore: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Assigned To</label>
                              <Input
                                value={editFormData.assigneeId}
                                onChange={(e) => setEditFormData({...editFormData, assigneeId: e.target.value})}
                                placeholder="User ID or name"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={handleSaveEdit} disabled={isPending || !editFormData.name?.trim()}>
                              {isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button variant="outline" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // Display view
                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {item.imageUrl ? (
                                <Image src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" width={64} height={64} />
                              ) : (
                                <ShoppingCartIcon className="h-6 w-6 text-gray-400" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <h3 className={cn(
                                "font-semibold text-lg text-gray-900 mb-1",
                                item.realizationStatus === 'CANCELLED' && "line-through text-gray-500"
                              )}>
                                {item.name}
                              </h3>
                              {item.productLink && (
                                <a 
                                  href={item.productLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mb-2"
                                >
                                  <LinkIcon className="h-3 w-3" />
                                  { new URL(item.productLink).hostname }
                                </a>
                              )}
                              
                              <div className="flex items-center gap-2">
                                <Badge className={statusColors[item.realizationStatus]}>
                                  {statusLabels[item.realizationStatus]}
                                </Badge>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <div className="text-sm text-gray-600">Total Price</div>
                              <div className="text-xl font-bold text-gray-900">
                                {item.totalPrice ? `${currencySymbol}${item.totalPrice.toFixed(2)}` : '-'}
                              </div>
                              <div className="text-sm text-gray-500">
                                {item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}/pc` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3 py-3 px-4 bg-gray-50 rounded-lg">
                            {/* Details grid... */}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-700">Quantity:</span>
                                <span className="text-lg font-semibold text-gray-900">{item.quantity} pcs</span>
                              </div>
                              
                              <Select
                                value={item.realizationStatus}
                                onValueChange={(value) => handleUpdateItem(item._id, { realizationStatus: value as Status })}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusLabels).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartEdit(item)}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                                    disabled={item.realizationStatus === 'CANCELLED'}
                                  >
                                    <PenIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Product</p>
                                </TooltipContent>
                              </Tooltip>

                              {item.realizationStatus !== 'CANCELLED' && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRejectItem(item._id)}
                                      className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 border-orange-200"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Reject Product</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteItem(item._id)}
                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 border-red-200"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete Product</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          <div className="border-t pt-3">
                            <button
                              onClick={() => toggleNotes(item._id)}
                              className="text-gray-600 text-sm hover:text-gray-800 flex items-center gap-2"
                            >
                              {expandedNotes.has(item._id) ? (
                                <>
                                  <ChevronUpIcon className="h-4 w-4" />
                                  Hide Note
                                </>
                              ) : (
                                <>
                                  <ChevronDownIcon className="h-4 w-4" />
                                  {item.notes ? 'Show Note' : 'Add Note'}
                                </>
                              )}
                            </button>
                          </div>

                          {expandedNotes.has(item._id) && (
                            <div className="border-t pt-3 space-y-3">
                              <Textarea
                                value={getNotesValue(item._id, item.notes)}
                                onChange={(e) => handleNotesLocalChange(item._id, e.target.value)}
                                placeholder="Add note..."
                                className="min-h-[80px]"
                              />
                              {hasUnsavedNotes(item._id, item.notes) && (
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-amber-600 flex items-center gap-1">
                                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                    Unsaved changes
                                  </span>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveNotes(item._id)}
                                    disabled={isPending}
                                    className="text-xs"
                                  >
                                    {isPending ? 'Saving...' : 'Save Note'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {sectionTotals.map(({ section, total }) => (
                <div key={section} className="flex justify-between items-center">
                  <span className="font-medium">{section}</span>
                  <span>{currencySymbol}{total.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between items-center font-bold text-lg">
                <span>Grand Total:</span>
                <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

