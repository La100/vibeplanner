'use client';

import { useState, useTransition } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { useProject } from '@/components/providers/ProjectProvider';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { TooltipProvider } from '@/components/ui/tooltip';

// Import new components
import { ShoppingListHeader } from './ShoppingListHeader';
import { SectionManager } from './SectionManager';
import { AddItemForm } from './AddItemForm';
import { ShoppingListSection } from './ShoppingListSection';
import { ExportModal } from './ExportModal';

type ShoppingListItem = Doc<"shoppingListItems">;



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
      <div className="mb-6 border rounded-lg p-4">
        <Skeleton className="h-7 w-48 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      {/* Items List Skeleton */}
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4">
            <Skeleton className="h-6 w-1/3 mb-4" />
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
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ShoppingListView() {
  const [isPending] = useTransition();

  const { project } = useProject();

  const items = useQuery(api.shopping.listShoppingListItems, { projectId: project._id });
  const sections = useQuery(api.shopping.listShoppingListSections, { projectId: project._id });
  const teamMembers = useQuery(api.teams.getTeamMembers, { teamId: project.teamId });

  const createItem = useMutation(api.shopping.createShoppingListItem);
  const updateItem = useMutation(api.shopping.updateShoppingListItem);
  const deleteItem = useMutation(api.shopping.deleteShoppingListItem);
  const createSection = useMutation(api.shopping.createShoppingListSection);
  const deleteSection = useMutation(api.shopping.deleteShoppingListSection);


  // Export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'pdf',
    includeImages: false,
    statusFilter: 'all' as 'all' | 'planned' | 'ordered' | 'completed',
    includeNotes: true,
    groupBySections: true
  });

  if (items === undefined || sections === undefined) {
    return null;
  }
  
  if (project === null) {
    return <div>Project not found</div>
  }

  const currencySymbol = project.currency === "EUR" ? "€" : project.currency === "PLN" ? "zł" : "$";

  // Group items by section
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

  // Handlers
  const handleCreateSection = async (name: string) => {
    await createSection({ name, projectId: project._id });
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
    
    await deleteSection({ sectionId });
  };

  const handleAddItem = async (itemData: {
    name: string;
    notes?: string;
    supplier?: string;
    category?: string;
    sectionId?: Id<"shoppingListSections">;
    catalogNumber?: string;
    dimensions?: string;
    quantity: number;
    unitPrice?: number;
    productLink?: string;
    imageUrl?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    realizationStatus?: string;
    assignedTo?: string;
    buyBefore?: number;
  }) => {
    const { realizationStatus, ...rest } = itemData;
    await createItem({
      projectId: project._id,
      ...rest,
      realizationStatus: (realizationStatus as "PLANNED" | "ORDERED" | "IN_TRANSIT" | "DELIVERED" | "COMPLETED" | "CANCELLED") || "PLANNED"
    });
    toast.success("Product added");
  };

  const handleUpdateItem = async (id: Id<"shoppingListItems">, updates: Partial<ShoppingListItem>) => {
    try {
      await updateItem({ itemId: id, ...updates });
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error("Error updating item");
    }
  };

  const handleDeleteItem = async (id: Id<"shoppingListItems">) => {
    try {
      await deleteItem({ itemId: id });
      toast.success("Item deleted");
    } catch(error) {
      console.error('Error deleting item:', error);
      toast.error("Error deleting item");
    }
  };

  const handleStartEdit = (item: ShoppingListItem) => {
    // This function is passed to ShoppingListSection but not used in this component
    console.log('Edit item:', item);
  };

  // Export handlers
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
        item.realizationStatus,
        item.priority || '',
        assignedMember || '',
        item.buyBefore ? format(new Date(item.buyBefore), 'yyyy-MM-dd') : '',
        ...(exportOptions.includeNotes ? [item.notes || ''] : [])
      ];
    });

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

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
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({
        putOnlyUsedFonts: true,
        format: 'a4'
      });
      
      // Header
      doc.setFontSize(20);
      doc.text(`Shopping List - ${project.name}`, 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString('pl-PL')}`, 20, 30);
      doc.text(`Total Budget: ${currencySymbol}${grandTotal.toFixed(2)}`, 20, 40);

      let yPosition = 50;

      if (exportOptions.groupBySections) {
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

          doc.setFontSize(16);
          doc.text(sectionName, 20, yPosition);
          yPosition += 10;

          const tableData = filteredSectionItems.map(item => [
            item.name,
            item.quantity.toString(),
            item.unitPrice ? `${currencySymbol}${item.unitPrice.toFixed(2)}` : '-',
            item.totalPrice ? `${currencySymbol}${item.totalPrice.toFixed(2)}` : '-',
            item.realizationStatus,
            item.supplier || '-'
          ]);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).autoTable({
            startY: yPosition,
            head: [['Product', 'Qty', 'Unit Price', 'Total', 'Status', 'Supplier']],
            body: tableData,
            margin: { left: 20, right: 20 },
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [66, 66, 66], textColor: [255, 255, 255] }
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          yPosition = (doc as any).lastAutoTable.finalY + 10;
        });
      } else {
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
            item.realizationStatus
          ];
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doc as any).autoTable({
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
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Failed to export PDF');
    }
  };

  const handleExport = () => {
    if (exportOptions.format === 'csv') {
      handleExportCSV();
    } else {
      handleExportPDF();
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full max-w-none px-4 sm:px-6 lg:px-8">
        {/* Export Modal */}
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          exportOptions={exportOptions}
          onExportOptionsChange={setExportOptions}
          onExport={handleExport}
          isPending={isPending}
        />

        {/* Header */}
        <ShoppingListHeader
          projectName={project.name}
          grandTotal={grandTotal}
          currencySymbol={currencySymbol}
          onExportClick={() => setIsExportModalOpen(true)}
        />

        {/* Section Manager */}
        <SectionManager
          sections={sections}
          onCreateSection={handleCreateSection}
          onDeleteSection={handleDeleteSection}
          isPending={isPending}
        />

        {/* Shopping List Sections */}
        {Object.entries(itemsBySection)
          .sort(([a], [b]) => {
            if (a === 'No Category') return 1;
            if (b === 'No Category') return -1;
            return a.localeCompare(b);
          })
          .map(([sectionName, sectionItems]) => {
            // Find the section ID for this section name
            const section = sections.find(s => s.name === sectionName);
            const sectionId = section?._id;
            
            return (
              <ShoppingListSection
                key={sectionName}
                sectionName={sectionName}
                sectionId={sectionId}
                items={sectionItems}
                currencySymbol={currencySymbol}
                teamMembers={teamMembers}
                sections={sections}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onStartEdit={handleStartEdit}
                onAddItem={handleAddItem}
                isPending={isPending}
              />
            );
          })}

        {/* Add Item Form for No Category items */}
        {hasItemsWithoutSection && (
          <div className="mb-6">
            <AddItemForm
              sections={sections}
              teamMembers={teamMembers}
              currencySymbol={currencySymbol}
              onAddItem={handleAddItem}
              isPending={isPending}
            />
          </div>
        )}

        {/* Grand Total */}
        <div className="bg-gray-50 border rounded-lg p-4">
          <div className="space-y-2">
            {sectionTotals.map(({ section, total }) => (
              <div key={section} className="flex justify-between items-center text-sm">
                <span className="font-medium">{section}</span>
                <span>{currencySymbol}{total.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between items-center font-bold text-lg">
              <span>Grand Total:</span>
              <span>{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

