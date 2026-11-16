import type { CollectionSchema } from 'deepspace/schema'

export const evidenceSchema: CollectionSchema = {
  name: 'evidence',
  columns: [
    { name: 'claimId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'fileRef', storage: 'text', interpretation: 'plain', required: true },
    { name: 'uploadedBy', storage: 'text', interpretation: 'plain', required: true },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: true, update: 'own', delete: 'own' },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
