import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { NextRequest } from 'next/server';
import path from 'path';
import { rename, stat } from 'fs/promises';
import { addDictionary } from '@/lib/db';
import { EventEmitter } from 'events';

const DICTIONARIES_PATH = process.env.DICTIONARIES_PATH || '/app/volumes/dictionaries';
const TUS_UPLOAD_PATH = process.env.TUS_UPLOAD_PATH || '/tmp/tus-uploads';

// Hashcat-compatible dictionary file extensions
const ALLOWED_EXTENSIONS = [
  '.txt',
  '.dic',
  '.lst',
  '.gz',
  '.bz2',
  '.lzma',
  '.xz',
  '.7z',
  '.zip',
];

// Create tus server with file store
const tusServer = new Server({
  path: '/api/dictionaries/tus',
  datastore: new FileStore({ directory: TUS_UPLOAD_PATH }),

  // Called when upload is complete
  async onUploadFinish(req: any, upload: any) {
    try {
      const filename = upload.metadata?.filename || upload.id;

      // Validate file extension
      const ext = path.extname(filename).toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        console.error(`Invalid file type for ${filename}. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
        return {};
      }

      // Move file from temp tus storage to dictionaries folder
      const tusFilePath = path.join(TUS_UPLOAD_PATH, upload.id);
      const finalPath = path.join(DICTIONARIES_PATH, filename);

      await rename(tusFilePath, finalPath);

      // Get file stats and add to database
      const stats = await stat(finalPath);
      addDictionary(filename, finalPath, stats.size);

      console.log(`Dictionary uploaded successfully: ${filename} (${stats.size} bytes)`);
    } catch (error) {
      console.error('Error processing completed upload:', error);
    }

    return {};
  },
});

// Convert NextRequest to Node.js IncomingMessage-like object for tus
function convertNextRequestToNode(req: NextRequest) {
  const url = new URL(req.url);

  // Create an EventEmitter-based object to match IncomingMessage interface
  const emitter = new EventEmitter();

  // Add IncomingMessage properties
  Object.assign(emitter, {
    method: req.method,
    url: url.pathname + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    body: req.body,
  });

  return emitter as any;
}

// Convert Node.js ServerResponse to NextResponse-compatible
function createNodeResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 204;
  let body = '';

  // Create an EventEmitter-based response object to match ServerResponse interface
  const res = new EventEmitter();

  // Add ServerResponse methods
  Object.assign(res, {
    setHeader(key: string, value: string | string[]) {
      headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
    },
    getHeader(key: string) {
      return headers[key.toLowerCase()];
    },
    removeHeader(key: string) {
      delete headers[key.toLowerCase()];
    },
    hasHeader(key: string) {
      return key.toLowerCase() in headers;
    },
    writeHead(code: number, headersObj?: Record<string, string>) {
      statusCode = code;
      if (headersObj) {
        Object.entries(headersObj).forEach(([key, value]) => {
          headers[key.toLowerCase()] = value;
        });
      }
    },
    write(chunk: any) {
      body += chunk;
    },
    end(chunk?: any) {
      if (chunk) body += chunk;
    },
    getHeaders() {
      return headers;
    },
    get statusCode() {
      return statusCode;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
  });

  return { res: res as any, getResponse: () => ({ statusCode, headers, body }) };
}

export async function GET(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(response.body || null, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function POST(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(response.body || null, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function PATCH(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(response.body || null, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function HEAD(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(null, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function OPTIONS(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(null, {
    status: response.statusCode,
    headers: response.headers,
  });
}

export async function DELETE(req: NextRequest) {
  const nodeReq = convertNextRequestToNode(req);
  const { res, getResponse } = createNodeResponse();

  await tusServer.handle(nodeReq, res);

  const response = getResponse();
  return new Response(null, {
    status: response.statusCode,
    headers: response.headers,
  });
}
