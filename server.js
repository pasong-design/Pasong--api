import express from 'express';
import cors from 'cors';
import axios from 'axios';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';

const app = express();

// ======================================================
// SUPABASE
// ======================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors({ origin: true }));

app.use(
  express.json({
    limit: '1mb'
  })
);

// ======================================================
// CLOUDINARY
// ======================================================

cloudinary.config({
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME,

  api_key:
    process.env.CLOUDINARY_API_KEY,

  api_secret:
    process.env.CLOUDINARY_API_SECRET,

  secure: true
});

// ======================================================
// UPLOAD SETTINGS
// ======================================================

const MAX_SONG_SIZE =
  10 * 1024 * 1024;

const MAX_COVER_SIZE =
  5 * 1024 * 1024;

const ALLOWED_SONG_EXTENSIONS =
  new Set([
    'mp3',
    'wav'
  ]);

const ALLOWED_COVER_EXTENSIONS =
  new Set([
    'jpg',
    'jpeg',
    'png',
    'webp'
  ]);

// ======================================================
// PESAPAL
// ======================================================

const PESAPAL_BASE_URL =
  process.env.PESAPAL_BASE_URL ||
  'https://pay.pesapal.com/v3';

let pesapalToken = null;

let pesapalTokenExpiry = 0;

// ======================================================
// PESAPAL TOKEN
// ======================================================

async function getPesaPalToken() {
  if (
    pesapalToken &&
    Date.now() < pesapalTokenExpiry
  ) {
    return pesapalToken;
  }

  if (
    !process.env.PESAPAL_CONSUMER_KEY ||
    !process.env.PESAPAL_CONSUMER_SECRET
  ) {
    throw new Error(
      'PesaPal credentials are not configured.'
    );
  }

  const response =
    await axios.post(
      `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
      {
        consumer_key:
          process.env.PESAPAL_CONSUMER_KEY,

        consumer_secret:
          process.env.PESAPAL_CONSUMER_SECRET
      },
      {
        headers: {
          'Content-Type':
            'application/json'
        }
      }
    );

  pesapalToken =
    response.data.token;

  pesapalTokenExpiry =
    Date.now() + 240000;

  return pesapalToken;
}

// ======================================================
// HELPERS
// ======================================================
// ======================================================
// HOME / HEALTH
// ======================================================

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE',

    upload: 'READY',

    database:
      supabaseReady()
        ? 'READY'
        : 'NOT CONFIGURED',

    cloudinary:
      cloudinaryReady()
        ? 'READY'
        : 'NOT CONFIGURED',

    pesapal:
      pesapalReady()
        ? 'READY'
        : 'NOT CONFIGURED',

    songsEndpoint:
      '/api/songs',

    signUploadEndpoint:
      '/api/songs/sign-upload',

    createSongEndpoint:
      '/api/songs/create'
  });
});

// ======================================================
// GET ALL SONGS
// ======================================================

app.get(
  '/api/songs',
  async (req, res) => {
    try {
      if (!supabaseReady()) {
        return res.status(500).json({
          error:
            'Supabase is not configured.'
        });
      }

      const limitNumber =
        Math.min(
          Math.max(
            Number(req.query.limit) || 50,
            1
          ),
          100
        );

      const {
        data,
        error
      } = await supabase
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
        .order(
          'created_at',
          {
            ascending: false
          }
        )
        .limit(
          limitNumber
        );

      if (error) {
        console.error(
          'GET SONGS ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Failed to load songs.',

          details:
            error.message
        });
      }

      return res.json({
        songs: data || [],

        nextCursor:
          null
      });

    } catch (error) {
      console.error(
        'GET SONGS SERVER ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Server error while loading songs.'
      });
    }
  }
);

// ======================================================
// GET ONE SONG
// ======================================================
app.get(
  '/api/songs/:id',
  async (req, res) => {
    try {
      if (!supabaseReady()) {
        return res.status(500).json({
          error:
            'Supabase is not configured.'
        });
      }

      const songId =
        req.params.id;

      if (!isValidUUID(songId)) {
        return res.status(400).json({
          error:
            'Invalid song ID.'
        });
      }

      const {
        data,
        error
      } = await supabase
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
        .eq(
          'id',
          songId
        )
        .maybeSingle();

      if (error) {
        console.error(
          'GET SONG ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Failed to load song.',

          details:
            error.message
        });
      }

      if (!data) {
        return res.status(404).json({
          error:
            'Song not found.'
        });
      }

      return res.json({
        song: data
      });

    } catch (error) {
      console.error(
        'GET SONG SERVER ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Server error while loading song.'
      });
    }
  }
);
// ======================================================
// CREATE CLOUDINARY UPLOAD SIGNATURE
// ======================================================

app.post(
  '/api/songs/sign-upload',
  (req, res) => {
    try {
      if (!cloudinaryReady()) {
        return res.status(500).json({
          error:
            'Cloudinary is not configured.'
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
        coverFileSize,
        artistId,
        albumId,
        categoryId
      } = req.body;

      if (contractAccepted !== true) {
        return res.status(400).json({
          error:
            'You must read and agree to the PASONG upload contract.'
        });
      }

      const artist =
        cleanText(
          artistName,
          100
        );

      const title =
        cleanText(
          songTitle,
          150
        );

      const descriptionText =
        cleanText(
          description,
          500
        );

      const songGenre =
        cleanText(
          genre,
          100
        );

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

      const validArtistId =
        optionalUUID(
          artistId
        );

      const validAlbumId =
        optionalUUID(
          albumId
        );

      const validCategoryId =
        optionalUUID(
          categoryId
        );

      const songSize =
        Number(fileSize);

      const songExtension =
        getExtension(
          fileName
        );

      if (
        !Number.isFinite(
          songSize
        ) ||
        songSize <= 0
      ) {
        return res.status(400).json({
          error:
            'Invalid song file size.'
        });
      }

      if (
        songSize >
        MAX_SONG_SIZE
      ) {
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

      if (coverFileName) {
        const coverSize =
          Number(
            coverFileSize
          );

        const coverExtension =
          getExtension(
            coverFileName
          );

        if (
          !Number.isFinite(
            coverSize
          ) ||
          coverSize <= 0
        ) {
          return res.status(400).json({
            error:
              'Invalid cover image size.'
          });
        }

        if (
          coverSize >
          MAX_COVER_SIZE
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

      const databaseSongId =
        createSongUUID();

      const cloudinaryPublicId =
        createCloudinaryPublicId();

      const timestamp =
        Math.floor(
          Date.now() / 1000
        );

      const songFolder =
        'pasong/songs';

      const coverFolder =
        'pasong/covers';

      const songContext =
        `songId=${cleanContext(databaseSongId)}` +
        `|artist=${cleanContext(artist, 100)}` +
        `|title=${cleanContext(title, 150)}` +
        `|description=${cleanContext(descriptionText, 500)}` +
        `|genre=${cleanContext(songGenre, 100)}` +
        `|contractAccepted=true` +
        `|acceptedAt=${timestamp}`;

      const songParams = {
        timestamp,
        folder:
          songFolder,
        public_id:
          cloudinaryPublicId,
        tags:
          'pasong-song',
        context:
          songContext
      };

      const songSignature =
        cloudinary.utils.api_sign_request(
          songParams,
          process.env.CLOUDINARY_API_SECRET
        );

      const coverParams = {
        timestamp,
        folder:
          coverFolder,
        public_id:
          cloudinaryPublicId,
        tags:
          'pasong-cover'
      };

      const coverSignature =
        cloudinary.utils.api_sign_request(
          coverParams,
         // ======================================================
// SAVE SONG TO SUPABASE
// ======================================================

app.post(
  '/api/songs/create',
  async (req, res) => {
    try {
      if (!supabaseReady()) {
        return res.status(500).json({
          error:
            'Supabase is not configured.'
        });
      }

      const {
        id,
        songId,

        artist_id,
        album_id,
        category_id,

        artistId,
        albumId,
        categoryId,

        title,
        description,
        genre,

        cover_url,
        audio_url,
        preview_url,

        file_size,
        duration_seconds,

        status,
        featured
      } = req.body;

      // --------------------------------------------------
      // SONG ID
      // --------------------------------------------------

      const finalSongId =
        id ||
        songId ||
        createSongUUID();

      if (!isValidUUID(finalSongId)) {
        return res.status(400).json({
          error:
            'Invalid song UUID.'
        });
      }

      // --------------------------------------------------
      // TEXT FIELDS
      // --------------------------------------------------

      const finalTitle =
        cleanText(
          title,
          150
        );

      const finalDescription =
        cleanText(
          description,
          500
        );

      const finalGenre =
        cleanText(
          genre,
          100
        );

      if (!finalTitle) {
        return res.status(400).json({
          error:
            'Song title is required.'
        });
      }

      // --------------------------------------------------
      // UUID FIELDS
      // --------------------------------------------------

      const finalArtistId =
        optionalUUID(
          artist_id ||
          artistId
        );

      const finalAlbumId =
        optionalUUID(
          album_id ||
          albumId
        );

      const finalCategoryId =
        optionalUUID(
          category_id ||
          categoryId
        );

      // --------------------------------------------------
      // CLOUDINARY URLS
      // --------------------------------------------------

      const finalCoverUrl =
        cleanText(
          cover_url,
          1000
        ) || null;

      const finalAudioUrl =
        cleanText(
          audio_url,
          1000
        ) || null;

      const finalPreviewUrl =
        cleanText(
          preview_url,
          1000
        ) || null;

      // --------------------------------------------------
      // FILE SIZE
      // IMPORTANT: Supabase file_size = int8
      // --------------------------------------------------

      let finalFileSize = null;

      if (
        file_size !== undefined &&
        file_size !== null &&
        file_size !== ''
      ) {
        const parsedFileSize =
          Number(file_size);

        if (
          !Number.isFinite(
            parsedFileSize
          ) ||
          parsedFileSize <= 0
        ) {
          return res.status(400).json({
            error:
              'Invalid file_size.'
          });
        }

        finalFileSize =
          Math.floor(
            parsedFileSize
          );
      }

      // --------------------------------------------------
      // DURATION
      // --------------------------------------------------

      let finalDuration = null;

      if (
        duration_seconds !==
          undefined &&
        duration_seconds !== null &&
        duration_seconds !== ''
      ) {
        const parsedDuration =
          Number(
            duration_seconds
          );

        if (
          !Number.isFinite(
            parsedDuration
          ) ||
          parsedDuration < 0
        ) {
          return res.status(400).json({
            error:
              'Invalid duration_seconds.'
          });
        }

        finalDuration =
          Math.floor(
            parsedDuration
          );
      }

      // --------------------------------------------------
      // SONG DATA
      // --------------------------------------------------

      const songData = {
        id:
          finalSongId,

        artist_id:
          finalArtistId,

        album_id:
          finalAlbumId,

        category_id:
          finalCategoryId,

        title:
          finalTitle,

        description:
          finalDescription ||
          null,

        genre:
          finalGenre ||
          null,

        cover_url:
          finalCoverUrl,

        audio_url:
          finalAudioUrl,

        preview_url:
          finalPreviewUrl,

        file_size:
          finalFileSize,

        duration_seconds:
          finalDuration,

        // PASONG DEFAULT PRICE
        price:
          500,

        currency:
          'UGX',

        // DEFAULT STATUS
        status:
          status ||
          'pending',

        featured:
          featured === true
      };

      // --------------------------------------------------
      // SAVE TO SUPABASE
      // --------------------------------------------------

      const {
        data,
        error
      } = await supabase
        .from('songs')
        .upsert(
          songData,
          {
            onConflict:
              'id'
          }
        )
        .select()
        .single();

      if (error) {
        console.error(
          'SUPABASE SONG SAVE ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Could not save song to Supabase.',

          details:
            error.message,

          code:
            error.code ||
            null
        });
      }

      // --------------------------------------------------
      // SUCCESS
      // --------------------------------------------------

      return res.status(201).json({
        success:
          true,

        message:
          'Song saved successfully.',

        song:
          data
      });

    } catch (error) {
      console.error(
        'CREATE SONG SERVER ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Server error while saving song.',

        details:
          error.message
      });
    }
  }
);
      // ======================================================
// UPDATE SONG
// ======================================================

app.patch(
  '/api/songs/:id',
  async (req, res) => {
    try {
      if (!supabaseReady()) {
        return res.status(500).json({
          error:
            'Supabase is not configured.'
        });
      }

      const songId =
        req.params.id;

      if (!isValidUUID(songId)) {
        return res.status(400).json({
          error:
            'Invalid song ID.'
        });
      }

      const allowedFields = [
        'title',
        'description',
        'genre',
        'cover_url',
        'audio_url',
        'preview_url',
        'file_size',
        'duration_seconds',
        'featured'
      ];

      const updates = {};

      for (const field of allowedFields) {
        if (
          req.body[field] !==
          undefined
        ) {
          updates[field] =
            req.body[field];
        }
      }

      if (
        updates.title !==
        undefined
      ) {
        updates.title =
          cleanText(
            updates.title,
            150
          );
      }

      if (
        updates.description !==
        undefined
      ) {
        updates.description =
          cleanText(
            updates.description,
            500
          ) || null;
      }

      if (
        updates.genre !==
        undefined
      ) {
        updates.genre =
          cleanText(
            updates.genre,
            100
          ) || null;
      }

      if (
        updates.file_size !==
        undefined
      ) {
        const parsedFileSize =
          Number(
            updates.file_size
          );

        if (
          !Number.isFinite(
            parsedFileSize
          ) ||
          parsedFileSize <= 0
        ) {
          return res.status(400).json({
            error:
              'Invalid file_size.'
          });
        }

        updates.file_size =
          Math.floor(
            parsedFileSize
          );
      }

      if (
        updates.duration_seconds !==
        undefined
      ) {
        const duration =
          Number(
            updates.duration_seconds
          );

        if (
          !Number.isFinite(
            duration
          ) ||
          duration < 0
        ) {
          return res.status(400).json({
            error:
              'Invalid duration_seconds.'
          });
        }

        updates.duration_seconds =
          Math.floor(
            duration
          );
      }

      if (
        Object.keys(
          updates
        ).length === 0
      ) {
        return res.status(400).json({
          error:
            'No valid fields supplied.'
        });
      }

      const {
        data,
        error
      } = await supabase
        .from('songs')
        .update(updates)
        .eq(
          'id',
          songId
        )
        .select()
        .single();

      if (error) {
        console.error(
          'UPDATE SONG ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Could not update song.',

          details:
            error.message
        });
      }

      return res.json({
        success:
          true,

        song:
          data
      });

    } catch (error) {
      console.error(
        'UPDATE SONG SERVER ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Server error while updating song.'
      });
    }
  }
);
      // ======================================================
// PESAPAL TOKEN TEST
// ======================================================

app.get(
  '/api/payments/pesapal/token',
  async (req, res) => {
    try {
      if (!pesapalReady()) {
        return res.status(503).json({
          error:
            'PesaPal is not configured.'
        });
      }

      const token =
        await getPesaPalToken();

      return res.json({
        success:
          true,

        tokenAvailable:
          Boolean(token)
      });

    } catch (error) {
      console.error(
        'PESAPAL TOKEN ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not get PesaPal token.',

        details:
          error.response?.data ||
          error.message
      });
    }
  }
);

// ======================================================
// 404 HANDLER
// ======================================================

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        'PASONG API route not found.',

      path:
        req.originalUrl
    });
  }
);

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      'GLOBAL SERVER ERROR:',
      error
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    return res.status(500).json({
      error:
        'Internal PASONG server error.',

      details:
        error.message
    });
  }
);

// ======================================================
// START SERVER
// ======================================================

const PORT =
  Number(
    process.env.PORT
  ) || 3000;

app.listen(
  PORT,
  () => {
    console.log(
      `PASONG API running on port ${PORT}`
    );
  }
);
