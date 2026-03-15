'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import useSWR, { mutate } from 'swr'
import { ThumbsUp, MapPin, Send, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/providers/auth-provider'
import type { Complaint, Comment } from '@/lib/types'
import { CATEGORY_CONFIG, STATUS_CONFIG } from '@/lib/types'

interface ComplaintSheetProps {
  complaint: Complaint | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComplaintSheet({ complaint, open, onOpenChange }: ComplaintSheetProps) {
  const { user } = useAuth()
  const [newComment, setNewComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpvoting, setIsUpvoting] = useState(false)
  const supabase = createClient()

  // Fetch comments for this complaint
  const { data: comments = [], isLoading: loadingComments } = useSWR(
    complaint ? `comments-${complaint.id}` : null,
    async () => {
      const { data } = await supabase
        .from('comments')
        .select('*, profiles(display_name)')
        .eq('complaint_id', complaint!.id)
        .order('created_at', { ascending: true })
      return (data || []) as Comment[]
    }
  )

  // Check if user has upvoted
  const { data: hasUpvoted } = useSWR(
    user && complaint ? `upvote-${complaint.id}-${user.id}` : null,
    async () => {
      const { data } = await supabase
        .from('upvotes')
        .select('id')
        .eq('complaint_id', complaint!.id)
        .eq('user_id', user!.id)
        .single()
      return !!data
    }
  )

  // Set up real-time subscription for comments
  useEffect(() => {
    if (!complaint) return

    const channel = supabase
      .channel(`comments-${complaint.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `complaint_id=eq.${complaint.id}`,
        },
        () => {
          mutate(`comments-${complaint.id}`)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [complaint, supabase])

  const handleSubmitComment = async () => {
    if (!user || !complaint || !newComment.trim()) return
    
    setIsSubmitting(true)
    try {
      await supabase.from('comments').insert({
        complaint_id: complaint.id,
        user_id: user.id,
        content: newComment.trim(),
      })
      setNewComment('')
      mutate(`comments-${complaint.id}`)
    } catch (error) {
      console.error('Error posting comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpvote = async () => {
    if (!user || !complaint || isUpvoting) return
    
    setIsUpvoting(true)
    try {
      if (hasUpvoted) {
        await supabase
          .from('upvotes')
          .delete()
          .eq('complaint_id', complaint.id)
          .eq('user_id', user.id)
      } else {
        await supabase
          .from('upvotes')
          .insert({ complaint_id: complaint.id, user_id: user.id })
      }
      mutate(`upvote-${complaint.id}-${user.id}`)
      mutate('complaints')
    } catch (error) {
      console.error('Error toggling upvote:', error)
    } finally {
      setIsUpvoting(false)
    }
  }

  if (!complaint) return null

  const categoryConfig = CATEGORY_CONFIG[complaint.category]
  const statusConfig = STATUS_CONFIG[complaint.status]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 pb-0">
          <div className="flex items-start justify-between">
            <SheetTitle className="text-lg pr-8 text-balance">{complaint.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Badge 
              variant="outline"
              style={{ 
                borderColor: categoryConfig.color,
                color: categoryConfig.color,
              }}
            >
              {categoryConfig.label}
            </Badge>
            <Badge 
              variant="secondary"
              style={{ 
                backgroundColor: `${statusConfig.color}20`,
                color: statusConfig.color,
              }}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {/* Image */}
            {complaint.image_url && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={complaint.image_url}
                  alt={complaint.title}
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground">{complaint.description}</p>

            {/* Location */}
            {complaint.address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{complaint.address}</span>
              </div>
            )}

            {/* Meta info */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className={hasUpvoted ? 'border-primary text-primary' : ''}
                  onClick={handleUpvote}
                  disabled={!user || isUpvoting}
                >
                  <ThumbsUp className={`h-4 w-4 mr-1 ${hasUpvoted ? 'fill-current' : ''}`} />
                  {complaint.upvote_count} upvotes
                </Button>
              </div>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(complaint.created_at), { addSuffix: true })}
              </span>
            </div>

            <Separator />

            {/* Comments section */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Discussion ({comments.length})</h4>
              
              {loadingComments ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="h-8 w-8 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-3 w-full bg-muted rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No comments yet. Be the first to discuss!
                </p>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {(comment.profiles?.display_name || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.profiles?.display_name || 'Anonymous'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Comment input */}
        <div className="border-t p-4">
          {user ? (
            <div className="flex gap-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <Button
                size="icon"
                className="shrink-0"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">
              <a href="/auth/login" className="text-primary hover:underline">Sign in</a> to join the discussion
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
