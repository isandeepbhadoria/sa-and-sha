import {
  NotificationEventType,
  CustomerTarget,
  ProviderDispatchResult
} from '../types';
import { whatsappService } from '../whatsappService';

export interface WhatsAppProvider {
  dispatch(
    event: NotificationEventType,
    customer: CustomerTarget,
    order?: any,
    payload?: Record<string, any>
  ): Promise<ProviderDispatchResult>;
}

export class MSG91WhatsAppProvider implements WhatsAppProvider {
  async dispatch(
    event: NotificationEventType,
    customer: CustomerTarget,
    order?: any,
    payload?: Record<string, any>
  ): Promise<ProviderDispatchResult> {
    return whatsappService.sendTemplate({
      eventType: event,
      customer,
      order,
      params: payload
    });
  }
}

export const whatsappProvider = new MSG91WhatsAppProvider();

export async function sendWhatsAppNotification(options: {
  toPhone: string;
  eventType: NotificationEventType;
  params?: Record<string, any>;
  order?: any;
}): Promise<ProviderDispatchResult> {
  return whatsappService.sendTemplate({
    eventType: options.eventType,
    customer: {
      profileId: options.params?.customerProfileId || options.order?.customer_profile_id || 'guest',
      name: options.params?.customerName || options.order?.customer_name || 'Customer',
      phone: options.toPhone
    },
    order: options.order,
    params: options.params
  });
}

