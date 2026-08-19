export interface WidgetConfig {
  projectId: string
  position: 'bottom-right' | 'bottom-left'
  theme: 'auto' | 'light' | 'dark'
  accentColor: string
  apiUrl: string
}

export interface Entry {
  id: string
  title: string
  slug: string
  entry_type: string | null
  version: string | null
  // Server-sanitized HTML (deploylog issue 37) — rendered raw via innerHTML, never
  // re-escaped or run through a client-side sanitizer like DOMPurify (kept under the
  // widget's <15KB bundle budget). This field is not safe to render if that contract changes.
  body_html: string
  published_at: string
}

export interface WidgetData {
  project: { name: string; slug: string }
  entries: Entry[]
  plan: string
  // Appearance saved in the dashboard. The widget applies this over the
  // script's data-attributes so "Widget Appearance" settings actually take
  // effect on the embedded widget.
  widget_config?: {
    position?: 'bottom-right' | 'bottom-left'
    theme?: 'auto' | 'light' | 'dark'
    accent_color?: string
  }
}
