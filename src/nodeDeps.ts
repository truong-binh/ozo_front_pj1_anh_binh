import type { ProjectNode } from './types'

export function afterStringToArray(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[,;\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    ),
  )
}

export function getAfter(node: ProjectNode, validIds: Set<string>) {
  const raw = Array.isArray(node.after) ? node.after : []
  return raw.filter((d) => validIds.has(d) && d !== node.node_id)
}

export function createsCycle(
  nodes: ProjectNode[],
  nodeId: string,
  newAfter: string[],
  validIds: Set<string>,
) {
  const nodeById = new Map(nodes.map((n) => [n.node_id, n]))

  function depsOf(id: string) {
    if (id === nodeId) return newAfter
    const node = nodeById.get(id)
    if (!node) return []
    return getAfter(node, validIds)
  }

  const stack = new Set([nodeId])

  function reach(id: string): boolean {
    for (const dep of depsOf(id)) {
      if (!validIds.has(dep)) continue
      if (dep === nodeId) return true
      if (stack.has(dep)) continue
      stack.add(dep)
      if (reach(dep)) return true
      stack.delete(dep)
    }
    return false
  }

  return reach(nodeId)
}
