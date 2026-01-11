import logger from '../utils/logger.js';
import { supabase } from '../config/database.js';

const clients = new Set();

/**
 * Setup WebSocket server for live attendance feed
 */
export function setupWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    logger.info('WebSocket client connected');
    clients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'Connected to live attendance feed',
      timestamp: new Date().toISOString(),
    }));

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Subscribe to Supabase realtime changes
  const channel = supabase
    .channel('attendance_changes')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_logs',
      },
      async (payload) => {
        logger.info('New attendance log:', payload.new.id);

        // Fetch full details
        const { data } = await supabase
          .from('attendance_logs')
          .select(`
            *,
            employees (name, employee_id),
            devices (device_uuid, location),
            companies (name)
          `)
          .eq('id', payload.new.id)
          .single();

        // Broadcast to all connected clients
        const message = JSON.stringify({
          type: 'attendance_event',
          data,
          timestamp: new Date().toISOString(),
        });

        clients.forEach((client) => {
          if (client.readyState === 1) { // OPEN
            client.send(message);
          }
        });
      }
    )
    .subscribe();

  logger.info('WebSocket server initialized with Supabase realtime');
}

/**
 * Broadcast message to all connected clients
 */
export function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}
