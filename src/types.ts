export interface MqttConfig {
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

export interface AutodartsEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export interface GameState {
  state: 'idle' | 'running' | 'finished';
  gameMode?: string;
  players?: Player[];
  currentPlayer?: number;
}

export interface Player {
  name: string;
  score: number;
  average?: number;
  darts?: number;
}

export interface ThrowData {
  segment: string;
  multiplier: number;
  points: number;
  player: string;
}

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
}
