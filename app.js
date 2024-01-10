const express = require('express');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Adicionando CSS para estilos básicos
const styles = `
  <style>
    body {
      font-family: 'Arial', sans-serif;
      background-color: #f5f5f5;
      color: #333;
      text-align: center;
      margin: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .info-container {
      padding: 20px;
      border-radius: 10px;
      background-color: rgba(255, 255, 255, 0.8);
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      width: 80%;
    }
    .text-info {
      flex: 1;
      text-align: left;
      padding: 0 20px;
    }
    img {
      max-width: 100%;
      border-radius: 5px;
    }
    body:before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: -1;
      filter: blur(10px);
      opacity: 0.5;
    }
  </style>
`;

// Função para autenticar no Spotify
async function authenticateSpotify() {
  try {
     	const clientId = 'c38a85957a6045e1887789d3c5f4fb93';
	const clientSecret = '3f434f2cea2d42598fa326c43c55cf86';
	const refreshToken = 'AQCd9xv-tIb3rYW8e5l3XGJEWXmZx1Ad16D8Z28WSmENFpa8-UMd6yE49uQAptcNME04Oa7iWVRhGpQzFcW0Ld-DE9mnRwiAM-GuO1-BNe54IOCNc_lLJHc-kEI6kM06zQw';

    const authResponse = await axios.post('https://accounts.spotify.com/api/token', null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      auth: {
        username: clientId,
        password: clientSecret,
      },
    });

    return authResponse.data.access_token;
  } catch (error) {
    throw new Error('Erro na autenticação do Spotify');
  }
}

// Função para obter a reprodução atual
async function getCurrentPlayback(accessToken) {
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error) {
    throw new Error('Erro ao obter a reprodução atual do Spotify');
  }
}

// Função para obter detalhes do artista
async function getArtistDetails(accessToken, artistIds) {
  try {
    const artistResponse = await axios.get(`https://api.spotify.com/v1/artists`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      params: {
        ids: artistIds,
      },
    });

    return artistResponse.data.artists[0].images[0].url;
  } catch (error) {
    throw new Error('Erro ao obter detalhes do artista do Spotify');
  }
}

// Função para obter detalhes do podcast
async function getPodcastDetails(accessToken, showId) {
  try {
    const showResponse = await axios.get(`https://api.spotify.com/v1/shows/${showId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    return showResponse.data.images[0].url;
  } catch (error) {
    throw new Error('Erro ao obter detalhes do podcast do Spotify');
  }
}

// Função para converter milissegundos em formato de hora (mm:ss)
function msToTime(duration) {
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);

  minutes = (minutes < 10) ? `0${minutes}` : minutes;
  seconds = (seconds < 10) ? `0${seconds}` : seconds;

  return `${minutes}:${seconds}`;
}

// Função para renderizar a página
function renderPage(res, musicInfo) {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Spotify Now Playing</title>
      ${styles}
      <script>
        document.addEventListener("DOMContentLoaded", function() {
          const body = document.querySelector("body");
          body.style.backgroundImage = \`url('${musicInfo.artistImageUrl}')\`;

          // Atualizar o tempo de reprodução a cada segundo
          setInterval(async function() {
            const response = await fetch('/music');
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const currentTimeElement = doc.querySelector("#currentTime");
            const newTime = currentTimeElement.textContent;
            document.querySelector("#currentTime").textContent = newTime;
          }, 1000);
        });
      </script>
    </head>
    <body>
      <div class="info-container">
        <img src="${musicInfo.albumImageUrl}" alt="Capa do Álbum">
        <div class="text-info">
          <h2>${musicInfo.song}</h2>
          <p>Artista: ${musicInfo.artist}</p>
          <p>Álbum: ${musicInfo.album}</p>
          <p>Tempo de Reprodução: <span id="currentTime">${msToTime(musicInfo.progressMs)}</span></p>
        </div>
      </div>
    </body>
    </html>
  `);
}

app.get('/music', async (req, res) => {
  try {
    const accessToken = await authenticateSpotify();
    const response = await getCurrentPlayback(accessToken);

    // Lógica para extrair informações
    let musicInfo;

    if (response.currently_playing_type === 'track' && response.item) {
      const artists = response.item.artists;
      const artistIds = artists.map(artist => artist.id).join(',');

      const artistImageUrl = await getArtistDetails(accessToken, artistIds);

      musicInfo = {
        artist: artists.map(artist => artist.name).join(', '),
        album: response.item.album.name,
        song: response.item.name,
        albumImageUrl: response.item.album.images[0].url,
        artistImageUrl: artistImageUrl,
        progressMs: response.progress_ms,
      };
    } else if (response.currently_playing_type === 'episode' && response.item) {
      const podcastImageUrl = await getPodcastDetails(accessToken, response.item.show.id);

      musicInfo = {
        type: 'episode',
        podcast: response.item.show.name,
        episode: response.item.name,
        podcastImageUrl: podcastImageUrl,
      };
    } else {
      res.status(404).json({ error: 'Tipo de reprodução não suportado ou sem item atual.' });
      return;
    }

    // Exibir informações na página
    renderPage(res, musicInfo);
  } catch (error) {
    console.error('###Erro ao fazer solicitação:', error);
    res.status(500).json({ error: 'Erro ao obter informações da música' });
  }
});

app.listen(PORT, () => {
  console.log(`##Servidor a correr em http://localhost:${PORT}`);
});
