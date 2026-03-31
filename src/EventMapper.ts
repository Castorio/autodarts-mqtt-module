/**
 * Event Mapper - Maps Autodarts events to MQTT actions
 */

import type { ParsedEvent, ThrowData } from '@autodarts-hub/module-sdk';
import type {
  MqttModuleConfig,
  GameState,
  PlayerState,
  MqttThrowData,
  MqttTurnData,
} from './types.js';

/**
 * MQTT Action Types
 */
export type MqttActionType =
  | 'publish.state'
  | 'publish.event'
  | 'publish.throw'
  | 'publish.turn'
  | 'publish.player'
  | 'publish.match.start'
  | 'publish.match.end'
  | 'publish.game.end'
  | 'publish.highlight'
  | 'none';

/**
 * Mapped MQTT Action
 */
export interface MqttAction {
  type: MqttActionType;
  topic?: string;
  data?: unknown;
  retain?: boolean;
}

/**
 * Match state tracking
 */
interface MatchState {
  matchId: string;
  gameType: string;
  startingScore: number;
  players: Array<{ name: string; index: number; score: number; legs: number; sets: number }>;
  currentPlayer: number;
  round: number;
  leg: number;
  set: number;
  turnThrows: ThrowData[];
  turnScore: number;
}

/**
 * EventMapper - Maps Autodarts SDK events to MQTT publish actions
 */
export class EventMapper {
  private config: MqttModuleConfig;
  private currentMatch: MatchState | null = null;
  private inMatch = false;

  constructor(config?: Partial<MqttModuleConfig>) {
    this.config = {
      broker: '',
      baseTopic: 'autodarts',
      homeAssistant: true,
      ...config,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MqttModuleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current match state
   */
  getCurrentMatch(): MatchState | null {
    return this.currentMatch;
  }

  /**
   * Check if in match
   */
  isInMatch(): boolean {
    return this.inMatch;
  }

  /**
   * Map an Autodarts SDK event to MQTT actions
   */
  mapEvent(event: ParsedEvent): MqttAction[] {
    const actions: MqttAction[] = [];

    switch (event.type) {
      case 'match.start':
        actions.push(...this.handleMatchStart(event));
        break;

      case 'match.delete':
      case 'match.finished':
        actions.push(...this.handleMatchEnd(event));
        break;

      case 'throw.detected':
        actions.push(...this.handleThrow(event));
        break;

      case 'player.change':
        actions.push(...this.handlePlayerChange(event));
        break;

      case 'turn.finished':
        actions.push(...this.handleTurnFinished(event));
        break;

      case 'game.finished':
        actions.push(...this.handleGameFinished(event));
        break;

      case 'takeout.started':
        actions.push({
          type: 'publish.event',
          topic: 'event/takeout/started',
          data: { timestamp: event.timestamp },
        });
        break;

      case 'takeout.finished':
        actions.push({
          type: 'publish.event',
          topic: 'event/takeout/finished',
          data: { timestamp: event.timestamp },
        });
        break;

      case 'match.state':
        actions.push(...this.handleMatchState(event));
        break;
    }

    return actions;
  }

  /**
   * Handle match start
   */
  private handleMatchStart(event: ParsedEvent): MqttAction[] {
    const data = event.data as {
      matchId?: string;
      variant?: string;
      settings?: { baseScore?: number };
      players?: Array<{ name: string }>;
    };

    const players = (data.players || []).map((p, i) => ({
      name: p.name,
      index: i,
      score: data.settings?.baseScore || 501,
      legs: 0,
      sets: 0,
    }));

    this.currentMatch = {
      matchId: data.matchId || `match-${Date.now()}`,
      gameType: data.variant || 'X01',
      startingScore: data.settings?.baseScore || 501,
      players,
      currentPlayer: 0,
      round: 1,
      leg: 1,
      set: 1,
      turnThrows: [],
      turnScore: 0,
    };

    this.inMatch = true;

    const gameState = this.buildGameState();

    return [
      {
        type: 'publish.match.start',
        topic: 'match/start',
        data: {
          matchId: this.currentMatch.matchId,
          gameType: this.currentMatch.gameType,
          startingScore: this.currentMatch.startingScore,
          players: players.map((p) => p.name),
          timestamp: event.timestamp,
        },
      },
      {
        type: 'publish.state',
        topic: 'game/state',
        data: gameState,
        retain: true,
      },
      {
        type: 'publish.state',
        topic: 'game/status',
        data: 'running',
        retain: true,
      },
    ];
  }

  /**
   * Handle match end
   */
  private handleMatchEnd(event: ParsedEvent): MqttAction[] {
    if (!this.inMatch || !this.currentMatch) {
      return [];
    }

    const data = event.data as {
      winner?: number;
      winnerName?: string;
      isAborted?: boolean;
    };

    const actions: MqttAction[] = [
      {
        type: 'publish.match.end',
        topic: 'match/end',
        data: {
          matchId: this.currentMatch.matchId,
          winner: data.winner,
          winnerName: data.winnerName || (data.winner !== undefined ? this.currentMatch.players[data.winner]?.name : undefined),
          isAborted: event.type === 'match.delete' || data.isAborted,
          timestamp: event.timestamp,
        },
      },
      {
        type: 'publish.state',
        topic: 'game/status',
        data: 'finished',
        retain: true,
      },
    ];

    // Reset state
    this.currentMatch = null;
    this.inMatch = false;

    return actions;
  }

  /**
   * Handle throw detected
   */
  private handleThrow(event: ParsedEvent): MqttAction[] {
    if (!this.currentMatch) {
      return [];
    }

    const throwData = event.data as ThrowData;
    const segment = throwData.segment;
    const points = segment.number * segment.multiplier;
    const currentPlayer = this.currentMatch.players[this.currentMatch.currentPlayer];

    // Track throw in turn
    this.currentMatch.turnThrows.push(throwData);
    this.currentMatch.turnScore += points;

    // Update player score
    if (currentPlayer) {
      currentPlayer.score -= points;
      if (currentPlayer.score < 0) {
        currentPlayer.score += points; // Revert on bust
      }
    }

    const mqttThrow: MqttThrowData = {
      segment: segment.name,
      bed: segment.bed,
      multiplier: segment.multiplier,
      points,
      player: currentPlayer?.name || 'Unknown',
      throwNumber: throwData.throwNumber,
    };

    const actions: MqttAction[] = [
      {
        type: 'publish.throw',
        topic: 'game/throw',
        data: mqttThrow,
      },
      {
        type: 'publish.event',
        topic: 'game/lastThrow',
        data: `${segment.name} (${points} points)`,
        retain: true,
      },
    ];

    // Check for highlights
    if (this.currentMatch.turnScore === 180) {
      actions.push({
        type: 'publish.highlight',
        topic: 'event/highlight/180',
        data: {
          player: currentPlayer?.name,
          timestamp: event.timestamp,
        },
      });
    }

    return actions;
  }

  /**
   * Handle player change
   */
  private handlePlayerChange(event: ParsedEvent): MqttAction[] {
    if (!this.currentMatch) {
      return [];
    }

    const data = event.data as { currentPlayer: number; previousPlayer?: number };

    this.currentMatch.currentPlayer = data.currentPlayer;
    this.currentMatch.turnThrows = [];
    this.currentMatch.turnScore = 0;

    const currentPlayer = this.currentMatch.players[data.currentPlayer];
    const gameState = this.buildGameState();

    return [
      {
        type: 'publish.player',
        topic: 'player/current',
        data: currentPlayer ? this.buildPlayerState(currentPlayer) : null,
        retain: true,
      },
      {
        type: 'publish.player',
        topic: 'player/current/name',
        data: currentPlayer?.name || '',
        retain: true,
      },
      {
        type: 'publish.player',
        topic: 'player/current/score',
        data: String(currentPlayer?.score || 0),
        retain: true,
      },
      {
        type: 'publish.state',
        topic: 'game/state',
        data: gameState,
        retain: true,
      },
    ];
  }

  /**
   * Handle turn finished
   */
  private handleTurnFinished(event: ParsedEvent): MqttAction[] {
    if (!this.currentMatch) {
      return [];
    }

    const data = event.data as { busted?: boolean; score?: number };
    const currentPlayer = this.currentMatch.players[this.currentMatch.currentPlayer];

    const turnData: MqttTurnData = {
      player: currentPlayer?.name || 'Unknown',
      playerIndex: this.currentMatch.currentPlayer,
      throws: this.currentMatch.turnThrows.map((t) => ({
        segment: t.segment.name,
        bed: t.segment.bed,
        multiplier: t.segment.multiplier,
        points: t.segment.number * t.segment.multiplier,
        player: currentPlayer?.name || 'Unknown',
        throwNumber: t.throwNumber,
      })),
      totalScore: this.currentMatch.turnScore,
      remaining: currentPlayer?.score || 0,
      busted: data.busted || false,
      checkout: currentPlayer?.score === 0,
      round: this.currentMatch.round,
    };

    const actions: MqttAction[] = [
      {
        type: 'publish.turn',
        topic: 'game/turn',
        data: turnData,
      },
    ];

    // Bust highlight
    if (data.busted) {
      actions.push({
        type: 'publish.highlight',
        topic: 'event/highlight/bust',
        data: {
          player: currentPlayer?.name,
          score: this.currentMatch.turnScore,
          timestamp: event.timestamp,
        },
      });
    }

    // Reset turn tracking
    this.currentMatch.turnThrows = [];
    this.currentMatch.turnScore = 0;

    return actions;
  }

  /**
   * Handle game finished (leg won)
   */
  private handleGameFinished(event: ParsedEvent): MqttAction[] {
    if (!this.currentMatch) {
      return [];
    }

    const data = event.data as { winner?: number; winnerName?: string };
    const winner = data.winner !== undefined ? this.currentMatch.players[data.winner] : undefined;

    if (winner) {
      winner.legs++;
    }

    // Reset scores for new leg
    for (const player of this.currentMatch.players) {
      player.score = this.currentMatch.startingScore;
    }
    this.currentMatch.leg++;

    const actions: MqttAction[] = [
      {
        type: 'publish.game.end',
        topic: 'game/legWon',
        data: {
          winner: data.winner,
          winnerName: winner?.name || data.winnerName,
          leg: this.currentMatch.leg - 1,
          timestamp: event.timestamp,
        },
      },
    ];

    // Checkout highlight
    actions.push({
      type: 'publish.highlight',
      topic: 'event/highlight/checkout',
      data: {
        player: winner?.name,
        timestamp: event.timestamp,
      },
    });

    return actions;
  }

  /**
   * Handle match state updates
   */
  private handleMatchState(event: ParsedEvent): MqttAction[] {
    const data = event.data as {
      players?: Array<{ name: string; score?: number; legs?: number; sets?: number }>;
      player?: number;
      round?: number;
      leg?: number;
      set?: number;
    };

    if (!this.currentMatch) {
      return [];
    }

    // Update player scores
    if (data.players) {
      for (let i = 0; i < data.players.length; i++) {
        const p = data.players[i];
        if (this.currentMatch.players[i]) {
          if (p.score !== undefined) this.currentMatch.players[i].score = p.score;
          if (p.legs !== undefined) this.currentMatch.players[i].legs = p.legs;
          if (p.sets !== undefined) this.currentMatch.players[i].sets = p.sets;
        }
      }
    }

    if (data.player !== undefined) this.currentMatch.currentPlayer = data.player;
    if (data.round !== undefined) this.currentMatch.round = data.round;
    if (data.leg !== undefined) this.currentMatch.leg = data.leg;
    if (data.set !== undefined) this.currentMatch.set = data.set;

    const gameState = this.buildGameState();
    const currentPlayer = this.currentMatch.players[this.currentMatch.currentPlayer];

    return [
      {
        type: 'publish.state',
        topic: 'game/state',
        data: gameState,
        retain: true,
      },
      {
        type: 'publish.player',
        topic: 'player/current/score',
        data: String(currentPlayer?.score || 0),
        retain: true,
      },
    ];
  }

  /**
   * Build game state for publishing
   */
  private buildGameState(): GameState {
    if (!this.currentMatch) {
      return { state: 'idle' };
    }

    return {
      state: 'running',
      matchId: this.currentMatch.matchId,
      gameMode: this.currentMatch.gameType,
      players: this.currentMatch.players.map((p) => this.buildPlayerState(p)),
      currentPlayer: this.currentMatch.currentPlayer,
      round: this.currentMatch.round,
      leg: this.currentMatch.leg,
      set: this.currentMatch.set,
    };
  }

  /**
   * Build player state for publishing
   */
  private buildPlayerState(player: { name: string; score: number; legs: number; sets: number }): PlayerState {
    return {
      name: player.name,
      score: player.score,
      legs: player.legs,
      sets: player.sets,
    };
  }

  /**
   * Reset mapper state
   */
  reset(): void {
    this.currentMatch = null;
    this.inMatch = false;
  }
}
