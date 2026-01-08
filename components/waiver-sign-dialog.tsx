'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WaiverSignature } from '@/components/waiver-signature'

interface WaiverSignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  waiver: {
    id: string
    title: string
    body: string
    required: boolean
  }
  athlete: {
    id: string
    first_name: string
    last_name: string
  }
  guardianId: string
  onSignatureComplete?: () => void
}

export function WaiverSignDialog({
  open,
  onOpenChange,
  waiver,
  athlete,
  guardianId,
  onSignatureComplete,
}: WaiverSignDialogProps) {
  const handleSignatureComplete = () => {
    onSignatureComplete?.()
    onOpenChange(false) // Close dialog after successful signature
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{waiver.title}</DialogTitle>
          <DialogDescription>
            Please review and sign this waiver for {athlete.first_name} {athlete.last_name}
            {waiver.required && (
              <span className="ml-2 text-orange-600 font-medium">(Required)</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <WaiverSignature
            waiver={waiver}
            athlete={athlete}
            guardianId={guardianId}
            onSignatureComplete={handleSignatureComplete}
            showTitle={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

