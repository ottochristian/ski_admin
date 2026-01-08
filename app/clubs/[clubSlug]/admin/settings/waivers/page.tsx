'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useRequireAdmin } from '@/lib/auth-context'
import { useSelectedSeason } from '@/lib/contexts/season-context'
import { AdminPageHeader } from '@/components/admin-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { InlineLoading, ErrorState } from '@/components/ui/loading-states'
import { Plus, Edit, FileText, Eye, CheckCircle, Copy } from 'lucide-react'
import { useWaivers, useCreateWaiver, useUpdateWaiver } from '@/lib/hooks/use-waivers'
import { toast } from 'sonner'

export default function WaiversAdminPage() {
  const params = useParams()
  const router = useRouter()
  const clubSlug = params.clubSlug as string
  const { profile } = useRequireAdmin()
  const selectedSeason = useSelectedSeason()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingWaiver, setEditingWaiver] = useState<any>(null)
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    required: true,
  })

  // PHASE 2: RLS handles club filtering automatically
  const { data: waivers = [], isLoading, error } = useWaivers(selectedSeason?.id)
  const createWaiver = useCreateWaiver()
  const updateWaiver = useUpdateWaiver()

  const handleCreateWaiver = async () => {
    if (!selectedSeason) {
      toast.error('Please select a season first')
      return
    }

    try {
      await createWaiver.mutateAsync({
        ...formData,
        seasonId: selectedSeason.id,
      })

      setFormData({ title: '', body: '', required: true })
      setIsCreateDialogOpen(false)
      toast.success('Waiver created successfully')
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Unknown error occurred'
      console.error('Create waiver error:', error)
      console.error('Error details:', {
        message: error?.message,
        hint: error?.hint,
        details: error?.details,
        code: error?.code,
        full: JSON.stringify(error, null, 2)
      })
      toast.error(`Failed to create waiver: ${errorMessage}`)
    }
  }

  const handleUpdateWaiver = async () => {
    if (!editingWaiver) return

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/admin/settings/waivers/page.tsx:86',message:'handleUpdateWaiver called',data:{waiverId:editingWaiver.id,formData},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    try {
      await updateWaiver.mutateAsync({
        id: editingWaiver.id,
        ...formData,
      })

      setEditingWaiver(null)
      setFormData({ title: '', body: '', required: true })
      toast.success('Waiver updated successfully')
    } catch (error) {
      toast.error('Failed to update waiver')
      console.error('Update waiver error:', error)
    }
  }

  const handleCloneWaiver = (waiver: any) => {
    setFormData({
      title: `${waiver.title} (Copy)`,
      body: waiver.body,
      required: waiver.required,
    })
    setIsCreateDialogOpen(true)
    toast.info('Waiver cloned. Edit the title and save to create a new waiver.')
  }

  const handleEdit = (waiver: any) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/admin/settings/waivers/page.tsx:104',message:'handleEdit called',data:{waiverId:waiver.id,waiverRequired:waiver.required},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    setEditingWaiver(waiver)
    const newFormData = {
      title: waiver.title,
      body: waiver.body,
      required: waiver.required,
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/admin/settings/waivers/page.tsx:111',message:'handleEdit formData set',data:newFormData,timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    setFormData(newFormData)
  }

  const resetForm = () => {
    setFormData({ title: '', body: '', required: true })
    setEditingWaiver(null)
    setIsCreateDialogOpen(false)
  }

  if (!selectedSeason) {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Season Selected</CardTitle>
            <CardDescription>
              Please select a season to manage waivers.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (error) {
    return <ErrorState error={error} />
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Waivers & Documents"
        description="Manage season waivers and legal documents"
      />

      <div className="mb-6">
        <Dialog open={isCreateDialogOpen || !!editingWaiver} onOpenChange={(open) => {
          if (!open) resetForm()
          else if (!editingWaiver) setIsCreateDialogOpen(true)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Waiver
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingWaiver ? 'Edit Waiver' : 'Create New Waiver'}
                </DialogTitle>
                <DialogDescription>
                  {editingWaiver
                    ? 'Update the waiver details below.'
                    : 'Create a new waiver for the current season.'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Waiver Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., 2025-2026 Season Participation Waiver"
                  />
                </div>

                <div>
                  <Label htmlFor="body">Waiver Content</Label>
                  <Textarea
                    id="body"
                    value={formData.body}
                    onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Enter the full waiver text..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="required" className="text-base font-medium cursor-pointer">
                      Required for registration
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Parents must sign this waiver before registering athletes
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-medium transition-colors ${!formData.required ? 'text-muted-foreground' : 'text-green-600'}`}>
                      {formData.required ? 'ON' : 'OFF'}
                    </span>
                    <Switch
                      id="required"
                      checked={formData.required}
                      onCheckedChange={(checked) => {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/admin/settings/waivers/page.tsx:195',message:'Switch onCheckedChange',data:{checked,currentFormDataRequired:formData.required},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
                        // #endregion
                        setFormData(prev => {
                          const updated = { ...prev, required: checked }
                          // #region agent log
                          fetch('http://127.0.0.1:7242/ingest/3aef41da-a86e-401e-9528-89856938cb09',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/clubs/[clubSlug]/admin/settings/waivers/page.tsx:200',message:'Switch formData updated',data:updated,timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'D'})}).catch(()=>{});
                          // #endregion
                          return updated
                        })
                      }}
                      className="h-7 w-12 data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={editingWaiver ? handleUpdateWaiver : handleCreateWaiver}
                  disabled={!formData.title.trim() || !formData.body.trim()}
                >
                  {editingWaiver ? 'Update Waiver' : 'Create Waiver'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Season Waivers</CardTitle>
          <CardDescription>
            Waivers for {selectedSeason.name}. Parents must sign required waivers before registering athletes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <InlineLoading />
          ) : waivers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waivers.map((waiver: any) => (
                  <TableRow key={waiver.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {waiver.title}
                        {waiver.required && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {waiver.required ? (
                        <Badge variant="destructive" className="bg-green-600 hover:bg-green-700">
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Optional</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          waiver.status === 'active'
                            ? 'default'
                            : waiver.status === 'inactive'
                            ? 'secondary'
                            : 'secondary'
                        }
                        className={
                          waiver.status === 'active'
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : waiver.status === 'inactive'
                            ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                            : 'bg-gray-500 hover:bg-gray-600 text-white'
                        }
                      >
                        {waiver.status.charAt(0).toUpperCase() + waiver.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(waiver.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(waiver)}
                          title="Edit waiver"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCloneWaiver(waiver)}
                          title="Clone waiver"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Preview waiver content
                            const previewWindow = window.open('', '_blank')
                            if (previewWindow) {
                              previewWindow.document.write(`
                                <html>
                                  <head>
                                    <title>${waiver.title}</title>
                                    <style>
                                      body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                                      pre { white-space: pre-wrap; font-family: inherit; }
                                    </style>
                                  </head>
                                  <body>
                                    <h1>${waiver.title}</h1>
                                    <pre>${waiver.body}</pre>
                                  </body>
                                </html>
                              `)
                            }
                          }}
                          title="Preview waiver"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No waivers yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first waiver to get started with legal compliance.
              </p>
              <Button
                className="mt-4"
                onClick={() => setIsCreateDialogOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Waiver
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {waivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waiver Compliance</CardTitle>
            <CardDescription>
              Track which athletes have signed required waivers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Waiver signature tracking will be displayed here once athletes start registering.
              This will show compliance status for each athlete and waiver.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
