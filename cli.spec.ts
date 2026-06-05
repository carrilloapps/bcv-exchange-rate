import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { parseArgs, runCli, HELP, CliIo } from './cli';
import { clearCache } from './index';

const mock = new MockAdapter(axios);

function makeIo(): { io: CliIo; out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { io: { out: (t) => out.push(t), err: (t) => err.push(t) }, out, err };
}

describe('cli', () => {
    afterEach(() => {
        mock.reset();
        clearCache();
    });

    describe('parseArgs', () => {
        it('parses a command with value flags', () => {
            const parsed = parseArgs(['trm', '--limit', '5', '--offset=2']);
            expect(parsed.command).toBe('trm');
            expect(parsed.flags).toEqual({ limit: '5', offset: '2' });
            expect(parsed.errors).toEqual([]);
        });

        it('parses boolean flags and short aliases', () => {
            expect(parseArgs(['-h']).flags['help']).toBe(true);
            expect(parseArgs(['-v']).flags['version']).toBe(true);
            expect(parseArgs(['bcv', '--no-history', '--strict-ssl']).flags).toEqual({
                'no-history': true,
                'strict-ssl': true,
            });
        });

        it('reports unknown commands, unknown flags and missing values', () => {
            expect(parseArgs(['foo']).errors[0]).toContain('Comando desconocido');
            expect(parseArgs(['bcv', '--bogus']).errors[0]).toContain('Flag desconocido');
            expect(parseArgs(['trm', '--limit']).errors[0]).toContain('requiere un valor');
            expect(parseArgs(['bcv', 'extra']).errors[0]).toContain('Argumento inesperado');
        });
    });

    describe('runCli', () => {
        it('prints help with --help and the version with --version', async () => {
            const help = makeIo();
            expect(await runCli(['--help'], help.io)).toBe(0);
            expect(help.out[0]).toBe(HELP);

            const version = makeIo();
            expect(await runCli(['--version'], version.io)).toBe(0);
            expect(version.out[0]).toMatch(/^\d+\.\d+\.\d+$/);
        });

        it('defaults to the bcv command when no command is given', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(200, '<div id="dolar"><strong>563,28</strong></div>');
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"></table>'
            );
            const { io, out } = makeIo();
            expect(await runCli([], io)).toBe(0);
            const payload = JSON.parse(out[0]);
            expect(payload.current.USD).toBe(563.28);
        });

        it('runs bcv with currency filtering and no history', async () => {
            mock.onGet('https://www.bcv.org.ve/').reply(
                200,
                '<div id="dolar"><strong>563,28</strong></div><div id="euro"><strong>654,86</strong></div>'
            );
            const { io, out } = makeIo();
            expect(await runCli(['bcv', '--currencies', 'usd', '--no-history'], io)).toBe(0);
            const payload = JSON.parse(out[0]);
            expect(payload.current).toEqual({ USD: 563.28 });
            expect(payload.status.history).toBe('skipped');
        });

        it('runs the history command', async () => {
            mock.onGet(/tasas-informativas-sistema-bancario/).reply(
                200,
                '<table class="views-table"><tbody><tr><td>04-06-2026</td><td>Banesco</td><td>594,71</td><td>625,72</td></tr></tbody></table>'
            );
            const { io, out } = makeIo();
            expect(await runCli(['history', '--days', '3'], io)).toBe(0);
            expect(JSON.parse(out[0]).history[0].bank).toBe('Banesco');
        });

        it('runs the trm command', async () => {
            mock.onGet(/datos.gov.co/).reply(200, [
                { valor: '3565.32', unidad: 'COP', vigenciahasta: '2026-06-05' },
            ]);
            const { io, out } = makeIo();
            expect(await runCli(['trm', '--limit', '1'], io)).toBe(0);
            expect(JSON.parse(out[0]).current.value).toBe(3565.32);
        });

        it('runs the brl command', async () => {
            mock.onGet(/olinda\.bcb\.gov\.br/).reply(200, {
                value: [
                    {
                        cotacaoCompra: 5.0409,
                        cotacaoVenda: 5.0415,
                        dataHoraCotacao: '2026-06-03 13:06:26.54',
                    },
                ],
            });
            const { io, out } = makeIo();
            expect(await runCli(['brl', '--days', '7'], io)).toBe(0);
            expect(JSON.parse(out[0]).current.sell).toBe(5.0415);
        });

        it('returns 1 with parse errors on stderr', async () => {
            const { io, err } = makeIo();
            expect(await runCli(['foo'], io)).toBe(1);
            expect(err[0]).toContain('Comando desconocido');
            expect(err[err.length - 1]).toContain('--help');
        });

        it('returns 1 when flags are not integers or currencies are invalid', async () => {
            const bad = makeIo();
            expect(await runCli(['trm', '--limit', 'abc'], bad.io)).toBe(1);
            expect(bad.err[0]).toContain('debe ser un entero');

            const badCurrency = makeIo();
            expect(await runCli(['bcv', '--currencies', 'XYZ'], badCurrency.io)).toBe(1);
            expect(badCurrency.err[0]).toContain('Monedas no soportadas');
        });

        it('returns 1 and reports upstream failures', async () => {
            mock.onGet(/olinda\.bcb\.gov\.br/).reply(500);
            const { io, err } = makeIo();
            expect(await runCli(['brl', '--retries', '0'], io)).toBe(1);
            expect(err[0]).toContain('BrlApiError');
        });
    });
});
