'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import useSWR, { mutate } from 'swr'
import { Plus, List, Map as MapIcon, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/header'
import { WelcomeDialog } from '@/components/welcome-dialog'
import { ComplaintCard } from '@/components/complaint/complaint-card'
import { ComplaintSheet } from '@/components/complaint/complaint-sheet'
import { NewComplaintDialog } from '@/components/complaint/new-complaint-dialog'
import type { Complaint, Category } from '@/lib/types'
import { CATEGORY_CONFIG } from '@/lib/types'

// Dynamic import for map to avoid SSR issues with Leaflet
const IssueMap = dynamic(
  () => import('@/components/map/issue-map').then((mod) => mod.IssueMap),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-muted">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    ),
  }
)

export default function HomePage() {
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map')
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newComplaintOpen, setNewComplaintOpen] = useState(false)
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<Category[]>([])
  const supabase = createClient()

  // Fetch complaints
  const { data: complaints = [], isLoading } = useSWR('complaints', async () => {
    const { data, error } = await supabase
      .from('complaints')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data as Complaint[]
  })

  // Filter complaints by category
  const filteredComplaints = categoryFilter.length > 0
    ? complaints.filter(c => categoryFilter.includes(c.category))
    : complaints

  // Set up real-time subscription for complaints
  useEffect(() => {
    const channel = supabase
      .channel('complaints-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'complaints' },
        () => {
          mutate('complaints')
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Listen for complaint created event
  useEffect(() => {
    const handleComplaintCreated = () => {
      mutate('complaints')
    }
    window.addEventListener('complaint-created', handleComplaintCreated)
    return () => window.removeEventListener('complaint-created', handleComplaintCreated)
  }, [])

  const handleComplaintClick = useCallback((complaint: Complaint) => {
    setSelectedComplaint(complaint)
    setSheetOpen(true)
  }, [])

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (isSelectingLocation) {
      setSelectedLocation({ lat, lng })
      setIsSelectingLocation(false)
      setNewComplaintOpen(true)
    }
  }, [isSelectingLocation])

  const handleLocationFound = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng })
  }, [])

  const handleNewComplaint = () => {
    if (userLocation) {
      setSelectedLocation(userLocation)
      setNewComplaintOpen(true)
    } else {
      setIsSelectingLocation(true)
    }
  }

  const handleSelectLocation = () => {
    setNewComplaintOpen(false)
    setIsSelectingLocation(true)
  }

  const toggleCategoryFilter = (category: Category) => {
    setCategoryFilter(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <WelcomeDialog />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-lg border p-0.5">
              <Button
                variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('map')}
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Category filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                  {categoryFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1">
                      {categoryFilter.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={categoryFilter.includes(key as Category)}
                    onCheckedChange={() => toggleCategoryFilter(key as Category)}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: config.color }}
                      />
                      {config.label}
                    </div>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <span className="text-xs text-muted-foreground">
              {filteredComplaints.length} issues
            </span>
          </div>

          <Button size="sm" className="h-7" onClick={handleNewComplaint}>
            <Plus className="h-4 w-4 mr-1" />
            Report Issue
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'map' ? (
            <IssueMap
              complaints={filteredComplaints}
              onComplaintClick={handleComplaintClick}
              onMapClick={handleMapClick}
              isSelectingLocation={isSelectingLocation}
              selectedLocation={selectedLocation}
              onLocationFound={handleLocationFound}
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-64 rounded-lg bg-muted animate-pulse" />
                  ))
                ) : filteredComplaints.length === 0 ? (
                  <div className="col-span-full text-center py-12">
                    <p className="text-muted-foreground">No issues reported yet.</p>
                    <Button className="mt-4" onClick={handleNewComplaint}>
                      Report the first issue
                    </Button>
                  </div>
                ) : (
                  filteredComplaints.map((complaint) => (
                    <ComplaintCard
                      key={complaint.id}
                      complaint={complaint}
                      onViewDetails={() => handleComplaintClick(complaint)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </main>

      {/* Complaint details sheet */}
      <ComplaintSheet
        complaint={selectedComplaint}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* New complaint dialog */}
      <NewComplaintDialog
        open={newComplaintOpen}
        onOpenChange={setNewComplaintOpen}
        location={selectedLocation}
        onSelectLocation={handleSelectLocation}
      />
    </div>
  )
}
