/**
 * MQTT Client - Handles MQTT connection and publishing
 */

import * as mqtt from 'mqtt';
import type { MqttModuleConfig, HomeAssistantDiscovery } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

/**
 * Logger interface for MQTT client
 */
export interface MqttLoggerInterface {
  log(source: string, message: string, data?: unknown): void;
}

/**
 * MqttClient - Manages MQTT connection and message publishing
 */
export class MqttClient {
  private client: mqtt.MqttClient | null = null;
  private config: Required<Pick<MqttModuleConfig, 'broker' | 'baseTopic' | 'homeAssistant'>> & MqttModuleConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private logger: MqttLoggerInterface | null = null;

  constructor(config: MqttModuleConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      clientId: `autodarts-mqtt-${Date.now()}`,
      ...config,
    };
  }

  /**
   * Set logger
   */
  setLogger(logger: MqttLoggerInterface | null): void {
    this.logger = logger;
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.logger) {
      this.logger.log('mqtt-client', message, data);
    } else {
      console.log(`[mqtt-client] ${message}`, data || '');
    }
  }

  /**
   * Update configuration (requires reconnect)
   */
  updateConfig(config: Partial<MqttModuleConfig>): void {
    const reconnectRequired =
      config.broker !== undefined && config.broker !== this.config.broker ||
      config.username !== undefined && config.username !== this.config.username ||
      config.password !== undefined && config.password !== this.config.password;

    this.config = { ...this.config, ...config };

    if (reconnectRequired && this.isConnected) {
      this.log('Config changed, reconnecting...');
      this.disconnect().then(() => this.connect()).catch((err) => {
        this.log('Reconnect failed', { error: err.message });
      });
    }
  }

  /**
   * Connect to the MQTT broker
   */
  async connect(): Promise<void> {
    if (!this.config.broker) {
      throw new Error('MQTT broker URL not configured');
    }

    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        will: {
          topic: `${this.config.baseTopic}/status`,
          payload: Buffer.from('offline'),
          retain: true,
          qos: 1,
        },
      };

      if (this.config.username) {
        options.username = this.config.username;
        options.password = this.config.password;
      }

      this.log(`Connecting to ${this.config.broker}...`);
      this.client = mqtt.connect(this.config.broker, options);

      const connectTimeout = setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
          this.client?.end();
        }
      }, 15000);

      this.client.on('connect', () => {
        clearTimeout(connectTimeout);
        this.log('Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.config.homeAssistant) {
          this.publishHomeAssistantDiscovery().catch((err) => {
            this.log('Failed to publish HA discovery', { error: err.message });
          });
        }

        this.publishStatus('online').then(resolve).catch(resolve);
      });

      this.client.on('error', (error) => {
        this.log('Connection error', { error: error.message });
        if (!this.isConnected) {
          clearTimeout(connectTimeout);
          reject(error);
        }
      });

      this.client.on('offline', () => {
        this.log('Client offline');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        this.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.log('Max reconnect attempts reached');
          this.client?.end();
        }
      });

      this.client.on('close', () => {
        this.log('Connection closed');
        this.isConnected = false;
      });
    });
  }

  /**
   * Disconnect from the MQTT broker
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.publishStatus('offline');
      return new Promise((resolve) => {
        this.client?.end(false, {}, () => {
          this.log('Disconnected');
          this.isConnected = false;
          this.client = null;
          resolve();
        });
      });
    }
  }

  /**
   * Publish a message to a topic
   */
  async publish(
    topic: string,
    message: string | object,
    options: { retain?: boolean; qos?: 0 | 1 | 2 } = {}
  ): Promise<void> {
    if (!this.isConnected || !this.client) {
      this.log('Not connected, cannot publish', { topic });
      return;
    }

    const fullTopic = topic.startsWith('homeassistant/') ? topic : `${this.config.baseTopic}/${topic}`;
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.client!.publish(
        fullTopic,
        payload,
        { retain: options.retain ?? false, qos: options.qos ?? 0 },
        (error) => {
          if (error) {
            this.log(`Publish error on ${fullTopic}`, { error: error.message });
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Publish module status
   */
  async publishStatus(status: 'online' | 'offline'): Promise<void> {
    await this.publish('status', status, { retain: true });
  }

  /**
   * Publish Home Assistant MQTT Discovery messages
   */
  private async publishHomeAssistantDiscovery(): Promise<void> {
    const deviceInfo = {
      identifiers: ['autodarts_mqtt'],
      name: 'Autodarts',
      manufacturer: 'Autodarts',
      model: 'MQTT Module',
      sw_version: '1.0.0',
    };

    const discoveries: { topic: string; config: HomeAssistantDiscovery }[] = [
      // Binary sensor for status
      {
        topic: 'homeassistant/binary_sensor/autodarts/status/config',
        config: {
          name: 'Autodarts Status',
          state_topic: `${this.config.baseTopic}/status`,
          unique_id: 'autodarts_status',
          device: deviceInfo,
          payload_on: 'online',
          payload_off: 'offline',
          device_class: 'connectivity',
        },
      },
      // Sensor for game state
      {
        topic: 'homeassistant/sensor/autodarts/game_state/config',
        config: {
          name: 'Autodarts Game State',
          state_topic: `${this.config.baseTopic}/game/status`,
          unique_id: 'autodarts_game_state',
          device: deviceInfo,
          icon: 'mdi:bullseye-arrow',
        },
      },
      // Sensor for current player
      {
        topic: 'homeassistant/sensor/autodarts/current_player/config',
        config: {
          name: 'Autodarts Current Player',
          state_topic: `${this.config.baseTopic}/player/current/name`,
          unique_id: 'autodarts_current_player',
          device: deviceInfo,
          icon: 'mdi:account',
        },
      },
      // Sensor for current score
      {
        topic: 'homeassistant/sensor/autodarts/current_score/config',
        config: {
          name: 'Autodarts Current Score',
          state_topic: `${this.config.baseTopic}/player/current/score`,
          unique_id: 'autodarts_current_score',
          device: deviceInfo,
          icon: 'mdi:counter',
        },
      },
      // Sensor for last throw
      {
        topic: 'homeassistant/sensor/autodarts/last_throw/config',
        config: {
          name: 'Autodarts Last Throw',
          state_topic: `${this.config.baseTopic}/game/lastThrow`,
          unique_id: 'autodarts_last_throw',
          device: deviceInfo,
          icon: 'mdi:bullseye',
        },
      },
      // Sensor for full game state (JSON attributes)
      {
        topic: 'homeassistant/sensor/autodarts/game/config',
        config: {
          name: 'Autodarts Game',
          state_topic: `${this.config.baseTopic}/game/status`,
          json_attributes_topic: `${this.config.baseTopic}/game/state`,
          unique_id: 'autodarts_game',
          device: deviceInfo,
          icon: 'mdi:dart',
        },
      },
    ];

    for (const discovery of discoveries) {
      await this.publish(discovery.topic, discovery.config, { retain: true });
    }

    this.log('Home Assistant discovery published');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get base topic
   */
  get baseTopic(): string {
    return this.config.baseTopic;
  }
}
