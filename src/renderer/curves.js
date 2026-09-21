export function curve(path, segment) {
  const { startNode, controlPoint, endNode } = segment

  if (controlPoint) {
    const { cp1, cp2 } = path.resolve(startNode, controlPoint, endNode)

    return `C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${endNode.x},${endNode.y}`
  }

  return `L${endNode.x},${endNode.y}`
}

export function curves(path) {
  const first = path.nodes[0]
  const commands = path.getSegments().map((segment) => curve(path, segment))

  return [`M${first.x},${first.y}`, ...commands].join(' ')
}
