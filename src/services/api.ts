import axios from "axios";
import {
  Question,
  GameState,
  LeaderboardEntry,
  SubmissionResult,
} from "@/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "https://servershivam.onrender.com/";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const gameApi = {
  // Get current question
  getCurrentQuestion: async (): Promise<{
    question: Question;
    isActive: boolean;
    participants: number;
    winner: GameState["winner"];
  }> => {
    const response = await api.get("/game/question");
    return response.data;
  },

  // Submit answer via HTTP (fallback for socket)
  submitAnswer: async (
    answer: number,
    username: string,
    userId?: string
  ): Promise<SubmissionResult> => {
    const response = await api.post("/game/submit", {
      answer,
      username,
      userId,
    });
    return response.data;
  },

  // Get leaderboard
  getLeaderboard: async (
    limit: number = 10
  ): Promise<{
    leaderboard: LeaderboardEntry[];
    total: number;
  }> => {
    const response = await api.get(`/game/leaderboard?limit=${limit}`);
    return response.data;
  },

  // Create user session
  createUser: async (
    username: string,
    email?: string
  ): Promise<{
    userId: string;
    username: string;
    email?: string;
    message: string;
  }> => {
    const response = await api.post("/game/user", {
      username,
      email,
    });
    return response.data;
  },

  // Get game statistics
  getGameStats: async (): Promise<{
    connectedUsers: number;
    isGameActive: boolean;
    hasActiveQuestion: boolean;
    currentWinner: string | null;
    participants: number;
  }> => {
    const response = await api.get("/game/stats");
    return response.data;
  },

  // Health check
  healthCheck: async (): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
  }> => {
    const response = await api.get("/health");
    return response.data;
  },
};

export default api;
