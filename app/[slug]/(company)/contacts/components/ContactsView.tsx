"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Mail, Phone, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactForm } from "./ContactForm";
import { Id } from "@/convex/_generated/dataModel";

export function ContactsView() {
  const params = useParams<{ slug: string }>();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Id<"contacts"> | null>(null);

  const contacts = useQuery(api.contacts.getContacts, {
    teamSlug: params.slug,
    search: searchTerm || undefined,
    type: typeFilter === "all" ? undefined : typeFilter as "contractor" | "supplier" | "subcontractor" | "other",
  });



  const getTypeLabel = (type: string) => {
    const labels = {
      contractor: "Contractor",
      supplier: "Supplier", 
      subcontractor: "Subcontractor",
      other: "Other"
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      contractor: "bg-blue-100 text-blue-800",
      supplier: "bg-green-100 text-green-800",
      subcontractor: "bg-purple-100 text-purple-800", 
      other: "bg-gray-100 text-gray-800"
    };
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getInitials = (name: string, companyName?: string) => {
    if (companyName) {
      return companyName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
    }
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <Card className="p-6">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[200px] h-11">
                <SelectValue placeholder="Contact Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="contractor">Contractors</SelectItem>
                <SelectItem value="supplier">Suppliers</SelectItem>
                <SelectItem value="subcontractor">Subcontractors</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Fill in information about company or contractor
                  </DialogDescription>
                </DialogHeader>
                <ContactForm
                  onSuccess={() => setIsAddDialogOpen(false)}
                  onCancel={() => setIsAddDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* Contacts grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contacts?.map((contact) => (
          <Card
            key={contact._id}
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setEditingContact(contact._id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(contact.name, contact.companyName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{contact.name}</CardTitle>
                    {contact.companyName && (
                      <CardDescription className="font-medium text-base">
                        {contact.companyName}
                      </CardDescription>
                    )}
                  </div>
                </div>
                <Badge className={getTypeColor(contact.type)}>
                  {getTypeLabel(contact.type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{contact.email}</span>
                </div>
              )}
              
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              )}
              
              {(contact.city || contact.address) && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    {contact.city}
                    {contact.address && contact.city && ", "}
                    {contact.address}
                  </span>
                </div>
              )}


            </CardContent>
          </Card>
        ))}
      </div>

      {contacts && contacts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchTerm || typeFilter !== "all"
              ? "Nie znaleziono kontaktów spełniających kryteria"
              : "Nie masz jeszcze żadnych kontaktów. Dodaj pierwszy kontakt aby rozpocząć."
            }
          </p>
        </div>
      )}

      {/* Edit contact dialog */}
      <Dialog open={!!editingContact} onOpenChange={() => setEditingContact(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update contact information
            </DialogDescription>
          </DialogHeader>
          {editingContact && (
            <ContactForm
              contactId={editingContact}
              onSuccess={() => setEditingContact(null)}
              onCancel={() => setEditingContact(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}