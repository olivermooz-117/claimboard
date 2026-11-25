import type { ClaimRow } from './api'

export interface ClaimTreeNode {
  claim: ClaimRow
  children: ClaimTreeNode[]
}

/**
 * Build a nested claim tree from a flat list of claims.
 *
 * Children are grouped by parentId and ordered by creation (createdAt when
 * present, otherwise stable). Claims whose parent is missing from the list
 * (orphans) are treated as roots so nothing disappears.
 */
export function buildClaimTree(claims: ClaimRow[]): ClaimTreeNode[] {
  const byId = new Map<string, ClaimTreeNode>()
  for (const claim of claims) {
    byId.set(claim.id, { claim, children: [] })
  }

  const roots: ClaimTreeNode[] = []
  for (const claim of claims) {
    const node = byId.get(claim.id)
    if (!node) continue
    const parentId = claim.parentId
    if (parentId && byId.has(parentId)) {
      byId.get(parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const order = (a: ClaimTreeNode, b: ClaimTreeNode): number => {
    const aa = (a.claim as { createdAt?: string }).createdAt
    const bb = (b.claim as { createdAt?: string }).createdAt
    if (aa && bb) return aa < bb ? -1 : aa > bb ? 1 : 0
    return 0
  }

  for (const node of byId.values()) {
    node.children.sort(order)
  }
  roots.sort(order)

  return roots
}
