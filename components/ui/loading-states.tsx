import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'

/**
 * Standard loading spinner component
 */
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

/**
 * Full-page loading state
 */
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

/**
 * Inline loading state for content areas
 */
export function InlineLoading({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}

/**
 * Standard error display component
 */
export function ErrorState({
  error,
  title = 'Error',
  onRetry,
}: {
  error: string | Error | null
  title?: string
  onRetry?: () => void
}) {
  const errorMessage = error instanceof Error ? error.message : error || 'An error occurred'

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">{title}</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/**
 * Full-page error state
 */
export function FullPageError({
  error,
  title = 'Error',
  onRetry,
}: {
  error: string | Error | null
  title?: string
  onRetry?: () => void
}) {
  const errorMessage = error instanceof Error ? error.message : error || 'An error occurred'

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">{title}</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <button
              onClick={onRetry}
              className="text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

/**
 * Empty state component
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}


