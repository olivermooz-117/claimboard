import type { Env } from '../../worker'

const MEMBER_ROLES = new Set(['owner', 'editor', 'viewer'])
const WRITE_ROLES = new Set(['owner', 'editor'])

const recordStub = (env: Env): DurableObjectStub =>
  env.RECORD_ROOMS.get(env.RECORD_ROOMS.idFromName(`app:${env.DEEPSPACE_APP_ID}`))

async function recordCall<T = unknown>(
  env: Env,
  tool: string,
  params: Record<string, unknown>,
): Promise<{ success?: boolean; data?: T; error?: string }> {
  const res = await recordStub(env).fetch(
    new Request('https://internal/api/tools/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': env.OWNER_USER_ID,
        'X-App-Action': 'true',
      },
      body: JSON.stringify({ tool, params }),
    }),
  )
  return (await res.json()) as { success?: boolean; data?: T; error?: string }
}

export async function getBoardMembership(
  env: Env,
  boardId: string,
  userId: string,
): Promise<{ role: string } | null> {
  const json = await recordCall<{ records?: Array<{ data?: { role?: string } }> }>(
    env,
    'records.query',
    { collection: 'memberships', where: { boardId, userId }, limit: 1 },
  )
  if (json.success && json.data?.records?.[0]?.data?.role) {
    return { role: json.data.records[0].data.role }
  }
  return null
}

export async function getClaimBoardId(
  env: Env,
  claimId: string,
): Promise<string | null> {
  const json = await recordCall<{ record?: { data?: { boardId?: string } } }>(
    env,
    'records.get',
    { collection: 'claims', recordId: claimId },
  )
  if (json.success && json.data?.record?.data?.boardId) {
    return json.data.record.data.boardId
  }
  return null
}

export async function requireBoardMembership(
  env: Env,
  boardId: string,
  userId: string,
): Promise<{ role: string } | Response> {
  const membership = await getBoardMembership(env, boardId, userId)
  if (!membership || !MEMBER_ROLES.has(membership.role)) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return membership
}

export async function requireBoardWriteAccess(
  env: Env,
  boardId: string,
  userId: string,
): Promise<{ role: string } | Response> {
  const membership = await getBoardMembership(env, boardId, userId)
  if (!membership || !WRITE_ROLES.has(membership.role)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return membership
}

export function isWriteRole(role: string): boolean {
  return WRITE_ROLES.has(role)
}

export function isReadRole(role: string): boolean {
  return MEMBER_ROLES.has(role)
}
