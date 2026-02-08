import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // Slightly more neutral than bg-accent (which can look "beige" on some themes)
      className={cn(
        "bg-muted/40 animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
