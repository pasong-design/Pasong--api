import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

const app = express();

// ===============================
// SUPABASE
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
// CLOUDINARY
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
      consumer_key:
        process.env.PESAPAL_CONSUMER_KEY,

      consumer_secret:
        process.env.PESAPAL_CONSUMER_SECRET
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
  const name =
    String(filename || '').toLowerCase();

  const parts = name.split('.');

  return parts.length > 1
    ? parts.pop()
    : '';
}

function cleanContext(
  value,
  maxLength = 500
) {
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
// HOME / HEALTH
// ===============================

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE',
    upload: 'READY',

    database:
      process.env.SUPABASE_URL
        ? 'READY'
        : 'NOT CONFIGURED',

    cloudinary:
      cloudinaryReady()
        ? 'READY'
        : 'NOT CONFIGURED',

    songsEndpoint:
      '/api/songs',

    uploadEndpoint:
      '/api/songs/sign-upload',

    saveEndpoint:
      '/api/songs/create',

    settle: '0769719539'
  });
});

// ===============================
// CREATE CLOUDINARY UPLOAD SIGNATURE
// ===============================

app.post(
  '/api/songs/sign-upload',
  (req, res) => {

    try {

      if (!cloudinaryReady()) {
        return res.status(500).json({
          error:
            'Cloudinary is not configured'
        });
      }

      const {
        artistName,
        songTitle,
        description,
        genre,
        contractAccepted,
        fileName,
        fileSize,
        coverFileName,
        coverFileSize
      } = req.body;

      // CONTRACT

      if (contractAccepted !== true) {
        return res.status(400).json({
          error:
            'You must read and agree to the PASONG upload contract.'
        });
      }

      // SONG INFORMATION

      const artist =
        cleanText(artistName, 100);

      const title =
        cleanText(songTitle, 150);

      const details =
        cleanText(description, 500);

      const songGenre =
        cleanText(genre, 100);

      if (!artist) {
        return res.status(400).json({
          error:
            'Artist name is required.'
        });
      }

      if (!title) {
        return res.status(400).json({
          error:
            'Song title is required.'
        });
      }

      // SONG FILE

      const songSize =
        Number(fileSize);

      const songExtension =
        getExtension(fileName);

      if (
        !Number.isFinite(songSize) ||
        songSize <= 0
      ) {
        return res.status(400).json({
          error:
            'Invalid song file size.'
        });
      }

      if (songSize > MAX_SONG_SIZE) {
        return res.status(400).json({
          error:
            'Song file must not be larger than 10 MB.'
        });
      }

      if (
        !ALLOWED_SONG_EXTENSIONS.has(
          songExtension
        )
      ) {
        return res.status(400).json({
          error:
            'Only MP3 and WAV songs are allowed.'
        });
      }

      // COVER

      if (coverFileName) {

        const coverSize =
          Number(coverFileSize);

        const coverExtension =
          getExtension(coverFileName);

        if (
          !Number.isFinite(coverSize) ||
          coverSize <= 0
        ) {
          return res.status(400).json({
            error:
              'Invalid cover image size.'
          });
        }

        if (
          coverSize > MAX_COVER_SIZE
        ) {
          return res.status(400).json({
            error:
              'Cover image must not be larger than 5 MB.'
          });
        }

        if (
          !ALLOWED_COVER_EXTENSIONS.has(
            coverExtension
          )
        ) {
          return res.status(400).json({
            error:
              'Cover must be JPG, JPEG, PNG or WEBP.'
          });
        }
      }

      // SONG ID

      const songId =
        createSongId();

      const timestamp =
        Math.floor(Date.now() / 1000);

      const songFolder =
        'pasong/songs';

      const coverFolder =
        'pasong/covers';

      // SONG CONTEXT

      const songContext =
        `songId=${cleanContext(songId)}` +
        `|artist=${cleanContext(artist, 100)}` +
        `|title=${cleanContext(title, 150)}` +
        `|description=${cleanContext(details, 500)}` +
        `|genre=${cleanContext(songGenre, 100)}` +
        `|contractAccepted=true` +
        `|acceptedAt=${timestamp}`;

      // SONG SIGNATURE

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

      // COVER SIGNATURE

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

      // RESPONSE

      res.json({

        song: {
          songId,

          artistName: artist,

          songTitle: title,

          description: details,

          genre: songGenre,

          price: 500,

          currency: 'UGX',

          cloudName:
            process.env.CLOUDINARY_CLOUD_NAME,

          apiKey:
            process.env.CLOUDINARY_API_KEY,

          timestamp,

          signature:
            songSignature,

          folder:
            songFolder,

          publicId:
            songId,

          tags:
            'pasong-song',

          context:
            songContext,

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

          signature:
            coverSignature,

          folder:
            coverFolder,

          public
