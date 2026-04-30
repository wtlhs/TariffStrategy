import { describe, it, expect } from 'vitest'
import {
  calculateCheckInCredits,
  getActionCost,
  canAfford,
  isActionAvailable,
  PLAN_CHECKIN_MULTIPLIERS,
} from './credit-engine'
import type { PlanTier } from '@/types'

describe('calculateCheckInCredits', () => {
  it('should give base credits for streak 0, free plan', () => {
    const result = calculateCheckInCredits(0, 'free')
    expect(result.baseCredits).toBe(10)
    expect(result.streakBonus).toBe(0)
    expect(result.planMultiplier).toBe(1.0)
    expect(result.totalCredits).toBe(10)
  })

  it('should give streak bonus at threshold 3', () => {
    const result = calculateCheckInCredits(3, 'free')
    expect(result.streakBonus).toBe(5)
    expect(result.totalCredits).toBe(15)
  })

  it('should give streak bonus at threshold 7', () => {
    const result = calculateCheckInCredits(7, 'free')
    expect(result.streakBonus).toBe(10)
    expect(result.totalCredits).toBe(20)
  })

  it('should give streak bonus at threshold 30', () => {
    const result = calculateCheckInCredits(30, 'free')
    expect(result.streakBonus).toBe(20)
    expect(result.totalCredits).toBe(30)
  })

  it('should apply pro multiplier (2x)', () => {
    const result = calculateCheckInCredits(0, 'pro')
    expect(result.planMultiplier).toBe(2.0)
    expect(result.totalCredits).toBe(20)
  })

  it('should apply enterprise multiplier (3x)', () => {
    const result = calculateCheckInCredits(7, 'enterprise')
    expect(result.planMultiplier).toBe(3.0)
    expect(result.totalCredits).toBe(60) // (10 + 10) * 3
  })
})

describe('getActionCost', () => {
  it('should return free user cost for free plan', () => {
    expect(getActionCost('local_compare', 'free')).toBe(2)
  })

  it('should return paid user cost for pro plan', () => {
    expect(getActionCost('local_compare', 'pro')).toBe(0)
  })

  it('should return same cost for both tiers when no discount', () => {
    expect(getActionCost('send_notification', 'free')).toBe(1)
    expect(getActionCost('send_notification', 'pro')).toBe(1)
  })

  it('should return high cost for free deep report', () => {
    expect(getActionCost('ai_deep_report', 'free')).toBe(999)
  })
})

describe('canAfford', () => {
  it('should allow paid users to compare for free', () => {
    expect(canAfford(0, 'local_compare', 'pro')).toBe(true)
  })

  it('should allow when credits >= cost', () => {
    expect(canAfford(10, 'ai_analysis', 'free')).toBe(true)
  })

  it('should deny when credits < cost', () => {
    expect(canAfford(5, 'ai_analysis', 'free')).toBe(false)
  })

  it('should allow zero-cost actions', () => {
    expect(canAfford(0, 'local_compare', 'pro')).toBe(true)
  })
})

describe('isActionAvailable', () => {
  it('should always be available for paid users', () => {
    const result = isActionAvailable('local_compare', 'pro', 100)
    expect(result.available).toBe(true)
    expect(result.remaining).toBe(Infinity)
  })

  it('should be available when under weekly limit', () => {
    const result = isActionAvailable('local_compare', 'free', 5)
    expect(result.available).toBe(true)
    expect(result.remaining).toBe(10)
  })

  it('should be unavailable when at weekly limit', () => {
    const result = isActionAvailable('ai_analysis', 'free', 2)
    expect(result.available).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it('should always be available when no weekly limit', () => {
    const result = isActionAvailable('excel_export', 'free', 999)
    expect(result.available).toBe(true)
    expect(result.remaining).toBe(Infinity)
  })

  it('should block free deep report (0 weekly limit)', () => {
    const result = isActionAvailable('ai_deep_report', 'free', 0)
    expect(result.available).toBe(false)
  })
})
