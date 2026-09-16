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

// ======================================================
// PESAPAL
// ======================================================

const PESAPAL_BASE_URL =
  process.env.PESAPAL_BASE_URL ||
  'https://pay.pesapal.com/v3';

let pesapalToken = null;
let pesapalTokenExpiry = 0;

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

  const response = await axios.post(
    `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
    {
      consumer_key:
        process.env.PESAPAL_CONSUMER_KEY,

      consumer_secret:
        process.env.PESAPAL_CONSUMER_SECRET
    },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  pesapalToken = response.data.token;

  pesapalTokenExpiry =
    Date.now() + 240000;

  return pesapalToken;
}

// ======================================================
// HELPERS
// ======================================================

function cleanText(value, maxLength = 500) {
  return String(value || '')
    .trim()
    .slice(0, maxLength);
}

function getExtension(filename) {
  const name =
    String(filename || '')
      .toLowerCase()
      .trim();

  const parts = name.split('.');

  if (parts.length < 2) {
    return '';
  }

  return parts.pop();
}

function cloudinaryReady() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function supabaseReady() {
  return Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function pesapalReady() {
  return Boolean(
    process.env.PESAPAL_CONSUMER_KEY &&
    process.env.PESAPAL_CONSUMER_SECRET
  );
}

function isValidUUID(value) {
  if (!value) {
    return false;
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidRegex.test(String(value));
}

function optionalUUID(value) {
  if (!value) {
    return null;
  }

  return isValidUUID(value)
    ? String(value)
    : null;
}

function createSongUUID() {
  return crypto.randomUUID();
}

function createCloudinaryPublicId() {
  return `pasong-${Date.now()}-${crypto.randomUUID()}`;
}

function cleanContext(value, maxLength = 500) {
  return cleanText(value, maxLength)
    .replace(/[|=\\]/g, ' ');
}

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

app.get('/api/songs', async (req, res) => {
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

    const { data, error } =
      await supabase
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
        })
        .limit(limitNumber);

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
      nextCursor: null
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
});

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

      const { data, error } =
        await supabase
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
        optionalUUID(artistId);

      const validAlbumId =
        optionalUUID(albumId);

      const validCategoryId =
        optionalUUID(categoryId);

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

      if (
        songSize > MAX_SONG_SIZE
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
          Number(coverFileSize);

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
        `songId=${cleanContext(
          databaseSongId
        )}` +
        `|artist=${cleanContext(
          artist,
          100
        )}` +
        `|title=${cleanContext(
          title,
          150
        )}` +
        `|description=${cleanContext(
          descriptionText,
          500
        )}` +
        `|genre=${cleanContext(
          songGenre,
          100
        )}` +
        `|contractAccepted=true` +
        `|acceptedAt=${timestamp}`;

      const songParams = {
        timestamp,
        folder: songFolder,
        public_id:
          cloudinaryPublicId,
        tags: 'pasong-song',
        context: songContext
      };

      const songSignature =
        cloudinary.utils.api_sign_request(
          songParams,
          process.env.CLOUDINARY_API_SECRET
        );

      const coverParams = {
        timestamp,
        folder: coverFolder,
        public_id:
          cloudinaryPublicId,
        tags: 'pasong-cover',
        context:
          `songId=${cleanContext(
            databaseSongId
          )}`
      };

      const coverSignature =
        cloudinary.utils.api_sign_request(
          coverParams,
          process.env.CLOUDINARY_API_SECRET
        );

      return res.json({
        song: {
          songId:
            databaseSongId,

          cloudinaryPublicId,

          artistId:
            validArtistId,

          albumId:
            validAlbumId,

          categoryId:
            validCategoryId,

          artistName:
            artist,

          songTitle:
            title,

          description:
            descriptionText,

          genre:
            songGenre,

          price: 500,

          currency:
            'UGX',

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
            cloudinaryPublicId,

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
          songId:
            databaseSongId,

          cloudinaryPublicId,

          cloudName:
            process.env.CLOUDINARY_CLOUD_NAME,

          apiKey:
            process.env.CLOUDINARY_API_KEY,

          timestamp,

          signature:
            coverSignature,

          folder:
            coverFolder,

          publicId:
            cloudinaryPublicId,

          tags:
            'pasong-cover',

          uploadUrl:
            `https://api.cloudinary.com/v1_1/` +
            `${process.env.CLOUDINARY_CLOUD_NAME}` +
            `/image/upload`
        }
      });

    } catch (error) {
      console.error(
        'SIGN UPLOAD ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Could not create upload signature.',
        details:
          error.message
      });
    }
  }
);

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

      const finalSongId =
        id ||
        songId ||
        createSongUUID();

      if (
        !isValidUUID(
          finalSongId
        )
      ) {
        return res.status(400).json({
          error:
            'Invalid song UUID.'
        });
      }

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

      const finalArtistId =
        optionalUUID(
          artist_id || artistId
        );

      const finalAlbumId =
        optionalUUID(
          album_id || albumId
        );

      const finalCategoryId =
        optionalUUID(
          category_id || categoryId
        );

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

      const finalFileSize =
        file_size !== undefined &&
        file_size !== null
          ? String(file_size)
          : null;

      let finalDuration = null;

      if (
        duration_seconds !== undefined &&
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
                duration_seconds:
          finalDuration,

        price: 500,

        currency: 'UGX',

        status:
          cleanText(status, 50) ||
          'pending',

        plays: 0,

        downloads: 0,

        featured:
          featured === true,

        artist_id:
          finalArtistId,

        album_id:
          finalAlbumId,

        category_id:
          finalCategoryId
      };

      // ======================================================
      // SAVE TO SUPABASE
      // ======================================================

      const { data, error } =
        await supabase
          .from('songs')
          .insert(songData)
          .select()
          .single();

      if (error) {
        console.error(
          'CREATE SONG DATABASE ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Failed to save song to Supabase.',
          details:
            error.message
        });
      }

      return res.status(201).json({
        success: true,
        message:
          'Song created successfully.',
        song: data
      });

    } catch (error) {
      console.error(
        'CREATE SONG SERVER ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Server error while creating song.',
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

      const {
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

      const updates = {};

      if (title !== undefined) {
        const value =
          cleanText(title, 150);

        if (!value) {
          return res.status(400).json({
            error:
              'Song title cannot be empty.'
          });
        }

        updates.title = value;
      }

      if (description !== undefined) {
        updates.description =
          cleanText(
            description,
            500
          ) || null;
      }

      if (genre !== undefined) {
        updates.genre =
          cleanText(
            genre,
            100
          ) || null;
      }

      if (cover_url !== undefined) {
        updates.cover_url =
          cleanText(
            cover_url,
            1000
          ) || null;
      }

      if (audio_url !== undefined) {
        updates.audio_url =
          cleanText(
            audio_url,
            1000
          ) || null;
      }

      if (preview_url !== undefined) {
        updates.preview_url =
          cleanText(
            preview_url,
            1000
          ) || null;
      }

      if (file_size !== undefined) {
        updates.file_size =
          file_size === null
            ? null
            : String(file_size);
      }

      if (
        duration_seconds !==
        undefined
      ) {
        if (
          duration_seconds === null ||
          duration_seconds === ''
        ) {
          updates.duration_seconds =
            null;
        } else {
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

          updates.duration_seconds =
            Math.floor(
              parsedDuration
            );
        }
      }

      if (status !== undefined) {
        updates.status =
          cleanText(
            status,
            50
          );
      }

      if (featured !== undefined) {
        updates.featured =
          featured === true;
      }

      updates.updated_at =
        new Date().toISOString();

      const { data, error } =
        await supabase
          .from('songs')
          .update(updates)
          .eq('id', songId)
          .select()
          .single();

      if (error) {
        console.error(
          'UPDATE SONG DATABASE ERROR:',
          error
        );

        return res.status(500).json({
          error:
            'Failed to update song.',
          details:
            error.message
        });
      }

      return res.json({
        success: true,
        message:
          'Song updated successfully.',
        song: data
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
      const accessToken =
        await getPesaPalToken();

      return res.json({
        success: true,
        token: accessToken
      });

    } catch (error) {
      console.error(
        'PESAPAL TOKEN ERROR:',
        error.response?.data ||
        error.message
      );

      return res.status(500).json({
        error:
          'Could not obtain PesaPal token.',
        details:
          error.response?.data ||
          error.message
      });
    }
  }
);

// ======================================================
// 404
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    error:
      'PASONG API route not found.',
    path:
      req.originalUrl
  });
});

// ======================================================
// SERVER
// ======================================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `PASONG API running on port ${PORT}`
  );
});
