import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

const app = express();

// ===============================
// SUPABASE CONFIGURATION
// ===============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

// ===============================
// CLOUDINARY CONFIGURATION
// ===============================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const MAX_SONG_SIZE = 10 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;

const ALLOWED_SONG_EXTENSIONS = new Set([
  'mp3',
  'wav'
]);

const ALLOWED_COVER_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp'
]);

// ===============================
// PESAPAL
// ===============================

const BASE = 'https://pay.pesapal.com/v3';

let token = null;
let expiry = 0;

async function getToken() {
  if (token && Date.now() < expiry) {
    return token;
  }

  const r = await axios.post(
    `${BASE}/api/Auth/RequestToken`,
    {
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET
    }
  );

  token = r.data.token;
  expiry = Date.now() + 240000;

  return token;
}

// ===============================
// HELPERS
// ===============================

function cleanText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function getExtension(filename) {
  const name = String(filename || '').toLowerCase();
  const parts = name.split('.');

  return parts.length > 1
    ? parts.pop()
    : '';
}

function cleanContext(value, maxLength = 500) {
  return cleanText(value, maxLength)
    .replace(/[|=\\]/g, ' ');
}

function createSongId() {
  return `pasong-${Date.now()}-${crypto.randomUUID()}`;
}

function cloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

// ===============================
// HOME / HEALTH CHECK
// ===============================

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE',
    upload: 'READY',
    database: process.env.SUPABASE_URL
      ? 'READY'
      : 'NOT CONFIGURED',
    cloudinary: cloudinaryReady()
      ? 'READY'
      : 'NOT CONFIGURED',
    songsEndpoint: '/api/songs',
    settle: '0769719539'
  });
});

// ===============================
// CREATE CLOUDINARY UPLOAD SIGNATURE
// ===============================

app.post('/api/songs/sign-upload', (req, res) => {
  try {
    if (!cloudinaryReady()) {
      return res.status(500).json({
        error: 'Cloudinary is not configured'
      });
    }

    const {
      artistName,
      songTitle,
      description,
      contractAccepted,
      fileName,
      fileSize,
      coverFileName,
      coverFileSize
    } = req.body;

    // -------------------------------
    // CONTRACT
    // -------------------------------

    if (contractAccepted !== true) {
      return res.status(400).json({
        error:
          'You must read and agree to the PASONG upload contract.'
      });
    }

    // -------------------------------
    // SONG INFORMATION
    // -------------------------------

    const artist = cleanText(artistName, 100);
    const title = cleanText(songTitle, 150);
    const details = cleanText(description, 500);

    if (!artist) {
      return res.status(400).json({
        error: 'Artist name is required.'
      });
    }

    if (!title) {
      return res.status(400).json({
        error: 'Song title is required.'
      });
    }

    // -------------------------------
    // SONG FILE VALIDATION
    // -------------------------------

    const songSize = Number(fileSize);
    const songExtension = getExtension(fileName);

    if (!Number.isFinite(songSize) || songSize <= 0) {
      return res.status(400).json({
        error: 'Invalid song file size.'
      });
    }

    if (songSize > MAX_SONG_SIZE) {
      return res.status(400).json({
        error: 'Song file must not be larger than 10 MB.'
      });
    }

    if (!ALLOWED_SONG_EXTENSIONS.has(songExtension)) {
      return res.status(400).json({
        error: 'Only MP3 and WAV songs are allowed.'
      });
    }

    // -------------------------------
    // COVER VALIDATION
    // -------------------------------

    if (coverFileName) {
      const coverSize = Number(coverFileSize);
      const coverExtension =
        getExtension(coverFileName);

      if (!Number.isFinite(coverSize) || coverSize <= 0) {
        return res.status(400).json({
          error: 'Invalid cover image size.'
        });
      }

      if (coverSize > MAX_COVER_SIZE) {
        return res.status(400).json({
          error:
            'Cover image must not be larger than 5 MB.'
        });
      }

      if (!ALLOWED_COVER_EXTENSIONS.has(coverExtension)) {
        return res.status(400).json({
          error:
            'Cover must be JPG, JPEG, PNG or WEBP.'
        });
      }
    }

    // -------------------------------
    // CREATE SONG ID
    // -------------------------------

    const songId = createSongId();
    const timestamp = Math.floor(Date.now() / 1000);

    const songFolder = 'pasong/songs';
    const coverFolder = 'pasong/covers';

    // -------------------------------
    // SONG METADATA
    // -------------------------------

    const songContext =
      `songId=${cleanContext(songId)}` +
      `|artist=${cleanContext(artist, 100)}` +
      `|title=${cleanContext(title, 150)}` +
      `|description=${cleanContext(details, 500)}` +
      `|contractAccepted=true` +
      `|acceptedAt=${timestamp}`;

    // -------------------------------
    // SONG SIGNATURE
    // -------------------------------

    const songParams = {
      timestamp,
      folder: songFolder,
      public_id: songId,
      tags: 'pasong-song',
      context: songContext
    };

    const songSignature =
      cloudinary.utils.api_sign_request(
        songParams,
        process.env.CLOUDINARY_API_SECRET
      );

    // -------------------------------
    // COVER SIGNATURE
    // -------------------------------

    const coverContext =
      `songId=${cleanContext(songId)}`;

    const coverParams = {
      timestamp,
      folder: coverFolder,
      public_id: songId,
      tags: 'pasong-cover',
      context: coverContext
    };

    const coverSignature =
      cloudinary.utils.api_sign_request(
        coverParams,
        process.env.CLOUDINARY_API_SECRET
      );

    // -------------------------------
    // SEND UPLOAD DETAILS
    // -------------------------------

    res.json({
      song: {
        songId,
        cloudName:
          process.env.CLOUDINARY_CLOUD_NAME,
        apiKey:
          process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature: songSignature,
        folder: songFolder,
        publicId: songId,
        tags: 'pasong-song',
        context: songContext,
        uploadUrl:
          `https://api.cloudinary.com/v1_1/` +
          `${process.env.CLOUDINARY_CLOUD_NAME}` +
          `/video/upload`
      },

      cover: {
        songId,
        cloudName:
          process.env.CLOUDINARY_CLOUD_NAME,
        apiKey:
          process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature: coverSignature,
        folder: coverFolder,
        publicId: songId,
        tags: 'pasong-cover',
        context: coverContext,
        uploadUrl:
          `https://api.cloudinary.com/v1_1/` +
          `${process.env.CLOUDINARY_CLOUD_NAME}` +
          `/image/upload`
      }
    });

  } catch (error) {
    console.error(
      'Upload signing error:',
      error
    );

    res.status(500).json({
      error:
        'Could not prepare the song upload.'
    });
  }
});

// ===============================
// GET SONGS FROM SUPABASE
// ===============================

app.get('/api/songs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select(`
        id,
        artist_id,
        album_id,
        category_id,
        title,
        description,
        genre,
        cover_url,
        audio_url,
        preview_url,
        file_size,
        duration_seconds,
        price,
        currency,
        status,
        plays,
        downloads,
        featured,
        created_at,
        updated_at
      `)
      .order('created_at', {
        ascending: false
      });

    if (error) {
      console.error(
        'Supabase songs error:',
        error
      );

      return res.status(500).json({
        error:
          'Could not load songs from Supabase.',
        details: error.message
      });
    }

    const songs = (data || []).map((song) => ({
      id: song.id,
      artistId: song.artist_id,
      albumId: song.album_id,
      categoryId: song.category_id,

      songTitle: song.title || 'Untitled Song',

      description:
        song.description || '',

      genre:
        song.genre || '',

      coverUrl:
        song.cover_url || '',

      audioUrl:
        song.audio_url || '',

      previewUrl:
        song.preview_url || song.audio_url || '',

      fileSize:
        song.file_size || 0,

      durationSeconds:
        song.duration_seconds || 0,

      price:
        song.price ?? 500,

      currency:
        song.currency || 'UGX',

      status:
        song.status || 'published',

      plays:
        song.plays || 0,

      downloads:
        song.downloads || 0,

      featured:
        Boolean(song.featured),

      createdAt:
        song.created_at,

      updatedAt:
        song.updated_at
    }));

    res.json({
      songs,
      nextCursor: null
    });

  } catch (error) {
    console.error(
      'Song listing error:',
      error
    );

    res.status(500).json({
      error:
        'Could not load songs.'
    });
  }
});

// ===============================
// GET ONE SONG FROM SUPABASE
// ===============================

app.get('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;

    const { data, error } = await supabase
      .from('songs')
      .select(`
        id,
        artist_id,
        album_id,
        category_id,
        title,
        description,
        genre,
        cover_url,
        audio_url,
        preview_url,
        file_size,
        duration_seconds,
        price,
        currency,
        status,
        plays,
        downloads,
        featured,
        created_at,
        updated_at
      `)
      .eq('id', songId)
      .maybeSingle();

    if (error) {
      console.error(
        'Supabase single song error:',
        error
      );

      return res.status(500).json({
        error:
          'Could not load the song.',
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Song not found.'
      });
    }

    res.json({
      song: {
        id: data.id,
        artistId: data.artist_id,
        albumId: data.album_id,
        categoryId: data.category_id,

        songTitle:
          data.title || 'Untitled Song',

        description:
          data.description || '',

        genre:
          data.genre || '',

        coverUrl:
          data.cover_url || '',

        audioUrl:
          data.audio_url || '',

        previewUrl:
          data.preview_url ||
          data.audio_url ||
          '',

        fileSize:
          data.file_size || 0,

        durationSeconds:
          data.duration_seconds || 0,

        price:
          data.price ?? 500,

        currency:
          data.currency || 'UGX',

        status:
          data.status || 'published',

        plays:
          data.plays || 0,

        downloads:
          data.downloads || 0,

        featured:
          Boolean(data.featured),

        createdAt:
          data.created_at,

        updatedAt:
          data.updated_at
      }
    });

  } catch (error) {
    console.error(
      'Single song error:',
      error
    );

    res.status(500).json({
      error:
        'Could not load the song.'
    });
  }
});

// ===============================
// PESAPAL CREATE PAYMENT
// ===============================

app.post(
  '/api/pesapal/create-payment',
  async (req, res) => {
    try {
      const t = await getToken();

      const id =
        `PASONG-${Date.now()}`;

      const r = await axios.post(
        `${BASE}/api/Transactions/SubmitOrderRequest`,
        {
          id,

          currency: 'UGX',

          amount:
            Number(req.body.amount) || 500,

          description:
            `PASONG - ${
              req.body.songTitle ||
              'Song'
            }`,

          callback_url:
            `${process.env.FRONTEND_URL}/success`,

          notification_id:
            process.env.PESAPAL_IPN_ID,

          billing_address: {
            email_address:
              req.body.email ||
              'c@pasong.ug',

            phone_number:
              '256769719539',

            country_code: 'UG',

            first_name:
              'PASONG',

            last_name:
              'User'
          }
        },
        {
          headers: {
            Authorization:
              `Bearer ${t}`
          }
        }
      );

      res.json({
        ...r.data,
        SETTLE: '0769719539'
      });

    } catch (error) {
      console.error(
        'PesaPal error:',
        error
      );

      res.status(500).json(
        error.response?.data ||
        error.message
      );
    }
  }
);

// ===============================
// PESAPAL IPN
// ===============================

app.post(
  '/api/pesapal/ipn',
  (req, res) => {

    console.log(
      'PASONG -> 0769719539',
      req.body
    );

    res.json({
      ok: true
    });
  }
);

// ===============================
// START SERVER
// ===============================

app.listen(
  process.env.PORT || 10000,
  () => {
    console.log(
      'PASONG LIVE'
    );
  }
);
