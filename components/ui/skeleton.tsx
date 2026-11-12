import { cn } from "cn"

/** Barra cinza plana, sem brilho animado. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-control bg-active", className)}
      {...props}
    />
  )
}

export { Skeleton }
