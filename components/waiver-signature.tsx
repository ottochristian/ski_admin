'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useSignWaiver, useAthleteWaiverStatus } from '@/lib/hooks/use-waivers'
import { toast } from 'sonner'

interface WaiverSignatureProps {
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
  showTitle?: boolean
}

export function WaiverSignature({
  waiver,
  athlete,
  guardianId,
  onSignatureComplete,
  showTitle = true
}: WaiverSignatureProps) {
  const [agreed, setAgreed] = useState(false)
  const [typedName, setTypedName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const signWaiver = useSignWaiver()
  const { data: waiverStatus } = useAthleteWaiverStatus(athlete.id)

  // Check if this specific waiver is already signed
  const isSigned = waiverStatus?.find(
    (status: any) => status.waiver_id === waiver.id && status.status === 'signed'
  )

  const handleSign = async () => {
    if (!agreed) {
      toast.error('Please check the agreement box to continue')
      return
    }

    const fullName = `${athlete.first_name} ${athlete.last_name}`
    if (typedName.trim().toLowerCase() !== fullName.toLowerCase()) {
      toast.error('Please type the athlete\'s full name exactly as shown')
      return
    }

    setIsSubmitting(true)
    try {
      await signWaiver.mutateAsync({
        waiverId: waiver.id,
        athleteId: athlete.id,
        guardianId,
        signedName: typedName.trim(),
      })

      toast.success('Waiver signed successfully')
      setAgreed(false)
      setTypedName('')
      onSignatureComplete?.()
    } catch (error) {
      toast.error('Failed to sign waiver')
      console.error('Sign waiver error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSigned) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Waiver signed for {athlete.first_name} {athlete.last_name}
            </span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            Signed on {new Date(isSigned.signed_at).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={waiver.required ? 'border-orange-200' : 'border-gray-200'}>
      <CardHeader>
        {showTitle && (
          <>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {waiver.title}
              {waiver.required && (
                <span className="text-sm font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">
                  Required
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Please read and sign this waiver for {athlete.first_name} {athlete.last_name}
            </CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Waiver Content */}
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto bg-gray-50">
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
            {waiver.body}
          </pre>
        </div>

        {/* Agreement Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`agree-${waiver.id}-${athlete.id}`}
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked as boolean)}
          />
          <Label
            htmlFor={`agree-${waiver.id}-${athlete.id}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            I have read and agree to the terms of this waiver
          </Label>
        </div>

        {/* Name Verification */}
        <div className="space-y-2">
          <Label htmlFor={`name-${waiver.id}-${athlete.id}`}>
            Type the athlete's full name to confirm: <strong>{athlete.first_name} {athlete.last_name}</strong>
          </Label>
          <Input
            id={`name-${waiver.id}-${athlete.id}`}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={`${athlete.first_name} ${athlete.last_name}`}
            className="font-mono"
          />
          {typedName && typedName.trim().toLowerCase() !== `${athlete.first_name} ${athlete.last_name}`.toLowerCase() && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Name must match exactly: {athlete.first_name} {athlete.last_name}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Sign Button */}
        <Button
          onClick={handleSign}
          disabled={!agreed || !typedName.trim() || isSubmitting}
          className="w-full"
          variant={waiver.required ? "default" : "outline"}
        >
          {isSubmitting ? 'Signing...' : `Sign Waiver for ${athlete.first_name} ${athlete.last_name}`}
        </Button>

        {waiver.required && (
          <p className="text-xs text-muted-foreground text-center">
            This waiver is required before you can complete registration
          </p>
        )}
      </CardContent>
    </Card>
  )
}
