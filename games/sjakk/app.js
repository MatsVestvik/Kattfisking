/**
 * Sjakk – 2-Player Party Chess for NTNU Games
 * Complete chess engine, Web Audio effects, 1-device pass & play,
 * and real-time party room multiplayer.
 */

(() => {
  "use strict";

  // --- Sound Synthesizer (Web Audio API) ---
  const soundEngine = {
    ctx: null,
    enabled: true,

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    playMove() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(320, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
      } catch (_) {}
    },

    playCapture() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(480, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.12);
      } catch (_) {}
    },

    playCheck() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        [580, 880].forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.18, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.07 + 0.14);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.14);
        });
      } catch (_) {}
    },

    playVictory() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554, 659, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.25);
        });
      } catch (_) {}
    },
  };

  // --- Initial Chess Setup ---
  // Uppercase = White, Lowercase = Black
  const STARTING_BOARD = [
    ["r", "n", "b", "q", "k", "b", "n", "r"], // rank 8
    ["p", "p", "p", "p", "p", "p", "p", "p"], // rank 7
    [null, null, null, null, null, null, null, null], // rank 6
    [null, null, null, null, null, null, null, null], // rank 5
    [null, null, null, null, null, null, null, null], // rank 4
    [null, null, null, null, null, null, null, null], // rank 3
    ["P", "P", "P", "P", "P", "P", "P", "P"], // rank 2
    ["R", "N", "B", "Q", "K", "B", "N", "R"], // rank 1
  ];

  const PIECE_VALUES = {
    p: 1, P: 1,
    n: 3, N: 3,
    b: 3, B: 3,
    r: 5, R: 5,
    q: 9, Q: 9,
    k: 0, K: 0,
  };

  // --- Engine State ---
  class ChessGame {
    constructor() {
      this.reset();
    }

    reset() {
      this.board = STARTING_BOARD.map((row) => [...row]);
      this.turn = "w"; // 'w' or 'b'
      this.castling = {
        wK: true, // white kingside
        wQ: true, // white queenside
        bK: true, // black kingside
        bQ: true, // black queenside
      };
      this.enPassantTarget = null; // { r, c }
      this.halfmoveClock = 0;
      this.fullmoveNumber = 1;
      this.history = []; // stack of { from, to, piece, captured, flags, castling, enPassantTarget, san }
      this.capturedWhite = []; // black pieces captured by white
      this.capturedBlack = []; // white pieces captured by black
      this.positionHistory = {}; // FEN -> count
      this.recordPosition();
    }

    recordPosition() {
      const fen = this.getBoardFEN();
      this.positionHistory[fen] = (this.positionHistory[fen] || 0) + 1;
    }

    getBoardFEN() {
      let fen = "";
      for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) {
            empty++;
          } else {
            if (empty > 0) {
              fen += empty;
              empty = 0;
            }
            fen += p;
          }
        }
        if (empty > 0) fen += empty;
        if (r < 7) fen += "/";
      }
      fen += ` ${this.turn}`;
      return fen;
    }

    clone() {
      const g = new ChessGame();
      g.board = this.board.map((row) => [...row]);
      g.turn = this.turn;
      g.castling = { ...this.castling };
      g.enPassantTarget = this.enPassantTarget ? { ...this.enPassantTarget } : null;
      g.halfmoveClock = this.halfmoveClock;
      g.fullmoveNumber = this.fullmoveNumber;
      return g;
    }

    isWhite(piece) {
      return piece && piece === piece.toUpperCase();
    }

    isBlack(piece) {
      return piece && piece === piece.toLowerCase();
    }

    getColor(piece) {
      if (!piece) return null;
      return this.isWhite(piece) ? "w" : "b";
    }

    isSquareAttacked(r, c, attackerColor) {
      // Check knights
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      const targetKnight = attackerColor === "w" ? "N" : "n";
      for (const [dr, dc] of knightOffsets) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          if (this.board[nr][nc] === targetKnight) return true;
        }
      }

      // Check pawns
      const pawnDir = attackerColor === "w" ? 1 : -1; // row offset from attacker's pawn to attacked square
      const targetPawn = attackerColor === "w" ? "P" : "p";
      const pr = r + pawnDir;
      if (pr >= 0 && pr < 8) {
        if (c - 1 >= 0 && this.board[pr][c - 1] === targetPawn) return true;
        if (c + 1 < 8 && this.board[pr][c + 1] === targetPawn) return true;
      }

      // Check king
      const targetKing = attackerColor === "w" ? "K" : "k";
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const kr = r + dr, kc = c + dc;
          if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
            if (this.board[kr][kc] === targetKing) return true;
          }
        }
      }

      // Check orthogonals (Rook, Queen)
      const targetRook = attackerColor === "w" ? "R" : "r";
      const targetQueen = attackerColor === "w" ? "Q" : "q";
      const orthDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of orthDirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const p = this.board[nr][nc];
          if (p) {
            if (p === targetRook || p === targetQueen) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      // Check diagonals (Bishop, Queen)
      const targetBishop = attackerColor === "w" ? "B" : "b";
      const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of diagDirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const p = this.board[nr][nc];
          if (p) {
            if (p === targetBishop || p === targetQueen) return true;
            break;
          }
          nr += dr;
          nc += dc;
        }
      }

      return false;
    }

    findKing(color) {
      const target = color === "w" ? "K" : "k";
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if (this.board[r][c] === target) return { r, c };
        }
      }
      return null;
    }

    isInCheck(color = this.turn) {
      const kingPos = this.findKing(color);
      if (!kingPos) return false;
      const opponentColor = color === "w" ? "b" : "w";
      return this.isSquareAttacked(kingPos.r, kingPos.c, opponentColor);
    }

    generatePseudoLegalMoves(color = this.turn) {
      const moves = [];
      const isW = color === "w";

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p || this.getColor(p) !== color) continue;

          const type = p.toUpperCase();

          // 1. PAWN
          if (type === "P") {
            const dir = isW ? -1 : 1;
            const startRank = isW ? 6 : 1;
            const promoRank = isW ? 0 : 7;

            // 1 step forward
            const r1 = r + dir;
            if (r1 >= 0 && r1 < 8 && !this.board[r1][c]) {
              if (r1 === promoRank) {
                ["Q", "R", "B", "N"].forEach((promo) => {
                  moves.push({ from: { r, c }, to: { r: r1, c }, piece: p, promo });
                });
              } else {
                moves.push({ from: { r, c }, to: { r: r1, c }, piece: p });

                // 2 steps forward from initial rank
                const r2 = r + 2 * dir;
                if (r === startRank && !this.board[r2][c]) {
                  moves.push({ from: { r, c }, to: { r: r2, c }, piece: p, isDoublePawn: true });
                }
              }
            }

            // Diagonal captures
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (nc >= 0 && nc < 8 && r1 >= 0 && r1 < 8) {
                const targetPiece = this.board[r1][nc];
                if (targetPiece && this.getColor(targetPiece) !== color) {
                  if (r1 === promoRank) {
                    ["Q", "R", "B", "N"].forEach((promo) => {
                      moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p, promo });
                    });
                  } else {
                    moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p });
                  }
                } else if (
                  this.enPassantTarget &&
                  this.enPassantTarget.r === r1 &&
                  this.enPassantTarget.c === nc
                ) {
                  moves.push({ from: { r, c }, to: { r: r1, c: nc }, piece: p, isEnPassant: true });
                }
              }
            }
          }

          // 2. KNIGHT
          else if (type === "N") {
            const offsets = [
              [-2, -1], [-2, 1], [-1, -2], [-1, 2],
              [1, -2], [1, 2], [2, -1], [2, 1],
            ];
            for (const [dr, dc] of offsets) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target || this.getColor(target) !== color) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                }
              }
            }
          }

          // 3. BISHOP & QUEEN (Diagonals)
          if (type === "B" || type === "Q") {
            const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
            for (const [dr, dc] of dirs) {
              let nr = r + dr, nc = c + dc;
              while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                } else {
                  if (this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                  break;
                }
                nr += dr;
                nc += dc;
              }
            }
          }

          // 4. ROOK & QUEEN (Orthogonals)
          if (type === "R" || type === "Q") {
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
              let nr = r + dr, nc = c + dc;
              while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = this.board[nr][nc];
                if (!target) {
                  moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                } else {
                  if (this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                  break;
                }
                nr += dr;
                nc += dc;
              }
            }
          }

          // 5. KING
          else if (type === "K") {
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                  const target = this.board[nr][nc];
                  if (!target || this.getColor(target) !== color) {
                    moves.push({ from: { r, c }, to: { r: nr, c: nc }, piece: p });
                  }
                }
              }
            }

            // Castling
            const oppColor = isW ? "b" : "w";
            if (!this.isInCheck(color)) {
              // Kingside castling
              const canKingside = isW ? this.castling.wK : this.castling.bK;
              const rookSquare = isW ? this.board[7][7] : this.board[0][7];
              const expectedRook = isW ? "R" : "r";
              if (
                canKingside &&
                rookSquare === expectedRook &&
                !this.board[r][5] &&
                !this.board[r][6] &&
                !this.isSquareAttacked(r, 5, oppColor) &&
                !this.isSquareAttacked(r, 6, oppColor)
              ) {
                moves.push({ from: { r, c }, to: { r, c: 6 }, piece: p, isCastling: "K" });
              }

              // Queenside castling
              const canQueenside = isW ? this.castling.wQ : this.castling.bQ;
              const qRookSquare = isW ? this.board[7][0] : this.board[0][0];
              if (
                canQueenside &&
                qRookSquare === expectedRook &&
                !this.board[r][1] &&
                !this.board[r][2] &&
                !this.board[r][3] &&
                !this.isSquareAttacked(r, 3, oppColor) &&
                !this.isSquareAttacked(r, 2, oppColor)
              ) {
                moves.push({ from: { r, c }, to: { r, c: 2 }, piece: p, isCastling: "Q" });
              }
            }
          }
        }
      }

      return moves;
    }

    getLegalMoves(color = this.turn) {
      const pseudo = this.generatePseudoLegalMoves(color);
      return pseudo.filter((m) => {
        const sim = this.clone();
        sim.applyMoveInternal(m);
        return !sim.isInCheck(color);
      });
    }

    applyMoveInternal(move) {
      const { from, to, piece, promo, isEnPassant, isCastling, isDoublePawn } = move;

      // Update castling rights if King moves
      if (piece === "K") {
        this.castling.wK = false;
        this.castling.wQ = false;
      } else if (piece === "k") {
        this.castling.bK = false;
        this.castling.bQ = false;
      }

      // Update castling rights if Rook moves
      if (piece === "R") {
        if (from.r === 7 && from.c === 0) this.castling.wQ = false;
        if (from.r === 7 && from.c === 7) this.castling.wK = false;
      } else if (piece === "r") {
        if (from.r === 0 && from.c === 0) this.castling.bQ = false;
        if (from.r === 0 && from.c === 7) this.castling.bK = false;
      }

      // If a Rook is captured in corner
      if (to.r === 7 && to.c === 0) this.castling.wQ = false;
      if (to.r === 7 && to.c === 7) this.castling.wK = false;
      if (to.r === 0 && to.c === 0) this.castling.bQ = false;
      if (to.r === 0 && to.c === 7) this.castling.bK = false;

      // Move piece
      this.board[from.r][from.c] = null;

      if (isEnPassant) {
        // Remove captured pawn
        const capturedPawnRow = from.r;
        this.board[capturedPawnRow][to.c] = null;
      }

      if (isCastling === "K") {
        // Move rook as well
        this.board[from.r][5] = this.board[from.r][7];
        this.board[from.r][7] = null;
      } else if (isCastling === "Q") {
        this.board[from.r][3] = this.board[from.r][0];
        this.board[from.r][0] = null;
      }

      // Final placed piece (handle promotion)
      let placedPiece = piece;
      if (promo) {
        placedPiece = this.isWhite(piece) ? promo.toUpperCase() : promo.toLowerCase();
      }

      this.board[to.r][to.c] = placedPiece;

      // Update en passant target
      if (isDoublePawn) {
        this.enPassantTarget = { r: (from.r + to.r) / 2, c: from.c };
      } else {
        this.enPassantTarget = null;
      }
    }

    makeMove(move) {
      const from = move.from;
      const to = move.to;
      const piece = this.board[from.r][from.c];
      const captured = this.board[to.r][to.c];

      // Clone state for history undo
      const prevCastling = { ...this.castling };
      const prevEnPassant = this.enPassantTarget ? { ...this.enPassantTarget } : null;

      // Build SAN (Standard Algebraic Notation)
      const san = this.formatSAN(move, piece, captured);

      // Track captured pieces
      if (captured) {
        if (this.isWhite(captured)) {
          this.capturedWhite.push(captured);
        } else {
          this.capturedBlack.push(captured);
        }
      } else if (move.isEnPassant) {
        const epPawn = this.turn === "w" ? "p" : "P";
        if (this.turn === "w") this.capturedBlack.push(epPawn);
        else this.capturedWhite.push(epPawn);
      }

      this.applyMoveInternal(move);

      // Switch turn
      this.turn = this.turn === "w" ? "b" : "w";
      if (this.turn === "w") this.fullmoveNumber++;

      this.history.push({
        from,
        to,
        piece,
        captured,
        promo: move.promo,
        castling: prevCastling,
        enPassantTarget: prevEnPassant,
        san,
      });

      this.recordPosition();
      return san;
    }

    undoMove() {
      if (!this.history.length) return false;
      const last = this.history.pop();

      // Restore board
      this.board[last.from.r][last.from.c] = last.piece;
      this.board[last.to.r][last.to.c] = last.captured;

      if (last.promo) {
        this.board[last.from.r][last.from.c] = this.isWhite(last.piece) ? "P" : "p";
      }

      // Revert castling
      if (last.piece.toUpperCase() === "K" && Math.abs(last.to.c - last.from.c) === 2) {
        if (last.to.c === 6) {
          // Kingside
          this.board[last.from.r][7] = this.board[last.from.r][5];
          this.board[last.from.r][5] = null;
        } else if (last.to.c === 2) {
          // Queenside
          this.board[last.from.r][0] = this.board[last.from.r][3];
          this.board[last.from.r][3] = null;
        }
      }

      // Revert en passant
      if (last.piece.toUpperCase() === "P" && !last.captured && last.from.c !== last.to.c) {
        const pawnRow = last.from.r;
        const capturedPawn = this.turn === "w" ? "P" : "p";
        this.board[pawnRow][last.to.c] = capturedPawn;
      }

      // Pop from captured trays
      if (last.captured) {
        if (this.isWhite(last.captured)) this.capturedWhite.pop();
        else this.capturedBlack.pop();
      }

      this.castling = last.castling;
      this.enPassantTarget = last.enPassantTarget;
      this.turn = this.turn === "w" ? "b" : "w";
      if (this.turn === "b") this.fullmoveNumber--;

      return true;
    }

    formatSAN(move, piece, captured) {
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const toSquare = `${files[move.to.c]}${8 - move.to.r}`;

      if (move.isCastling === "K") return "O-O";
      if (move.isCastling === "Q") return "O-O-O";

      const type = piece.toUpperCase();
      let san = "";

      if (type === "P") {
        if (captured || move.isEnPassant) {
          san = `${files[move.from.c]}x${toSquare}`;
        } else {
          san = toSquare;
        }
        if (move.promo) {
          san += `=${move.promo.toUpperCase()}`;
        }
      } else {
        san = `${type}${captured ? "x" : ""}${toSquare}`;
      }

      // Check / Checkmate suffix
      const sim = this.clone();
      sim.applyMoveInternal(move);
      sim.turn = sim.turn === "w" ? "b" : "w";
      if (sim.isInCheck()) {
        const nextLegal = sim.getLegalMoves();
        san += nextLegal.length === 0 ? "#" : "+";
      }

      return san;
    }

    getGameStatus() {
      const legalMoves = this.getLegalMoves();
      const inCheck = this.isInCheck();

      if (legalMoves.length === 0) {
        if (inCheck) {
          const winner = this.turn === "w" ? "Svart" : "Hvit";
          return {
            over: true,
            result: this.turn === "w" ? "0-1" : "1-0",
            title: `Sjakkmatt! ${winner} vinner! 🏆`,
            reason: `${winner} satte motstanderen i sjakkmatt.`,
          };
        } else {
          return {
            over: true,
            result: "1/2-1/2",
            title: "Patt! Remis 🤝",
            reason: "Spilleren i trekket har ingen lovlige trekk og står ikke i sjakk.",
          };
        }
      }

      // Insufficient material check
      if (this.isInsufficientMaterial()) {
        return {
          over: true,
          result: "1/2-1/2",
          title: "Remis (For lite materiell) 🤝",
          reason: "Ingen av spillerne har nok brikker til å sette sjakkmatt.",
        };
      }

      // Threefold repetition
      const fen = this.getBoardFEN();
      if ((this.positionHistory[fen] || 0) >= 3) {
        return {
          over: true,
          result: "1/2-1/2",
          title: "Remis (Trekkgjentakelse) 🤝",
          reason: "Samme stilling har oppstått 3 ganger.",
        };
      }

      return {
        over: false,
        inCheck: inCheck,
      };
    }

    isInsufficientMaterial() {
      const pieces = [];
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (p) pieces.push(p);
        }
      }
      if (pieces.length === 2) return true; // K vs K
      if (pieces.length === 3) {
        // K + B vs K or K + N vs K
        const nonKings = pieces.filter((p) => p.toUpperCase() !== "K");
        if (nonKings.length === 1) {
          const t = nonKings[0].toUpperCase();
          if (t === "B" || t === "N") return true;
        }
      }
      return false;
    }

    getMaterialDifference() {
      let whiteScore = 0;
      let blackScore = 0;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) continue;
          const val = PIECE_VALUES[p] || 0;
          if (this.isWhite(p)) whiteScore += val;
          else blackScore += val;
        }
      }
      return whiteScore - blackScore;
    }
  }

  // --- UI Controller & Multiplayer Sync ---
  const state = {
    game: new ChessGame(),
    mode: "local", // 'local' or 'room'
    perspective: "w", // 'w' or 'b'
    selectedSquare: null, // { r, c }
    legalMovesForSelected: [],
    lastMove: null, // { from: {r, c}, to: {r, c} }
    autoFlip: false,

    // Timers
    timeControl: 300, // seconds
    whiteTime: 300,
    blackTime: 300,
    timerRunning: false,
    timerInterval: null,

    // Room Multiplayer
    roomCode: null,
    playerId: null,
    playerColor: "w", // 'w', 'b', or 'spectator'
    isHost: false,
    pollTimer: null,
    lastPolledVersion: 0,
    pendingPromotionMove: null,
  };

  // DOM Elements
  const el = {
    boardFrame: document.getElementById("boardFrame"),
    chessGrid: document.getElementById("chessGrid"),
    checkBanner: document.getElementById("checkBanner"),
    btnSoundToggle: document.getElementById("btnSoundToggle"),
    soundIcon: document.getElementById("soundIcon"),
    btnFlipBoard: document.getElementById("btnFlipBoard"),
    btnHelp: document.getElementById("btnHelp"),

    tabLocal: document.getElementById("tabLocal"),
    tabRoom: document.getElementById("tabRoom"),
    roomPill: document.getElementById("roomPill"),
    roomPillCode: document.getElementById("roomPillCode"),
    btnCopyRoomLink: document.getElementById("btnCopyRoomLink"),

    topPlayerCard: document.getElementById("topPlayerCard"),
    topAvatar: document.getElementById("topAvatar"),
    topPlayerName: document.getElementById("topPlayerName"),
    topColorDot: document.getElementById("topColorDot"),
    topTurnBadge: document.getElementById("topTurnBadge"),
    topCapturedTray: document.getElementById("topCapturedTray"),
    topMaterialLead: document.getElementById("topMaterialLead"),
    topClock: document.getElementById("topClock"),

    bottomPlayerCard: document.getElementById("bottomPlayerCard"),
    bottomAvatar: document.getElementById("bottomAvatar"),
    bottomPlayerName: document.getElementById("bottomPlayerName"),
    bottomColorDot: document.getElementById("bottomColorDot"),
    bottomTurnBadge: document.getElementById("bottomTurnBadge"),
    bottomCapturedTray: document.getElementById("bottomCapturedTray"),
    bottomMaterialLead: document.getElementById("bottomMaterialLead"),
    bottomClock: document.getElementById("bottomClock"),

    gameStatusText: document.getElementById("gameStatusText"),
    moveHistoryList: document.getElementById("moveHistoryList"),

    btnUndo: document.getElementById("btnUndo"),
    btnDrawOffer: document.getElementById("btnDrawOffer"),
    btnResign: document.getElementById("btnResign"),
    btnNewGame: document.getElementById("btnNewGame"),
    selectTimeControl: document.getElementById("selectTimeControl"),
    checkAutoFlip: document.getElementById("checkAutoFlip"),
    labelAutoFlip: document.getElementById("labelAutoFlip"),

    // Modals
    modalPromotion: document.getElementById("modalPromotion"),
    promotionChoices: document.getElementById("promotionChoices"),
    modalGameOver: document.getElementById("modalGameOver"),
    gameOverTrophy: document.getElementById("gameOverTrophy"),
    gameOverTitle: document.getElementById("gameOverTitle"),
    gameOverReason: document.getElementById("gameOverReason"),
    btnGameOverRematch: document.getElementById("btnGameOverRematch"),
    btnGameOverClose: document.getElementById("btnGameOverClose"),

    modalRoomSetup: document.getElementById("modalRoomSetup"),
    btnCloseRoomModal: document.getElementById("btnCloseRoomModal"),
    tabCreateRoom: document.getElementById("tabCreateRoom"),
    tabJoinRoom: document.getElementById("tabJoinRoom"),
    bodyCreateRoom: document.getElementById("bodyCreateRoom"),
    bodyJoinRoom: document.getElementById("bodyJoinRoom"),
    inputHostName: document.getElementById("inputHostName"),
    btnSubmitCreateRoom: document.getElementById("btnSubmitCreateRoom"),
    inputRoomCode: document.getElementById("inputRoomCode"),
    inputJoinName: document.getElementById("inputJoinName"),
    btnSubmitJoinRoom: document.getElementById("btnSubmitJoinRoom"),

    modalHelp: document.getElementById("modalHelp"),
    btnCloseHelpModal: document.getElementById("btnCloseHelpModal"),
  };

  function renderAvatarHtml(avatar) {
    if (avatar === "💀") return `<span class="skull-emoji">💀</span>`;
    if (window.CharacterCreator && typeof window.CharacterCreator.getAvatarImgSrc === "function") {
      const src = window.CharacterCreator.getAvatarImgSrc(avatar);
      return `<img src="${src}" alt="Spillerfigur" class="player-mon-img" />`;
    }
    const monIds = ["charbear", "jormundgandr", "pixiu", "squitonkey", "tanuki", "totter"];
    if (avatar && (monIds.includes(avatar) || avatar.endsWith(".png") || avatar.startsWith("data:"))) {
      const src = (avatar.endsWith(".png") || avatar.startsWith("data:")) ? avatar : `/assets/mons/${avatar}.png`;
      return `<img src="${src}" alt="Monster" class="player-mon-img" />`;
    }
    return avatar || "👤";
  }

  // --- Board Coordinate Conversion ---
  // If perspective is 'w', visual row 0 is rank 8 (matrix r=0), col 0 is file a (matrix c=0).
  // If perspective is 'b', visual row 0 is rank 1 (matrix r=7), col 0 is file h (matrix c=7).
  function toMatrixCoords(vRow, vCol) {
    if (state.perspective === "w") {
      return { r: vRow, c: vCol };
    } else {
      return { r: 7 - vRow, c: 7 - vCol };
    }
  }

  function toVisualCoords(r, c) {
    if (state.perspective === "w") {
      return { vRow: r, vCol: c };
    } else {
      return { vRow: 7 - r, vCol: 7 - c };
    }
  }

  // --- Render Board & Squares ---
  function initBoardDOM() {
    el.chessGrid.innerHTML = "";
    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        const sq = document.createElement("div");
        sq.className = "square";
        sq.dataset.vrow = String(vRow);
        sq.dataset.vcol = String(vCol);
        sq.addEventListener("click", () => handleSquareClick(vRow, vCol));
        el.chessGrid.appendChild(sq);
      }
    }
  }

  function renderBoard() {
    // Board perspective background
    if (state.perspective === "w") {
      el.boardFrame.classList.remove("black-perspective");
    } else {
      el.boardFrame.classList.add("black-perspective");
    }

    const inCheck = state.game.isInCheck();
    const checkedKing = inCheck ? state.game.findKing(state.game.turn) : null;

    // Check banner
    if (inCheck) {
      el.checkBanner.classList.remove("hidden");
    } else {
      el.checkBanner.classList.add("hidden");
    }

    for (let vRow = 0; vRow < 8; vRow++) {
      for (let vCol = 0; vCol < 8; vCol++) {
        const { r, c } = toMatrixCoords(vRow, vCol);
        const sq = el.chessGrid.children[vRow * 8 + vCol];
        sq.innerHTML = "";
        sq.className = "square";

        // Last move highlight
        if (
          state.lastMove &&
          ((state.lastMove.from.r === r && state.lastMove.from.c === c) ||
            (state.lastMove.to.r === r && state.lastMove.to.c === c))
        ) {
          sq.classList.add("last-move");
        }

        // Selected square highlight
        if (state.selectedSquare && state.selectedSquare.r === r && state.selectedSquare.c === c) {
          sq.classList.add("selected");
        }

        // Checked King highlight
        if (checkedKing && checkedKing.r === r && checkedKing.c === c) {
          sq.classList.add("in-check");
        }

        // Piece
        const piece = state.game.board[r][c];
        if (piece) {
          const pieceEl = document.createElement("div");
          pieceEl.className = "chess-piece";
          pieceEl.innerHTML = `
            <div class="piece-shadow piece-${piece}"></div>
            <div class="piece-sprite piece-${piece}"></div>
          `;
          sq.appendChild(pieceEl);
        }

        // Legal move indicator
        const legalMove = state.legalMovesForSelected.find((m) => m.to.r === r && m.to.c === c);
        if (legalMove) {
          const isCapture = !!state.game.board[r][c] || legalMove.isEnPassant;
          const indicator = document.createElement("div");
          indicator.className = isCapture ? "capture-ring" : "move-dot";
          sq.appendChild(indicator);
        }
      }
    }

    renderPlayerCards();
    renderMoveHistory();
  }

  function renderPlayerCards() {
    const isWhiteTurn = state.game.turn === "w";
    const whitePlayerIsBottom = state.perspective === "w";

    // Bottom card config
    const bottomColor = whitePlayerIsBottom ? "w" : "b";
    const topColor = whitePlayerIsBottom ? "b" : "w";

    // Turn styling
    el.bottomPlayerCard.classList.toggle("is-turn", state.game.turn === bottomColor);
    el.topPlayerCard.classList.toggle("is-turn", state.game.turn === topColor);

    el.bottomTurnBadge.classList.toggle("hidden", state.game.turn !== bottomColor);
    el.topTurnBadge.classList.toggle("hidden", state.game.turn !== topColor);

    el.bottomClock.classList.toggle("active", state.game.turn === bottomColor);
    el.topClock.classList.toggle("active", state.game.turn === topColor);

    // Color dots
    el.bottomColorDot.className = `player-color-indicator ${bottomColor === "w" ? "white" : "black"}`;
    el.topColorDot.className = `player-color-indicator ${topColor === "w" ? "white" : "black"}`;

    // Names in local vs room mode
    if (state.mode === "local") {
      el.bottomPlayerName.textContent = bottomColor === "w" ? "Hvit" : "Svart";
      el.topPlayerName.textContent = topColor === "w" ? "Hvit" : "Svart";
      el.bottomAvatar.innerHTML = renderAvatarHtml(bottomColor === "w" ? "charbear" : "jormundgandr");
      el.topAvatar.innerHTML = renderAvatarHtml(topColor === "w" ? "charbear" : "jormundgandr");
    }

    // Material difference
    const diff = state.game.getMaterialDifference();
    el.bottomMaterialLead.textContent = "";
    el.topMaterialLead.textContent = "";
    if (diff !== 0) {
      if (diff > 0) {
        // White leads
        if (whitePlayerIsBottom) el.bottomMaterialLead.textContent = `+${diff}`;
        else el.topMaterialLead.textContent = `+${diff}`;
      } else {
        // Black leads
        if (whitePlayerIsBottom) el.topMaterialLead.textContent = `+${Math.abs(diff)}`;
        else el.bottomMaterialLead.textContent = `+${Math.abs(diff)}`;
      }
    }

    // Captured pieces trays
    renderCapturedTray(el.bottomCapturedTray, bottomColor === "w" ? state.game.capturedBlack : state.game.capturedWhite);
    renderCapturedTray(el.topCapturedTray, topColor === "w" ? state.game.capturedBlack : state.game.capturedWhite);

    // Clocks
    renderClocks();

    // Status text
    const status = state.game.getGameStatus();
    if (status.over) {
      el.gameStatusText.textContent = status.title;
      el.gameStatusText.style.color = "var(--accent-gold)";
    } else {
      el.gameStatusText.textContent = isWhiteTurn ? "Hvits trekk" : "Svarts trekk";
      el.gameStatusText.style.color = "var(--accent-blue)";
    }
  }

  function renderCapturedTray(container, pieces) {
    container.innerHTML = "";
    const sorted = [...pieces].sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0));
    sorted.forEach((p) => {
      const span = document.createElement("span");
      span.className = `tray-piece piece-${p}`;
      container.appendChild(span);
    });
  }

  function renderClocks() {
    if (state.timeControl <= 0) {
      el.bottomClock.textContent = "∞";
      el.topClock.textContent = "∞";
      return;
    }

    const whiteClockStr = formatTime(state.whiteTime);
    const blackClockStr = formatTime(state.blackTime);

    const whitePlayerIsBottom = state.perspective === "w";
    if (whitePlayerIsBottom) {
      el.bottomClock.textContent = whiteClockStr;
      el.topClock.textContent = blackClockStr;
      el.bottomClock.classList.toggle("low-time", state.whiteTime <= 30);
      el.topClock.classList.toggle("low-time", state.blackTime <= 30);
    } else {
      el.bottomClock.textContent = blackClockStr;
      el.topClock.textContent = whiteClockStr;
      el.bottomClock.classList.toggle("low-time", state.blackTime <= 30);
      el.topClock.classList.toggle("low-time", state.whiteTime <= 30);
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  }

  function renderMoveHistory() {
    if (!state.game.history.length) {
      el.moveHistoryList.innerHTML =
        '<span class="move-empty-hint">Trekkene vises her etterhvert som dere spiller...</span>';
      return;
    }

    el.moveHistoryList.innerHTML = "";
    for (let i = 0; i < state.game.history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const whiteMove = state.game.history[i];
      const blackMove = state.game.history[i + 1];

      const block = document.createElement("div");
      block.className = "move-turn-block";
      block.innerHTML = `
        <span class="move-turn-num">${moveNum}.</span>
        <span class="move-san">${whiteMove ? whiteMove.san : ""}</span>
        ${blackMove ? `<span class="move-san">${blackMove.san}</span>` : ""}
      `;
      el.moveHistoryList.appendChild(block);
    }

    // Scroll to end of list
    el.moveHistoryList.scrollLeft = el.moveHistoryList.scrollWidth;
  }

  // --- Interaction & Move Handling ---
  function handleSquareClick(vRow, vCol) {
    const { r, c } = toMatrixCoords(vRow, vCol);
    const piece = state.game.board[r][c];

    // In room mode, disallow moving if it's not our turn or role
    if (state.mode === "room") {
      if (state.playerColor !== state.game.turn) {
        return; // not our turn
      }
    }

    // 1. If clicking a legal target square for already selected piece
    if (state.selectedSquare) {
      const legalMove = state.legalMovesForSelected.find((m) => m.to.r === r && m.to.c === c);

      if (legalMove) {
        // Check for pawn promotion
        const movingPiece = state.game.board[state.selectedSquare.r][state.selectedSquare.c];
        const isPawn = movingPiece && movingPiece.toUpperCase() === "P";
        const isEndRank = (state.game.turn === "w" && r === 0) || (state.game.turn === "b" && r === 7);

        if (isPawn && isEndRank) {
          // Open promotion modal
          promptPromotion(legalMove);
          return;
        }

        executeMove(legalMove);
        return;
      }
    }

    // 2. Selecting a piece of the current turn's color
    if (piece && state.game.getColor(piece) === state.game.turn) {
      state.selectedSquare = { r, c };
      const allLegal = state.game.getLegalMoves();
      state.legalMovesForSelected = allLegal.filter((m) => m.from.r === r && m.from.c === c);
      renderBoard();
    } else {
      // Deselect
      state.selectedSquare = null;
      state.legalMovesForSelected = [];
      renderBoard();
    }
  }

  function promptPromotion(move) {
    state.pendingPromotionMove = move;
    el.promotionChoices.innerHTML = "";

    const color = state.game.turn;
    const pieces = ["Q", "R", "B", "N"];

    pieces.forEach((type) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "promo-btn";
      const spriteClass = color === "w" ? `piece-${type}` : `piece-${type.toLowerCase()}`;
      btn.innerHTML = `<div class="promo-piece-inner ${spriteClass}"></div>`;
      btn.addEventListener("click", () => {
        el.modalPromotion.close();
        move.promo = type;
        executeMove(move);
      });
      el.promotionChoices.appendChild(btn);
    });

    el.modalPromotion.showModal();
  }

  async function executeMove(move) {
    const isCapture = !!state.game.board[move.to.r][move.to.c] || move.isEnPassant;

    // Apply move in local engine
    const san = state.game.makeMove(move);
    state.lastMove = { from: { ...move.from }, to: { ...move.to } };
    state.selectedSquare = null;
    state.legalMovesForSelected = [];

    // Sound FX
    if (isCapture) {
      soundEngine.playCapture();
    } else {
      soundEngine.playMove();
    }

    // Check sound
    if (state.game.isInCheck()) {
      soundEngine.playCheck();
    }

    // Auto-flip board in 1-device pass & play
    if (state.mode === "local" && state.autoFlip) {
      state.perspective = state.game.turn;
    }

    // Check game termination
    const status = state.game.getGameStatus();
    if (status.over) {
      stopTimer();
      soundEngine.playVictory();
      triggerGameOver(status.title, status.reason);
    } else {
      startTimer();
    }

    renderBoard();

    // If in multiplayer room mode, sync move to server
    if (state.mode === "room") {
      await syncMoveToServer(move, san, status);
    }
  }

  function triggerGameOver(title, reason) {
    el.gameOverTitle.textContent = title;
    el.gameOverReason.textContent = reason;
    el.modalGameOver.showModal();
  }

  // --- Clocks & Timers ---
  function startTimer() {
    if (state.timeControl <= 0) return;
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerRunning = true;
    let lastTick = Date.now();

    state.timerInterval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTick) / 1000;
      lastTick = now;

      if (state.game.turn === "w") {
        state.whiteTime = Math.max(0, state.whiteTime - delta);
        if (state.whiteTime <= 0) {
          handleTimeout("w");
        }
      } else {
        state.blackTime = Math.max(0, state.blackTime - delta);
        if (state.blackTime <= 0) {
          handleTimeout("b");
        }
      }

      renderClocks();
    }, 100);
  }

  function stopTimer() {
    state.timerRunning = false;
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function handleTimeout(color) {
    stopTimer();
    const winner = color === "w" ? "Svart" : "Hvit";
    triggerGameOver("Tiden er ute! ⏱️", `${winner} vinner på tid!`);
  }

  function resetGame() {
    state.game.reset();
    state.selectedSquare = null;
    state.legalMovesForSelected = [];
    state.lastMove = null;
    state.whiteTime = state.timeControl;
    state.blackTime = state.timeControl;
    stopTimer();

    if (state.mode === "local" && state.autoFlip) {
      state.perspective = "w";
    }

    renderBoard();
  }

  // --- Multiplayer Room Mode ---
  async function syncMoveToServer(move, san, status) {
    try {
      const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
      const fromStr = `${files[move.from.c]}${8 - move.from.r}`;
      const toStr = `${files[move.to.c]}${8 - move.to.r}`;

      await fetch("/api/sjakk/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: state.roomCode,
          playerId: state.playerId,
          move: {
            from: fromStr,
            to: toStr,
            piece: move.piece,
            san: san,
            promotion: move.promo,
            gameOver: status.over,
            result: status.result || "*",
            resultReason: status.reason || "",
          },
        }),
      });
    } catch (err) {
      console.warn("Nettverksfeil ved sending av trekk:", err);
    }
  }

  function startRoomPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);

    async function poll() {
      if (state.mode !== "room" || !state.roomCode) return;

      try {
        const resp = await fetch(
          `/api/sjakk/state?room=${encodeURIComponent(state.roomCode)}&player=${encodeURIComponent(state.playerId || "")}`
        );
        if (!resp.ok) return;

        const data = await resp.json();
        if (!data.ok) return;

        // Sync player labels
        if (data.whitePlayer) {
          const isBottom = state.perspective === "w";
          const targetName = isBottom ? el.bottomPlayerName : el.topPlayerName;
          const targetAv = isBottom ? el.bottomAvatar : el.topAvatar;
          targetName.textContent = data.whitePlayer.name;
          targetAv.innerHTML = renderAvatarHtml(data.whitePlayer.avatar);
        }

        if (data.blackPlayer) {
          const isBottom = state.perspective === "b";
          const targetName = isBottom ? el.bottomPlayerName : el.topPlayerName;
          const targetAv = isBottom ? el.bottomAvatar : el.topAvatar;
          targetName.textContent = data.blackPlayer.name;
          targetAv.innerHTML = renderAvatarHtml(data.blackPlayer.avatar);
        }

        // Sync times
        state.whiteTime = data.whiteTime;
        state.blackTime = data.blackTime;
        renderClocks();

        // Check if there are new moves from opponent
        if (data.moves.length > state.game.history.length) {
          // Re-play moves
          applyRemoteMoves(data.moves);
        }

        // Check draw / finished state
        if (data.status === "finished") {
          stopTimer();
          if (!el.modalGameOver.open) {
            triggerGameOver("Partiet er over!", data.resultReason || "Spillet ble avsluttet.");
          }
        }
      } catch (err) {
        console.warn("Polling feil:", err);
      }
    }

    state.pollTimer = setInterval(poll, 750);
    poll();
  }

  function applyRemoteMoves(serverMoves) {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Apply any missing moves
    for (let i = state.game.history.length; i < serverMoves.length; i++) {
      const sm = serverMoves[i];
      if (!sm.from || !sm.to) continue;

      const fromC = files.indexOf(sm.from[0]);
      const fromR = 8 - parseInt(sm.from[1], 10);
      const toC = files.indexOf(sm.to[0]);
      const toR = 8 - parseInt(sm.to[1], 10);

      const legal = state.game.getLegalMoves();
      const match = legal.find(
        (m) =>
          m.from.r === fromR &&
          m.from.c === fromC &&
          m.to.r === toR &&
          m.to.c === toC &&
          (!sm.promotion || m.promo === sm.promotion)
      );

      if (match) {
        const isCapture = !!state.game.board[toR][toC] || match.isEnPassant;
        state.game.makeMove(match);
        state.lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };

        if (isCapture) soundEngine.playCapture();
        else soundEngine.playMove();

        if (state.game.isInCheck()) soundEngine.playCheck();
      }
    }

    renderBoard();
  }

  // --- Setup Event Listeners ---
  function initEvents() {
    // Sound Toggle
    el.btnSoundToggle.addEventListener("click", () => {
      soundEngine.enabled = !soundEngine.enabled;
      el.soundIcon.textContent = soundEngine.enabled ? "🔊" : "🔇";
    });

    // Flip Board
    el.btnFlipBoard.addEventListener("click", () => {
      state.perspective = state.perspective === "w" ? "b" : "w";
      renderBoard();
    });

    // Help Modal
    el.btnHelp.addEventListener("click", () => el.modalHelp.showModal());
    el.btnCloseHelpModal.addEventListener("click", () => el.modalHelp.close());

    // Local vs Room Tabs
    el.tabLocal.addEventListener("click", () => {
      el.tabLocal.classList.add("active");
      el.tabRoom.classList.remove("active");
      el.roomPill.classList.add("hidden");
      el.btnUndo.disabled = false;
      el.labelAutoFlip.classList.remove("hidden");
      state.mode = "local";
      state.perspective = "w";
      if (state.pollTimer) clearInterval(state.pollTimer);
      renderBoard();
    });

    el.tabRoom.addEventListener("click", () => {
      el.modalRoomSetup.showModal();
    });

    el.btnCloseRoomModal.addEventListener("click", () => el.modalRoomSetup.close());

    el.tabCreateRoom.addEventListener("click", () => {
      el.tabCreateRoom.classList.add("active");
      el.tabJoinRoom.classList.remove("active");
      el.bodyCreateRoom.classList.remove("hidden");
      el.bodyJoinRoom.classList.add("hidden");
    });

    el.tabJoinRoom.addEventListener("click", () => {
      el.tabJoinRoom.classList.add("active");
      el.tabCreateRoom.classList.remove("active");
      el.bodyJoinRoom.classList.remove("hidden");
      el.bodyCreateRoom.classList.add("hidden");
    });

    // Submit Create Room
    el.btnSubmitCreateRoom.addEventListener("click", async () => {
      const hostName = el.inputHostName.value.trim() || "Hvit";
      const timeSec = parseInt(el.selectTimeControl.value, 10) || 300;

      el.btnSubmitCreateRoom.disabled = true;
      el.btnSubmitCreateRoom.textContent = "Oppretter rom…";

      try {
        const resp = await fetch("/api/sjakk/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: hostName,
            timeControl: timeSec,
          }),
        });

        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.playerColor = "w";
          state.isHost = true;
          state.mode = "room";
          state.perspective = "w";

          el.tabRoom.classList.add("active");
          el.tabLocal.classList.remove("active");
          el.roomPill.classList.remove("hidden");
          el.roomPillCode.textContent = data.roomCode;
          el.btnUndo.disabled = true;
          el.labelAutoFlip.classList.add("hidden");

          el.modalRoomSetup.close();
          resetGame();
          startRoomPolling();
        }
      } catch (err) {
        alert("Feil ved opprettelse av rom.");
      } finally {
        el.btnSubmitCreateRoom.disabled = false;
        el.btnSubmitCreateRoom.textContent = "Opprett Sjakkrom";
      }
    });

    // Submit Join Room
    el.btnSubmitJoinRoom.addEventListener("click", async () => {
      const code = el.inputRoomCode.value.trim().toUpperCase();
      const playerName = el.inputJoinName.value.trim() || "Svart";

      if (!code) {
        alert("Skriv inn en romkode.");
        return;
      }

      el.btnSubmitJoinRoom.disabled = true;
      el.btnSubmitJoinRoom.textContent = "Kobler til…";

      try {
        const resp = await fetch("/api/sjakk/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: code,
            playerName: playerName,
          }),
        });

        const data = await resp.json();
        if (data.ok) {
          state.roomCode = data.roomCode;
          state.playerId = data.playerId;
          state.playerColor = data.playerColor;
          state.isHost = false;
          state.mode = "room";
          state.perspective = data.playerColor === "b" ? "b" : "w";

          el.tabRoom.classList.add("active");
          el.tabLocal.classList.remove("active");
          el.roomPill.classList.remove("hidden");
          el.roomPillCode.textContent = data.roomCode;
          el.btnUndo.disabled = true;
          el.labelAutoFlip.classList.add("hidden");

          el.modalRoomSetup.close();
          resetGame();
          startRoomPolling();
        } else {
          alert(data.error || "Fant ikke rommet.");
        }
      } catch (err) {
        alert("Feil ved tilkobling.");
      } finally {
        el.btnSubmitJoinRoom.disabled = false;
        el.btnSubmitJoinRoom.textContent = "Bli med i partiet";
      }
    });

    // Copy Room Link
    el.btnCopyRoomLink.addEventListener("click", async () => {
      const url = `${window.location.origin}/sjakk/?room=${encodeURIComponent(state.roomCode)}`;
      try {
        await navigator.clipboard.writeText(url);
        el.btnCopyRoomLink.textContent = "✓";
        setTimeout(() => (el.btnCopyRoomLink.textContent = "Kopier"), 1500);
      } catch (_) {
        prompt("Kopier lenke:", url);
      }
    });

    // Undo Move (Local mode)
    el.btnUndo.addEventListener("click", () => {
      if (state.mode === "room") return;
      if (state.game.undoMove()) {
        state.selectedSquare = null;
        state.legalMovesForSelected = [];
        state.lastMove = state.game.history.length
          ? { ...state.game.history[state.game.history.length - 1] }
          : null;
        if (state.autoFlip) {
          state.perspective = state.game.turn;
        }
        renderBoard();
      }
    });

    // Draw Offer
    el.btnDrawOffer.addEventListener("click", async () => {
      if (state.mode === "room") {
        await fetch("/api/sjakk/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "draw",
          }),
        });
      } else {
        const agree = confirm("Begge spillere godtar remis (uavgjort)?");
        if (agree) {
          stopTimer();
          triggerGameOver("Remis! 🤝", "Spillerne ble enige om remis.");
        }
      }
    });

    // Resign
    el.btnResign.addEventListener("click", async () => {
      const confirmResign = confirm("Er du sikker på at du vil gi opp partiet?");
      if (!confirmResign) return;

      if (state.mode === "room") {
        await fetch("/api/sjakk/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "resign",
          }),
        });
      } else {
        stopTimer();
        const resigning = state.game.turn === "w" ? "Hvit" : "Svart";
        const winner = state.game.turn === "w" ? "Svart" : "Hvit";
        triggerGameOver(`${winner} vinner! 🏆`, `${resigning} ga opp partiet.`);
      }
    });

    // New Game / Rematch
    el.btnNewGame.addEventListener("click", () => {
      if (confirm("Starte et nytt parti?")) {
        resetGame();
      }
    });

    el.btnGameOverRematch.addEventListener("click", () => {
      el.modalGameOver.close();
      if (state.mode === "room") {
        fetch("/api/sjakk/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: state.roomCode,
            playerId: state.playerId,
            action: "rematch",
          }),
        });
      } else {
        resetGame();
      }
    });

    el.btnGameOverClose.addEventListener("click", () => el.modalGameOver.close());

    // Time Control Change
    el.selectTimeControl.addEventListener("change", (e) => {
      state.timeControl = parseInt(e.target.value, 10);
      state.whiteTime = state.timeControl;
      state.blackTime = state.timeControl;
      renderClocks();
    });

    // Auto Flip
    el.checkAutoFlip.addEventListener("change", (e) => {
      state.autoFlip = e.target.checked;
      if (state.autoFlip) {
        state.perspective = state.game.turn;
        renderBoard();
      }
    });

    // Parse URL params for ?room=CODE
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    const playerParam = params.get("player");

    if (roomParam) {
      el.inputRoomCode.value = roomParam.toUpperCase();
      el.tabRoom.click();
      if (playerParam) {
        state.playerId = playerParam;
        state.roomCode = roomParam.toUpperCase();
        state.mode = "room";
        el.modalRoomSetup.close();
        startRoomPolling();
      }
    }
  }

  // --- Initial Launch ---
  function init() {
    initBoardDOM();
    initEvents();
    renderBoard();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
