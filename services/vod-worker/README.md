# DeHax VOD Worker
Serviço separado para a ferramenta web de download. Ele precisa rodar em um host de containers (Cloud Run, Railway, Render, Fly.io etc.), porque Netlify Functions não é adequada para VODs longos + FFmpeg.

Variáveis: `VOD_INTERNAL_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` e opcional `VOD_MAX_FILESIZE`.

A versão web aceita YouTube, Twitch e Kick e mantém qualidade, MP4/melhor/MP3, recorte, legendas e thumbnail. A opção de usar cookies do navegador continua exclusiva do app Desktop; o site nunca deve pedir ou armazenar cookies de sessão do navegador do usuário.
