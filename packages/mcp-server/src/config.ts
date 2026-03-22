import { UberEatsClient } from '@orderfood/ubereats-client';
import { ThuisbezorgdClient } from '@orderfood/thuisbezorgd-client';
import type { PlatformClient } from '@orderfood/shared';

export function getClient(platform: 'ubereats' | 'thuisbezorgd'): PlatformClient {
  switch (platform) {
    case 'ubereats': return new UberEatsClient();
    case 'thuisbezorgd': return new ThuisbezorgdClient();
  }
}
