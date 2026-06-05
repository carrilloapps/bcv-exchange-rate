# Ejemplo: CLI y servidor MCP

El paquete incluye un binario que funciona como CLI en la terminal y como servidor MCP para agentes de IA.

## CLI con npx (sin instalar)

```bash
npx bcv-exchange-rate                  # tasas BCV + histórico (comando por defecto)
npx bcv-exchange-rate trm --limit 1    # TRM de Colombia
npx bcv-exchange-rate brl --days 30 --limit 5
npx bcv-exchange-rate --help
```

## En scripts de shell

La salida es JSON por stdout (exit 0); los errores van por stderr (exit 1):

```bash
# Extraer la tasa USD con jq
USD=$(npx bcv-exchange-rate bcv --no-history --currencies USD | jq '.current.USD')
echo "USD/VES: $USD"

# Fallar el script si la fuente no responde
npx bcv-exchange-rate trm --retries 0 || echo "TRM no disponible"
```

## Alias global `xrate`

```bash
npm install -g bcv-exchange-rate
xrate                 # = xrate bcv
xrate brl --days 3
```

## Como servidor MCP (Claude, Cursor)

```bash
claude mcp add bcv-exchange-rate -- npx bcv-exchange-rate
```

O en cualquier cliente con `mcpServers`:

```json
{
  "mcpServers": {
    "bcv-exchange-rate": {
      "command": "npx",
      "args": ["bcv-exchange-rate"]
    }
  }
}
```

El binario detecta el contexto automáticamente: con stdin por pipe (cliente MCP) sirve el protocolo; en una terminal interactiva actúa como CLI. Las tools expuestas y todos sus atributos están documentados en el [README](../../README.md#tools-disponibles).
