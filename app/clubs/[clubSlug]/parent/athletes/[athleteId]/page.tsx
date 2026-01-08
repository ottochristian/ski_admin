'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParentClub } from '@/lib/use-parent-club'
import { useAthlete, useUpdateAthlete } from '@/lib/hooks/use-athletes'
import { useAthleteRegistrations } from '@/lib/hooks/use-registrations'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Calendar, ShoppingCart, Mail, Phone, Edit2, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'

export default function AthleteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const athleteId = params.athleteId as string

  const { profile, loading: authLoading } = useParentClub()

  const { data: athlete, isLoading: athleteLoading, error: athleteError, refetch: refetchAthlete } = useAthlete(athleteId)
  const { data: registrations = [], isLoading: registrationsLoading } = useAthleteRegistrations(athleteId)
  
  // State for medical notes editing
  const [isEditingMedicalNotes, setIsEditingMedicalNotes] = useState(false)
  const [medicalNotesValue, setMedicalNotesValue] = useState('')
  const updateAthlete = useUpdateAthlete()

  // Calculate age correctly
  const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const age = athlete ? calculateAge(athlete.date_of_birth) : null

  // Initialize medical notes value when athlete loads
  useEffect(() => {
    if (athlete && !isEditingMedicalNotes) {
      setMedicalNotesValue(athlete.medical_notes || '')
    }
  }, [athlete, isEditingMedicalNotes])

  const handleStartEditMedicalNotes = () => {
    setMedicalNotesValue(athlete?.medical_notes || '')
    setIsEditingMedicalNotes(true)
  }

  const handleCancelEditMedicalNotes = () => {
    setMedicalNotesValue(athlete?.medical_notes || '')
    setIsEditingMedicalNotes(false)
  }

  const handleSaveMedicalNotes = async () => {
    if (!athlete) return

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/athletes/[athleteId]/page.tsx:80',message:'handleSaveMedicalNotes called',data:{athleteId:athlete.id,medicalNotesValue:medicalNotesValue,trimmedValue:medicalNotesValue.trim()||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    try {
      const result = await updateAthlete.mutateAsync({
        athleteId: athlete.id,
        updates: {
          medical_notes: medicalNotesValue.trim() || null,
        },
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/athletes/[athleteId]/page.tsx:95',message:'mutation success',data:{result},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      toast.success('Medical notes updated successfully')
      setIsEditingMedicalNotes(false)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/athletes/[athleteId]/page.tsx:99',message:'calling refetchAthlete',timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const refetchResult = await refetchAthlete()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/athletes/[athleteId]/page.tsx:103',message:'refetchAthlete completed',data:{refetchResult:refetchResult?.data?{id:refetchResult.data.id,medical_notes:refetchResult.data.medical_notes}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/parent/athletes/[athleteId]/page.tsx:109',message:'mutation error',data:{error:error?.message||String(error),errorType:error?.constructor?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      toast.error('Failed to update medical notes')
      console.error('Error updating medical notes:', error)
    }
  }

  if (authLoading || athleteLoading) {
    return <InlineLoading />
  }

  if (athleteError) {
    return <ErrorState error={athleteError} />
  }

  if (!athlete) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Athlete Not Found</CardTitle>
            <CardDescription>
              The athlete you're looking for doesn't exist or you don't have permission to view it.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/clubs/${clubSlug}/parent/athletes`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Athletes
        </Button>
      </div>

      {/* Athlete Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {athlete.first_name} {athlete.last_name}
                {age !== null && (
                  <Badge variant="outline">
                    {age} {age === 1 ? 'year' : 'years'} old
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {athlete.date_of_birth 
                  ? `Date of Birth: ${new Date(athlete.date_of_birth).toLocaleDateString()}`
                  : 'Date of Birth: Not specified'
                }
                {athlete.gender && ` • Gender: ${athlete.gender}`}
              </CardDescription>
            </div>
            <Link href={`/clubs/${clubSlug}/parent/programs?athleteId=${athleteId}`}>
              <Button>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Sign Up for Program
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Date of Birth</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  {athlete.date_of_birth 
                    ? new Date(athlete.date_of_birth).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'Not specified'
                  }
                </p>
              </div>
              {age !== null && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Age</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {age} {age === 1 ? 'year' : 'years'} old
                  </p>
                </div>
              )}
              {athlete.gender && (
                <div className="space-y-2">
                  <span className="text-sm font-medium">Gender</span>
                  <p className="text-sm text-muted-foreground">{athlete.gender}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Medical Notes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Medical Notes</CardTitle>
              <CardDescription>
                Important medical information for {athlete.first_name}
              </CardDescription>
            </div>
            {!isEditingMedicalNotes && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEditMedicalNotes}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {athlete.medical_notes ? 'Edit' : 'Add Medical Notes'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingMedicalNotes ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="medical-notes">
                  Medical Notes <span className="text-muted-foreground">(Optional)</span>
                </Label>
                <Textarea
                  id="medical-notes"
                  value={medicalNotesValue}
                  onChange={(e) => setMedicalNotesValue(e.target.value)}
                  placeholder="Allergies, medications, or other important medical information..."
                  rows={6}
                  className="font-sans"
                />
                <p className="text-xs text-muted-foreground">
                  Include any allergies, medications, medical conditions, or other important health information.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSaveMedicalNotes}
                  disabled={updateAthlete.isPending}
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateAthlete.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelEditMedicalNotes}
                  disabled={updateAthlete.isPending}
                  size="sm"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : athlete.medical_notes ? (
            <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
              <p className="text-sm whitespace-pre-wrap text-foreground">
                {athlete.medical_notes}
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">
                No medical notes on file.
              </p>
              <p className="text-xs text-muted-foreground">
                Click "Add Medical Notes" above to add important medical information.
              </p>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Registration History */}
      <Card>
        <CardHeader>
          <CardTitle>Program Registrations</CardTitle>
          <CardDescription>
            Registration history for {athlete.first_name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {registrationsLoading ? (
            <div className="text-center py-8">
              <InlineLoading />
            </div>
          ) : registrations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm mb-4">
                No registrations found for {athlete.first_name}.
              </p>
              <Link href={`/clubs/${clubSlug}/parent/programs`}>
                <Button variant="outline">
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Browse Programs
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Sub-Program</TableHead>
                    <TableHead>Season</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Registered Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {registrations.map((registration: any) => (
                    <TableRow key={registration.id}>
                      <TableCell className="font-medium">
                        {registration.sub_programs?.programs?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {registration.sub_programs?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {registration.seasons?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            registration.status === 'confirmed' ? 'default' :
                            registration.status === 'pending' ? 'secondary' :
                            registration.status === 'cancelled' ? 'destructive' :
                            'outline'
                          }
                        >
                          {registration.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge 
                            variant={
                              registration.payment_status === 'paid' ? 'default' :
                              registration.payment_status === 'pending' ? 'secondary' :
                              registration.payment_status === 'partial' ? 'outline' :
                              'destructive'
                            }
                          >
                            {registration.payment_status || 'Unknown'}
                          </Badge>
                          {registration.amount_paid > 0 && (
                            <span className="text-xs text-muted-foreground">
                              ${registration.amount_paid.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {registration.created_at
                          ? new Date(registration.created_at).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
