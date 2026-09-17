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
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname)));

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

  return String(country).toUpperCase();
}

// ======================================================
// SONG PRICING
// ======================================================

function getSongPricing(country) {
  // Uganda
  if (country === 'UG') {
    return {
      country: 'UG',
      amount: 700,
      currency: 'UGX',
      label: 'UGX 700'
    };
  }

  // Kenya
  if (country === 'KE') {
    return {
      country: 'KE',
      amount: 1000,
      currency: 'UGX',
      localAmount: 35,
      localCurrency: 'KES',
      label: 'UGX 1,000 / 35 KES'
    };
  }

  // Rwanda / Tanzania
  if (['RW', 'TZ'].includes(country)) {
    return {
      country,
      amount: 1000,
      currency: 'UGX',
      label: 'UGX 1,000'
    };
  }

  // Ghana / Nigeria / Zambia / South Africa / Cameroon
  if (['GH', 'NG', 'ZM', 'ZA', 'CM'].includes(country)) {
    return {
      country,
      amount: 0.50,
      currency: 'USD',
      label: '$0.50'
    };
  }

  // USA, UK and other countries
  return {
    country,
    amount: 1.00,
    currency: 'USD',
    label: '$1.00'
  };
}

// ======================================================
// COVER DESIGN PRICING
// ======================================================

function getCoverPricing(country) {
  // Uganda
  if (country === 'UG') {
    return {
      country: 'UG',
      amount: 10000,
      currency: 'UGX',
      label: 'UGX 10,000'
    };
  }

  // International / diaspora
  return {
    country,
    amount: 10,
    currency: 'USD',
    label: '$10'
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
    time: new Date().toISOString()
  });
});

// ======================================================
// STATIC PAGES
// ======================================================

app.get('/music-store.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'music-store.html'));
});

app.get('/pasong_checkout.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'pasong_checkout.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ======================================================
// GET CURRENT PRICING
// ======================================================

app.get('/api/pricing', (req, res) => {
  try {
    const country = getCountryFromRequest(req);

    res.json({
      success: true,
      country,
      song: getSongPricing(country),
      cover: getCoverPricing(country)
    });
  } catch (e) {
    console.error('GET /api/pricing ERROR:', e);

    res.status(500).json({
      error: e.message
    });
  }
});

// ======================================================
// GET ALL APPROVED SONGS
// ======================================================

app.get('/api/songs', async (req, res) => {
  try {
    const sb = getSupabase();

    const country = getCountryFromRequest(req);
    const pricing = getSongPricing(country);

    const { data, error } = await sb
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
      .order('created_at', {
        ascending: false
      })
      .limit(50);

    if (error) {
      throw error;
    }

    const songs = (data || []).map(song => ({
      ...song,

      artist_id: song.artist_id || null,

      artist: song.artist || null,

      artist_name:
        song.artist?.stage_name ||
        song.artist?.artist_name ||
        'Unknown Artist',

      marketplace_price: pricing.amount,
      marketplace_currency: pricing.currency,
      marketplace_label: pricing.label,
      marketplace_country: country,

      ...(pricing.localAmount
        ? {
            local_price: pricing.localAmount,
            local_currency: pricing.localCurrency
          }
        : {})
    }));

    res.json({
      success: true,
      country,
      pricing,
      songs
    });

  } catch (e) {
    console.error('GET /api/songs ERROR:', e);

    res.status(500).json({
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
    const sb = getSupabase();

    const country = getCountryFromRequest(req);
    const pricing = getSongPricing(country);

    const { data, error } = await sb
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
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        error: 'Song not found'
      });
    }

    const song = {
      ...data,

      artist_id: data.artist_id || null,

      artist: data.artist || null,

      artist_name:
        data.artist?.stage_name ||
        data.artist?.artist_name ||
        'Unknown Artist',

      marketplace_price: pricing.amount,
      marketplace_currency: pricing.currency,
      marketplace_label: pricing.label,
      marketplace_country: country,

      ...(pricing.localAmount
        ? {
            local_price: pricing.localAmount,
            local_currency: pricing.localCurrency
          }
        : {})
    };

    res.json({
      success: true,
      country,
      pricing,
      song
    });

  } catch (e) {
    console.error('GET /api/songs/:id ERROR:', e);

    res.status(404).json({
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
      public_id = `song_${Date.now()}`
    } = req.body;

    const timestamp = Math.round(Date.now() / 1000);

    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;

    if (!key || !secret || !cloud) {
      return res.status(500).json({
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

    const coverFolder = 'pasong-covers';
    const coverPublicId = `${public_id}_cover`;

    const coverString =
      `folder=${coverFolder}` +
      `&public_id=${coverPublicId}` +
      `&timestamp=${timestamp}`;

    res.json({
      song: {
        apiKey: key,
        timestamp,
        signature: sign(songString),
        folder,
        public_id,
        publicId: public_id,
        uploadUrl:
          `https://api.cloudinary.com/v1_1/${cloud}/video/upload`
      },

      cover: {
        apiKey: key,
        timestamp,
        signature: sign(coverString),
        folder: coverFolder,
        public_id: coverPublicId,
        publicId: coverPublicId,
        uploadUrl:
          `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
      }
    });

  } catch (e) {
    console.error('Cloudinary signature ERROR:', e);

    res.status(500).json({
      error: e.message
    });
  }
});

// ======================================================
// SIGN SONG UPLOAD
// ======================================================

app.post('/api/songs/sign-upload', async (req, res) => {
  try {
    const sb = getSupabase();

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

    if (!artistName) {
      return res.status(400).json({
        error: 'Artist name is required'
      });
    }

    if (!songTitle) {
      return res.status(400).json({
        error: 'Song title is required'
      });
    }

    if (!fileName) {
      return res.status(400).json({
        error: 'Song file is required'
      });
    }

    if (!contract) {
      return res.status(400).json({
        error: 'Upload agreement is required'
      });
    }

    // Song max 10 MB
    if (fileSize && Number(fileSize) > 10 * 1024 * 1024) {
      return res.status(400).json({
        error: 'Song file must not exceed 10 MB'
      });
    }

    // Cover max 5 MB
    if (
      coverFileSize &&
      Number(coverFileSize) > 5 * 1024 * 1024
    ) {
      return res.status(400).json({
        error: 'Cover image must not exceed 5 MB'
      });
    }

    // ==================================================
    // FIND OR CREATE ARTIST
    // ==================================================

    let artistProfile = null;

    const { data: existingArtist, error: artistFindError } =
      await sb
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
      artistProfile = existingArtist;
    } else {
      const { data: newArtist, error: createArtistError } =
        await sb
          .from('artist_profiles')
          .insert([
            {
              artist_name: artistName,
              stage_name: artistName,
              genre: genre || 'Afrobeats',
              verified: false
            }
          ])
          .select('*')
          .single();

      if (createArtistError) {
        throw createArtistError;
      }

      artistProfile = newArtist;
    }

    // ==================================================
    // CLOUDINARY
    // ==================================================

    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;

    if (!key || !secret || !cloud) {
      return res.status(500).json({
        error: 'Missing Cloudinary ENV'
      });
    }

    const timestamp = Math.round(Date.now() / 1000);

    const songId = crypto.randomUUID();

    const songPublicId = `pasong_${songId}`;

    const sign = params =>
      crypto
        .createHash('sha1')
        .update(params + secret)
        .digest('hex');

    // ==================================================
    // SONG UPLOAD SIGNATURE
    // ==================================================

    const songFolder = 'pasong-songs';

    const songSignatureString =
      `folder=${songFolder}` +
      `&public_id=${songPublicId}` +
      `&timestamp=${timestamp}`;

    const songUpload = {
      apiKey: key,
      timestamp,
      signature: sign(songSignatureString),
      folder: songFolder,
      public_id: songPublicId,
      publicId: songPublicId,
      uploadUrl:
        `https://api.cloudinary.com/v1_1/${cloud}/video/upload`
    };

    // ==================================================
    // COVER UPLOAD SIGNATURE
    // ONLY IF ARTIST PROVIDED COVER
    // ==================================================

    let coverUpload = null;

    if (coverFileName) {
      const coverFolder = 'pasong-covers';
      const coverPublicId = `${songPublicId}_cover`;

      const coverSignatureString =
        `folder=${coverFolder}` +
        `&public_id=${coverPublicId}` +
        `&timestamp=${timestamp}`;

      coverUpload = {
        apiKey: key,
        timestamp,
        signature: sign(coverSignatureString),
        folder: coverFolder,
        public_id: coverPublicId,
        publicId: coverPublicId,
        uploadUrl:
          `https://api.cloudinary.com/v1_1/${cloud}/image/upload`
      };
    }

    // ==================================================
    // PRICING
    // ==================================================

    const country = getCountryFromRequest(req);

    const pricing = getSongPricing(country);

    const coverPricing = getCoverPricing(country);

    res.json({
      success: true,

      songId,

      artistId: artistProfile?.id || null,

      country,

      pricing,

      coverPricing,

      songUpload,

      coverUpload,

      hasCover: Boolean(coverFileName),

      suggestedStatus: coverFileName
        ? 'approved'
        : 'pending_cover'
    });

  } catch (e) {
    console.error(
      'POST /api/songs/sign-upload ERROR:',
      e
    );

    res.status(500).json({
      error: e.message
    });
  }
});

// ======================================================
// CREATE SONG AFTER CLOUDINARY UPLOAD
// ======================================================

app.post('/api/songs/create', async (req, res) => {
  try {
    const sb = getSupabase();

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
        error: 'Song ID is required'
      });
    }

    if (!title) {
      return res.status(400).json({
        error: 'Song title is required'
      });
    }

    if (!audio_url) {
      return res.status(400).json({
        error: 'Audio URL is required'
      });
    }

    // ==================================================
    // BACKEND DECIDES STATUS
    // ==================================================

    const finalStatus =
      cover_url && String(cover_url).trim()
        ? 'approved'
        : 'pending_cover';

    // ==================================================
    // CANONICAL CATALOG PRICE
    // ==================================================

    const catalogPrice = 700;
    const catalogCurrency = 'UGX';

    const { data, error } = await sb
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
            cover_url || '',

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

    const country = getCountryFromRequest(req);
    const pricing = getSongPricing(country);

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

      status: finalStatus,

      song,

      pricing
    });

  } catch (e) {
    console.error(
      'POST /api/songs/create ERROR:',
      e
    );

    res.status(500).json({
      error: e.message
    });
  }
});

// ======================================================
// OLD CREATE SONG ENDPOINT
// KEPT FOR COMPATIBILITY
// ======================================================

app.post('/api/songs', async (req, res) => {
  try {
    const sb = getSupabase();

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
        error: 'Need title + audio_url'
      });
    }

    const finalStatus =
      cover_url && String(cover_url).trim()
        ? 'approved'
        : 'pending_cover';

    const { data, error } = await sb
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
            cover_url || '',

          duration_seconds:
            Number(duration_seconds) || 0,

          file_size:
            Number(file_size) || 0,

          price:
            700,

          currency:
            'UGX',

          status:
            finalStatus,

          featured:
            false
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

    const country = getCountryFromRequest(req);
    const pricing = getSongPricing(country);

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
      error: e.message
    });
  }
});

// ======================================================
// COVER STATUS
// ======================================================

app.get('/api/songs/:id/cover-status', async (req, res) => {
  try {
    const sb = getSupabase();

    const { data, error } = await sb
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
        error: 'Song not found'
      });
    }

    res.json({
      success: true,

      songId: data.id,

      title: data.title,

      hasCover:
        Boolean(data.cover_url),

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
      error: 'Song not found'
    });
  }
});

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
