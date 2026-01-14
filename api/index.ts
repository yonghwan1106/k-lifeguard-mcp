/**
 * K-LifeGuard MCP Server
 * 지능형 응급 의료 코디네이터
 *
 * Vercel Serverless Function - Streamable HTTP MCP Server
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Lib imports
import type { MCPRequest } from './lib/types';
import { TOOLS } from './lib/constants';
import { LANDING_HTML } from './lib/landing';
import {
  handleSearchEmergency,
  handleActivateEmergency,
  handleGetStatus,
  handleFindPharmacy
} from './lib/tools';

// ============================================================================
// MCP Request Handler
// ============================================================================

function handleMCPRequest(request: MCPRequest): unknown {
  const { method, params, id } = request;
  const protocolVersion = (params?.protocolVersion as string) || '2024-11-05';

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          serverInfo: {
            name: 'k-lifeguard-mcp',
            version: '1.1.0',
            description: 'K-LifeGuard: 지능형 응급 의료 코디네이터'
          },
          capabilities: {
            tools: { listChanged: false },
          },
        },
      };

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id, result: {} };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call':
      return null; // 비동기 처리 필요

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`,
        },
      };
  }
}

// ============================================================================
// Tool Call Handler
// ============================================================================

async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  id: number | string | undefined
): Promise<unknown> {
  try {
    let result: unknown;

    switch (toolName) {
      case 'lifeguard_search_emergency':
        result = await handleSearchEmergency(args as unknown as Parameters<typeof handleSearchEmergency>[0]);
        break;
      case 'lifeguard_activate_emergency':
        result = await handleActivateEmergency(args as unknown as Parameters<typeof handleActivateEmergency>[0]);
        break;
      case 'lifeguard_get_status':
        result = await handleGetStatus(args as unknown as Parameters<typeof handleGetStatus>[0]);
        break;
      case 'lifeguard_find_pharmacy':
        result = await handleFindPharmacy(args as unknown as Parameters<typeof handleFindPharmacy>[0]);
        break;
      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Unknown tool: ${toolName}`,
          },
        };
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      },
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

// ============================================================================
// Vercel Handler
// ============================================================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse | void> {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, x-session-id, Accept');

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;

  // GET / → 랜딩 페이지
  if (req.method === 'GET' && (path === '/' || path === '')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(LANDING_HTML);
  }

  // GET /health 또는 /mcp → JSON 상태
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'ok',
      name: 'k-lifeguard-mcp',
      version: '1.1.0',
      description: 'K-LifeGuard: 지능형 응급 의료 코디네이터',
      tools: TOOLS.map(t => t.name),
      endpoints: {
        mcp: 'POST /',
        health: 'GET /health',
        landing: 'GET /'
      }
    });
  }

  // DELETE → 세션 종료
  if (req.method === 'DELETE') {
    return res.status(200).json({ success: true, message: 'Session closed' });
  }

  // POST → MCP 요청 처리
  if (req.method === 'POST') {
    try {
      const mcpReq = req.body as MCPRequest;

      if (!mcpReq || !mcpReq.jsonrpc || !mcpReq.method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid Request' },
        });
      }

      // tools/call은 비동기 처리
      if (mcpReq.method === 'tools/call') {
        const toolName = (mcpReq.params?.name as string) || '';
        const toolArgs = (mcpReq.params?.arguments as Record<string, unknown>) || {};
        const result = await handleToolCall(toolName, toolArgs, mcpReq.id);
        return res.status(200).json(result);
      }

      // 다른 MCP 메서드
      const response = handleMCPRequest(mcpReq);
      return res.status(200).json(response);
    } catch (error) {
      return res.status(500).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
