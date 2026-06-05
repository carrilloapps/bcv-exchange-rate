import { getBcvRates, getBcvHistory, getTrmRates, getBrlRates, Currency } from './index';

const VERSION = '1.2.0';

export const HELP = `bcv-exchange-rate v${VERSION} — tasas de cambio oficiales de Venezuela, Colombia y Brasil

Uso:
  bcv-exchange-rate [comando] [flags]

Comandos:
  bcv        Tasas oficiales del BCV (Venezuela) y su histórico bancario. Es el
             comando por defecto: ejecutar sin comando equivale a "bcv".
  history    Solo el histórico bancario del BCV (compra/venta por banco).
  trm        Tasa Representativa del Mercado (Colombia).
  brl        Dólar PTAX oficial (Brasil).

Flags de bcv:
  --currencies USD,EUR   Monedas a incluir (USD, EUR, CNY, TRY, RUB). Default: todas.
  --days N               Ventana de días del histórico. Default: 7.
  --page N               Página del histórico. Default: 0.
  --no-current           Omitir las tasas actuales.
  --no-history           Omitir el histórico bancario.
  --strict-ssl           Activar validación TLS (desactivada por defecto: el portal
                         del BCV sirve una cadena de certificados incompleta).

Flags de history:
  --days N               Ventana de días hacia atrás. Default: 7.
  --page N               Página del listado. Default: 0.
  --strict-ssl           Activar validación TLS.

Flags de trm:
  --limit N              Máximo de registros (1-1000). Default: 10.
  --offset N             Desplazamiento de paginación. Default: 0.

Flags de brl:
  --days N               Ventana de días hacia atrás. Default: 7.

Flags globales:
  --timeout MS           Timeout de la petición en ms. Default: 25000.
  --retries N            Reintentos ante fallos transitorios. Default: 2.
  --help, -h             Esta ayuda.
  --version, -v          Versión.

Salida: JSON formateado por stdout (exit 0). Errores por stderr (exit 1).

Servidor MCP: sin argumentos y lanzado por un cliente MCP (Claude, Cursor, etc.)
el binario inicia automáticamente el servidor por stdio. Configuración:
  { "command": "npx", "args": ["bcv-exchange-rate"] }`;

/** Parsed command-line input: a command plus its flags. */
export interface ParsedArgs {
    command: string | null;
    flags: Record<string, string | boolean>;
    errors: string[];
}

const VALID_COMMANDS = ['bcv', 'history', 'trm', 'brl'];
const VALUE_FLAGS = ['currencies', 'days', 'page', 'limit', 'offset', 'timeout', 'retries'];
const BOOLEAN_FLAGS = ['no-current', 'no-history', 'strict-ssl', 'help', 'version'];

/** Parses raw argv (without node/bin prefix) into a command and flag map. */
export function parseArgs(argv: string[]): ParsedArgs {
    const parsed: ParsedArgs = { command: null, flags: {}, errors: [] };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '-h') {
            parsed.flags['help'] = true;
        } else if (arg === '-v') {
            parsed.flags['version'] = true;
        } else if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            const name = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
            if (BOOLEAN_FLAGS.includes(name)) {
                parsed.flags[name] = true;
            } else if (VALUE_FLAGS.includes(name)) {
                const value = eq >= 0 ? arg.slice(eq + 1) : argv[++i];
                if (value === undefined) {
                    parsed.errors.push(`El flag --${name} requiere un valor.`);
                } else {
                    parsed.flags[name] = value;
                }
            } else {
                parsed.errors.push(`Flag desconocido: --${name}`);
            }
        } else if (parsed.command === null) {
            if (VALID_COMMANDS.includes(arg)) {
                parsed.command = arg;
            } else {
                parsed.errors.push(
                    `Comando desconocido: ${arg}. Comandos válidos: ${VALID_COMMANDS.join(', ')}.`
                );
            }
        } else {
            parsed.errors.push(`Argumento inesperado: ${arg}`);
        }
    }

    return parsed;
}

function toInt(value: string | boolean | undefined, name: string, errors: string[]): number | undefined {
    if (value === undefined) return undefined;
    const num = Number(value);
    if (typeof value === 'boolean' || !Number.isInteger(num)) {
        errors.push(`El flag --${name} debe ser un entero, se recibió: ${String(value)}`);
        return undefined;
    }
    return num;
}

function toCurrencies(value: string | boolean | undefined, errors: string[]): Currency[] | undefined {
    if (value === undefined || typeof value === 'boolean') return undefined;
    const valid: Currency[] = ['USD', 'EUR', 'CNY', 'TRY', 'RUB'];
    const list = value.split(',').map((c) => c.trim().toUpperCase());
    const invalid = list.filter((c) => !valid.includes(c as Currency));
    if (invalid.length) {
        errors.push(`Monedas no soportadas: ${invalid.join(', ')}. Válidas: ${valid.join(', ')}.`);
        return undefined;
    }
    return list as Currency[];
}

/** Output sinks, injectable for tests. */
export interface CliIo {
    out: (text: string) => void;
    err: (text: string) => void;
}

/**
 * Runs the CLI for the given argv and returns the process exit code.
 * Results are printed as formatted JSON to `io.out`; failures go to `io.err`.
 */
export async function runCli(
    argv: string[],
    io: CliIo = { out: (t) => console.log(t), err: (t) => console.error(t) }
): Promise<number> {
    const { command, flags, errors } = parseArgs(argv);

    if (flags['help']) {
        io.out(HELP);
        return 0;
    }
    if (flags['version']) {
        io.out(VERSION);
        return 0;
    }

    const days = toInt(flags['days'], 'days', errors);
    const page = toInt(flags['page'], 'page', errors);
    const limit = toInt(flags['limit'], 'limit', errors);
    const offset = toInt(flags['offset'], 'offset', errors);
    const timeout = toInt(flags['timeout'], 'timeout', errors);
    const retries = toInt(flags['retries'], 'retries', errors);
    const currencies = toCurrencies(flags['currencies'], errors);

    if (errors.length > 0) {
        for (const error of errors) io.err(error);
        io.err(`Usa --help para ver la ayuda.`);
        return 1;
    }

    const shared = { timeout, retries };

    try {
        let result: unknown;
        // "bcv" is the default command: the package name already announces it.
        if (command === 'bcv' || command === null) {
            result = await getBcvRates({
                ...shared,
                currencies,
                days,
                page,
                includeCurrent: flags['no-current'] ? false : undefined,
                includeHistory: flags['no-history'] ? false : undefined,
                strictSSL: flags['strict-ssl'] === true,
            });
        } else if (command === 'history') {
            result = await getBcvHistory({
                ...shared,
                days,
                page,
                strictSSL: flags['strict-ssl'] === true,
            });
        } else if (command === 'trm') {
            result = await getTrmRates({ ...shared, limit, offset });
        } else {
            result = await getBrlRates({ ...shared, days });
        }
        io.out(JSON.stringify(result, null, 2));
        return 0;
    } catch (error) {
        const err = error as Error;
        io.err(`${err.name}: ${err.message}`);
        return 1;
    }
}
