import * as mqtt from 'mqtt';
import { MqttConfig, AutodartsEvent, GameState, ThrowData, HomeAssistantDiscovery } from './types';

export class MqttModule {
  private client: mqtt.MqttClient | null = null;
  private config: Required<Pick<MqttConfig, 'broker' | 'baseTopic' | 'homeAssistant'>> & MqttConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: MqttConfig) {
    this.config = {
      baseTopic: 'autodarts',
      homeAssistant: true,
      clientId: `autodarts-mqtt-${Date.now()}`,
      ...config,
    };
  }

  /**
   * Connect to the MQTT broker
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const options: mqtt.IClientOptions = {
        clientId: this.config.clientId,
        clean: true,
        reconnectPeriod: 5000,
      };

      if (this.config.username) {
        options.username = this.config.username;
        options.password = this.config.password;
      }

      console.log(`[MQTT] Connecting to ${this.config.broker}...`);
      this.client = mqtt.connect(this.config.broker, options);

      this.client.on('connect', () => {
        console.log('[MQTT] Connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        if (this.config.homeAssistant) {
          this.publishHomeAssistantDiscovery();
        }

        this.publishStatus('online');
        resolve();
      });

      this.client.on('error', (error) => {
        console.error('[MQTT] Connection error:', error.message);
        reject(error);
      });

      this.client.on('offline', () => {
        console.log('[MQTT] Client offline');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`[MQTT] Reconnecting... (attempt ${this.reconnectAttempts})`);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('[MQTT] Max reconnect attempts reached');
          this.client?.end();
        }
      });

      this.client.on('close', () => {
        console.log('[MQTT] Connection closed');
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
          console.log('[MQTT] Disconnected');
          this.isConnected = false;
          resolve();
        });
      });
    }
  }

  /**
   * Handle incoming Autodarts events
   */
  async handleEvent(event: AutodartsEvent): Promise<void> {
    if (!this.isConnected || !this.client) {
      console.warn('[MQTT] Not connected, cannot publish event');
      return;
    }

    const topic = `${this.config.baseTopic}/event/${event.type}`;
    const payload = JSON.stringify({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    await this.publish(topic, payload);

    // Handle specific event types
    switch (event.type) {
      case 'game.started':
      case 'game.updated':
      case 'game.finished':
        await this.handleGameEvent(event);
        break;
      case 'throw':
        await this.handleThrowEvent(event.data as ThrowData);
        break;
    }
  }

  /**
   * Publish game state updates
   */
  async publishGameState(state: GameState): Promise<void> {
    await this.publish(
      `${this.config.baseTopic}/game/state`,
      JSON.stringify(state)
    );

    // Publish individual state components for easier consumption
    await this.publish(
      `${this.config.baseTopic}/game/status`,
      state.state
    );

    if (state.currentPlayer !== undefined && state.players) {
      const currentPlayer = state.players[state.currentPlayer];
      if (currentPlayer) {
        await this.publish(
          `${this.config.baseTopic}/player/current`,
          JSON.stringify(currentPlayer)
        );
        await this.publish(
          `${this.config.baseTopic}/player/current/name`,
          currentPlayer.name
        );
        await this.publish(
          `${this.config.baseTopic}/player/current/score`,
          String(currentPlayer.score)
        );
      }
    }
  }

  /**
   * Publish throw data
   */
  async publishThrow(throwData: ThrowData): Promise<void> {
    await this.publish(
      `${this.config.baseTopic}/game/throw`,
      JSON.stringify(throwData)
    );
    await this.publish(
      `${this.config.baseTopic}/game/lastThrow`,
      `${throwData.segment} (${throwData.points} points)`
    );
  }

  /**
   * Publish module status
   */
  private async publishStatus(status: 'online' | 'offline'): Promise<void> {
    await this.publish(
      `${this.config.baseTopic}/status`,
      status,
      { retain: true }
    );
  }

  /**
   * Publish Home Assistant MQTT Discovery messages
   */
  private async publishHomeAssistantDiscovery(): Promise<void> {
    const deviceInfo = {
      identifiers: ['autodarts_mqtt'],
      name: 'Autodarts',
      manufacturer: 'Autodarts',
    };

    const discoveries: { topic: string; config: HomeAssistantDiscovery }[] = [
      {
        topic: 'homeassistant/sensor/autodarts/game_state/config',
        config: {
          name: 'Autodarts Game State',
          state_topic: `${this.config.baseTopic}/game/status`,
          unique_id: 'autodarts_game_state',
          device: deviceInfo,
        },
      },
      {
        topic: 'homeassistant/sensor/autodarts/current_player/config',
        config: {
          name: 'Autodarts Current Player',
          state_topic: `${this.config.baseTopic}/player/current/name`,
          unique_id: 'autodarts_current_player',
          device: deviceInfo,
        },
      },
      {
        topic: 'homeassistant/sensor/autodarts/current_score/config',
        config: {
          name: 'Autodarts Current Score',
          state_topic: `${this.config.baseTopic}/player/current/score`,
          unique_id: 'autodarts_current_score',
          device: deviceInfo,
        },
      },
      {
        topic: 'homeassistant/sensor/autodarts/last_throw/config',
        config: {
          name: 'Autodarts Last Throw',
          state_topic: `${this.config.baseTopic}/game/lastThrow`,
          unique_id: 'autodarts_last_throw',
          device: deviceInfo,
        },
      },
      {
        topic: 'homeassistant/binary_sensor/autodarts/status/config',
        config: {
          name: 'Autodarts Status',
          state_topic: `${this.config.baseTopic}/status`,
          unique_id: 'autodarts_status',
          device: deviceInfo,
          value_template: '{{ "ON" if value == "online" else "OFF" }}',
        } as HomeAssistantDiscovery,
      },
    ];

    for (const discovery of discoveries) {
      await this.publish(discovery.topic, JSON.stringify(discovery.config), { retain: true });
    }

    console.log('[MQTT] Home Assistant discovery published');
  }

  /**
   * Handle game events
   */
  private async handleGameEvent(event: AutodartsEvent): Promise<void> {
    const gameState: GameState = {
      state: event.type === 'game.finished' ? 'finished' : 'running',
      ...(event.data as object),
    };
    await this.publishGameState(gameState);
  }

  /**
   * Handle throw events
   */
  private async handleThrowEvent(throwData: ThrowData): Promise<void> {
    await this.publishThrow(throwData);
  }

  /**
   * Generic publish method
   */
  private async publish(
    topic: string,
    message: string,
    options: mqtt.IClientPublishOptions = {}
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MQTT client not initialized'));
        return;
      }

      this.client.publish(topic, message, options, (error) => {
        if (error) {
          console.error(`[MQTT] Publish error on ${topic}:`, error.message);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}
