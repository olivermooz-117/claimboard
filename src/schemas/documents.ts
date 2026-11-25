import type { CollectionSchema } from 'deepspace/schema'

export const documentsSchema: CollectionSchema = {
  name: 'documents',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'claimId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'editors', storage: 'text', interpretation: 'plain' },
    { name: 'collaborators', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
