export interface Question {
  id: string;
  problem: string;
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
}

export interface GameState {
  isActive: boolean;
  participants: number;
  winner: {
    userId: string;
    username: string;
    submissionTime: string;
  } | null;
}

export interface SubmissionResult {
  isCorrect: boolean;
  isWinner: boolean;
  submissionTime: string;
  timeTaken: number;
  userId?: string;
  error?: string;
}

export interface LeaderboardEntry {
  username: string;
  highScore: number;
  gamesWon: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
}
