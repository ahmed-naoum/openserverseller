import axios from 'axios';

export interface CourierResponse {
  trackingNumber: string;
  status: string;
  estimatedDelivery?: string;
}

export interface DeliveryAddress {
  name: string;
  phone: string;
  city: string;
  address: string;
}

export class ColiswiftService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.coliswift.ma') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createShipment(order: {
    orderNumber: string;
    customer: DeliveryAddress;
    codAmount: number;
    weight?: number;
    description?: string;
  }): Promise<CourierResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/shipments`,
        {
          reference: order.orderNumber,
          recipient: {
            name: order.customer.name,
            phone: order.customer.phone,
            city: order.customer.city,
            address: order.customer.address,
          },
          cod: order.codAmount,
          weight: order.weight || 1,
          description: order.description || 'Colis e-commerce',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        trackingNumber: response.data.tracking_number,
        status: 'PENDING_PICKUP',
        estimatedDelivery: response.data.estimated_delivery,
      };
    } catch (error: any) {
      console.error('Coliswift API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async trackShipment(trackingNumber: string): Promise<{
    status: string;
    events: Array<{ status: string; location: string; time: string }>;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/shipments/${trackingNumber}/track`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return {
        status: response.data.status,
        events: response.data.events.map((e: any) => ({
          status: e.status,
          location: e.location,
          time: e.timestamp,
        })),
      };
    } catch (error: any) {
      console.error('Coliswift tracking error:', error.response?.data || error.message);
      throw error;
    }
  }

  async cancelShipment(trackingNumber: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.baseUrl}/v1/shipments/${trackingNumber}/cancel`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return true;
    } catch (error: any) {
      console.error('Coliswift cancel error:', error.response?.data || error.message);
      throw error;
    }
  }
}

export class AramexService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.aramex.com') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async createShipment(order: {
    orderNumber: string;
    customer: DeliveryAddress;
    codAmount: number;
    weight?: number;
  }): Promise<CourierResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/shipments`,
        {
          reference: order.orderNumber,
          consignee: {
            name: order.customer.name,
            phone: order.customer.phone,
            city: order.customer.city,
            address: order.customer.address,
            country: 'MA',
          },
          CODAmount: order.codAmount,
          weight: order.weight || 1,
          serviceType: 'COD',
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        trackingNumber: response.data.trackingNumber,
        status: 'PENDING_PICKUP',
        estimatedDelivery: response.data.estimatedDelivery,
      };
    } catch (error: any) {
      console.error('Aramex API error:', error.response?.data || error.message);
      throw error;
    }
  }

  async trackShipment(trackingNumber: string): Promise<{
    status: string;
    events: Array<{ status: string; location: string; time: string }>;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/shipments/${trackingNumber}/tracking`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        }
      );

      return {
        status: response.data.status,
        events: response.data.trackingEvents.map((e: any) => ({
          status: e.statusDescription,
          location: e.location,
          time: e.updateDateTime,
        })),
      };
    } catch (error: any) {
      console.error('Aramex tracking error:', error.response?.data || error.message);
      throw error;
    }
  }
}

export const createCourierService = (courierName: string, apiKey: string) => {
  switch (courierName.toLowerCase()) {
    case 'coliswift':
      return new ColiswiftService(apiKey);
    case 'aramex':
      return new AramexService(apiKey);
    default:
      throw new Error(`Unknown courier: ${courierName}`);
  }
};
