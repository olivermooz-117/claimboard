import type { CollectionSchema } from 'deepspace/schema'

export const claimsSchema: CollectionSchema = {
  name: 'claims',
  columns: [
    { name: 'boardId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'parentId', storage: 'text', interpretation: 'plain' },
    { name: 'stance', storage: 'text', interpretation: 'plain', required: true },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true },
    { name: 'bodyDocId', storage: 'text', interpretation: 'plain' },
    { name: 'authorId', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
