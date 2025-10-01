"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { socketService } from "@/services/socketService";
import { gameApi } from "@/services/api";
import {
  Question,
  GameState,
  SubmissionResult,
  LeaderboardEntry,
  User,
} from "@/types";
import {
  Trophy,
  Wifi,
  WifiOff,
  Send,
  Crown,
  Target,
  Zap,
  Timer,
  Sparkles,
  Award,
  Activity,
} from "lucide-react";

interface Notification {
  message: string;
  type: "success" | "error" | "info";
}

export default function MathQuizGame() {
  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    isActive: false,
    participants: 0,
    winner: null,
  });

  // User state
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);

  // UI state
  const [answer, setAnswer] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionLatency, setConnectionLatency] = useState<number>(-1);
  const [lastSubmissionResult, setLastSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [gameStats, setGameStats] = useState({
    connectedUsers: 0,
    currentWinner: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Performance tracking
  const [questionStartTime, setQuestionStartTime] = useState<number | null>(
    null
  );
  const answerInputRef = useRef<HTMLInputElement>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load user data from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("mathQuizUser");
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setUsername(userData.username);
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    }
  }, []);

  // Show notification helper
  const showNotification = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 4000);
    },
    []
  );

  // Initialize socket connection
  const initializeConnection = useCallback(async () => {
    try {
      await socketService.connect();
      setIsConnected(true);

      // Test latency
      const latency = await socketService.ping();
      setConnectionLatency(latency);

      showNotification("Connected to game server!", "success");
    } catch (error) {
      setIsConnected(false);
      showNotification("Failed to connect to game server", "error");
    }
  }, [showNotification]);

  // Socket event handlers
  useEffect(() => {
    if (!isConnected) return;

    const handleJoinedSuccessfully = (data: {
      userId: string;
      username: string;
      participantCount: number;
    }) => {
      setUser({ id: data.userId, username: data.username });
      setIsJoined(true);
      setGameStats((prev) => ({
        ...prev,
        connectedUsers: data.participantCount,
      }));
      showNotification(
        `Welcome ${data.username}! ${data.participantCount} players online`,
        "success"
      );

      // Save user data
      localStorage.setItem(
        "mathQuizUser",
        JSON.stringify({ id: data.userId, username: data.username })
      );
    };

    const handleNewQuestion = (data: {
      question: Question;
      gameState: GameState;
    }) => {
      setCurrentQuestion(data.question);
      setGameState(data.gameState);
      setAnswer("");
      setLastSubmissionResult(null);
      setIsSubmitting(false);
      setQuestionStartTime(Date.now());

      // Focus on answer input for quick response
      setTimeout(() => {
        answerInputRef.current?.focus();
      }, 100);

      showNotification("🎯 New challenge available!", "info");
    };

    const handleSubmissionResult = (result: SubmissionResult) => {
      setLastSubmissionResult(result);
      setIsSubmitting(false);
      setAnswer("");

      if (result.error) {
        showNotification(result.error, "error");
      } else if (result.isWinner) {
        showNotification("🎉 Congratulations! You won this round!", "success");
      } else if (result.isCorrect) {
        showNotification("Correct answer, but someone was faster!", "info");
      } else {
        showNotification("Incorrect answer. Keep trying!", "error");
      }
    };

    const handleWinnerAnnounced = (data: {
      winner: { username: string; timeTaken: number };
      correctAnswer: number;
    }) => {
      setGameState((prev) => ({
        ...prev,
        winner: { ...data.winner, userId: "", submissionTime: "" },
        isActive: false,
      }));

      const isCurrentUser = data.winner.username === username;
      const message = isCurrentUser
        ? `🏆 You won! Answer was: ${data.correctAnswer}`
        : `🏆 ${data.winner.username} won! Answer: ${data.correctAnswer}`;

      showNotification(message, "success");
      setAnswer("");
      setLastSubmissionResult(null);
    };

    const handleUserJoined = (data: {
      username: string;
      participantCount: number;
    }) => {
      setGameStats((prev) => ({
        ...prev,
        connectedUsers: data.participantCount,
      }));
      showNotification(`${data.username} joined the game`, "info");
    };

    const handleUserLeft = (data: {
      username: string;
      participantCount: number;
    }) => {
      setGameStats((prev) => ({
        ...prev,
        connectedUsers: data.participantCount,
      }));
    };

    const handleError = (error: { message: string }) => {
      showNotification(error.message, "error");
    };

    // Register event listeners
    socketService.onJoinedSuccessfully(handleJoinedSuccessfully);
    socketService.onNewQuestion(handleNewQuestion);
    socketService.onSubmissionResult(handleSubmissionResult);
    socketService.onWinnerAnnounced(handleWinnerAnnounced);
    socketService.onUserJoined(handleUserJoined);
    socketService.onUserLeft(handleUserLeft);
    socketService.onError(handleError);

    return () => {
      // Cleanup event listeners
      socketService.off("joined-successfully", handleJoinedSuccessfully);
      socketService.off("new-question", handleNewQuestion);
      socketService.off("submission-result", handleSubmissionResult);
      socketService.off("winner-announced", handleWinnerAnnounced);
      socketService.off("user-joined", handleUserJoined);
      socketService.off("user-left", handleUserLeft);
      socketService.off("error", handleError);
    };
  }, [isConnected, showNotification, username]);

  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();
    return () => socketService.disconnect();
  }, [initializeConnection]);

  // Load leaderboard
  const loadLeaderboard = useCallback(async () => {
    try {
      const data = await gameApi.getLeaderboard(10);
      setLeaderboard(data.leaderboard);
    } catch {
      showNotification("Failed to load leaderboard", "error");
    }
  }, [showNotification]);

  // Join game
  const handleJoinGame = useCallback(async () => {
    if (!username.trim() || username.length < 2 || username.length > 20) {
      showNotification("Username must be between 2 and 20 characters", "error");
      return;
    }

    if (!isConnected) {
      showNotification("Not connected to server", "error");
      return;
    }

    try {
      socketService.joinGame(username.trim(), user?.id);
    } catch {
      showNotification("Failed to join game", "error");
    }
  }, [username, user?.id, isConnected, showNotification]);

  // Submit answer function
  const handleSubmitAnswer = useCallback(async () => {
    if (!currentQuestion || !gameState.isActive || isSubmitting) {
      if (isSubmitting) {
        showNotification("Please wait, submitting...", "info");
      } else if (!currentQuestion) {
        showNotification("No active question available", "error");
      } else if (!gameState.isActive) {
        showNotification("Game is not active", "error");
      }
      return;
    }

    const numericAnswer = parseFloat(answer.trim());
    if (isNaN(numericAnswer)) {
      showNotification("Please enter a valid number", "error");
      return;
    }

    setIsSubmitting(true);

    // Clear any existing timeout
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }

    try {
      // Try socket submission first
      if (socketService.isConnected()) {
        socketService.submitAnswer(numericAnswer);
        showNotification("Answer submitted!", "info");
      } else {
        // Fallback to HTTP API
        const result = await gameApi.submitAnswer(
          numericAnswer,
          username,
          user?.id
        );
        setLastSubmissionResult(result);
        showNotification("Answer submitted via HTTP!", "info");
      }
    } catch (error) {
      showNotification("Failed to submit answer", "error");
    } finally {
      // Reset submitting state after a short delay
      setTimeout(() => {
        setIsSubmitting(false);
      }, 1000);
    }
  }, [
    currentQuestion,
    gameState.isActive,
    answer,
    username,
    user?.id,
    showNotification,
    isSubmitting,
  ]);

  // Key press handler
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        handleSubmitAnswer();
      }
    },
    [handleSubmitAnswer, isSubmitting]
  );

  // Calculate time taken
  const getTimeTaken = useCallback(() => {
    if (!questionStartTime) return null;
    return Math.floor((Date.now() - questionStartTime) / 1000);
  }, [questionStartTime]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <header className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full">
              <Target className="text-white" size={32} />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              Competitive Math Quiz
            </h1>
            <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full">
              <Sparkles className="text-white" size={32} />
            </div>
          </div>
          <p className="text-xl text-blue-100 font-medium">
            🚀 Be the first to solve the math problem and claim victory! 🏆
          </p>
        </header>

        {/* Connection Status */}
        <div className="flex items-center justify-between mb-8 p-6 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {isConnected ? (
                <>
                  <div className="p-2 bg-green-500/20 rounded-full">
                    <Wifi className="text-green-400" size={24} />
                  </div>
                  <div>
                    <span className="text-green-400 font-semibold">
                      Connected
                    </span>
                    <div className="text-green-300 text-sm">
                      Ready to compete!
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-red-500/20 rounded-full">
                    <WifiOff className="text-red-400" size={24} />
                  </div>
                  <div>
                    <span className="text-red-400 font-semibold">
                      Disconnected
                    </span>
                    <div className="text-red-300 text-sm">Reconnecting...</div>
                  </div>
                </>
              )}
            </div>
            {connectionLatency > 0 && (
              <div className="px-3 py-1 bg-blue-500/20 rounded-full">
                <span className="text-blue-300 text-sm font-medium">
                  {connectionLatency}ms latency
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full">
              <Activity className="text-blue-400" size={20} />
              <span className="text-blue-300 font-semibold">
                {gameStats.connectedUsers} online
              </span>
            </div>
            <button
              onClick={() => {
                setShowLeaderboard(true);
                loadLeaderboard();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-full hover:from-yellow-600 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <Trophy size={20} />
              <span className="font-semibold">Leaderboard</span>
            </button>
          </div>
        </div>

        {/* Notification */}
        {notification && (
          <div
            className={`mb-6 p-4 rounded-2xl backdrop-blur-md border shadow-2xl transform animate-in slide-in-from-top duration-300 ${
              notification.type === "success"
                ? "bg-green-500/20 border-green-500/30 text-green-100"
                : notification.type === "error"
                ? "bg-red-500/20 border-red-500/30 text-red-100"
                : "bg-blue-500/20 border-blue-500/30 text-blue-100"
            }`}
          >
            <div className="flex items-center gap-3">
              {notification.type === "success" && (
                <Zap className="text-green-400" size={20} />
              )}
              {notification.type === "error" && (
                <Target className="text-red-400" size={20} />
              )}
              {notification.type === "info" && (
                <Sparkles className="text-blue-400" size={20} />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
          </div>
        )}

        {/* Main Game Area */}
        {!isJoined ? (
          /* Join Game Form */
          <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-10 text-center border border-white/20">
            <div className="inline-flex items-center gap-3 mb-8">
              <Crown className="text-yellow-400" size={32} />
              <h2 className="text-3xl font-bold text-white">
                Join the Competition
              </h2>
              <Award className="text-purple-400" size={32} />
            </div>

            <div className="max-w-md mx-auto">
              <div className="relative mb-6">
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full p-4 bg-white/10 backdrop-blur border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 text-lg"
                  maxLength={20}
                  onKeyPress={(e) => e.key === "Enter" && handleJoinGame()}
                />
              </div>
              <button
                onClick={handleJoinGame}
                disabled={!isConnected || !username.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-purple-500/25"
              >
                🚀 Join Game
              </button>
            </div>
          </div>
        ) : (
          /* Game Interface */
          <div className="space-y-8">
            {/* Current Question */}
            {currentQuestion && (
              <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Target className="text-blue-400" />
                    Current Challenge
                  </h2>
                  <div className="flex items-center gap-4">
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-bold ${
                        currentQuestion.difficulty === "easy"
                          ? "bg-green-500/20 text-green-300 border border-green-500/30"
                          : currentQuestion.difficulty === "medium"
                          ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {currentQuestion.difficulty.toUpperCase()}
                    </div>
                    {questionStartTime && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-500/30">
                        <Timer size={18} className="text-blue-400" />
                        <span className="text-blue-300 font-semibold">
                          {getTimeTaken()}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-3xl font-mono mb-8 p-6 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl text-center text-white border border-white/20 backdrop-blur">
                  {currentQuestion.problem}
                </div>

                <div className="flex gap-4">
                  <input
                    ref={answerInputRef}
                    type="number"
                    placeholder="Your answer"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isSubmitting}
                    className="flex-1 p-4 bg-white/10 backdrop-blur border border-white/30 rounded-2xl text-white placeholder-white/60 focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all duration-300 text-lg disabled:opacity-50"
                    step="any"
                  />
                  <button
                    onClick={handleSubmitAnswer}
                    disabled={
                      !answer.trim() || !gameState.isActive || isSubmitting
                    }
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-2xl hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl hover:shadow-green-500/25 flex items-center gap-3 font-bold"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Winner Announcement */}
            {gameState.winner && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-3xl p-8 text-center border border-yellow-500/30 shadow-2xl">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Crown size={32} className="text-yellow-400 animate-bounce" />
                  <h3 className="text-3xl font-bold text-yellow-100">
                    Victory!
                  </h3>
                  <Sparkles
                    size={32}
                    className="text-orange-400 animate-pulse"
                  />
                </div>
                <p className="text-xl text-yellow-200 font-semibold">
                  🎉 {gameState.winner.username} conquered this challenge! 🎉
                </p>
              </div>
            )}

            {/* Last Submission Result */}
            {lastSubmissionResult && (
              <div
                className={`p-6 rounded-2xl backdrop-blur-md border shadow-2xl ${
                  lastSubmissionResult.isWinner
                    ? "bg-green-500/20 border-green-500/30"
                    : lastSubmissionResult.isCorrect
                    ? "bg-blue-500/20 border-blue-500/30"
                    : "bg-red-500/20 border-red-500/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {lastSubmissionResult.isWinner && (
                    <Zap className="text-yellow-400" size={24} />
                  )}
                  {lastSubmissionResult.isCorrect &&
                    !lastSubmissionResult.isWinner && (
                      <Target className="text-blue-400" size={24} />
                    )}
                  {!lastSubmissionResult.isCorrect && (
                    <Activity className="text-red-400" size={24} />
                  )}

                  <span
                    className={`font-semibold text-lg ${
                      lastSubmissionResult.isWinner
                        ? "text-green-100"
                        : lastSubmissionResult.isCorrect
                        ? "text-blue-100"
                        : "text-red-100"
                    }`}
                  >
                    {lastSubmissionResult.isWinner
                      ? "🏆 You won this round!"
                      : lastSubmissionResult.isCorrect
                      ? "✅ Correct! But someone was faster."
                      : "❌ Incorrect answer. Keep trying!"}
                  </span>

                  {lastSubmissionResult.timeTaken > 0 && (
                    <span className="ml-auto px-3 py-1 bg-white/20 rounded-full text-white font-medium">
                      {(lastSubmissionResult.timeTaken / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Modal */}
        {showLeaderboard && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 max-w-lg w-full border border-white/20 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Trophy className="text-yellow-400" size={28} />
                  Leaderboard
                </h3>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.username}
                    className="flex items-center justify-between p-4 bg-white/10 rounded-2xl border border-white/20 backdrop-blur"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0
                            ? "bg-yellow-500 text-yellow-900"
                            : index === 1
                            ? "bg-gray-400 text-gray-900"
                            : index === 2
                            ? "bg-orange-500 text-orange-900"
                            : "bg-blue-500/50 text-blue-100"
                        }`}
                      >
                        {index === 0
                          ? "🥇"
                          : index === 1
                          ? "🥈"
                          : index === 2
                          ? "🥉"
                          : index + 1}
                      </div>
                      <span className="font-semibold text-white">
                        {entry.username}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-white">
                        {entry.highScore}
                      </div>
                      <div className="text-sm text-white/70">
                        {entry.gamesWon} wins
                      </div>
                    </div>
                  </div>
                ))}

                {leaderboard.length === 0 && (
                  <div className="text-center py-8 text-white/60">
                    <Trophy className="mx-auto mb-3 opacity-50" size={48} />
                    <p>No scores yet. Be the first to win!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
