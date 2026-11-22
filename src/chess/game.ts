import { START_FEN, parseFen, toFen } from './fen'
import type { Color, Move } from './types'

export type Ply = {
  san: string
  move: Move
  /** FEN after this ply. */
  fen: string
  comment?: string
  /** Full-move number of the move (1 for 1. e4 and 1... e5). */
  number: number
  color: Color
}

export type Game = {
  headers: Record<string, string>
  startFen: string
  plies: Ply[]
  result?: string
}

export function gameFromFen(fen: string): Game {
  const normalized = toFen(parseFen(fen)) // validates
  return { headers: {}, startFen: fen.trim() === START_FEN ? START_FEN : normalized, plies: [] }
}
