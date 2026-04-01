/**
 * MQTT Module - SDK-conformant Autodarts Module
 *
 * Extends AutodartsModule from @autodarts-hub/module-sdk to publish
 * game events to an MQTT broker for Home Assistant and other integrations.
 */

import { AutodartsModule, type ParsedEvent } from '@autodarts-hub/module-sdk';
import { MqttHandler } from './MqttHandler.js';
import type { MqttModuleConfig } from './types.js';

/**
 * MqttModule - Autodarts MQTT Integration Module
 *
 * Usage:
 * ```typescript
 * const module = new MqttModule();
 * module.start();
 * ```
 */
export class MqttModule extends AutodartsModule {
  private handler: MqttHandler | null = null;

  /**
   * Called when module is initialized with config
   */
  protected async onInit(config: Record<string, unknown>): Promise<void> {
    const mqttConfig: MqttModuleConfig = {
      broker: config.broker as string || '',
      username: config.username as string | undefined,
      password: config.password as string | undefined,
      baseTopic: config.baseTopic as string | undefined,
      homeAssistant: config.homeAssistant as boolean | undefined,
      clientId: config.clientId as string | undefined,
    };

    // Validate broker URL
    if (!mqttConfig.broker) {
      this.reportError('CONFIG_ERROR', 'MQTT broker URL is required', true);
      return;
    }

    // Create handler with logging
    this.handler = new MqttHandler(mqttConfig);
    this.handler.setLogger({
      log: (source, message, data) => {
        this.log('info', `[${source}] ${message}`, data as Record<string, unknown>);
      },
    });

    // Connect to broker
    try {
      await this.handler.init();
      this.updateStatus('connected', `Connected to ${mqttConfig.broker}`);
      this.log('info', 'MQTT module initialized', { broker: mqttConfig.broker });
    } catch (error) {
      const err = error as Error;
      this.reportError('CONNECTION_ERROR', `Failed to connect to MQTT broker: ${err.message}`, true);
    }
  }

  /**
   * Called when an event is received
   */
  protected async onEvent(event: ParsedEvent): Promise<void> {
    if (!this.handler) {
      return;
    }

    try {
      const publishedTopics = await this.handler.handleEvent(event);

      // Emit intent for each published topic
      for (const topic of publishedTopics) {
        this.emitIntent('mqtt.message.published', {
          topic,
          eventType: event.type,
        });
      }
    } catch (error) {
      const err = error as Error;
      this.log('error', `Failed to handle event: ${err.message}`, { event: event.type });
    }
  }

  /**
   * Called when config is updated
   */
  protected async onConfigUpdate(config: Record<string, unknown>, changedKeys: string[]): Promise<void> {
    await super.onConfigUpdate(config, changedKeys);

    if (!this.handler) {
      return;
    }

    const mqttConfig: Partial<MqttModuleConfig> = {};

    if (changedKeys.includes('broker')) mqttConfig.broker = config.broker as string;
    if (changedKeys.includes('username')) mqttConfig.username = config.username as string;
    if (changedKeys.includes('password')) mqttConfig.password = config.password as string;
    if (changedKeys.includes('baseTopic')) mqttConfig.baseTopic = config.baseTopic as string;
    if (changedKeys.includes('homeAssistant')) mqttConfig.homeAssistant = config.homeAssistant as boolean;
    if (changedKeys.includes('clientId')) mqttConfig.clientId = config.clientId as string;

    if (Object.keys(mqttConfig).length > 0) {
      this.handler.updateConfig(mqttConfig);
      this.log('info', 'Config updated', { changedKeys });
    }
  }

  /**
   * Called when shutdown is requested
   */
  protected async onShutdown(reason: string): Promise<void> {
    this.log('info', `Shutting down: ${reason}`);

    if (this.handler) {
      await this.handler.shutdown();
      this.handler = null;
    }
  }
}

// Export for direct instantiation
export default MqttModule;
