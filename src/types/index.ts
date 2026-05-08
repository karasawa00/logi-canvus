// Organization
export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
}

// User
export interface User {
  id: string
  email: string
  name: string
  orgId: string | null
  createdAt: string
}

// Folder
export interface Folder {
  id: string
  name: string
  orgId: string
  parentFolderId: string | null
  createdAt: string
  children?: Folder[]
}

// Page
export interface Page {
  id: string
  title: string
  orgId: string
  folderId: string | null
  createdBy: Pick<User, 'id' | 'name'>
  version: number
  urlSlug: string
  createdAt: string
  updatedAt: string
  blocks?: Block[]
}

// Block types
export type BlockType = 'text' | 'heading' | 'diagram'

export interface Block {
  id: string
  pageId: string
  type: BlockType
  order: number
  content: string | null
  version: number
  createdAt: string
  updatedAt: string
  nodes?: DiagramNode[]
  edges?: DiagramEdge[]
}

// Diagram node types
export type DiagramNodeType = 'Screen' | 'Action' | 'Branch' | 'Start' | 'End' | 'External'

export interface DiagramNode {
  id: string
  blockId: string
  type: DiagramNodeType
  label: string
  positionX: number
  positionY: number
  createdAt: string
  updatedAt: string
}

export interface DiagramEdge {
  id: string
  blockId: string
  sourceNodeId: string
  targetNodeId: string
  label: string | null
  createdAt: string
  updatedAt: string
}

// Annotation
export interface Annotation {
  id: string
  blockId: string
  nodeId: string | null
  blockOffset: number | null
  createdBy: Pick<User, 'id' | 'name'>
  resolvedAt: string | null
  createdAt: string
  comments: Comment[]
}

// Comment
export interface Comment {
  id: string
  annotationId: string
  body: string
  createdBy: Pick<User, 'id' | 'name'>
  createdAt: string
  updatedAt: string
}

// Notification
export type NotificationType = 'annotation_reply' | 'mention' | 'conflict'

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  commentId: string | null
  pageId: string | null
  readAt: string | null
  createdAt: string
  meta: NotificationMeta
}

export interface NotificationMeta {
  actor?: Pick<User, 'id' | 'name'>
  page: {
    title: string
    urlSlug: string
    orgSlug: string
  }
}

// Invitation
export interface Invitation {
  id: string
  orgId: string
  email: string
  token: string
  createdBy: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

// API response types
export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: {
    code: string
    message: string
    current?: unknown
  }
}

// Optimistic lock conflict
export interface ConflictError<T> {
  error: {
    code: 'CONFLICT'
    message: string
    current: T
  }
}
