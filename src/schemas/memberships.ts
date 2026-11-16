import type { CollectionSchema } from 'deepspace/schema'

export const membershipsSchema: CollectionSchema = {
  name: 'memberships',
  columns: [
    { name: 'boardId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'userId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'role', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
