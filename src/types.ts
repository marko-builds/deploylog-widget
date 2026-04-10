export interface WidgetConfig {
  projectId: string
  position: 'bottom-right' | 'bottom-left'
  theme: 'auto' | 'light' | 'dark'
  apiUrl: string
}

export interface Entry {
  id: string
  title: string
  slug: string
  entry_type: string | null
  version: string | null
  body_html: string
  published_at: string
}

export interface WidgetData {
  project: { name: string; slug: string }
  entries: Entry[]
  plan: string
}
