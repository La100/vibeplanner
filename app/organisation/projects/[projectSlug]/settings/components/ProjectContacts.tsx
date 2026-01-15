"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useOrganization } from "@clerk/nextjs";
import { apiAny } from "@/lib/convexApiAny";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Building2,
  User
} from "lucide-react";
import { toast } from "sonner";

interface ProjectContactsProps {
  project: {
    _id: Id<"projects">;
    teamId: Id<"teams">;
    name: string;
  };
}

export default function ProjectContacts({ project }: ProjectContactsProps) {
  const { organization } = useOrganization();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<Id<"contacts"> | "">("");
  const [contactRole, setContactRole] = useState("");
  const [contactNotes, setContactNotes] = useState("");

  // Get all team contacts
  const team = useQuery(
    apiAny.teams.getTeamByClerkOrg,
    organization?.id ? { clerkOrgId: organization.id } : "skip"
  );

  const teamContacts = useQuery(
    apiAny.contacts.getContacts,
    team?.slug ? { teamSlug: team.slug } : "skip"
  );
  
  // Get project contacts
  const projectContacts = useQuery(apiAny.contacts.getProjectContacts, {
    projectId: project._id,
  });

  // Mutations
  const assignContact = useMutation(apiAny.contacts.assignContactToProject);
  const removeContact = useMutation(apiAny.contacts.removeContactFromProject);

  const handleAssignContact = async () => {
    if (!selectedContactId) {
      toast.error("Please select a contact to assign");
      return;
    }

    try {
      await assignContact({
        projectId: project._id,
        contactId: selectedContactId as Id<"contacts">,
        role: contactRole || undefined,
        notes: contactNotes || undefined,
      });
      
      toast.success("Contact assigned to project");
      setIsAddDialogOpen(false);
      setSelectedContactId("");
      setContactRole("");
      setContactNotes("");
    } catch (error) {
      toast.error("Error assigning contact");
      console.error(error);
    }
  };

  const handleRemoveContact = async (contactId: Id<"contacts">) => {
    try {
      await removeContact({
        projectId: project._id,
        contactId,
      });
      
      toast.success("Contact removed from project");
    } catch (error) {
      toast.error("Error removing contact");
      console.error(error);
    }
  };

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


  // Filter available contacts (not already assigned)
  const availableContacts = teamContacts?.filter(contact => 
    !projectContacts?.some(pc => pc._id === contact._id)
  ) || [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg lg:text-xl">Project Contacts</CardTitle>
            <CardDescription className="text-sm">
              Manage contacts assigned to this project
            </CardDescription>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Contact to Project</DialogTitle>
                <DialogDescription>
                  Select a contact from address book and assign to this project
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="contact">Contact</Label>
                  <Select value={selectedContactId} onValueChange={(value) => setSelectedContactId(value as Id<"contacts"> | "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContacts.map((contact) => (
                        <SelectItem key={contact._id} value={contact._id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{contact.name}</span>
                            {contact.companyName && (
                              <span className="text-muted-foreground text-sm">
                                ({contact.companyName})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="role">Project Role</Label>
                  <Input
                    id="role"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                  />
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={contactNotes}
                    onChange={(e) => setContactNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAssignContact}>
                  Assign Contact
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent className="px-4 lg:px-6">
        {projectContacts && projectContacts.length > 0 ? (
          <div className="space-y-4">
            {projectContacts.map((contact) => (
              <div
                key={contact._id}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{contact.name}</h3>
                      {contact.type && (
                        <Badge className={getTypeColor(contact.type)}>
                          {getTypeLabel(contact.type)}
                        </Badge>
                      )}
                    </div>
                    
                    {contact.companyName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Building2 className="h-4 w-4" />
                        <span>{contact.companyName}</span>
                      </div>
                    )}
                    
                    {contact.projectRole && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{contact.projectRole}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      
                      {contact.city && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{contact.city}</span>
                        </div>
                      )}
                    </div>
                    
                    
                    {contact.projectNotes && (
                      <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                        {contact.projectNotes}
                      </p>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => contact._id && handleRemoveContact(contact._id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              No contacts assigned to this project yet
            </p>
            {availableContacts.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Click "Add Contact" to assign contacts from address book
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                First add contacts in the Address Book section
              </p>
            )}
          </div>
        )}
        
        {availableContacts.length === 0 && projectContacts && projectContacts.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              All available contacts have been assigned to this project
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
