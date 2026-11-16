import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  requireBoardMembership,
  requireBoardWriteAccess,
  getBoardMembership,
} from '../lib/rbac'

export const createBoard: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const { topic, rules } = params as { topic?: string; rules?: string }
  if (typeof topic !== 'string' || topic.trim() === '') {
    return { success: false, error: 'topic is required' }
  }

  const board = await tools.create('boards', {
    topic: topic.trim(),
    rules: rules ?? '',
    ownerId: userId,
  })

  if (!board.success) return board

  const boardId = (board.data as { id?: string })?.id
  if (!boardId) {
    return { success: false, error: 'Board created without id' }
  }

  const membership = await tools.create('memberships', {
    boardId,
    userId,
    role: 'owner',
  })

  if (!membership.success) return membership

  return { success: true, data: { board: board.data, membership: membership.data } }
}

export const addMember: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const { boardId, email, role } = params as {
    boardId?: string
    email?: string
    role?: string
  }

  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }
  if (!email || typeof email !== 'string') {
    return { success: false, error: 'email is required' }
  }
  if (!role || !['editor', 'viewer'].includes(role)) {
    return { success: false, error: 'role must be editor or viewer' }
  }

  const access = await requireBoardWriteAccess(env, boardId, userId)
  if (access instanceof Response) {
    return {
      success: false,
      error: access.status === 403 ? 'Forbidden' : 'Not found',
    }
  }

  const users = await tools.query('users', { where: { email }, limit: 1 })
  if (!users.success || !users.data) {
    return { success: false, error: 'Failed to look up user' }
  }

  const records = (users.data as { records?: Array<{ id?: string }> }).records ?? []
  if (records.length === 0) {
    return { success: false, error: 'User not found' }
  }

  const targetUserId = records[0].id
  if (!targetUserId) {
    return { success: false, error: 'User record missing id' }
  }

  const existing = await tools.query('memberships', {
    where: { boardId, userId: targetUserId },
    limit: 1,
  })

  if (existing.success && existing.data) {
    const existingRecords = (existing.data as { records?: Array<{ id?: string }> })
      .records ?? []
    if (existingRecords.length > 0) {
      return { success: false, error: 'User is already a member of this board' }
    }
  }

  const membership = await tools.create('memberships', {
    boardId,
    userId: targetUserId,
    role,
  })

  if (!membership.success) return membership

  return { success: true, data: membership.data }
}

export const claimsCreate: ActionHandler<Env> = async ({ userId, params, tools, env }) => {
  const { boardId, parentId, stance, title } = params as {
    boardId?: string
    parentId?: string
    stance?: string
    title?: string
  }

  if (!boardId || typeof boardId !== 'string') {
    return { success: false, error: 'boardId is required' }
  }
  if (!stance || !['support', 'oppose', 'neutral'].includes(stance)) {
    return { success: false, error: 'stance must be support, oppose, or neutral' }
  }
  if (typeof title !== 'string' || title.trim() === '') {
    return { success: false, error: 'title is required' }
  }

  const access = await requireBoardWriteAccess(env, boardId, userId)
  if (access instanceof Response) {
    return {
      success: false,
      error: access.status === 403 ? 'Forbidden' : 'Not found',
    }
  }

  // If replying, validate the parent claim exists on this board.
  if (parentId) {
    const parent = await tools.get('claims', parentId)
    if (!parent.success || !parent.data) {
      return { success: false, error: 'Parent claim not found' }
    }
    const parentData = parent.data as { boardId?: string }
    if (parentData.boardId !== boardId) {
      return { success: false, error: 'Parent claim is not on this board' }
    }
  }

  const bodyDocId = crypto.randomUUID()

  const claim = await tools.create('claims', {
    boardId,
    parentId: parentId ?? null,
    stance: stance.trim(),
    title: title.trim(),
    bodyDocId,
    authorId: userId,
  })

  if (!claim.success) return claim

  const claimId = (claim.data as { id?: string })?.id
  if (!claimId) {
    return { success: false, error: 'Claim created without id' }
  }

  // documents record links bodyDocId -> claimId for read-through Yjs gating.
  // Membership is resolved live on connect (see resolveDocsYjsRole), so no
  // denormalized editors/collaborators arrays to keep in sync.
  await tools.create(
    'documents',
    {
      ownerId: userId,
      claimId,
    },
    bodyDocId,
  )

  return { success: true, data: claim.data }
}

export const actions: Record<string, ActionHandler<Env>> = {
  'boards.create': createBoard,
  'boards.add-member': addMember,
  'claims.create': claimsCreate,
}
