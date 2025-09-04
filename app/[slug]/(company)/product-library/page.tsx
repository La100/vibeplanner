"use client";

import React, { useState } from 'react';
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Grid, List, Package, ShoppingCart } from "lucide-react";
import { ProductModal } from "./components/ProductModal";
import { AddProductModal } from "./components/AddProductModal";
import { AddToProjectModal } from "./components/AddToProjectModal";
import { formatCurrency } from "@/lib/utils";

export default function ProductLibraryPage() {
  const params = useParams<{ slug: string }>();
  const team = useQuery(api.teams.getTeamBySlug, 
    params.slug ? { slug: params.slug } : "skip"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<{ _id: string; name: string; brand?: string; model?: string; sku?: string; supplierSku?: string; dimensions?: string; weight?: number; material?: string; color?: string; unitPrice?: number; supplier?: string; category?: string; tags: string[]; description?: string; notes?: string; creatorName?: string; _creationTime: number; imageUrl?: string; productLink?: string; } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddToProjectModal, setShowAddToProjectModal] = useState<{ _id: string; name: string; brand?: string; imageUrl?: string; } | null>(null);

  // Queries
  const products = useQuery(api.productLibrary.getAllProducts, 
    team ? { teamId: team._id } : "skip"
  );
  
  const categories = useQuery(api.productLibrary.getCategories, 
    team ? { teamId: team._id } : "skip"
  );
  
  const suppliers = useQuery(api.productLibrary.getSuppliers, 
    team ? { teamId: team._id } : "skip"
  );

  // Filter products
  const filteredProducts = products?.filter(product => {
    const matchesSearch = searchTerm === "" || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    const matchesSupplier = selectedSupplier === "all" || product.supplier === selectedSupplier;
    
    return matchesSearch && matchesCategory && matchesSupplier;
  }) || [];

  const ProductCard = ({ product }: { product: { _id: string; name: string; brand?: string; description?: string; category?: string; supplier?: string; unitPrice?: number; imageUrl?: string; tags: string[]; _creationTime: number; } }) => (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedProduct(product)}>
      <CardHeader className="pb-3">
        {product.imageUrl && (
          <div className="aspect-square mb-3 bg-muted rounded-md overflow-hidden">
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardTitle className="text-base line-clamp-2">{product.name}</CardTitle>
        {product.brand && (
          <p className="text-sm text-muted-foreground">{product.brand}</p>
        )}
      </CardHeader>
      <CardContent className="py-3">
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{product.description}</p>
        )}
        
        <div className="flex flex-wrap gap-1 mb-2">
          {product.category && (
            <Badge variant="secondary" className="text-xs">{product.category}</Badge>
          )}
          {product.supplier && (
            <Badge variant="outline" className="text-xs">{product.supplier}</Badge>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          {product.unitPrice && (
            <span className="font-medium">
              {formatCurrency(product.unitPrice, team?.currency || 'USD')}
            </span>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-3">
        <Button
          size="sm"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            setShowAddToProjectModal(product);
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Add to Project
        </Button>
      </CardFooter>
    </Card>
  );

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Product Library</h1>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="p-6 border-b bg-muted/30">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Supplier Filter */}
          <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {suppliers?.map(supplier => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Mode */}
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none border-l"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Products Grid/List */}
      <div className="flex-1 p-6 overflow-auto">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Package className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-medium">No products found</h3>
            <p className="text-sm">Try adjusting your filters or add some products to get started.</p>
            <Button className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Product
            </Button>
          </div>
        ) : (
          <div className={`grid gap-6 ${
            viewMode === "grid" 
              ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
              : "grid-cols-1"
          }`}>
            {filteredProducts.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && team && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          teamCurrency={team?.currency || 'USD'}
          teamId={team._id}
        />
      )}

      {/* Add Product Modal */}
      {showAddModal && team && (
        <AddProductModal
          onClose={() => setShowAddModal(false)}
          teamId={team._id}
        />
      )}

      {/* Add to Project Modal */}
      {showAddToProjectModal && team && (
        <AddToProjectModal
          product={showAddToProjectModal}
          teamId={team._id}
          onClose={() => setShowAddToProjectModal(null)}
        />
      )}
    </div>
  );
}