/**
 * EventMapper Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EventMapper } from './EventMapper.js';
import type { ParsedEvent, ThrowData } from '@autodarts-hub/module-sdk';

describe('EventMapper', () => {
  let mapper: EventMapper;

  beforeEach(() => {
    mapper = new EventMapper({
      broker: 'mqtt://localhost',
      baseTopic: 'autodarts',
    });
  });

  describe('mapEvent', () => {
    it('should handle match.start event', () => {
      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match-123',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }, { name: 'Player 2' }],
        },
      };

      const actions = mapper.mapEvent(event);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].type).toBe('publish.match.start');
      expect(actions[0].topic).toBe('match/start');
      expect(mapper.isInMatch()).toBe(true);
    });

    it('should handle throw.detected event', () => {
      // First start a match
      const startEvent: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }],
        },
      };
      mapper.mapEvent(startEvent);

      // Then throw
      const throwEvent: ParsedEvent = {
        type: 'throw.detected',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'throw.detected', data: {} },
        data: {
          segment: {
            name: 'T20',
            bed: 'Triple',
            multiplier: 3,
            number: 20,
          },
          throwNumber: 1,
          boardId: 'board-1',
        } as ThrowData,
      };

      const actions = mapper.mapEvent(throwEvent);

      expect(actions.some((a) => a.type === 'publish.throw')).toBe(true);
      expect(actions.some((a) => a.topic === 'game/throw')).toBe(true);
    });

    it('should detect 180 highlight', () => {
      // Start match
      const startEvent: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }],
        },
      };
      mapper.mapEvent(startEvent);

      // Three T20s for 180
      for (let i = 0; i < 3; i++) {
        const throwEvent: ParsedEvent = {
          type: 'throw.detected',
          timestamp: new Date(),
          raw: { channel: 'test', topic: 'throw.detected', data: {} },
          data: {
            segment: {
              name: 'T20',
              bed: 'Triple',
              multiplier: 3,
              number: 20,
            },
            throwNumber: i + 1,
            boardId: 'board-1',
          } as ThrowData,
        };
        const actions = mapper.mapEvent(throwEvent);

        // Check for 180 highlight on third throw
        if (i === 2) {
          expect(actions.some((a) => a.topic === 'event/highlight/180')).toBe(true);
        }
      }
    });

    it('should handle match.finished event', () => {
      // Start match
      const startEvent: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }, { name: 'Player 2' }],
        },
      };
      mapper.mapEvent(startEvent);
      expect(mapper.isInMatch()).toBe(true);

      // End match
      const endEvent: ParsedEvent = {
        type: 'match.finished',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.finished', data: {} },
        data: {
          winner: 0,
          winnerName: 'Player 1',
        },
      };

      const actions = mapper.mapEvent(endEvent);

      expect(actions.some((a) => a.type === 'publish.match.end')).toBe(true);
      expect(mapper.isInMatch()).toBe(false);
    });

    it('should handle player.change event', () => {
      // Start match
      const startEvent: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }, { name: 'Player 2' }],
        },
      };
      mapper.mapEvent(startEvent);

      // Change player
      const changeEvent: ParsedEvent = {
        type: 'player.change',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'player.change', data: {} },
        data: {
          currentPlayer: 1,
          previousPlayer: 0,
        },
      };

      const actions = mapper.mapEvent(changeEvent);

      expect(actions.some((a) => a.type === 'publish.player')).toBe(true);
      expect(actions.some((a) => a.topic === 'player/current/name')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset mapper state', () => {
      // Start match
      const startEvent: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }],
        },
      };
      mapper.mapEvent(startEvent);
      expect(mapper.isInMatch()).toBe(true);

      // Reset
      mapper.reset();

      expect(mapper.isInMatch()).toBe(false);
      expect(mapper.getCurrentMatch()).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      mapper.updateConfig({
        baseTopic: 'new-topic',
        homeAssistant: false,
      });

      // Config should be updated (internal, but we can verify by mapping)
      const event: ParsedEvent = {
        type: 'match.start',
        timestamp: new Date(),
        raw: { channel: 'test', topic: 'match.start', data: {} },
        data: {
          matchId: 'test-match',
          variant: 'X01',
          settings: { baseScore: 501 },
          players: [{ name: 'Player 1' }],
        },
      };

      const actions = mapper.mapEvent(event);
      expect(actions.length).toBeGreaterThan(0);
    });
  });
});
