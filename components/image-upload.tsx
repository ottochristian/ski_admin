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
  label?: string
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'club-logos',
  folder = 'logos',
  maxSizeMB = 5,
  accept = 'image/*',
  label,
}: ImageUploadProps) {
  const { toast: showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isUploadingRef = useRef(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)

  // Sync preview with value prop when it changes from external source
  // (e.g., when loading existing data, but not during active upload)
  useEffect(() => {
    // Always sync preview with value when value changes
    // This ensures the preview updates immediately when a new image is uploaded
    if (value) {
      setPreview(value)
      isUploadingRef.current = false
    } else if (!uploading) {
      // Only clear preview if we're not uploading and value is null
      setPreview(null)
      isUploadingRef.current = false
    }
  }, [value, uploading])

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
        // Better error serialization
        const errorDetails = {
          message: uploadError.message || 'Unknown error',
          name: uploadError.name || 'Unknown',
          statusCode: (uploadError as any).statusCode,
          status: (uploadError as any).status,
          error: uploadError,
          errorString: String(uploadError),
          errorJSON: JSON.stringify(uploadError, Object.getOwnPropertyNames(uploadError)),
        }
        
        console.error('Upload error details:', errorDetails)
        
        // Check for specific error types
        const errorMessage = uploadError.message || String(uploadError)
        const errorLower = errorMessage.toLowerCase()
        
        // Check if bucket doesn't exist
        if (
          errorLower.includes('bucket not found') ||
          errorLower.includes('does not exist') ||
          (uploadError as any).statusCode === 404 ||
          (uploadError as any).status === 404
        ) {
          showToast({
            title: 'Storage bucket not found',
            description: `The bucket "${bucket}" doesn't exist. Please create it in Supabase Dashboard → Storage.`,
            variant: 'destructive',
          })
        } 
        // Check for permission/RLS errors
        else if (
          errorLower.includes('permission') ||
          errorLower.includes('unauthorized') ||
          errorLower.includes('forbidden') ||
          (uploadError as any).statusCode === 403 ||
          (uploadError as any).status === 403
        ) {
          showToast({
            title: 'Permission denied',
            description: `You don't have permission to upload to "${bucket}". Check bucket RLS policies in Supabase Dashboard.`,
            variant: 'destructive',
          })
        }
        // Check for file too large
        else if (
          errorLower.includes('too large') ||
          errorLower.includes('file size') ||
          (uploadError as any).statusCode === 413 ||
          (uploadError as any).status === 413
        ) {
          showToast({
            title: 'File too large',
            description: 'The file is too large. Please select a smaller image.',
            variant: 'destructive',
          })
        }
        // Generic error
        else {
          showToast({
            title: 'Upload failed',
            description: errorMessage || 'Failed to upload image. Check browser console for details.',
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
      
      // Update preview to show the uploaded image immediately
      setPreview(publicUrl)
      isUploadingRef.current = false
      
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

  const displayLabel = label || (bucket === 'profile-images' ? 'Profile Picture' : 'Logo')

  return (
    <div className="space-y-2">
      <Label>{displayLabel}</Label>
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
            Upload an image (max {maxSizeMB}MB). Supported formats: JPG, PNG, GIF, WebP
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
