# VortexGG — Transcript Server

Servidor Express minimalista (sin dependencias) para guardar y servir transcripts HTML del bot de Discord.

## Endpoints

| Método | Ruta        | Descripción                          |
|--------|-------------|--------------------------------------|
| GET    | `/`         | Health check                         |
| POST   | `/upload`   | Sube un transcript `{ hash, html }`  |
| GET    | `/t/:hash`  | Visualiza el transcript              |

## Variables de entorno

| Variable   | Default          | Descripción                        |
|------------|------------------|------------------------------------|
| `PORT`     | `8080`           | Puerto del servidor                |
| `DATA_DIR` | `./transcripts`  | Carpeta donde se guardan los HTML  |

## Deploy en Railway

1. Subí esta carpeta a un repo de GitHub
2. Conectá el repo en Railway
3. Railway detecta el `package.json` y corre `npm start` automáticamente
4. El `PORT` lo asigna Railway automáticamente (no hace falta setearlo)

## Variable en el bot (.env)

```
TRANSCRIPT_SERVER_URL=https://bot-soporte-production-5c87.up.railway.app
```
