import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getBcvRates, getBcvHistory, getTrmRates, getBrlRates, Currency, RequestOptions } from './index';

const SERVER_NAME = 'bcv-exchange-rate';
const SERVER_VERSION = '1.3.0';

const CURRENCY_CODES = ['USD', 'EUR', 'CNY', 'TRY', 'RUB'] as const;

/** Shared per-call options accepted by every tool. */
const sharedOptionsShape = {
    timeout: z.number().int().min(1).optional().describe('Request timeout in milliseconds. Default: 25000.'),
    retries: z.number().int().min(0).optional().describe('Retry attempts on transient failures. Default: 2.'),
    cacheTtlMs: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Fresh-cache TTL in milliseconds. 0 disables caching. Default: 60000.'),
};

/**
 * The BCV portal frequently serves an incomplete TLS certificate chain, so the
 * MCP tools default to `strictSSL: false` (overridable per call). The library
 * itself keeps its strict default.
 */
const bcvSslShape = {
    strictSSL: z
        .boolean()
        .optional()
        .describe(
            'Validate TLS certificates. Default here: false, because the BCV portal serves an incomplete certificate chain.'
        ),
};

type SharedToolArgs = {
    timeout?: number;
    retries?: number;
    cacheTtlMs?: number;
};

function toRequestOptions(args: SharedToolArgs): RequestOptions {
    const options: RequestOptions = {};
    if (args.timeout !== undefined) options.timeout = args.timeout;
    if (args.retries !== undefined) options.retries = args.retries;
    if (args.cacheTtlMs !== undefined) options.cacheTtlMs = args.cacheTtlMs;
    return options;
}

function jsonResult(payload: unknown) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

function errorResult(error: unknown) {
    const err = error as Error;
    return {
        isError: true,
        content: [{ type: 'text' as const, text: `${err.name ?? 'Error'}: ${err.message}` }],
    };
}

/** Builds the MCP server with the four exchange-rate tools registered. */
export function createServer(): McpServer {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

    server.registerTool(
        'get_bcv_rates',
        {
            title: 'Tasas oficiales BCV (Venezuela)',
            description:
                'Obtiene las tasas de cambio oficiales del Banco Central de Venezuela (VES por unidad de divisa): ' +
                'tasas actuales por moneda y, opcionalmente, el histórico informativo del sistema bancario.',
            inputSchema: {
                currencies: z
                    .array(z.enum(CURRENCY_CODES))
                    .optional()
                    .describe('Códigos de moneda a incluir. Default: todas (USD, EUR, CNY, TRY, RUB).'),
                includeCurrent: z.boolean().optional().describe('Incluir tasas actuales. Default: true.'),
                includeHistory: z.boolean().optional().describe('Incluir histórico bancario. Default: true.'),
                days: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe('Ventana de días del histórico. Default: 7.'),
                page: z.number().int().min(0).optional().describe('Página del histórico. Default: 0.'),
                ...bcvSslShape,
                ...sharedOptionsShape,
            },
        },
        async ({ currencies, includeCurrent, includeHistory, days, page, strictSSL, ...shared }) => {
            try {
                const result = await getBcvRates({
                    ...toRequestOptions(shared),
                    currencies: currencies as Currency[] | undefined,
                    includeCurrent,
                    includeHistory,
                    days,
                    page,
                    strictSSL: strictSSL ?? false,
                });
                return jsonResult(result);
            } catch (error) {
                return errorResult(error);
            }
        }
    );

    server.registerTool(
        'get_bcv_history',
        {
            title: 'Histórico bancario BCV (Venezuela)',
            description:
                'Obtiene únicamente las tasas informativas históricas del sistema bancario venezolano ' +
                '(compra/venta por banco y fecha) publicadas por el BCV.',
            inputSchema: {
                days: z.number().int().min(1).optional().describe('Ventana de días hacia atrás. Default: 7.'),
                page: z.number().int().min(0).optional().describe('Página del listado. Default: 0.'),
                ...bcvSslShape,
                ...sharedOptionsShape,
            },
        },
        async ({ days, page, strictSSL, ...shared }) => {
            try {
                const result = await getBcvHistory({
                    ...toRequestOptions(shared),
                    days,
                    page,
                    strictSSL: strictSSL ?? false,
                });
                return jsonResult(result);
            } catch (error) {
                return errorResult(error);
            }
        }
    );

    server.registerTool(
        'get_trm_rates',
        {
            title: 'TRM oficial (Colombia)',
            description:
                'Obtiene la Tasa Representativa del Mercado (COP por USD) desde la API de datos abiertos ' +
                'del gobierno de Colombia (datos.gov.co).',
            inputSchema: {
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(1000)
                    .optional()
                    .describe('Máximo de registros (1-1000). Default: 10.'),
                offset: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe('Desplazamiento de paginación. Default: 0.'),
                ...sharedOptionsShape,
            },
        },
        async ({ limit, offset, ...shared }) => {
            try {
                const result = await getTrmRates({ ...toRequestOptions(shared), limit, offset });
                return jsonResult(result);
            } catch (error) {
                return errorResult(error);
            }
        }
    );

    server.registerTool(
        'get_brl_rates',
        {
            title: 'Dólar PTAX oficial (Brasil)',
            description:
                'Obtiene la cotización oficial USD/BRL (dólar PTAX, compra y venta) desde la API de datos ' +
                'abiertos del Banco Central do Brasil. Devuelve null si la ventana no contiene cotizaciones.',
            inputSchema: {
                days: z.number().int().min(1).optional().describe('Ventana de días hacia atrás. Default: 7.'),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(1000)
                    .optional()
                    .describe('Máximo de registros (1-1000). Default: toda la ventana.'),
                offset: z
                    .number()
                    .int()
                    .min(0)
                    .optional()
                    .describe('Registros a saltar para paginar. Default: 0.'),
                ...sharedOptionsShape,
            },
        },
        async ({ days, limit, offset, ...shared }) => {
            try {
                const result = await getBrlRates({ ...toRequestOptions(shared), days, limit, offset });
                return jsonResult(result);
            } catch (error) {
                return errorResult(error);
            }
        }
    );

    return server;
}

/** Starts the server over stdio. Invoked by the `bcv-exchange-rate` bin. */
export async function main(): Promise<void> {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
