import axios from 'axios';

export interface ExternalLogPayload {
  userId: number | null;
  action: string;
  modelType: string | null;
  modelId: number | null;
  changes: any;
  timestamp: string;
}

export const streamLogToExternalTransport = async (logData: ExternalLogPayload) => {
  const externalLogUrl = process.env.EXTERNAL_LOG_STREAM_URL;
  const externalApiKey = process.env.EXTERNAL_LOG_STREAM_API_KEY;

  // Output to standard secure logs stream (stdout/stderr is captured by host runners like Docker/systemd)
  console.log(`[Tamper-Proof Audit Log Stream] ${new Date().toISOString()} - User: ${logData.userId || 'Anonymous'} - Action: ${logData.action}`);

  if (externalLogUrl) {
    try {
      // Stream asynchronously without awaiting in a blocking manner in the main thread
      axios.post(externalLogUrl, {
        app: 'silacod-backend',
        environment: process.env.NODE_ENV || 'development',
        ...logData,
      }, {
        headers: {
          'Authorization': externalApiKey ? `Bearer ${externalApiKey}` : '',
          'Content-Type': 'application/json',
        },
        timeout: 3000, // 3s timeout to keep the app highly responsive
      }).catch((err) => {
        console.warn('[Tamper-Proof Audit Log Stream] Async background post error:', err.message);
      });
    } catch (err: any) {
      console.warn('[Tamper-Proof Audit Log Stream] Sync background post trigger error:', err.message);
    }
  }
};
