import { getAuthToken } from 'deepspace'

const API_BASE = ''

async function authHeaders(): Promise<Headers> {
  const token = await getAuthToken()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

export async function apiGet(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: await authHeaders(),
  })
}

export async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  })
}

export async function callAction<T = unknown>(
  name: string,
  params?: Record<string, unknown>,
): Promise<{ success?: boolean; data?: T; error?: string }> {
  const res = await apiPost(`/api/actions/${name}`, params ?? {})
  return (await res.json()) as { success?: boolean; data?: T; error?: string }
}

export type BoardSummary = { boardId: string; role: string; topic: string }
export type ClaimRow = {
  id: string
  boardId: string
  parentId?: string
  stance: string
  title: string
  bodyDocId: string
  authorId: string
}
export type EvidenceRow = {
  id: string
  claimId: string
  fileRef: string
  uploadedBy: string
}

export async function listBoards(): Promise<BoardSummary[]> {
  const res = await apiGet('/api/boards')
  const json = (await res.json()) as { boards?: BoardSummary[] }
  return json.boards ?? []
}

export async function getBoard(id: string): Promise<{
  board: { id: string; topic: string; rules: string; ownerId: string } | null
  notFound: boolean
}> {
  const res = await apiGet(`/api/boards/${id}`)
  if (res.status === 404) return { board: null, notFound: true }
  if (!res.ok) return { board: null, notFound: false }
  const json = await res.json()
  return {
    board: json as { id: string; topic: string; rules: string; ownerId: string },
    notFound: false,
  }
}

export async function listClaims(boardId: string): Promise<ClaimRow[]> {
  const res = await apiGet(`/api/boards/${boardId}/claims`)
  const json = (await res.json()) as { claims?: ClaimRow[] }
  return json.claims ?? []
}

export async function listEvidence(claimId: string): Promise<EvidenceRow[]> {
  const res = await apiGet(`/api/claims/${claimId}/evidence`)
  const json = (await res.json()) as { evidence?: EvidenceRow[] }
  return json.evidence ?? []
}

export async function createClaim(params: {
  boardId: string
  parentId?: string
  stance: string
  title: string
}): Promise<{ success?: boolean; data?: unknown; error?: string }> {
  return callAction('claims.create', params)
}

export async function createBoardAction(params: {
  topic: string
  rules?: string
}): Promise<{ success?: boolean; data?: unknown; error?: string }> {
  return callAction('boards.create', params)
}

export async function addMemberAction(params: {
  boardId: string
  email: string
  role: 'editor' | 'viewer'
}): Promise<{ success?: boolean; data?: unknown; error?: string }> {
  return callAction('boards.add-member', params)
}

export type AiMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export async function createAiChat(title?: string): Promise<{ chat?: { id: string; title: string }; error?: string }> {
  const res = await apiPost('/api/ai/chats', { title })
  const json = await res.json() as { chat?: { id: string; title: string }; error?: string }
  if (!res.ok) return { error: json.error ?? 'Failed to create chat' }
  return { chat: json.chat }
}

export async function sendAiMessage(params: {
  chatId: string
  userMessageId: string
  content: string
  modelId?: string
}): Promise<{ text?: string; error?: string }> {
  const token = await getAuthToken()
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) {
    const json = await res.json() as { error?: string }
    return { error: json.error ?? 'AI request failed' }
  }
  if (!res.body) return { error: 'No response body' }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (line) {
        try {
          const parsed = JSON.parse(line.slice(6))
          if (parsed.type === 'text' && typeof parsed.text === 'string') {
            text += parsed.text
          }
        } catch {}
      }
    }
  }
  return { text }
}
