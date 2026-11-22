export type Color = 'w' | 'b'
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Piece = { color: Color; type: PieceType }

/** Board is 64 squares, index 0 = a8, 7 = h8, 56 = a1, 63 = h1. */
export type Position = {
  board: (Piece | null)[]
  turn: Color
  castling: string // subset of "KQkq", or "-"
  ep: number | null // en-passant target square index
  halfmove: number
  fullmove: number
}

export type Move = { from: number; to: number; promotion?: PieceType }
