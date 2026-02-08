import * as React from "react"

const DEFAULT_MOBILE_BREAKPOINT = 1280

export function useIsMobile(breakpoint: number = DEFAULT_MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.innerWidth < breakpoint
  })

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const query = `(max-width: ${breakpoint - 1}px)`
    const mediaQuery = window.matchMedia(query)

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    // Sync on mount in case the breakpoint changed
    setIsMobile(mediaQuery.matches)

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    // Fallback for older browsers
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [breakpoint])

  return isMobile
}
