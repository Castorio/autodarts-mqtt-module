# Autodarts MQTT Module

An SDK-conformant module for Autodarts Hub that publishes game events to an MQTT broker. Perfect for integration with Home Assistant, Node-RED, or any other smart home system that supports MQTT.

## Features

- **Full SDK Integration** - Built on `@autodarts-hub/module-sdk` for seamless Autodarts Hub integration
- **Comprehensive Event Support** - Match, throw, player, turn, and board events
- **Home Assistant Auto-Discovery** - Automatic sensor creation in Home Assistant
- **Configurable Topics** - Customizable base topic prefix for all MQTT messages
- **Automatic Reconnection** - Built-in reconnect logic for connection drops
- **Multi-Language Support** - UI available in English, German, and Spanish

## Requirements

- Node.js >= 18.0.0
- Autodarts Hub with Module SDK
- MQTT Broker (e.g., Mosquitto, HiveMQ, Home Assistant MQTT Add-on)

## Installation

```bash
npm install autodarts-mqtt-module
```

Or clone and build from source:

```bash
git clone https://github.com/autodarts/autodarts-mqtt-module.git
cd autodarts-mqtt-module
npm install
npm run build
```

## Configuration

Configure the module through the Autodarts Hub UI or via `module.json`:

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `broker` | string | MQTT Broker URL (e.g., `mqtt://192.168.1.100:1883`) | *required* |
| `username` | string | MQTT broker username | - |
| `password` | password | MQTT broker password | - |
| `baseTopic` | string | Base topic prefix for all messages | `autodarts` |
| `homeAssistant` | boolean | Enable Home Assistant MQTT auto-discovery | `true` |
| `clientId` | string | Custom MQTT client identifier | auto-generated |

## Supported Events

### Match Events
| Event | Description |
|-------|-------------|
| `match.started` | Triggered when a new match begins |
| `match.finished` | Triggered when a match ends |
| `match.finish` | User clicks finish (after results screen) |
| `match.deleted` | Match was cancelled |
| `match.state` | Game state was updated |

### Throw Events
| Event | Description |
|-------|-------------|
| `throw.detected` | A throw was detected |
| `throw.triple` | A triple field was hit |
| `throw.double` | A double field was hit |
| `throw.bull` | The outer bull was hit (25) |
| `throw.bullseye` | The bullseye was hit (50) |
| `throw.180` | A perfect 180 was thrown |
| `throw.highfinish` | A checkout over 100 points |
| `throw.miss` | The board was missed |

### Player Events
| Event | Description |
|-------|-------------|
| `player.changed` | The active player has changed |
| `turn.started` | A player starts their turn |
| `turn.finished` | A player finishes their turn |

### Board Events
| Event | Description |
|-------|-------------|
| `takeout.started` | Darts are being pulled from the board |
| `takeout.finished` | Darts have been pulled from the board |
| `game.finished` | A leg has been finished |

## MQTT Topic Structure

All messages are published under the configured base topic:

```
{baseTopic}/match/started
{baseTopic}/match/state
{baseTopic}/throw/detected
{baseTopic}/player/changed
...
```

**Example with default topic:**
```
autodarts/match/started
autodarts/throw/180
autodarts/game/finished
```

## Home Assistant Integration

When `homeAssistant` is enabled, the module automatically publishes discovery messages to Home Assistant's MQTT discovery prefix. This creates sensors for:

- **Match State** - Current game status
- **Current Player** - Active player name
- **Score** - Current score for each player
- **Last Throw** - Details of the last throw

Sensors will appear automatically under `sensor.autodarts_*` in Home Assistant.

### Example Home Assistant Automation

```yaml
automation:
  - alias: "Celebrate 180"
    trigger:
      - platform: mqtt
        topic: "autodarts/throw/180"
    action:
      - service: light.turn_on
        target:
          entity_id: light.darts_room
        data:
          effect: "rainbow"
          brightness: 255
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Project Structure

```
autodarts-mqtt-module/
├── src/
│   ├── index.ts          # Module exports and entry point
│   ├── MqttModule.ts     # Main SDK module class
│   ├── MqttHandler.ts    # Event handling logic
│   ├── MqttClient.ts     # MQTT client wrapper
│   ├── EventMapper.ts    # Event to MQTT action mapping
│   └── types.ts          # TypeScript type definitions
├── dist/                  # Compiled JavaScript (generated)
├── module.json           # Autodarts Hub module manifest
├── package.json
└── tsconfig.json
```

### Module SDK

This module is built on `@autodarts-hub/module-sdk`. See the [Module SDK Documentation](../AutodartsClient/docs/developerguide) for details on:

- Module lifecycle
- Event handling
- Configuration management
- Status reporting

## Custom Actions

The module supports custom MQTT publish actions:

```json
{
  "type": "publish",
  "config": {
    "topic": "custom/event",
    "message": "{\"data\": \"value\"}",
    "retain": false
  }
}
```

## Troubleshooting

### Connection Issues
- Verify broker URL format: `mqtt://host:port` or `mqtts://host:port` for TLS
- Check firewall rules for MQTT port (default: 1883)
- Verify credentials if authentication is enabled

### Events Not Publishing
- Check module status in Autodarts Hub
- Verify the module is subscribed to the desired events
- Check MQTT broker logs for connection issues

### Home Assistant Sensors Not Appearing
- Ensure `homeAssistant` option is enabled
- Verify Home Assistant MQTT integration is configured
- Check the discovery prefix matches Home Assistant's config (default: `homeassistant`)

## License

MIT

## Contributing

Contributions are welcome! Please read the contributing guidelines before submitting pull requests.

## Related Projects

- [Autodarts](https://autodarts.io) - Automatic dart scoring system
- [Autodarts Hub](https://github.com/autodarts) - Module system for Autodarts
- [Module SDK](../AutodartsClient/module-sdk) - SDK for building Autodarts modules
