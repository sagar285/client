import { io, Socket } from "socket.io-client";
import { Question, GameState, SubmissionResult } from "@/types";

// Type-safe socket event mapping
interface SocketEventMap {
  "joined-successfully": (data: {
    userId: string;
    username: string;
    participantCount: number;
  }) => void;
  "new-question": (data: { question: Question; gameState: GameState }) => void;
  "submission-result": (result: SubmissionResult) => void;
  "winner-announced": (data: {
    winner: { userId: string; username: string; timeTaken: number };
    correctAnswer: number;
  }) => void;
  "user-joined": (data: { username: string; participantCount: number }) => void;
  "user-left": (data: { username: string; participantCount: number }) => void;
  error: (error: { message: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private readonly serverUrl: string;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  constructor() {
    this.serverUrl =
      process.env.NEXT_PUBLIC_SERVER_URL || "https://servershivam.onrender.com/";
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // Clean up any existing socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(this.serverUrl, {
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        forceNew: true,
      });

      this.socket.on("connect", () => {
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(
            new Error(
              `Failed to connect after ${this.maxReconnectAttempts} attempts`
            )
          );
        }
      });

      this.socket.on("disconnect", () => {
        // Handle disconnection gracefully
      });

      this.socket.on("reconnect", () => {
        // Handle reconnection
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  joinGame(username: string, userId?: string): void {
    if (!this.socket?.connected) {
      throw new Error("Socket not connected");
    }

    this.socket.emit("join-game", { username, userId });
  }

  submitAnswer(answer: number): void {
    if (!this.socket?.connected) {
      throw new Error("Socket not connected");
    }

    const payload = {
      answer,
      timestamp: Date.now(),
    };

    this.socket.emit("submit-answer", payload);
  }

  // Event listeners with proper typing
  onJoinedSuccessfully(callback: SocketEventMap["joined-successfully"]): void {
    this.socket?.on("joined-successfully", callback);
  }

  onNewQuestion(callback: SocketEventMap["new-question"]): void {
    this.socket?.on("new-question", callback);
  }

  onSubmissionResult(callback: SocketEventMap["submission-result"]): void {
    this.socket?.on("submission-result", callback);
  }

  onWinnerAnnounced(callback: SocketEventMap["winner-announced"]): void {
    this.socket?.on("winner-announced", callback);
  }

  onUserJoined(callback: SocketEventMap["user-joined"]): void {
    this.socket?.on("user-joined", callback);
  }

  onUserLeft(callback: SocketEventMap["user-left"]): void {
    this.socket?.on("user-left", callback);
  }

  onError(callback: SocketEventMap["error"]): void {
    this.socket?.on("error", callback);
  }

  off<T extends keyof SocketEventMap>(
    event: T,
    callback?: SocketEventMap[T]
  ): void {
    this.socket?.off(event as string, callback);
  }

  async ping(): Promise<number> {
    return new Promise((resolve) => {
      if (!this.socket?.connected) {
        resolve(-1);
        return;
      }

      const start = Date.now();
      this.socket.emit("ping", () => {
        const latency = Date.now() - start;
        resolve(latency);
      });
    });
  }
}

export const socketService = new SocketService();
