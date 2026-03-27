/**
 * Copyright (c) 2026 ByteDance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it, vi } from 'vitest';
import { FeishuAccountConfigSchema, FeishuGroupSchema } from '../src/core/config-schema.ts';
import type { FeishuGroupConfig, LarkAccount } from '../src/core/types.ts';

vi.mock('../src/core/chat-info-cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/chat-info-cache')>();
  return {
    ...actual,
    isThreadCapableGroup: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('openclaw/plugin-sdk/routing', () => ({
  resolveThreadSessionKeys: vi.fn(({ baseSessionKey, threadId }: { baseSessionKey: string; threadId: string }) => ({
    sessionKey: `${baseSessionKey}:thread:${threadId}`,
  })),
}));

import { resolveThreadSessionKey } from '../src/messaging/inbound/dispatch-context.ts';

describe('threadSession config schema', () => {
  it('FeishuGroupSchema preserves value', () => {
    const result = FeishuGroupSchema.safeParse({ threadSession: true });
    expect(result.success).toBe(true);
    expect(result.data!.threadSession).toBe(true);
  });

  it('FeishuAccountConfigSchema preserves value', () => {
    const result = FeishuAccountConfigSchema.safeParse({ threadSession: false });
    expect(result.success).toBe(true);
    expect(result.data!.threadSession).toBe(false);
  });

  it('defaults to undefined when omitted', () => {
    const result = FeishuGroupSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data!.threadSession).toBeUndefined();
  });
});

describe('resolveThreadSessionKey', () => {
  const makeAccount = (threadSession: boolean): LarkAccount =>
    ({
      accountId: 'main',
      enabled: true,
      configured: true,
      appId: 'cli_app',
      appSecret: 'secret',
      brand: 'feishu',
      config: {
        allowFrom: [],
        groupAllowFrom: [],
        threadSession,
      },
    }) as LarkAccount;

  const baseParams = {
    accountScopedCfg: { channels: { feishu: {} } },
    account: makeAccount(false),
    chatId: 'oc_group',
    threadId: 'omt_thread',
    baseSessionKey: 'feishu:main:group:oc_group',
  };

  it('test_group_thread_session_overrides_account_level', async () => {
    const sessionKey = await resolveThreadSessionKey({
      ...baseParams,
      groupConfig: { allowFrom: [], threadSession: true } satisfies FeishuGroupConfig,
    });

    expect(sessionKey).toContain('omt_thread');
  });

  it('test_group_thread_session_false_overrides_account_true', async () => {
    const sessionKey = await resolveThreadSessionKey({
      ...baseParams,
      account: makeAccount(true),
      groupConfig: { allowFrom: [], threadSession: false } satisfies FeishuGroupConfig,
    });

    expect(sessionKey).toBeUndefined();
  });

  it('test_group_without_thread_session_falls_back_to_account', async () => {
    const sessionKey = await resolveThreadSessionKey({
      ...baseParams,
      account: makeAccount(true),
      groupConfig: { allowFrom: [] } satisfies FeishuGroupConfig,
    });

    expect(sessionKey).toContain('omt_thread');
  });
});
