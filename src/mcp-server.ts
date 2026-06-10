import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getBcvRates, getBcvHistory, getTrmRates, getBrlRates, Currency, RequestOptions } from './index';

const SERVER_NAME = 'bcv-exchange-rate';
const SERVER_VERSION = '2.0.1';

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

// --- Output schemas (unified v2 response contract) ---------------------------
// Every tool declares its exact response shape via `outputSchema`, so an AI
// client can integrate from `tools/list` alone, without reading external docs.
// The payload travels both as `structuredContent` (machine-readable) and as
// serialized JSON in the text content (backward compatibility). Tools that can
// legitimately find no data return `{ data: null }`.

const paginationSchema = z
    .object({
        limit: z
            .number()
            .int()
            .nullable()
            .describe('Tamaño de página solicitado. null: no solicitado o no aplica.'),
        offset: z
            .number()
            .int()
            .nullable()
            .describe('Desplazamiento solicitado. null: la fuente pagina por página.'),
        page: z
            .number()
            .int()
            .nullable()
            .describe('Página solicitada. null: la fuente pagina por limit/offset.'),
        count: z.number().int().describe('Registros devueltos en esta respuesta.'),
        hasMore: z
            .boolean()
            .nullable()
            .describe('Si hay más registros aguas arriba. null: la fuente no puede saberlo.'),
    })
    .describe(
        'Bloque de paginación unificado: idéntico en las tres fuentes, con null donde el paradigma no aplica.'
    );

const dateRangeSchema = z
    .object({
        startDate: z.string().describe('Inicio de la ventana, ISO 8601 (YYYY-MM-DD).'),
        endDate: z.string().describe('Fin de la ventana, ISO 8601 (YYYY-MM-DD).'),
    })
    .nullable()
    .describe('Ventana de días aplicada. null cuando no se aplicó ventana.');

const strictSslEchoSchema = z
    .boolean()
    .describe(
        'Política TLS efectiva de la llamada. false = la data se obtuvo SIN validación de certificados.'
    );

const bcvDataSchema = z.object({
    current: z
        .record(z.string(), z.number())
        .describe(
            'Tasas oficiales actuales (VES por unidad), indexadas por código ISO: USD, EUR, CNY, TRY, RUB.'
        ),
    effectiveDate: z.string().describe('Fecha de vigencia de current, ISO 8601 cuando el portal la expone.'),
    history: z
        .array(
            z.object({
                date: z.string().describe('Fecha del registro, ISO 8601 (YYYY-MM-DD).'),
                bank: z.string().describe('Institución bancaria.'),
                buy: z.number().nullable().describe('Tasa de compra. null si no pudo parsearse.'),
                sell: z.number().nullable().describe('Tasa de venta. null si no pudo parsearse.'),
            })
        )
        .describe('Tasas informativas históricas del sistema bancario.'),
    pagination: paginationSchema,
    range: dateRangeSchema,
    strictSSL: strictSslEchoSchema,
    status: z
        .object({
            current: z.enum(['ok', 'skipped', 'failed']),
            history: z.enum(['ok', 'skipped', 'failed']),
        })
        .describe('Estado por sección para detectar fallos parciales sin perder la sección sana.'),
});

const bcvHistoryDataSchema = bcvDataSchema.pick({ history: true, pagination: true, range: true });

const trmDataSchema = z
    .object({
        current: z.object({
            value: z.number().describe('TRM vigente, COP por USD.'),
            unit: z.string().describe('Unidad monetaria (COP).'),
            validityDate: z.string().describe('Fecha de vigencia.'),
        }),
        history: z.array(
            z.object({
                value: z.number(),
                validityDate: z.string(),
            })
        ),
        pagination: paginationSchema,
        range: dateRangeSchema,
        strictSSL: strictSslEchoSchema,
    })
    .nullable()
    .describe('null cuando la API responde sin registros (no es un error).');

const brlDataSchema = z
    .object({
        current: z.object({
            buy: z.number().describe('cotacaoCompra: BRL por USD.'),
            sell: z.number().describe('cotacaoVenda: BRL por USD.'),
            dateTime: z.string().describe('dataHoraCotacao (YYYY-MM-DD HH:mm:ss.SSS).'),
        }),
        history: z.array(
            z.object({
                buy: z.number(),
                sell: z.number(),
                dateTime: z.string(),
            })
        ),
        pagination: paginationSchema,
        range: dateRangeSchema,
        strictSSL: strictSslEchoSchema,
    })
    .nullable()
    .describe('null cuando la ventana no contiene cotizaciones (fines de semana/feriados; no es un error).');

function jsonResult(payload: unknown) {
    return {
        content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
        structuredContent: { data: payload },
    };
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
                'tasas actuales por moneda y, opcionalmente, el histórico informativo del sistema bancario. ' +
                'La respuesta llega en structuredContent.data (y como JSON en el texto). Si una sección falla, ' +
                'la otra se entrega igual con status.<sección> = "failed". Los errores se reportan con isError: true; ' +
                'ante fallo de certificado TLS el mensaje recomienda reintentar con strictSSL: false.',
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
            outputSchema: { data: bcvDataSchema },
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
                '(compra/venta por banco y fecha) publicadas por el BCV. La respuesta llega en ' +
                'structuredContent.data; pagination.hasMore indica si el portal tiene más páginas (usar page+1).',
            inputSchema: {
                days: z.number().int().min(1).optional().describe('Ventana de días hacia atrás. Default: 7.'),
                page: z.number().int().min(0).optional().describe('Página del listado. Default: 0.'),
                ...bcvSslShape,
                ...sharedOptionsShape,
            },
            outputSchema: { data: bcvHistoryDataSchema },
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
                'del gobierno de Colombia (datos.gov.co). La respuesta llega en structuredContent.data; ' +
                'data es null cuando la API responde sin registros (no es un error).',
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
                days: z
                    .number()
                    .int()
                    .min(1)
                    .optional()
                    .describe('Ventana de días hacia atrás. Default: sin filtro de fecha.'),
                ...sharedOptionsShape,
            },
            outputSchema: { data: trmDataSchema },
        },
        async ({ limit, offset, days, ...shared }) => {
            try {
                const result = await getTrmRates({ ...toRequestOptions(shared), limit, offset, days });
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
                'abiertos del Banco Central do Brasil. La respuesta llega en structuredContent.data; data es ' +
                'null cuando la ventana no contiene cotizaciones — fines de semana o feriados — (no es un error).',
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
            outputSchema: { data: brlDataSchema },
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
