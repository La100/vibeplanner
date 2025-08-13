import { Badge } from "@/components/ui/badge";
import { Doc } from "@/convex/_generated/dataModel";
import { format } from "date-fns";

type ShoppingListItem = Doc<"shoppingListItems">;

interface ShoppingListItemDetailsProps {
    item: ShoppingListItem;
}

export function ShoppingListItemDetails({ item }: ShoppingListItemDetailsProps) {
    return (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm text-gray-600">
            {item.priority && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Priority:</span>
                    <Badge variant={
                        item.priority === 'high' || item.priority === 'urgent' ? 'destructive' : 'secondary'
                    }>
                        {item.priority}
                    </Badge>
                </div>
            )}
            {item.buyBefore && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Buy Before:</span>
                    <span>{format(new Date(item.buyBefore), 'MMM dd, yyyy')}</span>
                </div>
            )}
            {item.supplier && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Supplier:</span>
                    <span>{item.supplier}</span>
                </div>
            )}
            {item.category && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Category:</span>
                    <span>{item.category}</span>
                </div>
            )}
            {item.dimensions && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Dimensions:</span>
                    <span>{item.dimensions}</span>
                </div>
            )}
            {item.catalogNumber && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Catalog #:</span>
                    <span>{item.catalogNumber}</span>
                </div>
            )}
            {item.productLink && (
                <div className="flex items-center gap-2 col-span-2 md:col-span-1">
                    <span className="font-semibold">Link:</span>
                    <a href={item.productLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate">
                        {item.productLink}
                    </a>
                </div>
            )}
            {item.assignedTo && (
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Assigned To:</span>
                    {/* TODO: Fetch and display user name */}
                    <span>{item.assignedTo}</span>
                </div>
            )}
            {item.notes && (
                <div className="col-span-2 md:col-span-3">
                    <span className="font-semibold">Notes:</span>
                    <p className="mt-1 text-gray-700">{item.notes}</p>
                </div>
            )}
        </div>
    )
} 