/**
 * MQTT Handler - Main handler class for the MQTT module
 *
 * Processes Autodarts events and publishes to MQTT broker
 */

import type { ParsedEvent } from '@autodarts-hub/module-sdk';
import { MqttClient, type MqttLoggerInterface } from './MqttClient.js';
import { EventMapper, type MqttAction } from './EventMapper.js';
import type { MqttModuleConfig } from './types.js';

/**
 * Logger interface for MQTT handler
 */
export interface MqttHandlerLoggerInterface {
  log(source: string, message: string, data?: unknown): void;
}

/**
 * MqttHandler - Main handler for the MQTT module
 */
export class MqttHandler {
  private config: MqttModuleConfig;
  private client: MqttClient;
  private eventMapper: EventMapper;
  private logger: MqttHandlerLoggerInterface | null = null;

  // Statistics
  private stats = {
    eventsProcessed: 0,
    messagesPublished: 0,
    errors: 0,
    connected: false,
  };

  constructor(config: MqttModuleConfig) {
    this.config = {
      baseTopic: 'autodarts',
      homeAssistant: true,
      ...config,
    };

    this.client = new MqttClient(this.config);
    this.eventMapper = new EventMapper(this.config);
  }

  /**
   * Set logger
   */
  setLogger(logger: MqttHandlerLoggerInterface | null): void {
    this.logger = logger;
    this.client.setLogger(logger as MqttLoggerInterface | null);
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.log('mqtt-handler', message, data);
    } else {
      console.log(`[mqtt-handler] ${message}`, data || '');
    }
  }

  /**
   * Initialize and connect to MQTT broker
   */
  async init(): Promise<void> {
    try {
      await this.client.connect();
      this.stats.connected = true;
      this.log('Initialized and connected');
    } catch (error) {
      this.stats.errors++;
      const err = error as Error;
      this.log('Failed to connect', { error: err.message });
      throw error;
    }
  }

  /**
   * Shutdown and disconnect
   */
  async shutdown(): Promise<void> {
    try {
      // Publish offline state
      await this.client.publish('game/status', 'idle', { retain: true });
      await this.client.disconnect();
      this.stats.connected = false;
      this.log('Shutdown complete');
    } catch (error) {
      const err = error as Error;
      this.log('Shutdown error', { error: err.message });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MqttModuleConfig>): void {
    this.config = { ...this.config, ...config };
    this.client.updateConfig(config);
    this.eventMapper.updateConfig(config);
    this.log('Config updated', { config });
  }

  /**
   * Handle incoming event from SDK
   */
  async handleEvent(event: ParsedEvent): Promise<void> {
    this.stats.eventsProcessed++;

    try {
      // Map event to MQTT actions
      const actions = this.eventMapper.mapEvent(event);

      // Execute all actions
      for (const action of actions) {
        await this.executeAction(action);
      }
    } catch (error) {
      this.stats.errors++;
      const err = error as Error;
      this.log('Error processing event', { error: err.message, event: event.type });
    }
  }

  /**
   * Execute a single MQTT action
   */
  private async executeAction(action: MqttAction): Promise<void> {
    if (action.type === 'none' || !action.topic) {
      return;
    }

    try {
      await this.client.publish(action.topic, action.data as object, {
        retain: action.retain ?? false,
      });
      this.stats.messagesPublished++;
    } catch (error) {
      this.stats.errors++;
      const err = error as Error;
      this.log('Failed to publish', { error: err.message, topic: action.topic });
    }
  }

  /**
   * Get handler statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats, connected: this.client.connected };
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.client.connected;
  }

  /**
   * Check if in match
   */
  get inMatch(): boolean {
    return this.eventMapper.isInMatch();
  }
}

/**
 * Factory function to create handler
 */
export function createMqttHandler(config: Record<string, unknown>): MqttHandler {
  return new MqttHandler(config as unknown as MqttModuleConfig);
}
