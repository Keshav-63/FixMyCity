'use client'

import { formatDistanceToNow } from 'date-fns'
import { ThumbsUp, MessageCircle, MapPin } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Complaint } from '@/lib/types'
import { CATEGORY_CONFIG, STATUS_CONFIG } from '@/lib/types'
import { useAuth } from '@/components/providers/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import useSWR, { mutate } from 'swr'

interface ComplaintCardProps {
  complaint: Complaint
  isPopup?: boolean
  onViewDetails?: () => void
}

export function ComplaintCard({ complaint, isPopup = false, onViewDetails }: ComplaintCardProps) {
  const { user } = useAuth()
  const [isUpvoting, setIsUpvoting] = useState(false)
  const supabase = createClient()
  const categoryConfig = CATEGORY_CONFIG[complaint.category]
  const statusConfig = STATUS_CONFIG[complaint.status]

  // Check if user has upvoted this complaint
  const { data: hasUpvoted } = useSWR(
    user ? `upvote-${complaint.id}-${user.id}` : null,
    async () => {
      const { data } = await supabase
        .from('upvotes')
        .select('id')
        .eq('complaint_id', complaint.id)
        .eq('user_id', user!.id)
        .single()
      return !!data
    }
  )

  const handleUpvote = async () => {
    if (!user || isUpvoting) return
    
    setIsUpvoting(true)
    try {
      if (hasUpvoted) {
        // Remove upvote
        await supabase
          .from('upvotes')
          .delete()
          .eq('complaint_id', complaint.id)
          .eq('user_id', user.id)
      } else {
        // Add upvote
        await supabase
          .from('upvotes')
          .insert({ complaint_id: complaint.id, user_id: user.id })
      }
      // Refresh data
      mutate(`upvote-${complaint.id}-${user.id}`)
      mutate('complaints')
    } catch (error) {
      console.error('Error toggling upvote:', error)
    } finally {
      setIsUpvoting(false)
    }
  }

  const cardContent = (
    <>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{complaint.title}</h3>
          <Badge 
            variant="outline" 
            className="shrink-0 text-xs"
            style={{ 
              borderColor: categoryConfig.color,
              color: categoryConfig.color,
            }}
          >
            {categoryConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {complaint.image_url && (
          <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
            <img
              src={complaint.image_url}
              alt={complaint.title}
              className="object-cover w-full h-full"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {complaint.description}
        </p>
        {complaint.address && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">{complaint.address}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <Badge 
            variant="secondary" 
            className="text-xs"
            style={{ 
              backgroundColor: `${statusConfig.color}20`,
              color: statusConfig.color,
            }}
          >
            {statusConfig.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
          </span>
        </div>
      </CardContent>
      <CardFooter className="p-3 pt-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 px-2 gap-1 ${hasUpvoted ? 'text-primary' : ''}`}
            onClick={handleUpvote}
            disabled={!user || isUpvoting}
          >
            <ThumbsUp className={`h-4 w-4 ${hasUpvoted ? 'fill-current' : ''}`} />
            <span className="text-xs">{complaint.upvote_count}</span>
          </Button>
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1"
              onClick={onViewDetails}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">Discuss</span>
            </Button>
          )}
        </div>
        {complaint.profiles?.display_name && (
          <span className="text-xs text-muted-foreground">
            by {complaint.profiles.display_name}
          </span>
        )}
      </CardFooter>
    </>
  )

  if (isPopup) {
    return <div className="min-w-[280px]">{cardContent}</div>
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {cardContent}
    </Card>
  )
}
