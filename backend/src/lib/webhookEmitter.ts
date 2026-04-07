import { EventEmitter } from 'events';

// Singleton event emitter for broadcasting webhook events to SSE clients
const webhookEmitter = new EventEmitter();
webhookEmitter.setMaxListeners(100); // Support up to 100 simultaneous SSE connections

export default webhookEmitter;
