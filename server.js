const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors({ origin: '*' }));

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb'
  })
);

app.use(
  express.static(path.join(__dirname))
);

// ======================================================
// SUPABASE
// ======================================================

function getSupabase() {
  const url = process.env.SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY'
    );
  }

  return createClient(url, key);
}

// ======================================================
// COUNTRY DETECTION
// ======================================================

function getCountryFromRequest(req) {
  const country =
    req.headers['x-vercel-ip-country'] ||
    req.headers['cf-ipcountry'] ||
    req.headers['x-country-code'] ||
    req.headers['x-country'] ||
    'UG';

  return String(country).trim().toUpperCase();
}

// ======================================================
// SONG PRICING
// ======================================================
//
// PASONG OFFICIAL REGIONAL PRICING
//
// Uganda                 = UGX 700
// East Africa            = UGX 1,000
// Other Africa           = USD 0.57
// United Kingdom         = GBP 1
// Rest of world          = USD 1
//
// IMPORTANT:
// The database "price" is only the catalog/default value.
// The marketplace price is calculated from the visitor's
// detected country.
//
// ======================================================

const EAST_AFRICA = [
  'KE',
  'TZ',
  'RW',
  'BI',
  'SS',
  'CD'
];

const AFRICA = [
  'DZ',
  'AO',
  'BJ',
  'BW',
  'BF',
  'CV',
  'CM',
  'CF',
  'TD',
  'KM',
  'CG',
  'CI',
  'DJ',
  'EG',
  'GQ',
  'ER',
  'SZ',
  'ET',
  'GA',
  'GM',
  'GH',
  'GN',
  'GW',
  'LS',
  'LR',
  'LY',
  'MG',
  'MW',
  'ML',
  'MR',
  'MU',
  'MA',
  'MZ',
  'NA',
  'NE',
  'NG',
  'RW',
  'ST',
  'SN',
  'SC',
  'SL',
  'SO',
  'ZA',
  'SD',
  'TZ',
  'TG',
  'TN',
  'UG',
  'ZM',
  'ZW'
];

function getSongPricing(country) {
  const code = String(country || 'UG')
    .trim()
    .toUpperCase();

  // ==================================================
  // UGANDA
  // ==================================================

  if (code === 'UG') {
    return {
      country: 'UG',
      amount: 700,
      currency: 'UGX',
      label: 'UGX 700'
    };
  }

  // ==================================================
  // EAST AFRICA
  // ==================================================

  if (EAST_AFRICA.includes(code)) {
    return {
      country: code,
      amount: 1000,
      currency: 'UGX',
      label: 'UGX 1,000'
    };
  }

  // ==================================================
  // OTHER AFRICA
  // ==================================================

  if (AFRICA.includes(code)) {
    return {
      country: code,
      amount: 0.57,
      currency: 'USD',
      label: '$0.57'
    };
  }

  // ==================================================
  // UNITED KINGDOM
  // ==================================================

  if (code === 'GB') {
    return {
      country: 'GB',
      amount: 1,
      currency: 'GBP',
      label: '£1'
    };
  }

  // ==================================================
  // REST OF WORLD / DIASPORA
  // ==================================================

  return {
    country: code,
    amount: 1,
    currency: 'USD',
    label: '$1'
  };
}

// ======================================================
// COVER DESIGN PRICING
// ======================================================

function getCoverPricing(country) {
  const code = String(country || 'UG')
    .trim()
    .toUpperCase();

  if (code === 'UG') {
    return {
      country: 'UG',
      amount: 10000,
      currency: 'UGX',
      label: 'UGX 10,000'
    };
  }

  return {
    country: code,
    amount: 10,
    currency: 'USD',
    label: '$10'
  };
}

// ======================================================
// TIP CALCULATION
// ======================================================
//
// Artist = 70%
// PASONG = 30%
//
// Example:
// UGX 10,000 tip
// Artist  = UGX 7,000
// PASONG  = UGX 3,000
//
// ======================================================

function calculateTipSplit(tipAmount) {
  const amount = Number(tipAmount) || 0;

  if (amount < 0) {
    throw new Error('Tip amount cannot be negative');
  }

  const artistTip = Math.floor(amount * 0.70 * 100) / 100;

  const pasongTip =
    Math.round((amount - artistTip) * 100) / 100;

  return {
    totalTip: amount,
    artistTip,
    pasongTip,
    artistPercent: 70,
    pasongPercent: 30
  };
}

// ======================================================
// ROOT
// ======================================================

app.get('/', (req, res) => {
  res.json({
    PASONG: 'LIVE',
    time: new Date().toISOString(),

    pricing: 'READY',

    upload: 'READY',

    coverWorkflow: 'READY',

    tips: 'READY',

    env: Object.keys(process.env).filter(
      key =>
        key.includes('SUPABASE') ||
        key.includes('CLOUDINARY')
    )
  });
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/health', (req, res) => {
  res.json({
    PASONG: 'LIVE',

    upload: 'READY',

    pricing: 'READY',

    coverWorkflow: 'READY',

    tips: 'READY',

    time: new Date().toISOString()
  });
});

// ======================================================
// STATIC PAGES
// ======================================================

app.get('/music-store.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'music-store.html')
  );
});

app.get('/pasong_checkout.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'pasong_checkout.html')
  );
});

app.get('/index.html', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});

// ======================================================
// GET CURRENT PRICING
// ======================================================

app.get('/api/pricing', (req, res) => {
  try {
    const country =
      getCountryFromRequest(req);

    const song =
      getSongPricing(country);

    const cover =
      getCoverPricing(country);

    res.json({
      success: true,

      country,

      song,

      cover,

      tips: {
        artistPercent: 70,
        pasongPercent: 30
      }
    });

  } catch (e) {
    console.error(
      'GET /api/pricing ERROR:',
      e
    );

    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// VALIDATE TIP
// ======================================================

app.post('/api/tip/validate', (req, res) => {
  try {
    const {
      tipAmount = 0
    } = req.body;

    const split =
      calculateTipSplit(tipAmount);

    res.json({
      success: true,

      tip: split
    });

  } catch (e) {
    console.error(
      'POST /api/tip/validate ERROR:',
      e
    );

    res.status(400).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// GET ALL APPROVED SONGS
// ======================================================

app.get('/api/songs', async (req, res) => {
  try {
    const sb =
      getSupabase();

    const country =
      getCountryFromRequest(req);

    const pricing =
      getSongPricing(country);

    const {
      data,
      error
    } = await sb
      .from('songs')
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .eq('status', 'approved')
      .not('cover_url', 'is', null)
      .order('created_at', {
        ascending: false
      })
      .limit(50);

    if (error) {
      throw error;
    }

    const songs =
      (data || [])
        .filter(song => {
          return (
            song.cover_url &&
            String(song.cover_url).trim()
          );
        })
        .map(song => ({
          ...song,

          artist_id:
            song.artist_id || null,

          artist:
            song.artist || null,

          artist_name:
            song.artist?.stage_name ||
            song.artist?.artist_name ||
            'Unknown Artist',

          // IP-based marketplace pricing
          marketplace_price:
            pricing.amount,

          marketplace_currency:
            pricing.currency,

          marketplace_label:
            pricing.label,

          marketplace_country:
            country
        }));

    res.json({
      success: true,

      country,

      pricing,

      songs
    });

  } catch (e) {
    console.error(
      'GET /api/songs ERROR:',
      e
    );

    res.status(500).json({
      success: false,

      error: e.message,

      songs: []
    });
  }
});

// ======================================================
// GET SINGLE APPROVED SONG
// ======================================================

app.get('/api/songs/:id', async (req, res) => {
  try {
    const sb =
      getSupabase();

    const country =
      getCountryFromRequest(req);

    const pricing =
      getSongPricing(country);

    const {
      data,
      error
    } = await sb
      .from('songs')
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .not('cover_url', 'is', null)
      .single();

    if (error) {
      throw error;
    }

    if (
      !data ||
      !data.cover_url ||
      !String(data.cover_url).trim()
    ) {
      return res.status(404).json({
        success: false,
        error: 'Song not found'
      });
    }

    const song = {
      ...data,

      artist_id:
        data.artist_id || null,

      artist:
        data.artist || null,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist',

      marketplace_price:
        pricing.amount,

      marketplace_currency:
        pricing.currency,

      marketplace_label:
        pricing.label,

      marketplace_country:
        country
    };

    res.json({
      success: true,

      country,

      pricing,

      song
    });

  } catch (e) {
    console.error(
      'GET /api/songs/:id ERROR:',
      e
    );

    res.status(404).json({
      success: false,
      error: 'Song not found'
    });
  }
});

// ======================================================
// CLOUDINARY SIGNATURE
// ======================================================

app.post('/api/cloudinary/signature', (req, res) => {
  try {
    const {
      folder = 'pasong-songs',

      public_id =
        `song_${Date.now()}`
    } = req.body;

    const timestamp =
      Math.round(Date.now() / 1000);

    const key =
      process.env.CLOUDINARY_API_KEY;

    const secret =
      process.env.CLOUDINARY_API_SECRET;

    const cloud =
      process.env.CLOUDINARY_CLOUD_NAME;

    if (!key || !secret || !cloud) {
      return res.status(500).json({
        success: false,
        error: 'Missing Cloudinary ENV'
      });
    }

    const sign = params => {
      return crypto
        .createHash('sha1')
        .update(params + secret)
        .digest('hex');
    };

    const songString =
      `folder=${folder}` +
      `&public_id=${public_id}` +
      `&timestamp=${timestamp}`;

    const coverFolder =
      'pasong-covers';

    const coverPublicId =
      `${public_id}_cover`;

    const coverString =
      `folder=${coverFolder}` +
      `&public_id=${coverPublicId}` +
      `&timestamp=${timestamp}`;

    res.json({
      success: true,

      song: {
        apiKey: key,

        timestamp,

        signature:
          sign(songString),

        folder,

        public_id,

        publicId:
          public_id,

        uploadUrl:
          `https://api.cloudinary.com/v1_1/${cloud}/video/upload`
      },

      cover: {
        apiKey: key,

        timestamp,

        signature:
          sign(coverString),

        folder:
          coverFolder,

        public_id:
          coverPublicId,

        publicId:
          coverPublicId,

        uploadUrl:
          `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
      }
    });

  } catch (e) {
    console.error(
      'Cloudinary signature ERROR:',
      e
    );

    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// SIGN SONG UPLOAD
// ======================================================
//
// COVER IS REQUIRED.
//
// Artist uploads song WITH cover.
// Artist uploads song WITHOUT cover = BLOCKED.
//
// ======================================================

app.post('/api/songs/sign-upload', async (req, res) => {
  try {
    const sb =
      getSupabase();

    const {
      artistName,
      songTitle,
      genre,
      fileName,
      fileSize,
      coverFileName,
      coverFileSize,
      contract
    } = req.body;

    // ==================================================
    // REQUIRED FIELDS
    // ==================================================

    if (!artistName) {
      return res.status(400).json({
        success: false,
        error: 'Artist name is required'
      });
    }

    if (!songTitle) {
      return res.status(400).json({
        success: false,
        error: 'Song title is required'
      });
    }

    if (!fileName) {
      return res.status(400).json({
        success: false,
        error: 'Song file is required'
      });
    }

    if (!contract) {
      return res.status(400).json({
        success: false,
        error: 'Upload agreement is required'
      });
    }

    // ==================================================
    // COVER IS MANDATORY
    // ==================================================

    if (!coverFileName) {
      return res.status(400).json({
        success: false,

        code: 'COVER_REQUIRED',

        error:
          'Cover artwork is required. Please upload a cover before uploading your song.'
      });
    }

    // ==================================================
    // FILE SIZE LIMITS
    // ==================================================

    if (
      fileSize &&
      Number(fileSize) >
        10 * 1024 * 1024
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Song file must not exceed 10 MB'
      });
    }

    if (
      coverFileSize &&
      Number(coverFileSize) >
        5 * 1024 * 1024
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Cover image must not exceed 5 MB'
      });
    }

    // ==================================================
    // FIND EXISTING ARTIST
    // ==================================================

    let artistProfile = null;

    const {
      data: existingArtist,
      error: artistFindError
    } = await sb
      .from('artist_profiles')
      .select('*')
      .or(
        `stage_name.eq.${artistName},artist_name.eq.${artistName}`
      )
      .limit(1)
      .maybeSingle();

    if (artistFindError) {
      console.error(
        'Artist lookup error:',
        artistFindError
      );
    }

    if (existingArtist) {
      artistProfile =
        existingArtist;
    } else {
      const {
        data: newArtist,
        error: createArtistError
      } = await sb
        .from('artist_profiles')
        .insert([
          {
            artist_name:
              artistName,

            stage_name:
              artistName,

            genre:
              genre || 'Afrobeats',

            verified:
              false
          }
        ])
        .select('*')
        .single();

      if (createArtistError) {
        throw createArtistError;
      }

      artistProfile =
        newArtist;
    }

    // ==================================================
    // CLOUDINARY ENV
    // ==================================================

    const key =
      process.env.CLOUDINARY_API_KEY;

    const secret =
      process.env.CLOUDINARY_API_SECRET;

    const cloud =
      process.env.CLOUDINARY_CLOUD_NAME;

    if (!key || !secret || !cloud) {
      return res.status(500).json({
        success: false,
        error:
          'Missing Cloudinary ENV'
      });
    }

    const timestamp =
      Math.round(Date.now() / 1000);

    const songId =
      crypto.randomUUID();

    const songPublicId =
      `pasong_${songId}`;

    const sign = params =>
      crypto
        .createHash('sha1')
        .update(params + secret)
        .digest('hex');

    // ==================================================
    // SONG SIGNATURE
    // ==================================================

    const songFolder =
      'pasong-songs';

    const songSignatureString =
      `folder=${songFolder}` +
      `&public_id=${songPublicId}` +
      `&timestamp=${timestamp}`;

    const songUpload = {
      apiKey: key,

      timestamp,

      signature:
        sign(songSignatureString),

      folder:
        songFolder,

      public_id:
        songPublicId,

      publicId:
        songPublicId,

      uploadUrl:
        `https://api.cloudinary.com/v1_1/${cloud}/video/upload`
    };

    // ==================================================
    // COVER SIGNATURE
    // ==================================================

    const coverFolder =
      'pasong-covers';

    const coverPublicId =
      `${songPublicId}_cover`;

    const coverSignatureString =
      `folder=${coverFolder}` +
      `&public_id=${coverPublicId}` +
      `&timestamp=${timestamp}`;

    const coverUpload = {
      apiKey: key,

      timestamp,

      signature:
        sign(coverSignatureString),

      folder:
        coverFolder,

      public_id:
        coverPublicId,

      publicId:
        coverPublicId,

      uploadUrl:
        `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
    };

    // ==================================================
    // PRICING
    // ==================================================

    const country =
      getCountryFromRequest(req);

    const pricing =
      getSongPricing(country);

    const coverPricing =
      getCoverPricing(country);

    // ==================================================
    // RESPONSE
    // ==================================================

    res.json({
      success: true,

      songId,

      artistId:
        artistProfile?.id || null,

      country,

      pricing,

      coverPricing,

      songUpload,

      coverUpload,

      hasCover: true,

      suggestedStatus:
        'approved'
    });

  } catch (e) {
    console.error(
      'POST /api/songs/sign-upload ERROR:',
      e
    );

    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// CREATE SONG AFTER CLOUDINARY UPLOAD
// ======================================================
//
// BACKEND REQUIRES COVER.
// BACKEND DECIDES PRICE.
// BACKEND DECIDES STATUS.
//
// ======================================================

app.post('/api/songs/create', async (req, res) => {
  try {
    const sb =
      getSupabase();

    const {
      id,
      title,
      artist_id,
      genre,
      audio_url,
      cover_url,
      preview_url,
      duration_seconds,
      file_size
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error:
          'Song ID is required'
      });
    }

    if (!title) {
      return res.status(400).json({
        success: false,
        error:
          'Song title is required'
      });
    }

    if (!audio_url) {
      return res.status(400).json({
        success: false,
        error:
          'Audio URL is required'
      });
    }

    // ==================================================
    // COVER REQUIRED
    // ==================================================

    if (
      !cover_url ||
      !String(cover_url).trim()
    ) {
      return res.status(400).json({
        success: false,

        code:
          'COVER_REQUIRED',

        error:
          'Cover artwork is required. Song was not created.'
      });
    }

    // ==================================================
    // BACKEND STATUS
    // ==================================================

    const finalStatus =
      'approved';

    // ==================================================
    // BACKEND PRICE
    // ==================================================

    const country =
      getCountryFromRequest(req);

    const pricing =
      getSongPricing(country);

    // Database stores the base catalog amount.
    // Marketplace responses use IP pricing.
    //
    // For PASONG's current catalog:
    // Uganda base = UGX 700.
    //
    const catalogPrice =
      700;

    const catalogCurrency =
      'UGX';

    // ==================================================
    // INSERT SONG
    // ==================================================

    const {
      data,
      error
    } = await sb
      .from('songs')
      .insert([
        {
          id,

          title,

          artist_id:
            artist_id || null,

          genre:
            genre || 'Afrobeats',

          audio_url,

          preview_url:
            preview_url ||
            audio_url,

          cover_url:
            String(cover_url).trim(),

          duration_seconds:
            Number(duration_seconds) || 0,

          file_size:
            Number(file_size) || 0,

          price:
            catalogPrice,

          currency:
            catalogCurrency,

          status:
            finalStatus,

          featured:
            false,

          plays:
            0,

          downloads:
            0
        }
      ])
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    const song = {
      ...data,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist',

      marketplace_price:
        pricing.amount,

      marketplace_currency:
        pricing.currency,

      marketplace_label:
        pricing.label,

      marketplace_country:
        country
    };

    res.json({
      success: true,

      status:
        finalStatus,

      song,

      pricing
    });

  } catch (e) {
    console.error(
      'POST /api/songs/create ERROR:',
      e
    );

    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// OLD CREATE SONG ENDPOINT
// KEPT FOR COMPATIBILITY
// ======================================================
//
// This endpoint also requires a cover now.
//
// ======================================================

app.post('/api/songs', async (req, res) => {
  try {
    const sb =
      getSupabase();

    const {
      title,
      artist_id,
      genre,
      audio_url,
      cover_url,
      preview_url,
      duration_seconds,
      file_size
    } = req.body;

    if (!title || !audio_url) {
      return res.status(400).json({
        success: false,
        error:
          'Need title + audio_url'
      });
    }

    if (
      !cover_url ||
      !String(cover_url).trim()
    ) {
      return res.status(400).json({
        success: false,

        code:
          'COVER_REQUIRED',

        error:
          'Cover artwork is required'
      });
    }

    const country =
      getCountryFromRequest(req);

    const pricing =
      getSongPricing(country);

    const {
      data,
      error
    } = await sb
      .from('songs')
      .insert([
        {
          title,

          artist_id:
            artist_id || null,

          genre:
            genre || 'Afrobeats',

          audio_url,

          preview_url:
            preview_url ||
            audio_url,

          cover_url:
            String(cover_url).trim(),

          duration_seconds:
            Number(duration_seconds) || 0,

          file_size:
            Number(file_size) || 0,

          price:
            700,

          currency:
            'UGX',

          status:
            'approved',

          featured:
            false,

          plays:
            0,

          downloads:
            0
        }
      ])
      .select(`
        *,
        artist:artist_profiles!songs_artist_id_fkey (
          id,
          artist_name,
          stage_name,
          profile_image_url,
          cover_image_url,
          genre,
          bio,
          verified
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    const song = {
      ...data,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist',

      marketplace_price:
        pricing.amount,

      marketplace_currency:
        pricing.currency,

      marketplace_label:
        pricing.label,

      marketplace_country:
        country
    };

    res.json({
      success: true,

      song,

      pricing
    });

  } catch (e) {
    console.error(
      'POST /api/songs ERROR:',
      e
    );

    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// ======================================================
// COVER STATUS
// ======================================================

app.get(
  '/api/songs/:id/cover-status',
  async (req, res) => {
    try {
      const sb =
        getSupabase();

      const {
        data,
        error
      } = await sb
        .from('songs')
        .select(`
          id,
          title,
          cover_url,
          status
        `)
        .eq('id', req.params.id)
        .single();

      if (error) {
        throw error;
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error:
            'Song not found'
        });
      }

      res.json({
        success: true,

        songId:
          data.id,

        title:
          data.title,

        hasCover:
          Boolean(
            data.cover_url &&
            String(data.cover_url).trim()
          ),

        status:
          data.status,

        live:
          data.status === 'approved'
      });

    } catch (e) {
      console.error(
        'GET /api/songs/:id/cover-status ERROR:',
        e
      );

      res.status(404).json({
        success: false,
        error:
          'Song not found'
      });
    }
  }
);

// ======================================================
// START SERVER
// ======================================================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `PASONG API running on port ${PORT}`
  );
});

// ======================================================
// VERCEL / NODE EXPORT
// ======================================================

module.exports = app;
