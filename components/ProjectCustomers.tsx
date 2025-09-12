"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useOrganization } from "@clerk/nextjs";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { 
  Mail, UserX, UserPlus, Users, AlertCircle, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

const inviteFormSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

interface ProjectCustomersProps {
  projectId: Id<"projects">;
}


export default function ProjectCustomers({ projectId }: ProjectCustomersProps) {
  const { organization } = useOrganization();
  const [isInviting, setIsInviting] = useState(false);

  // Get project info
  const project = useQuery(api.projects.getProject, { projectId });
  
  // Get customers for this project
  const projectCustomers = useQuery(api.customers.getProjectCustomers, { projectId });
  
  
  // Check user permissions
  const hasAccess = useQuery(api.projects.checkUserProjectAccess, { projectId });

  // Mutations
  const inviteCustomer = useMutation(api.teams.inviteCustomerToProject);
  const removeCustomerAccess = useMutation(api.customers.removeCustomerAccess);

  // Form setup
  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleInviteCustomer = async (values: z.infer<typeof inviteFormSchema>) => {
    if (!organization) {
      toast.error("Organization not found");
      return;
    }

    setIsInviting(true);
    try {
      // Check if user exists in organization
      const membersResponse = await organization.getMemberships();
      const existingMember = membersResponse.data.find(member => 
        member.publicUserData?.identifier === values.email
      );

      if (existingMember) {
        // User is already in org - add to project
        await inviteCustomer({
          email: values.email,
          projectId: projectId,
        });

        toast.success("Customer Added to Project", {
          description: `${values.email} now has access to this project.`,
        });
      } else {
        // Invite to organization and project
        await organization.inviteMember({
          emailAddress: values.email,
          role: "org:customer",
        });

        await inviteCustomer({
          email: values.email,
          projectId: projectId,
        });

        toast.success("Customer Invited", {
          description: `${values.email} has been invited to the organization and will have access to this project.`,
        });
      }

      form.reset();
    } catch (error) {
      console.error("Error inviting customer:", error);
      toast.error("Error Inviting Customer", {
        description: (error as Error).message || "Failed to invite customer. Please try again.",
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCustomer = async (customerId: Id<"customers">, customerEmail: string) => {
    try {
      await removeCustomerAccess({ customerId });
      toast.success("Customer Removed", {
        description: `${customerEmail} no longer has access to this project.`,
      });
    } catch (error) {
      toast.error("Failed to remove customer", {
        description: (error as Error).message,
      });
    }
  };

  if (!project || hasAccess === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] text-center">
        <AlertCircle className="h-8 w-8 text-red-600 mb-2" />
        <h3 className="text-lg font-semibold text-red-600">Access Denied</h3>
        <p className="text-muted-foreground">You don't have permission to manage project customers.</p>
      </div>
    );
  }

  const activeCustomers = projectCustomers?.filter(c => c.status === "active").length || 0;
  const pendingInvites = projectCustomers?.filter(c => c.status === "invited").length || 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectCustomers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">With access to this project</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers}</div>
            <p className="text-xs text-muted-foreground">Currently accessing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invites</CardTitle>
            <Mail className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingInvites}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Current Customers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Project Customers
          </CardTitle>
          <CardDescription>
            Customers who have access to "{project.name}" project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {projectCustomers && projectCustomers.length > 0 ? (
            <div className="space-y-3">
              {projectCustomers.map((customer) => (
                <div key={customer._id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {'imageUrl' in customer && customer.imageUrl && <AvatarImage src={customer.imageUrl} />}
                      <AvatarFallback>
                        {('name' in customer && customer.name?.[0]?.toUpperCase()) || customer.email[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{'name' in customer && customer.name || customer.email}</p>
                      {'name' in customer && customer.name && (
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant={customer.status === "active" ? "default" : customer.status === "invited" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {customer.status === "active" ? "Active" : 
                           customer.status === "invited" ? "Invited" : "Inactive"}
                        </Badge>
                        {customer.joinedAt && (
                          <span className="text-xs text-muted-foreground">
                            Joined {new Date(customer.joinedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveCustomer(customer._id, customer.email)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customers yet</h3>
              <p className="text-muted-foreground mb-4">
                Invite customers to give them access to this project.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite New Customer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite Customer
          </CardTitle>
          <CardDescription>
            Add a new customer to "{project.name}" project. They will only have access to this project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleInviteCustomer)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="customer@example.com" 
                        {...field} 
                        disabled={isInviting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isInviting}>
                {isInviting ? (
                  <>
                    <Mail className="mr-2 h-4 w-4 animate-spin" />
                    Sending Invitation...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}