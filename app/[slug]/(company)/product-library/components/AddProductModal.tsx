"use client";

import React, { useState } from 'react';
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface AddProductModalProps {
  onClose: () => void;
  teamId: Id<"teams">;
}

export function AddProductModal({ onClose, teamId }: AddProductModalProps) {
  const { user } = useUser();
  const createProduct = useMutation(api.productLibrary.createProduct);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    brand: "",
    model: "",
    sku: "",
    imageUrl: "",
    productLink: "",
    supplier: "",
    supplierSku: "",
    dimensions: "",
    weight: "",
    material: "",
    color: "",
    unitPrice: "",
    notes: "",
  });
  
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Product name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      await createProduct({
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        brand: formData.brand || undefined,
        model: formData.model || undefined,
        sku: formData.sku || undefined,
        imageUrl: formData.imageUrl || undefined,
        productLink: formData.productLink || undefined,
        supplier: formData.supplier || undefined,
        supplierSku: formData.supplierSku || undefined,
        dimensions: formData.dimensions || undefined,
        weight: formData.weight ? parseFloat(formData.weight) : undefined,
        material: formData.material || undefined,
        color: formData.color || undefined,
        unitPrice: formData.unitPrice ? parseFloat(formData.unitPrice) : undefined,
        tags: tags,
        notes: formData.notes || undefined,
        teamId,
        createdBy: user?.id ?? "",
      });

      toast.success("Product added successfully!");
      onClose();
    } catch (error) {
      console.error("Error creating product:", error);
      toast.error("Failed to add product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Name - Most Important Field */}
          <div>
            <Label htmlFor="name" className="text-base font-semibold">Product Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter product name"
              required
              className="text-base mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter product description"
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Two Column Grid for Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="brand" className="text-sm font-medium">Brand</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => handleInputChange("brand", e.target.value)}
                placeholder="Brand name"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="category" className="text-sm font-medium">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => handleInputChange("category", e.target.value)}
                placeholder="e.g. Furniture, Lighting"
                className="mt-1"
              />
            </div>
          </div>

          {/* Three Column Grid for Identifiers */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="model" className="text-sm font-medium">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => handleInputChange("model", e.target.value)}
                placeholder="Model"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="sku" className="text-sm font-medium">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="SKU"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="unitPrice" className="text-sm font-medium">Price</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) => handleInputChange("unitPrice", e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          {/* Supplier Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="supplier" className="text-sm font-medium">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => handleInputChange("supplier", e.target.value)}
                placeholder="Supplier name"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="supplierSku" className="text-sm font-medium">Supplier SKU</Label>
              <Input
                id="supplierSku"
                value={formData.supplierSku}
                onChange={(e) => handleInputChange("supplierSku", e.target.value)}
                placeholder="Supplier SKU"
                className="mt-1"
              />
            </div>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="imageUrl" className="text-sm font-medium">Image URL</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => handleInputChange("imageUrl", e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="productLink" className="text-sm font-medium">Product Link</Label>
              <Input
                id="productLink"
                value={formData.productLink}
                onChange={(e) => handleInputChange("productLink", e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>

          {/* Physical Properties */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dimensions" className="text-sm font-medium">Dimensions</Label>
              <Input
                id="dimensions"
                value={formData.dimensions}
                onChange={(e) => handleInputChange("dimensions", e.target.value)}
                placeholder="120 x 80 x 75 cm"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="weight" className="text-sm font-medium">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={formData.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                placeholder="0.0"
                className="mt-1"
              />
            </div>
          </div>

          {/* Material and Color */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="material" className="text-sm font-medium">Material</Label>
              <Input
                id="material"
                value={formData.material}
                onChange={(e) => handleInputChange("material", e.target.value)}
                placeholder="Wood, Metal, Plastic..."
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="color" className="text-sm font-medium">Color</Label>
              <Input
                id="color"
                value={formData.color}
                onChange={(e) => handleInputChange("color", e.target.value)}
                placeholder="White, Black, Natural..."
                className="mt-1"
              />
            </div>
          </div>


          {/* Tags */}
          <div>
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" onClick={addTag} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-sm font-medium">Additional Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Additional notes or specifications..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Actions */}
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding Product..." : "Add Product"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}