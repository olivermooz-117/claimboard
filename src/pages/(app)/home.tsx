import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthProfileReady } from 'deepspace'
import { APP_NAME } from '../../constants'
import {
  listBoards,
  createBoardAction,
  type BoardSummary,
} from '../../lib/api'
import { Button, Input, Label, Badge, useToast } from '@/components/ui'

export default function HomePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const navigate = useNavigate()
  const { error } = useToast()

  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [createTopic, setCreateTopic] = useState('')
  const [createRules, setCreateRules] = useState('')
  const [creating, setCreating] = useState(false)

  async function loadBoards() {
    setLoading(true)
    try {
      const bs = await listBoards()
      setBoards(bs)
    } catch (err) {
      error('Failed to load boards', String(err))
    } finally {
      setLoading(false)
    }
  }

  // Intentionally empty deps: loadBoards only calls stable setters and an
  // imported function, so this runs once on mount.
  useEffect(() => {
    loadBoards()
  }, [])

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const result = await createBoardAction({
        topic: createTopic,
        rules: createRules,
      })
      if (!result.success) {
        error('Create failed', result.error ?? 'unknown error')
        return
      }
      setCreateTopic('')
      setCreateRules('')
      const newBoardId = (result.data as { id?: string })?.id
      if (newBoardId) {
        navigate(`/board/${newBoardId}`)
      } else {
        await loadBoards()
      }
    } catch (err) {
      error('Create failed', String(err))
    } finally {
      setCreating(false)
    }
  }

  if (!isSignedIn) {
    return null
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold text-foreground">{APP_NAME}</h1>
            <Badge variant="outline" className="text-xs">
              Signed in as {user?.email ?? 'user'}
            </Badge>
          </div>

          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-foreground">
              Your boards
            </h2>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Loading boards...
              </div>
            ) : boards.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <h3 className="text-base font-semibold text-foreground">
                  No boards yet
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Create your first board to start mapping claims.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {boards.map((b) => (
                  <div
                    key={b.boardId}
                    onClick={() => navigate(`/board/${b.boardId}`)}
                    className="cursor-pointer group rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {b.topic || `Board ${b.boardId.slice(-6)}`}
                        </h3>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {b.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <form
              onSubmit={handleCreateBoard}
              className="rounded-lg border border-border bg-card p-6"
            >
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Create board
              </h2>
              <div className="space-y-3">
                <div>
                  <Label>Topic</Label>
                  <Input
                    value={createTopic}
                    onChange={(e) => setCreateTopic(e.target.value)}
                    placeholder="e.g. Quarterly planning"
                  />
                </div>
                <div>
                  <Label>Rules</Label>
                  <Input
                    value={createRules}
                    onChange={(e) => setCreateRules(e.target.value)}
                    placeholder="Optional ground rules"
                  />
                </div>
                <Button type="submit" loading={creating}>
                  Create board
                </Button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}
