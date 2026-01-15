import { Suspense } from "react";
import ShoppingListView, { ShoppingListViewSkeleton } from "./components/ShoppingListView";

export default function ProjectShoppingListPage() {
  return (
    <Suspense fallback={<ShoppingListViewSkeleton />}>
      <ShoppingListView />
    </Suspense>
  );
} 