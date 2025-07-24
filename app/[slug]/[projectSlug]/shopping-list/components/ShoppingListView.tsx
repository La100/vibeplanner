'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/components/providers/ProjectProvider';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar";
import { 
  PlusIcon, 
  TrashIcon, 
  ShoppingCartIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FolderPlusIcon,
  PenIcon,
  X,
  Undo2,
  CalendarIcon,
  DownloadIcon,
  FileSpreadsheetIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingListItemDetails } from './ShoppingListItemDetails';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type ShoppingListItem = Doc<"shoppingListItems">;
type Priority = ShoppingListItem["priority"];
type Status = ShoppingListItem["realizationStatus"];

// Define TeamMember type based on the structure returned by getTeamMembers
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

const selectableStatuses = {
  PLANNED: 'Planned',
  ORDERED: 'Ordered',
  COMPLETED: 'Completed',
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
  const [isPending, startTransition] = useTransition();

  const { project } = useProject();

  const items = useQuery(api.shopping.listShoppingListItems, { projectId: project._id });
  const sections = useQuery(api.shopping.listShoppingListSections, { projectId: project._id });
  const teamMembers = useQuery(api.teams.getTeamMembers, { teamId: project.teamId });

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
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>('none');
  const [newItemBuyBefore, setNewItemBuyBefore] = useState<Date | undefined>(undefined);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  
  // Edit state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({});

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'pdf',
    includeImages: false,
    statusFilter: 'all' as 'all' | 'planned' | 'ordered' | 'completed',
    includeNotes: true,
    groupBySections: true
  });

  if (items === undefined || sections === undefined) {
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
            priority: "medium",
            realizationStatus: "PLANNED",
            assignedTo: newItemAssignedTo === 'none' ? undefined : newItemAssignedTo,
            buyBefore: newItemBuyBefore?.getTime(),
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
        setNewItemAssignedTo('none');
        setNewItemBuyBefore(undefined);
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
      assigneeId: item.assignedTo || 'none'
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
                assignedTo: editFormData.assigneeId === 'none' ? undefined : editFormData.assigneeId
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


  const handleExportCSV = () => {
    const filteredItems = items.filter(item => {
      if (exportOptions.statusFilter === 'all') return true;
      return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
    });

    const csvHeaders = [
      'Section',
      'Product Name', 
      'Supplier',
      'Category',
      'Catalog Number',
      'Dimensions',
      'Quantity',
      'Unit Price',
      'Total Price',
      'Status',
      'Priority',
      'Assigned To',
      'Buy Before',
      ...(exportOptions.includeNotes ? ['Notes'] : [])
    ];

    const csvData = filteredItems.map(item => {
      const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
      const assignedMember = item.assignedTo ? teamMembers?.find(m => m.clerkUserId === item.assignedTo)?.name : '';
      
      return [
        sectionName,
        item.name,
        item.supplier || '',
        item.category || '',
        item.catalogNumber || '',
        item.dimensions || '',
        item.quantity,
        item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : '',
        item.totalPrice ? `${currencySymbol}${item.totalPrice.toFixed(2)}` : '',
        statusLabels[item.realizationStatus],
        item.priority || '',
        assignedMember || '',
        item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
        ...(exportOptions.includeNotes ? [item.notes || ''] : [])
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Add BOM for UTF-8 to ensure Excel opens CSV with correct encoding
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `shopping-list-${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    
    setIsExportModalOpen(false);
    toast.success('CSV exported with UTF-8 encoding');
  };

  const handleExportPDF = async () => {
    try {
      // Dynamic import for client-side only
      const jsPDF = (await import('jspdf')).default;

      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4'
      });
      
      // Load Open Sans font for Polish characters
      try {
        // Open Sans Regular from Google Fonts - supports Polish characters
        const fontUrl = 'https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVc.ttf';
        const fontResponse = await fetch(fontUrl);
        const fontBuffer = await fontResponse.arrayBuffer();
        const fontBase64 = btoa(String.fromCharCode(...new Uint8Array(fontBuffer)));
        
        // Add Open Sans to jsPDF
        doc.addFileToVFS('OpenSans-Regular.ttf', fontBase64);
        doc.addFont('OpenSans-Regular.ttf', 'OpenSans', 'normal');
        doc.setFont('OpenSans', 'normal');
        
        console.log('Open Sans loaded - Polish characters supported!');
      } catch (fontError) {
        console.warn('Font loading failed, using helvetica:', fontError);
        doc.setFont('helvetica', 'normal');
      }
      
      // Header
      doc.setFontSize(20);
      doc.text(`Shopping List - ${project.name}`, 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString('pl-PL')}`, 20, 30);
      doc.text(`Total Budget: ${currencySymbol}${grandTotal.toFixed(2)}`, 20, 40);

      let yPosition = 50;
      let currentPageHeight = yPosition;

      if (exportOptions.groupBySections) {
        // Group by sections
        Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .forEach(([sectionName, sectionItems]) => {
          if (sectionItems.length === 0) return;
          
          const filteredSectionItems = sectionItems.filter(item => {
            if (exportOptions.statusFilter === 'all') return true;
            return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
          });

          if (filteredSectionItems.length === 0) return;

          // Check if we need a new page
          if (currentPageHeight > 250) {
            doc.addPage();
            yPosition = 20;
            currentPageHeight = 20;
          }

          // Section header
          doc.setFontSize(16);
          doc.setFont('OpenSans', 'bold');
          doc.text(sectionName, 20, yPosition);
          yPosition += 10;
          currentPageHeight += 10;

          // Section table
          const tableData = filteredSectionItems.map(item => [
            item.name,
            item.quantity.toString(),
            item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : '-',
            item.totalPrice ? `${currencySymbol}${item.totalPrice.toFixed(2)}` : '-',
            statusLabels[item.realizationStatus],
            item.supplier || '-'
          ]);

          (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
            startY: yPosition,
            head: [['Product', 'Qty', 'Unit Price', 'Total', 'Status', 'Supplier']],
            body: tableData,
            margin: { left: 20, right: 20 },
            styles: { 
              fontSize: 8,
              cellPadding: 3,
              halign: 'left'
            },
            headStyles: { 
              fillColor: [66, 66, 66],
              textColor: [255, 255, 255],
              fontSize: 9,
              fontStyle: 'bold'
            },
            columnStyles: {
              1: { halign: 'center', cellWidth: 20 }, // Qty
              2: { halign: 'right', cellWidth: 25 },  // Unit Price
              3: { halign: 'right', cellWidth: 25 },  // Total
              4: { halign: 'center', cellWidth: 25 }, // Status
            },
            didDrawPage: (data: { cursor: { y: number } }) => {
              currentPageHeight = data.cursor.y;
            }
          });

          yPosition = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
          currentPageHeight = yPosition;
          
          // Section total
          const sectionTotal = filteredSectionItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0);
          doc.setFont('OpenSans', 'bold');
          doc.setFontSize(11);
          doc.text(`Section Total: ${currencySymbol}${sectionTotal.toFixed(2)}`, 140, yPosition);
          doc.setFont('OpenSans', 'normal');
          
          yPosition += 15;
          currentPageHeight += 15;
        });

        // Add Grand Total at the end
        if (currentPageHeight > 270) {
          doc.addPage();
          yPosition = 30;
        } else {
          yPosition += 10;
        }
        
        // Grand Total section
        doc.setDrawColor(0, 0, 0);
        doc.line(20, yPosition, 190, yPosition); // Horizontal line
        yPosition += 10;
        
        doc.setFontSize(16);
        doc.setFont('OpenSans', 'bold');
        doc.text(`GRAND TOTAL: ${currencySymbol}${grandTotal.toFixed(2)}`, 20, yPosition);
        doc.setFont('OpenSans', 'normal');
      } else {
        // Single table for all items
        const filteredItems = items.filter(item => {
          if (exportOptions.statusFilter === 'all') return true;
          return item.realizationStatus.toLowerCase() === exportOptions.statusFilter;
        });

        const tableData = filteredItems.map(item => {
          const sectionName = item.sectionId ? sectionMap.get(item.sectionId) || 'No Category' : 'No Category';
          return [
            sectionName,
            item.name,
            item.quantity.toString(),
            item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : '',
            item.totalPrice ? `${currencySymbol}${item.totalPrice.toFixed(2)}` : '',
            statusLabels[item.realizationStatus]
          ];
        });

        (doc as unknown as { autoTable: (options: unknown) => void }).autoTable({
          startY: yPosition,
          head: [['Section', 'Product', 'Qty', 'Unit Price', 'Total', 'Status']],
          body: tableData,
          margin: { left: 20 },
          styles: { fontSize: 9 },
          headStyles: { fillColor: [66, 66, 66] }
        });
      }

      doc.save(`shopping-list-${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      
      setIsExportModalOpen(false);
      toast.success('PDF exported with Polish characters!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6 max-w-7xl mx-auto p-6">
        {/* Export Modal */}
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
              <h3 className="text-lg font-semibold mb-4">Export Shopping List</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Format:</label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={exportOptions.format === 'csv' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setExportOptions({...exportOptions, format: 'csv'})}
                    >
                      <FileSpreadsheetIcon className="h-4 w-4 mr-1" />
                      CSV
                    </Button>
                    <Button
                      variant={exportOptions.format === 'pdf' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setExportOptions({...exportOptions, format: 'pdf'})}
                    >
                      <DownloadIcon className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Filter by Status:</label>
                  <Select 
                    value={exportOptions.statusFilter} 
                    onValueChange={(value) => setExportOptions({...exportOptions, statusFilter: value as 'all' | 'planned' | 'ordered' | 'completed'})}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      <SelectItem value="planned">Planned Only</SelectItem>
                      <SelectItem value="ordered">Ordered Only</SelectItem>
                      <SelectItem value="completed">Completed Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={exportOptions.includeNotes}
                      onChange={(e) => setExportOptions({...exportOptions, includeNotes: e.target.checked})}
                    />
                    <span className="text-sm">Include Notes</span>
                  </label>
                  
                  {exportOptions.format === 'pdf' && (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.groupBySections}
                        onChange={(e) => setExportOptions({...exportOptions, groupBySections: e.target.checked})}
                      />
                      <span className="text-sm">Group by Sections</span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <Button
                  onClick={exportOptions.format === 'csv' ? handleExportCSV : handleExportPDF}
                  disabled={isPending}
                >
                  {isPending ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
                </Button>
                <Button variant="outline" onClick={() => setIsExportModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header with Export Button */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Shopping List</h1>
            <p className="text-gray-600">Manage project purchases and materials</p>
          </div>
          <Button
            onClick={() => setIsExportModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <DownloadIcon className="h-4 w-4" />
            Export
          </Button>
        </div>

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
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !editFormData.buyBefore && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {editFormData.buyBefore ? format(new Date(editFormData.buyBefore), "PPP") : <span>Pick a date</span>}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                  <Calendar
                                    mode="single"
                                    selected={editFormData.buyBefore ? new Date(editFormData.buyBefore) : undefined}
                                    onSelect={(date) => setEditFormData({...editFormData, buyBefore: date ? format(date, 'yyyy-MM-dd') : ''})}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Assigned To</label>
                              <Select
                                value={editFormData.assigneeId}
                                onValueChange={(value) => setEditFormData({...editFormData, assigneeId: value})}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select user" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Unassigned</SelectItem>
                                  {teamMembers?.map((member: TeamMember) => (
                                    <SelectItem key={member.clerkUserId} value={member.clerkUserId}>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
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
                                <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" width={64} height={64} />
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
                              <ShoppingListItemDetails item={item} />
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

                          <div className="mt-4 flex flex-col sm:flex-row justify-between items-end w-full space-y-4 sm:space-y-0">
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleStartEdit(item)}
                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                                  >
                                    <PenIcon className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Edit Product</p>
                                </TooltipContent>
                              </Tooltip>

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

                            <div className="flex items-center gap-4">
                              {item.assignedTo && (() => {
                                const member = teamMembers?.find((m: TeamMember) => m.clerkUserId === item.assignedTo);
                                return member ? (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={member.imageUrl} />
                                      <AvatarFallback>{member.name?.[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-semibold">{member.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">Unknown User</span>
                                );
                              })()}

                              <Select
                                value={item.realizationStatus}
                                onValueChange={(value) => handleUpdateItem(item._id, { realizationStatus: value as Status })}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(selectableStatuses).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {item.realizationStatus === 'CANCELLED' ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleUpdateItem(item._id, { realizationStatus: 'PLANNED' })}
                                      className="text-green-600 hover:text-green-800 hover:bg-green-50 border-green-200"
                                    >
                                      <Undo2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Restore Product</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRejectItem(item._id)}
                                      className="text-orange-600 hover:text-orange-800 hover:bg-orange-50 border-orange-200"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Reject Product</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
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

