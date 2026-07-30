import * as React from "react"
import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/utils"

/**
 * Radix's HoverCard is mouse-only by design: it opens on pointerenter and
 * explicitly ignores touch pointers. On an iPad that meant the pattern
 * previews in the Pattern Book Builder and the info cards in Contract
 * Management simply never appeared — there was no gesture that could open
 * them. This wrapper keeps the hover behaviour for a mouse and adds
 * tap-to-toggle for touch and pen.
 */
const HoverCardContext = React.createContext(null)

const HoverCard = ({ open, defaultOpen, onOpenChange, children, ...props }) => {
  const isControlled = open !== undefined
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false)
  const isOpen = isControlled ? open : uncontrolledOpen

  const setOpen = React.useCallback(
    (next) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )

  const ctx = React.useMemo(() => ({ open: isOpen, setOpen }), [isOpen, setOpen])

  return (
    <HoverCardContext.Provider value={ctx}>
      <HoverCardPrimitive.Root open={isOpen} onOpenChange={setOpen} {...props}>
        {children}
      </HoverCardPrimitive.Root>
    </HoverCardContext.Provider>
  )
}

const HoverCardTrigger = React.forwardRef(({ onPointerDown, ...props }, ref) => {
  const ctx = React.useContext(HoverCardContext)

  return (
    <HoverCardPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        // Mouse keeps the native hover behaviour; a finger or pen toggles.
        if (event.pointerType !== "mouse" && ctx) ctx.setOpen(!ctx.open)
      }}
      {...props}
    />
  )
})
HoverCardTrigger.displayName = HoverCardPrimitive.Trigger.displayName

const HoverCardContent = React.forwardRef(
  ({ className, align = "center", sideOffset = 4, collisionPadding = 8, ...props }, ref) => (
    <HoverCardPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      // Several call sites ask for w-96 or w-[700px]; without the clamp and the
      // collision padding those hang off the side of a phone or tablet.
      collisionPadding={collisionPadding}
      className={cn(
        "touch-scroll z-50 max-h-[var(--radix-hover-card-content-available-height)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  )
)
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName

export { HoverCard, HoverCardTrigger, HoverCardContent }
