export const courierService = {
  ColiswiftService: () => {},
  AramexService: () => {},
  createCourierService: () => {}
};
export { sendWhatsAppMessage, sendOTPWhatsApp, sendOrderConfirmationWhatsApp } from './whatsapp.service';
export { setupSocketHandlers, broadcastToVendors, broadcastToAgents, broadcastToAdmins, notifyUser } from './socket.service';
export { OcrService } from './ocr.service';
