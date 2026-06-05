import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './mcp-server';
import { clearCache } from './index';

const mock = new MockAdapter(axios);

interface ToolTextResult {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
}

describe('mcp-server', () => {
    let client: Client;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
        const server = createServer();
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        client = new Client({ name: 'test-client', version: '0.0.0' });
        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
        cleanup = async () => {
            await client.close();
            await server.close();
        };
    });

    afterEach(async () => {
        await cleanup();
        mock.reset();
        clearCache();
    });

    it('exposes the four exchange-rate tools', async () => {
        const { tools } = await client.listTools();
        const names = tools.map((t) => t.name).sort();
        expect(names).toEqual(['get_bcv_history', 'get_bcv_rates', 'get_brl_rates', 'get_trm_rates']);
    });

    it('declares the documented input attributes per tool', async () => {
        const { tools } = await client.listTools();
        const schemaOf = (name: string) =>
            Object.keys(
                (tools.find((t) => t.name === name)?.inputSchema as { properties?: object }).properties ?? {}
            );

        expect(schemaOf('get_bcv_rates')).toEqual(
            expect.arrayContaining([
                'currencies',
                'includeCurrent',
                'includeHistory',
                'days',
                'page',
                'strictSSL',
                'timeout',
                'retries',
                'cacheTtlMs',
            ])
        );
        expect(schemaOf('get_bcv_history')).toEqual(
            expect.arrayContaining(['days', 'page', 'strictSSL', 'timeout', 'retries', 'cacheTtlMs'])
        );
        expect(schemaOf('get_trm_rates')).toEqual(
            expect.arrayContaining(['limit', 'offset', 'timeout', 'retries', 'cacheTtlMs'])
        );
        expect(schemaOf('get_brl_rates')).toEqual(
            expect.arrayContaining(['days', 'limit', 'offset', 'timeout', 'retries', 'cacheTtlMs'])
        );
    });

    it('declares an output schema for every tool so clients can integrate from tools/list alone', async () => {
        const { tools } = await client.listTools();
        for (const tool of tools) {
            expect(tool.outputSchema).toBeDefined();
            const out = tool.outputSchema as { properties?: { data?: object } };
            expect(out.properties?.data).toBeDefined();
            expect(tool.description?.length ?? 0).toBeGreaterThan(80);
        }
    });

    it('returns machine-readable structuredContent.data mirroring the text payload', async () => {
        mock.onGet(/olinda\.bcb\.gov\.br/).reply(200, {
            value: [
                { cotacaoCompra: 5.0409, cotacaoVenda: 5.0415, dataHoraCotacao: '2026-06-03 13:06:26.54' },
            ],
        });
        const result = (await client.callTool({
            name: 'get_brl_rates',
            arguments: { days: 7 },
        })) as ToolTextResult & { structuredContent?: { data: unknown } };
        expect(result.structuredContent?.data).toEqual(JSON.parse(result.content[0].text));
    });

    it('represents "no data" as structuredContent.data null', async () => {
        mock.onGet(/olinda\.bcb\.gov\.br/).reply(200, { value: [] });
        const result = (await client.callTool({
            name: 'get_brl_rates',
            arguments: {},
        })) as ToolTextResult & { structuredContent?: { data: unknown } };
        expect(result.isError).toBeFalsy();
        expect(result.structuredContent?.data).toBeNull();
    });

    it('get_bcv_rates returns current rates as JSON', async () => {
        mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>563,28</strong></div>');
        const result = (await client.callTool({
            name: 'get_bcv_rates',
            arguments: { includeHistory: false, currencies: ['USD'] },
        })) as ToolTextResult;
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse(result.content[0].text);
        expect(payload.current.USD).toBe(563.28);
        expect(payload.status.current).toBe('ok');
    });

    it('get_bcv_history returns bank rows as JSON', async () => {
        mock.onGet(/tasas-informativas-sistema-bancario/).reply(
            200,
            '<table class="views-table"><tbody><tr><td>04-06-2026</td><td>Banesco</td><td>594,71</td><td>625,72</td></tr></tbody></table>'
        );
        const result = (await client.callTool({
            name: 'get_bcv_history',
            arguments: { days: 7 },
        })) as ToolTextResult;
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse(result.content[0].text);
        expect(payload.history).toHaveLength(1);
        expect(payload.history[0].bank).toBe('Banesco');
    });

    it('get_trm_rates returns the Colombian TRM as JSON', async () => {
        mock.onGet(/datos.gov.co/).reply(200, [
            { valor: '3573.30', unidad: 'COP', vigenciahasta: '2026-04-21' },
        ]);
        const result = (await client.callTool({ name: 'get_trm_rates', arguments: {} })) as ToolTextResult;
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse(result.content[0].text);
        expect(payload.current.value).toBe(3573.3);
    });

    it('get_brl_rates returns the PTAX quotation as JSON', async () => {
        mock.onGet(/olinda\.bcb\.gov\.br/).reply(200, {
            value: [
                { cotacaoCompra: 5.0409, cotacaoVenda: 5.0415, dataHoraCotacao: '2026-06-03 13:06:26.54' },
            ],
        });
        const result = (await client.callTool({
            name: 'get_brl_rates',
            arguments: { days: 7 },
        })) as ToolTextResult;
        expect(result.isError).toBeFalsy();
        const payload = JSON.parse(result.content[0].text);
        expect(payload.current).toEqual({ buy: 5.0409, sell: 5.0415, dateTime: '2026-06-03 13:06:26.54' });
    });

    it('maps library errors to isError results without crashing', async () => {
        mock.onGet(/olinda\.bcb\.gov\.br/).reply(500);
        const result = (await client.callTool({
            name: 'get_brl_rates',
            arguments: { retries: 0, cacheTtlMs: 0 },
        })) as ToolTextResult;
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('BrlApiError');
    });

    it('rejects invalid arguments through the tool schema', async () => {
        const result = (await client.callTool({
            name: 'get_brl_rates',
            arguments: { days: 0 },
        })) as ToolTextResult;
        expect(result.isError).toBe(true);
    });
});
