/** User-facing Buffer errors. The product UI is Spanish; these strings are the source of truth. */
export const BUFFER_MSG = {
  missing:
    "Falta la clave de Buffer. Pégala en Integraciones (Buffer → Ajustes → API) o, si el servidor tiene BUFFER_API_KEY, pulsa «Usar clave del servidor».",
  unauthorized:
    "La clave de Buffer no es válida o expiró. Genera una nueva en Buffer → Ajustes → API y vuelve a conectarla en Integraciones.",
  rate: "Buffer limitó las peticiones de tu plan. Espera unos minutos e inténtalo de nuevo.",
  network: "No se pudo contactar con Buffer. Inténtalo de nuevo en unos minutos.",
  reconnect: "La sesión de Buffer caducó. Vuelve a conectar la cuenta en Integraciones.",
  oauthMissing:
    "OAuth de Buffer no está configurado. Pega una clave de API, o define BUFFER_CLIENT_ID y BUFFER_CLIENT_SECRET en el servidor.",
  noChannels:
    "No hay canales conectados en esta organización de Buffer. Conecta una red en publish.buffer.com y vuelve a probar.",
  pickChannel: "Elige al menos un canal de Buffer.",
  emptyContent:
    "No hay contenido pendiente. Añade un borrador en Marketing o una imagen/video con URL pública en la galería.",
  noText: "Escribe un texto o adjunta una imagen o un video.",
  badTime: "Elige una fecha y hora válidas.",
  envMissing: "BUFFER_API_KEY no está configurada en el servidor.",
  denied: "Cancelaste la autorización de Buffer.",
  oauthExpired: "El enlace de Buffer caducó. Vuelve a pulsar Conectar con Buffer.",
  oauthState: "No se pudo verificar la conexión con Buffer. Inténtalo de nuevo desde Integraciones.",
} as const;

export function humanizeBufferMessage(raw: string): string {
  const m = raw.toLowerCase();
  if (!raw.trim()) return "Buffer no devolvió detalle del error.";
  if (/channel not found/.test(m))
    return "Canal de Buffer no encontrado. Actualiza los canales en Integraciones.";
  if (/queue.*(full|limit)|limit.*queue/.test(m))
    return "La cola de este canal en Buffer está llena. Vacía la cola o elige otra hora.";
  if (/locked/.test(m))
    return "Este canal está bloqueado en Buffer: el plan no incluye tantos perfiles.";
  if (/disconnected/.test(m))
    return "Este canal está desconectado en Buffer. Vuelve a vincularlo en buffer.com.";
  if (/rate limit|too many requests/.test(m)) return BUFFER_MSG.rate;
  if (/unauthor|invalid api key|invalid token|forbidden/.test(m)) return BUFFER_MSG.unauthorized;
  if (/notification|personal profile|facebook group/.test(m))
    return "Ese perfil de Buffer solo admite recordatorio (no publicación automática). Cámbialo a un perfil profesional o de página.";
  if (/dueat|in the future|past/.test(m))
    return "Buffer rechazó la hora: tiene que ser futura. Elige unos minutos más adelante.";
  return `No se pudo enviar a Buffer: ${raw}`;
}
