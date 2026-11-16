import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useAuthProfileReady,
  useYjsRoom,
  usePresenceRoom,
} from 'deepspace'
import { APP_NAME } from '../../../constants'
import {
  getBoard,
  listClaims,
  createClaim,
  addMemberAction,
  createAiChat,
  sendAiMessage,
  type ClaimRow,
} from '../../../lib/api'
import {
  Button,
  Input,
  Label,
  Textarea,
  Badge,
  EmptyState,
  useToast,
} from '@/components/ui'

const POLL_INTERVAL_MS = 4000

function ClaimBodyEditor({ bodyDocId }: { bodyDocId: string }) {
  const { text, setText, connected, synced, canWrite } = useYjsRoom(
    bodyDocId,
    'content',
  )

  if (!connected) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
        Connecting to body editor…
      </div>
    )
  }

  if (!synced) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-muted-foreground">
        Syncing body…
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 mt-2">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            canWrite ? 'bg-green-foreground' : 'bg-muted'
          }`}
          aria-label={canWrite ? 'editable' : 'read-only'}
        />
        <span>{canWrite ? 'Editable' : 'Read-only (viewer)'}</span>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!canWrite}
        className="w-full h-32 font-mono text-sm"
        placeholder={canWrite ? 'Edit the claim body…' : 'View-only body'}
      />
    </div>
  )
}

function ClaimRowItem({
  claim,
  depth,
  onReply,
  userId,
}: {
  claim: ClaimRow
  depth: number
  onReply: (parentId: string) => void
  userId: string | null
}) {
  const [editingBody, setEditingBody] = useState(false)

  return (
    <div
      key={claim.id}
      className="rounded-lg border border-border bg-card p-3 mb-2"
      style={{ paddingLeft: 16 + depth * 18 }}
    >
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-xs border-transparent"
            style={{
              backgroundColor: `var(--claim-${claim.stance})`,
              color: `var(--claim-${claim.stance}-foreground)`,
              borderColor: `var(--claim-${claim.stance}-border)`,
            }}
          >
            {claim.stance}
          </Badge>
          <span className="text-xs text-muted-foreground">
            by {claim.authorId.slice(-6)}
          </span>
        </div>
        <div className="flex-1 ml-2">
          <h4 className="font-medium text-foreground">{claim.title}</h4>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {claim.bodyDocId ? 'Body edited live via Yjs' : 'No body yet'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {claim.bodyDocId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingBody(!editingBody)}
            >
              {editingBody ? 'Hide body' : 'Edit body'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onReply(claim.id)}>
            Reply
          </Button>
        </div>
      </div>
      {editingBody && claim.bodyDocId && (
        <ClaimBodyEditor bodyDocId={claim.bodyDocId} />
      )}
    </div>
  )
}

export default function BoardPage() {
  const { id: boardId } = useParams()
  const { isSignedIn, userId } = useAuthProfileReady({ requireUser: true })
  const navigate = useNavigate()
  const { error } = useToast()

  const [board, setBoard] = useState<{
    id: string
    topic: string
    rules: string
    ownerId: string
  } | null>(null)
  const [claims, setClaims] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [boardError, setBoardError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newStance, setNewStance] = useState<'support' | 'oppose' | 'neutral'>('support')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyTitle, setReplyTitle] = useState('')
  const [replyStance, setReplyStance] = useState<'support' | 'oppose' | 'neutral'>('oppose')
  const [creating, setCreating] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'editor' | 'viewer'>('viewer')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiChatId, setAiChatId] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)

  const presenceScope = boardId ? `board:${boardId}` : ''
  const { peers, connected: presenceConnected } = usePresenceRoom(presenceScope)
  const otherCount = presenceConnected ? peers.length : 0

  const errorRef = useRef(error)
  errorRef.current = error

  const loadClaims = useCallback(async () => {
    if (!boardId) return
    try {
      const cs = await listClaims(boardId)
      setClaims(cs)
    } catch (err) {
      errorRef.current('Failed to load claims', String(err))
    }
  }, [boardId])

  const loadBoard = useCallback(async () => {
    if (!boardId) return
    setBoardError(null)
    const result = await getBoard(boardId)
    if (result.notFound) {
      setNotFound(true)
    } else if (!result.board) {
      setBoardError('Failed to load board. Try again.')
    } else {
      setBoard(result.board)
    }
  }, [boardId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setBoardError(null)
        await Promise.all([loadBoard(), loadClaims()])
      } catch (err) {
        if (!cancelled) {
          setBoardError('Failed to load board. Try again.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [boardId, loadBoard, loadClaims])

  useEffect(() => {
    // Only poll once the board has loaded successfully. Stop on notFound or
    // load error so a broken board doesn't burn requests forever.
    // Deps are [boardId, loadClaims] only — loading/notFound/boardError/board
    // are read inside the body, not as deps, so claim fetches that update
    // board/claims don't restart the interval.
    if (!boardId || loading || notFound || boardError || !board) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    let stopped = false
    const tick = () => {
      if (stopped) return
      loadClaims()
    }

    const start = () => {
      intervalRef.current = window.setInterval(tick, POLL_INTERVAL_MS)
    }
    const stop = () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) stop()
      else start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      stopped = true
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [boardId, loadClaims])

  async function handleAddClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!boardId) return
    setCreating(true)
    try {
      const result = await createClaim({
        boardId,
        stance: newStance,
        title: newTitle,
      })
      if (!result.success) {
        error('Create claim failed', result.error ?? 'unknown error')
        return
      }
      setNewTitle('')
      await loadClaims()
    } catch (err) {
      error('Create claim failed', String(err))
    } finally {
      setCreating(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!boardId) return
    setAdding(true)
    try {
      const result = await addMemberAction({
        boardId,
        email: addEmail,
        role: addRole,
      })
      if (!result.success) {
        error('Add member failed', result.error ?? 'unknown error')
        return
      }
      setAddEmail('')
    } catch (err) {
      error('Add member failed', String(err))
    } finally {
      setAdding(false)
    }
  }

  async function ensureAiChat() {
    if (aiChatId) return aiChatId
    const result = await createAiChat(`Board ${boardId?.slice(-6)}`)
    if (result.chat) {
      setAiChatId(result.chat.id)
      return result.chat.id
    }
    error('AI chat failed', result.error ?? 'unknown error')
    return null
  }

  async function handleSuggestCounterArguments() {
    if (!boardId) return
    const chatId = await ensureAiChat()
    if (!chatId) return
    setAiLoading(true)
    try {
      const userMessageId = `msg-${Date.now()}-${crypto.randomUUID()}`
      const claimList = claims
        .map((c) => `- Claim ${c.id.slice(-6)}: "${c.title}" (stance: ${c.stance}, bodyDocId: ${c.bodyDocId ?? 'none'})`)
        .join('\n')
      const content = `Here are the claims on this board:\n${claimList}\n\nSuggest counter-arguments for each claim. Reference claim IDs in your suggestions.`
      const result = await sendAiMessage({ chatId, userMessageId, content })
      if (result.error) {
        error('AI error', result.error)
        return
      }
      if (result.text) {
        const text = result.text
        setAiMessages((prev) => [...prev, { role: 'assistant', content: text }])
      }
    } catch (err) {
      error('AI error', String(err))
    } finally {
      setAiLoading(false)
    }
  }

  async function handleAddReply(e: React.FormEvent) {
    e.preventDefault()
    if (!boardId || !replyTo) return
    setCreating(true)
    try {
      const result = await createClaim({
        boardId,
        parentId: replyTo,
        stance: replyStance,
        title: replyTitle,
      })
      if (!result.success) {
        error('Create reply failed', result.error ?? 'unknown error')
        return
      }
      setReplyTo(null)
      setReplyTitle('')
      await loadClaims()
    } catch (err) {
      error('Create reply failed', String(err))
    } finally {
      setCreating(false)
    }
  }

  if (!isSignedIn) return null
  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h2 className="text-2xl font-bold text-foreground">Board not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You don't have access to this board, or it doesn't exist.
        </p>
        <Button
          onClick={() => navigate('/home')}
          className="mt-4"
        >
          Back to home
        </Button>
      </div>
    )
  }
  if (boardError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
        <h2 className="text-2xl font-bold text-foreground">Board load failed</h2>
        <p className="mt-2 text-sm text-muted-foreground">{boardError}</p>
        <div className="mt-4 flex items-center gap-2">
          <Button onClick={loadBoard}>Retry</Button>
          <Button variant="outline" onClick={() => navigate('/home')}>
            Back to home
          </Button>
        </div>
      </div>
    )
  }
  if (loading || !board) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground">
        Loading board…
      </div>
    )
  }

  const isOwner = board.ownerId === userId
  const canManageMembers = isOwner
  const childClaims = claims.filter(
    (c) => c.parentId !== null && c.parentId !== undefined,
  )
  const rootClaims = claims.filter(
    (c) => c.parentId === null || c.parentId === undefined,
  )

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{board.topic}</h1>
              <p className="text-sm text-muted-foreground">
                {board.rules || 'No rules set.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  otherCount > 0
                    ? 'bg-green/10 text-green-foreground border border-green/20'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {otherCount} other{otherCount !== 1 ? 's' : ''} here
              </span>
              {!presenceConnected && (
                <span className="text-xs text-muted-foreground">
                  Presence connecting…
                </span>
              )}
            </div>
          </div>

          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Claims</h2>
            {claims.length === 0 ? (
              <EmptyState
                title="No claims yet"
                description="Add the first claim to start mapping the debate."
                action={{ label: 'Add claim', onClick: () => {} }}
              />
            ) : (
              <div className="space-y-0">
                {rootClaims.map((c) => (
                  <div key={c.id}>
                    <ClaimRowItem
                      claim={c}
                      depth={0}
                      onReply={(parentId) => setReplyTo(parentId)}
                      userId={userId}
                    />
                    {childClaims
                      .filter((cc) => cc.parentId === c.id)
                      .map((cc) => (
                        <ClaimRowItem
                          key={cc.id}
                          claim={cc}
                          depth={1}
                          onReply={(parentId) => setReplyTo(parentId)}
                          userId={userId}
                        />
                      ))}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            {replyTo ? (
              <div className="rounded-lg border border-border bg-card p-4 mb-4">
                <h3 className="mb-3 text-lg font-semibold text-foreground">Reply</h3>
                <form onSubmit={handleAddReply} className="space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input
                      value={replyTitle}
                      onChange={(e) => setReplyTitle(e.target.value)}
                      placeholder="Your counter-claim or support"
                    />
                  </div>
                  <div>
                    <Label>Stance</Label>
                    <select
                      value={replyStance}
                      onChange={(e) =>
                        setReplyStance(
                          e.target.value as 'support' | 'oppose' | 'neutral',
                        )
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors"
                    >
                      <option value="support">Support</option>
                      <option value="oppose">Oppose</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" loading={creating}>
                      Post reply
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setReplyTo(null)
                        setReplyTitle('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <form
                onSubmit={handleAddClaim}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <h2 className="mb-3 text-lg font-semibold text-foreground">
                  Add claim
                </h2>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="What is your claim?"
                  />
                </div>
                <div>
                  <Label>Stance</Label>
                  <select
                    value={newStance}
                    onChange={(e) =>
                      setNewStance(
                        e.target.value as 'support' | 'oppose' | 'neutral',
                      )
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors"
                  >
                    <option value="support">Support</option>
                    <option value="oppose">Oppose</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <Button type="submit" loading={creating}>
                  Add claim
                </Button>
              </form>
            )}
          </section>

          {canManageMembers && (
            <section className="mt-6">
              <form
                onSubmit={handleAddMember}
                className="rounded-lg border border-border bg-card p-6"
              >
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Add member
                </h2>
                <div className="space-y-3">
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={addEmail}
                      onChange={(e) => setAddEmail(e.target.value)}
                      placeholder="member@example.com"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <select
                      value={addRole}
                      onChange={(e) =>
                        setAddRole(e.target.value as 'editor' | 'viewer')
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors"
                    >
                      <option value="editor">Editor (can write)</option>
                      <option value="viewer">Viewer (read-only)</option>
                    </select>
                  </div>
                  <Button type="submit" loading={adding}>
                    Add member
                  </Button>
                </div>
              </form>
            </section>
          )}

          {/* AI Assistant panel — deferred to post-v1. Code committed but not rendered:
               - claims_for_board tool in src/ai/tools.ts (read-only, cap 25)
               - AI chat functions in src/lib/api.ts
               - Panel UI below (commented out).
               The /api/ai/chats route returns a 500 despite registering both
               AI_CHATS_SCHEMA and AI_MESSAGES_SCHEMA. Rather than ship a
               broken button, the panel is hidden for v1. */}
        </div>
      </div>
    </div>
  )
}
