'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Camera, Users, ThumbsUp } from 'lucide-react'

const features = [
  {
    icon: MapPin,
    title: 'Report Issues',
    description: 'Pin civic issues on the map to alert your community and local authorities.',
  },
  {
    icon: Camera,
    title: 'Photo Evidence',
    description: 'Upload photos to document issues. Our AI helps categorize them automatically.',
  },
  {
    icon: ThumbsUp,
    title: 'Upvote Issues',
    description: 'Support important issues to prioritize them for faster resolution.',
  },
  {
    icon: Users,
    title: 'Community Discussion',
    description: 'Join discussions with neighbors about local issues and solutions.',
  },
]

export function WelcomeDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('civic-reporter-welcome-seen')
    if (!hasSeenWelcome) {
      setOpen(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem('civic-reporter-welcome-seen', 'true')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl text-balance">Welcome to Civic Issue Reporter</DialogTitle>
          <DialogDescription className="text-pretty">
            Help improve your community by reporting and tracking local issues. Together, we can make our neighborhoods better.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {features.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{feature.title}</h4>
                <p className="text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> This app requires location access to show nearby issues and camera access for uploading photos. You can grant these permissions when prompted.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full">
            Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
