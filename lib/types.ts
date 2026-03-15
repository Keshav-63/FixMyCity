export type Category = 'pothole' | 'water' | 'trash' | 'electrical' | 'road' | 'other'

export type Status = 'open' | 'in_progress' | 'resolved'

export interface Profile {
  id: string
  display_name: string | null
  created_at: string
}

export interface Complaint {
  id: string
  user_id: string
  title: string
  description: string
  category: Category
  latitude: number
  longitude: number
  address: string | null
  image_url: string | null
  status: Status
  upvote_count: number
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Upvote {
  id: string
  user_id: string
  complaint_id: string
  created_at: string
}

export interface Comment {
  id: string
  user_id: string
  complaint_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export const CATEGORY_CONFIG: Record<Category, { label: string; color: string; icon: string }> = {
  pothole: { label: 'Pothole', color: '#EF4444', icon: 'circle-alert' },
  water: { label: 'Water Issue', color: '#3B82F6', icon: 'droplets' },
  trash: { label: 'Trash/Garbage', color: '#22C55E', icon: 'trash-2' },
  electrical: { label: 'Electrical', color: '#F59E0B', icon: 'zap' },
  road: { label: 'Road Damage', color: '#8B5CF6', icon: 'construction' },
  other: { label: 'Other', color: '#6B7280', icon: 'help-circle' },
}

export const STATUS_CONFIG: Record<Status, { label: string; color: string }> = {
  open: { label: 'Open', color: '#EF4444' },
  in_progress: { label: 'In Progress', color: '#F59E0B' },
  resolved: { label: 'Resolved', color: '#22C55E' },
}
