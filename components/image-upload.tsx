'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  bucket?: string
  folder?: string
  maxSizeMB?: number
  accept?: string
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'club-logos',
  folder = 'logos',
  maxSizeMB = 5,
  accept = 'image/*',
}: ImageUploadProps) {
  const { toast: showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)

  // Sync preview with value prop when it changes from external source
  // (e.g., when loading existing data, but not during active upload)
  useEffect(() => {
    // Only sync if we're not currently uploading
    // This prevents the preview from reverting during upload
    if (!isUploadingRef.current) {
      setPreview(value || null)
    }
  }, [value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast({
        title: 'Invalid file type',
        description: 'Please select an image file',
        variant: 'destructive',
      })
      return
    }

    // Validate file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      showToast({
        title: 'File too large',
        description: `File must be less than ${maxSizeMB}MB`,
        variant: 'destructive',
      })
      return
    }

    // Create temporary preview from file (for immediate feedback)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreview(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage (this will update preview with public URL)
    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    try {
      isUploadingRef.current = true
      setUploading(true)

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = fileName

      // Upload file
      console.log('Attempting to upload file to bucket:', bucket, 'path:', filePath)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        console.error('Upload error details:', {
          message: uploadError.message,
          statusCode: (uploadError as any).statusCode,
          error: uploadError,
        })
        
        // If bucket doesn't exist, try to create it (this might fail without admin access)
        if (uploadError.message.includes('Bucket not found') || (uploadError as any).statusCode === '404') {
          showToast({
            title: 'Storage bucket not found',
            description: `Please create a bucket named "${bucket}" in Supabase Storage and make it public`,
            variant: 'destructive',
          })
        } else {
          showToast({
            title: 'Upload failed',
            description: uploadError.message || 'Failed to upload image. Please check your Supabase Storage configuration.',
            variant: 'destructive',
          })
        }
        setPreview(null)
        onChange(null)
        return
      }

      if (!uploadData) {
        console.error('Upload succeeded but no data returned')
        showToast({
          title: 'Upload failed',
          description: 'Upload completed but no file data was returned',
          variant: 'destructive',
        })
        setPreview(null)
        onChange(null)
        return
      }

      console.log('Upload successful, upload data:', uploadData)

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath)

      console.log('Image uploaded successfully, public URL:', publicUrl)
      console.log('Full URL path:', filePath)
      
      // Update preview to show the uploaded image
      setPreview(publicUrl)
      
      // Notify parent component
      onChange(publicUrl)
      
      showToast({
        title: 'Upload successful',
        description: 'Image uploaded successfully',
      })
    } catch (err) {
      console.error('Error uploading file:', err)
      showToast({
        title: 'Upload failed',
        description: 'An error occurred while uploading the image',
        variant: 'destructive',
      })
      setPreview(null)
    } finally {
      setUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // Allow useEffect to sync again after a short delay
      setTimeout(() => {
        isUploadingRef.current = false
      }, 100)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <Label>Logo</Label>
      <div className="flex items-start gap-4">
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Logo preview"
              className="h-24 w-24 rounded-md object-cover border border-slate-200"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="h-24 w-24 rounded-md border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50">
            <Upload className="h-8 w-8 text-slate-400" />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            disabled={uploading}
            className="cursor-pointer"
          />
          <p className="text-xs text-muted-foreground">
            Upload a logo image (max {maxSizeMB}MB). Supported formats: JPG, PNG, GIF, WebP
          </p>
          {uploading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
