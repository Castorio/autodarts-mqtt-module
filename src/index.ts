/**
 * Autodarts MQTT Module
 *
 * SDK-conformant module that publishes Autodarts game events to MQTT
 * for Home Assistant and other smart home integrations.
 */

// Main module class
export { MqttModule } from './MqttModule.js';
export { default } from './MqttModule.js';

// Handler for standalone usage
export { MqttHandler, createMqttHandler } from './MqttHandler.js';

// Client for direct MQTT access
export { MqttClient } from './MqttClient.js';

// Event mapper
export { EventMapper, type MqttAction, type MqttActionType } from './EventMapper.js';

// Types
export type {
  MqttModuleConfig,
  GameState,
  PlayerState,
  MqttThrowData,
  MqttTurnData,
  HomeAssistantDiscovery,
  // Re-exported SDK types
  ParsedEvent,
  ThrowData,
  ThrowSegment,
  MatchData,
} from './types.js';

// Constants
export { DEFAULT_CONFIG } from './types.js';

// Entrypoint for running as standalone module
if (import.meta.url === `file://${process.argv[1]}`) {
  const { MqttModule } = await import('./MqttModule.js');
  const module = new MqttModule();
  module.start().catch((err) => {
    console.error('Failed to start MQTT module:', err);
    process.exit(1);
  });
}
