/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { AI_CHATS_SCHEMA } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { boardsSchema } from './schemas/boards'
import { claimsSchema } from './schemas/claims'
import { evidenceSchema } from './schemas/evidence'
import { membershipsSchema } from './schemas/memberships'
import { documentsSchema } from './schemas/documents'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  AI_CHATS_SCHEMA,
  boardsSchema,
  claimsSchema,
  evidenceSchema,
  membershipsSchema,
  documentsSchema,
]
