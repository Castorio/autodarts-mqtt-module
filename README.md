# Autodarts MQTT Module

Ein Modul für den Autodarts Hub, das Spielereignisse an einen MQTT-Broker publiziert. Ideal für die Integration mit Home Assistant oder anderen Smart-Home-Systemen.

## Features

- Publiziert Autodarts-Events an MQTT
- Konfigurierbare Topics
- Home Assistant Auto-Discovery Support
- Reconnect-Logik bei Verbindungsabbrüchen

## Installation

```bash
npm install autodarts-mqtt-module
```

## Konfiguration

Das Modul benötigt folgende Konfiguration:

| Option | Beschreibung | Standard |
|--------|--------------|----------|
| `broker` | MQTT Broker URL | `mqtt://localhost:1883` |
| `username` | MQTT Benutzername | - |
| `password` | MQTT Passwort | - |
| `baseTopic` | Basis-Topic für alle Messages | `autodarts` |
| `homeAssistant` | Home Assistant Discovery aktivieren | `true` |

## Topics

Das Modul publiziert auf folgenden Topics:

- `autodarts/game/state` - Aktueller Spielstatus
- `autodarts/game/score` - Aktueller Punktestand
- `autodarts/game/throw` - Letzter Wurf
- `autodarts/player/current` - Aktueller Spieler

## Verwendung mit Home Assistant

Bei aktiviertem Home Assistant Discovery werden automatisch Sensoren erstellt:

- `sensor.autodarts_game_state`
- `sensor.autodarts_current_player`
- `sensor.autodarts_score`

## Entwicklung

```bash
# Dependencies installieren
npm install

# Build
npm run build

# Development
npm run dev
```

## Lizenz

MIT
