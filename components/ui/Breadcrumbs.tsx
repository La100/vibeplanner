"use client";

import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  id?: string;
  name: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = "" }: BreadcrumbsProps) {
  return (
    <nav className={`flex items-center space-x-1 text-sm text-gray-600 ${className}`}>
      {items.map((item, index) => (
        <div key={item.id || index} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 text-gray-400 mx-1" />
          )}
          
          {item.onClick ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={item.onClick}
              className="h-auto p-1 font-medium hover:text-blue-600 hover:bg-blue-50"
            >
              {index === 0 && <Home className="h-4 w-4 mr-1" />}
              {item.name}
            </Button>
          ) : (
            <span className="px-1 py-1 font-medium text-gray-900 flex items-center">
              {index === 0 && <Home className="h-4 w-4 mr-1" />}
              {item.name}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
} 