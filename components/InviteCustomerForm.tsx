"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useOrganization } from "@clerk/nextjs";

const formSchema = z.object({
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
});

interface InviteCustomerFormProps {
  projectId: Id<"projects">;
}

export function InviteCustomerForm({ projectId }: InviteCustomerFormProps) {
  const { organization } = useOrganization();
  const project = useQuery(api.projects.getProject, { projectId });
  const inviteCustomer = useMutation(api.teams.inviteCustomerToProject);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!organization) {
      toast.error("Organization not found");
      return;
    }

    try {
      // Sprawdź czy użytkownik już jest w organizacji
      const membersResponse = await organization.getMemberships();
      const existingMember = membersResponse.data.find(member => 
        member.publicUserData?.identifier === values.email
      );

      if (existingMember) {
        // Użytkownik już jest w organizacji - po prostu dodaj do projektu
        await inviteCustomer({
          email: values.email,
          projectId: projectId,
        });

        toast.success("Customer Added to Project", {
          description: `${values.email} has been given access to this project.`,
        });
      } else {
        // Nowy użytkownik - zaproś do organizacji i dodaj do projektu
        await organization.inviteMember({
          emailAddress: values.email,
          role: "org:customer",
        });

        await inviteCustomer({
          email: values.email,
          projectId: projectId,
        });

        toast.success("Customer Invited", {
          description: `${values.email} has been invited to the organization as a customer and will have access to this project once they join.`,
        });
      }

      form.reset();
    } catch (error) {
      console.error("Error sending invitation:", error);
      toast.error("Error Sending Invitation", {
        description: (error as Error).message || "There was a problem sending the invitation. Please try again.",
      });
    }
  }

  if (!project) {
    return <div>Loading...</div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Customer Email</FormLabel>
              <FormControl>
                <Input placeholder="customer@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <p className="text-sm text-muted-foreground">
          The customer will be invited to join the organization and will have access only to the project "{project.name}".
        </p>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Sending..." : "Send Organization Invitation"}
        </Button>
      </form>
    </Form>
  );
} 