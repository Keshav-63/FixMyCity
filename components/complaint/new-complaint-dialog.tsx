'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, MapPin, Loader2, X, Upload } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import type { Category } from '@/lib/types'
import { CATEGORY_CONFIG } from '@/lib/types'

interface NewComplaintDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  location: { lat: number; lng: number } | null
  onSelectLocation: () => void
}

interface AIAnalysis {
  isAppropriate: boolean
  suggestedCategory: Category | null
  confidence: number
  reason?: string
  suggestedTitle?: string
  suggestedDescription?: string
}

export function NewComplaintDialog({ 
  open, 
  onOpenChange, 
  location,
  onSelectLocation,
}: NewComplaintDialogProps) {
  const { user } = useAuth()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '' as Category | '',
  })
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setImageFile(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Analyze image with AI
    setIsAnalyzing(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      })
      
      if (response.ok) {
        const analysis = await response.json()
        console.log('🤖 AI Analysis Result:', analysis)

        if (!analysis.isAppropriate) {
          // Image rejected - clear everything and show error
          console.log('❌ Image rejected:', analysis.reason)
          setError(analysis.reason || 'This image is not suitable for civic issue reporting')
          setImageFile(null)
          setImagePreview(null)
          setAiAnalysis(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } else {
          // Image approved - set analysis and auto-fill category, title, and description
          setAiAnalysis(analysis)

          const updates: any = {}

          // Auto-fill category if not already set
          if (analysis.suggestedCategory && !form.category) {
            console.log('✅ Auto-filling category:', analysis.suggestedCategory)
            updates.category = analysis.suggestedCategory
          }

          // Auto-fill title if not already set
          if (analysis.suggestedTitle && !form.title) {
            console.log('✅ Auto-filling title:', analysis.suggestedTitle)
            updates.title = analysis.suggestedTitle
          }

          // Auto-fill description if not already set
          if (analysis.suggestedDescription && !form.description) {
            console.log('✅ Auto-filling description:', analysis.suggestedDescription)
            updates.description = analysis.suggestedDescription
          }

          if (Object.keys(updates).length > 0) {
            setForm(prev => ({ ...prev, ...updates }))
          }
        }
      }
    } catch (err) {
      console.error('❌ Error analyzing image:', err)
      setError('Failed to analyze image. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setAiAnalysis(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    if (!form.title || !form.description || !form.category || !location) {
      setError('Please fill in all required fields and select a location')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      let imageUrl = null

      // Upload image if present
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('sem6_fixmycity')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('sem6_fixmycity')
          .getPublicUrl(fileName)

        imageUrl = publicUrl
      }

      // Get address from coordinates using reverse geocoding
      let address = null
      try {
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}`
        )
        if (geoResponse.ok) {
          const geoData = await geoResponse.json()
          address = geoData.display_name
        }
      } catch (geoError) {
        console.error('Geocoding error:', geoError)
      }

      // Create complaint
      const { error: insertError } = await supabase.from('complaints').insert({
        user_id: user.id,
        title: form.title,
        description: form.description,
        category: form.category,
        latitude: location.lat,
        longitude: location.lng,
        address,
        image_url: imageUrl,
      })

      if (insertError) throw insertError

      // Reset form and close dialog
      setForm({ title: '', description: '', category: '' })
      setImageFile(null)
      setImagePreview(null)
      setAiAnalysis(null)
      onOpenChange(false)
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('complaint-created'))
    } catch (err) {
      console.error('Error creating complaint:', err)
      setError('Failed to create complaint. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in Required</DialogTitle>
            <DialogDescription>
              You need to sign in to report an issue.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => router.push('/auth/login')}>
              Sign in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Civic Issue</DialogTitle>
          <DialogDescription>
            Help improve your community by reporting local issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border-2 border-destructive/50 p-4 text-sm text-destructive">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">Image Rejected</p>
                  <p>{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          <div className="space-y-2">
            <Label>Location *</Label>
            <Button
              type="button"
              variant={location ? "outline" : "secondary"}
              className="w-full justify-start"
              onClick={onSelectLocation}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {location 
                ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                : 'Click to select location on map'
              }
            </Button>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <Label>Photo</Label>
            {imagePreview ? (
              <div className="relative">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="object-cover w-full h-full"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Analyzing image...</span>
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={handleRemoveImage}
                >
                  <X className="h-4 w-4" />
                </Button>
                {aiAnalysis?.isAppropriate && aiAnalysis.suggestedCategory && (
                  <p className="text-xs text-muted-foreground mt-2">
                    AI detected: <strong>{CATEGORY_CONFIG[aiAnalysis.suggestedCategory].label}</strong>
                    {' '}({Math.round(aiAnalysis.confidence * 100)}% confidence)
                  </p>
                )}
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG up to 5MB
                </p>
                <p className="text-xs text-muted-foreground mt-2 px-4">
                  📸 Upload photos of: potholes, road damage, water leaks, trash, electrical issues, or other civic problems
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue"
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            />
            {aiAnalysis?.suggestedTitle && form.title === aiAnalysis.suggestedTitle && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                ✨ AI-generated (you can edit this)
              </p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={form.category}
              onValueChange={(value) => setForm(prev => ({ ...prev, category: value as Category }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Provide details about the issue..."
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="min-h-[100px]"
            />
            {aiAnalysis?.suggestedDescription && form.description === aiAnalysis.suggestedDescription && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                ✨ AI-generated (you can edit this)
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isAnalyzing}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
