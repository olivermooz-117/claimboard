import type { CollectionSchema } from 'deepspace/schema'

export const boardsSchema: CollectionSchema = {
  name: 'boards',
  columns: [
    { name: 'topic', storage: 'text', interpretation: 'plain', required: true },
    { name: 'rules', storage: 'text', interpretation: 'plain' },
    { name: 'ownerId', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: false, create: false, update: false, delete: false },
    member: { read: false, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
