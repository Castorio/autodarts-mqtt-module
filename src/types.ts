/**
 * MQTT Module Types
 */

import type { ThrowData as SDKThrowData } from '@autodarts-hub/module-sdk';

// Re-export SDK types for convenience
export type { ParsedEvent, ThrowData, ThrowSegment, MatchData } from '@autodarts-hub/module-sdk';

/**
 * MQTT Module Configuration
 */
export interface MqttModuleConfig {
  /** MQTT Broker URL (e.g., mqtt://localhost:1883) */
  broker: string;

  /** MQTT Username (optional) */
  username?: string;

  /** MQTT Password (optional) */
  password?: string;

  /** Base topic for all messages (default: autodarts) */
  baseTopic?: string;

  /** Enable Home Assistant MQTT Discovery (default: true) */
  homeAssistant?: boolean;

  /** Client ID for MQTT connection */
  clientId?: string;
}

/**
 * Internal game state tracking
 */
export interface GameState {
  state: 'idle' | 'running' | 'finished';
  matchId?: string;
  gameMode?: string;
  players?: PlayerState[];
  currentPlayer?: number;
  round?: number;
  leg?: number;
  set?: number;
}

/**
 * Player state for MQTT publishing
 */
export interface PlayerState {
  name: string;
  score: number;
  average?: number;
  darts?: number;
  legs?: number;
  sets?: number;
}

/**
 * Throw data for MQTT publishing
 */
export interface MqttThrowData {
  segment: string;
  bed: string;
  multiplier: number;
  points: number;
  player: string;
  throwNumber: number;
}

/**
 * Turn data for MQTT publishing
 */
export interface MqttTurnData {
  player: string;
  playerIndex: number;
  throws: MqttThrowData[];
  totalScore: number;
  remaining: number;
  busted: boolean;
  checkout: boolean;
  round: number;
}

/**
 * Home Assistant discovery configuration
 */
export interface HomeAssistantDiscovery {
  name: string;
  state_topic: string;
  unique_id: string;
  device: {
    identifiers: string[];
    name: string;
    manufacturer: string;
  };
  value_template?: string;
  json_attributes_topic?: string;
  payload_on?: string;
  payload_off?: string;
  device_class?: string;
  icon?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Pick<MqttModuleConfig, 'baseTopic' | 'homeAssistant'>> = {
  baseTopic: 'autodarts',
  homeAssistant: true,
};
