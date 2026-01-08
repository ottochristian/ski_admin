'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system', resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: '!bg-white dark:!bg-gray-900 !text-gray-900 dark:!text-gray-50 !border-gray-200 dark:!border-gray-700 !shadow-xl !opacity-100',
          title: '!text-gray-900 dark:!text-gray-50 !font-semibold',
          description: '!text-gray-700 dark:!text-gray-300 !text-sm !font-normal',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-muted !text-muted-foreground',
        },
        style: {
          opacity: 1,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
