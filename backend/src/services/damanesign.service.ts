import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';

const BASE_URL = process.env.DAMANESIGN_API_URL || 'https://api-recette.damanesign.ma';
const API_KEY = process.env.DAMANESIGN_API_KEY || '';

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'x-api-key': API_KEY,
  },
});

export interface DamanesignMemberInput {
  type: 'signer' | 'validator';
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  authenticationMode?: 'email' | 'sms' | 'none';
  signatureType?: 'simple' | 'advanced' | 'qualified';
  position?: number;
  fields?: {
    file: string;
    page: number;
    position: string;
    type: string;
  }[];
}

export interface DamanesignTransactionInput {
  name: string;
  description?: string;
  type?: 'simple' | 'advanced' | 'qualified' | 'hybrid';
  deliveryMode?: 'email' | 'sms' | 'none';
  authenticationMode?: 'email' | 'sms' | 'hybrid' | 'none';
  ordered?: boolean;
  members: DamanesignMemberInput[];
  expiresAt?: string;
}

export interface DamanesignFileOutput {
  id: string;
  name: string;
  pages: number;
  contentType: string;
  type: string;
  width: number;
  height: number;
}

export interface DamanesignTransactionOutput {
  id: string;
  name: string;
  status: string;
  members: {
    id: string;
    type: string;
    firstname: string;
    lastname: string;
    email: string;
    phone: string;
    status: string;
    fields: any[];
  }[];
  files: DamanesignFileOutput[];
}

/**
 * Upload a PDF file to DamaneSign.
 */
export async function uploadFile(
  pdfBuffer: Buffer,
  fileName: string
): Promise<DamanesignFileOutput> {
  const form = new FormData();
  form.append('file', pdfBuffer, {
    filename: fileName,
    contentType: 'application/pdf',
  });

  const res = await client.post('/files/upload', form, {
    params: {
      contentType: 'application/pdf',
      type: 'signable',
    },
    headers: {
      ...form.getHeaders(),
      'x-api-key': API_KEY,
    },
  });

  return res.data;
}

/**
 * Create a new transaction (draft).
 */
export async function createTransaction(
  input: DamanesignTransactionInput
): Promise<DamanesignTransactionOutput> {
  const res = await client.post('/transactions', input);
  return res.data;
}

/**
 * Start a draft transaction (send invitations).
 */
export async function startTransaction(transactionId: string): Promise<void> {
  await client.post(`/transactions/${transactionId}/start`);
}

/**
 * Get the signing URL for a specific member.
 */
export async function getSignatureUrl(
  transactionId: string,
  memberId: string
): Promise<string> {
  const res = await client.get(
    `/transactions/${transactionId}/member/${memberId}/url`
  );
  // The API returns the URL as a plain string or inside data
  return typeof res.data === 'string' ? res.data : res.data.url || res.data;
}

/**
 * Get transaction details (to check status).
 */
export async function getTransaction(
  transactionId: string
): Promise<DamanesignTransactionOutput> {
  const res = await client.get(`/transactions/${transactionId}`);
  return res.data;
}

/**
 * Download a signed file's binary content.
 */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await client.get(`/files/${fileId}/download`, {
    responseType: 'arraybuffer',
  });
  return Buffer.from(res.data);
}
