const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://mtufczmjlkvycarxylgh.supabase.co';

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY;

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME ||
  'vuehnvkp';

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY ||
  '621955771344375';

const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);


/* =========================================================
   HELPERS
========================================================= */

function getCountryFromRequest(req) {
  const country =
    req.headers['x-vercel-ip-country'] ||
    req.headers['cf-ipcountry'] ||
    req.headers['x-country-code'] ||
    req.headers['x-country'] ||
    'UG';

  return String(country).trim().toUpperCase();
}


function getPricing(country) {
  const eastAfrica = [
    'UG',
    'KE',
    'TZ',
    'RW',
    'BI',
    'SS'
  ];

  const africa = [
    'UG',
    'KE',
    'TZ',
    'RW',
    'BI',
    'SS',
    'NG',
    'GH',
    'ZA',
    'ZM',
    'ZW',
    'MW',
    'MZ',
    'ET',
    'SN',
    'CI',
    'CM',
    'CD',
    'CG',
    'AO',
    'BW',
    'NA',
    'SL',
    'LR',
    'GM',
    'GN',
    'BJ',
    'TG',
    'BF',
    'NE',
    'ML',
    'MR',
    'TD',
    'CF',
    'GA',
    'GQ',
    'DJ',
    'ER',
    'SO',
    'SD',
    'LY',
    'DZ',
    'MA',
    'TN'
  ];

  if (country === 'UG') {
    return {
      country: country,
      amount: 700,
      currency: 'UGX',
      label: 'UGX 700'
    };
  }

  if (eastAfrica.indexOf(country) !== -1) {
    return {
      country: country,
      amount: 1000,
      currency: 'UGX',
      label: 'UGX 1,000'
    };
  }

  if (africa.indexOf(country) !== -1) {
    return {
      country: country,
      amount: 0.57,
      currency: 'USD',
      label: '$0.57'
    };
  }

  if (country === 'GB') {
    return {
      country: country,
      amount: 1,
      currency: 'GBP',
      label: '£1'
    };
  }

  return {
    country: country,
    amount: 1,
    currency: 'USD',
    label: '$1'
  };
}


function getCoverPricing(country) {
  if (country === 'UG') {
    return {
      country: country,
      amount: 10000,
      currency: 'UGX',
      label: 'UGX 10,000'
    };
  }

  return {
    country: country,
    amount: 10,
    currency: 'USD',
    label: '$10'
  };
}


function getTipPricing(country) {
  const songPricing = getPricing(country);

  return {
    country: country,
    currency: songPricing.currency,
    artistPercent: 70,
    pasongPercent: 30
  };
}


function makeCloudinarySignature(params) {
  if (!CLOUDINARY_API_SECRET) {
    throw new Error('CLOUDINARY_API_SECRET is not configured');
  }

  const keys = Object.keys(params).sort();

  const parts = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    if (
      params[key] !== undefined &&
      params[key] !== null &&
      params[key] !== ''
    ) {
      parts.push(
        key + '=' + params[key]
      );
    }
  }

  const stringToSign = parts.join('&');

  return crypto
    .createHash('sha1')
    .update(
      stringToSign + CLOUDINARY_API_SECRET
    )
    .digest('hex');
}


/* =========================================================
   BASIC ROUTES
========================================================= */

app.get('/', function (req, res) {
  res.json({
    success: true,
    message: 'PASONG API is LIVE',
    pricing: 'ready',
    upload: 'ready',
    coverWorkflow: 'ready',
    tips: 'ready',
    cloudinary: 'ready'
  });
});


app.get('/health', function (req, res) {
  res.json({
    success: true,
    status: 'PASONG: LIVE',
    upload: 'READY',
    cloudinary: 'READY',
    pricing: 'READY',
    coverWorkflow: 'READY',
    tips: 'READY'
  });
});


/* =========================================================
   PRICING
========================================================= */

app.get('/api/pricing', function (req, res) {
  try {
    const country = getCountryFromRequest(req);

    const song = getPricing(country);
    const cover = getCoverPricing(country);
    const tips = getTipPricing(country);

    res.json({
      success: true,
      country: country,
      song: song,
      cover: cover,
      tips: tips
    });
  } catch (error) {
    console.error('Pricing error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   CLOUDINARY SIGNATURE
   PROFILE IMAGES
========================================================= */

function cloudinarySignatureHandler(req, res) {
  try {
    if (!CLOUDINARY_API_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'CLOUDINARY_API_SECRET is not configured on Render'
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const requestedFolder =
      req.body && req.body.folder
        ? req.body.folder
        : req.query && req.query.folder
        ? req.query.folder
        : 'pasong-profiles';

    const folder =
      String(requestedFolder).trim() || 'pasong-profiles';

    const requestedPublicId =
      req.body && req.body.public_id
        ? req.body.public_id
        : req.query && req.query.public_id
        ? req.query.public_id
        : null;

    const publicId =
      requestedPublicId
        ? String(requestedPublicId)
        : 'pasong_' + Date.now();

    const signature = makeCloudinarySignature({
      folder: folder,
      public_id: publicId,
      timestamp: timestamp
    });

    const uploadUrl =
      'https://api.cloudinary.com/v1_1/' +
      CLOUDINARY_CLOUD_NAME +
      '/image/upload';

    res.json({
      success: true,

      cloud_name: CLOUDINARY_CLOUD_NAME,
      cloudName: CLOUDINARY_CLOUD_NAME,

      api_key: CLOUDINARY_API_KEY,
      apiKey: CLOUDINARY_API_KEY,

      timestamp: timestamp,

      signature: signature,

      folder: folder,

      public_id: publicId,
      publicId: publicId,

      upload_url: uploadUrl,
      uploadUrl: uploadUrl
    });
  } catch (error) {
    console.error(
      'Cloudinary signature error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}


app.get(
  '/api/cloudinary/signature',
  cloudinarySignatureHandler
);


app.post(
  '/api/cloudinary/signature',
  cloudinarySignatureHandler
);


/* =========================================================
   SONG UPLOAD SIGNATURES
========================================================= */

app.get('/api/songs/sign-upload', async function (req, res) {
  try {
    const country = getCountryFromRequest(req);

    const songPricing = getPricing(country);
    const coverPricing = getCoverPricing(country);

    const title =
      req.query.title
        ? String(req.query.title).trim()
        : 'pasong-song';

    const artistName =
      req.query.artist_name
        ? String(req.query.artist_name).trim()
        : 'PASONG Artist';

    const coverProvided =
      req.query.has_cover === 'true' ||
      req.query.has_cover === '1';

    if (!coverProvided) {
      return res.status(400).json({
        success: false,
        error: 'Cover image is required before uploading a PASONG song.',
        coverRequired: true,
        coverPricing: coverPricing
      });
    }

    const audioTimestamp =
      Math.floor(Date.now() / 1000);

    const coverTimestamp =
      Math.floor(Date.now() / 1000);

    const songPublicId =
      'song_' + Date.now();

    const coverPublicId =
      'cover_' + Date.now();

    const songFolder = 'pasong-songs';
    const coverFolder = 'pasong-covers';

    const songSignature =
      makeCloudinarySignature({
        folder: songFolder,
        public_id: songPublicId,
        timestamp: audioTimestamp
      });

    const coverSignature =
      makeCloudinarySignature({
        folder: coverFolder,
        public_id: coverPublicId,
        timestamp: coverTimestamp
      });

    const audioUploadUrl =
      'https://api.cloudinary.com/v1_1/' +
      CLOUDINARY_CLOUD_NAME +
      '/video/upload';

    const coverUploadUrl =
      'https://api.cloudinary.com/v1_1/' +
      CLOUDINARY_CLOUD_NAME +
      '/image/upload';

    res.json({
      success: true,

      country: country,

      pricing: songPricing,

      coverPricing: coverPricing,

      artistName: artistName,

      title: title,

      songId: null,

      artistId: null,

      songUpload: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        cloudName: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        apiKey: CLOUDINARY_API_KEY,
        timestamp: audioTimestamp,
        signature: songSignature,
        folder: songFolder,
        public_id: songPublicId,
        publicId: songPublicId,
        upload_url: audioUploadUrl,
        uploadUrl: audioUploadUrl
      },

      coverUpload: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        cloudName: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        apiKey: CLOUDINARY_API_KEY,
        timestamp: coverTimestamp,
        signature: coverSignature,
        folder: coverFolder,
        public_id: coverPublicId,
        publicId: coverPublicId,
        upload_url: coverUploadUrl,
        uploadUrl: coverUploadUrl
      },

      audio: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        cloudName: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        apiKey: CLOUDINARY_API_KEY,
        timestamp: audioTimestamp,
        signature: songSignature,
        folder: songFolder,
        public_id: songPublicId,
        publicId: songPublicId,
        upload_url: audioUploadUrl,
        uploadUrl: audioUploadUrl
      },

      cover: {
        cloud_name: CLOUDINARY_CLOUD_NAME,
        cloudName: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        apiKey: CLOUDINARY_API_KEY,
        timestamp: coverTimestamp,
        signature: coverSignature,
        folder: coverFolder,
        public_id: coverPublicId,
        publicId: coverPublicId,
        upload_url: coverUploadUrl,
        uploadUrl: coverUploadUrl
      },

      hasCover: true,

      suggestedStatus: 'approved'
    });
  } catch (error) {
    console.error(
      'Song upload signing error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   SONGS - GET ALL APPROVED SONGS
========================================================= */

app.get('/api/songs', async function (req, res) {
  try {
    const country = getCountryFromRequest(req);
    const pricing = getPricing(country);

    const result = await supabase
      .from('songs')
      .select('*')
      .eq('status', 'approved')
      .not('cover_url', 'is', null)
      .order('created_at', {
        ascending: false
      });

    if (result.error) {
      throw result.error;
    }

    const songs = result.data || [];

    const formattedSongs = songs.map(function (song) {
      return Object.assign({}, song, {
        display_price: pricing.amount,
        display_currency: pricing.currency,
        display_price_label: pricing.label,
        country: country
      });
    });

    res.json({
      success: true,
      country: country,
      pricing: pricing,
      songs: formattedSongs,
      nextCursor: null
    });
  } catch (error) {
    console.error(
      'Get songs error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message,
      songs: []
    });
  }
});


/* =========================================================
   SINGLE SONG
========================================================= */

app.get('/api/songs/:id', async function (req, res) {
  try {
    const country = getCountryFromRequest(req);
    const pricing = getPricing(country);

    const result = await supabase
      .from('songs')
      .select('*')
      .eq('id', req.params.id)
      .eq('status', 'approved')
      .not('cover_url', 'is', null)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      return res.status(404).json({
        success: false,
        error: 'Song not found'
      });
    }

    const song = Object.assign(
      {},
      result.data,
      {
        display_price: pricing.amount,
        display_currency: pricing.currency,
        display_price_label: pricing.label,
        country: country
      }
    );

    res.json({
      success: true,
      country: country,
      pricing: pricing,
      song: song
    });
  } catch (error) {
    console.error(
      'Get single song error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   CREATE SONG
========================================================= */

app.post('/api/songs/create', async function (req, res) {
  try {
    const body = req.body || {};

    const title =
      body.title
        ? String(body.title).trim()
        : '';

    const artistId =
      body.artist_id ||
      null;

    const audioUrl =
      body.audio_url
        ? String(body.audio_url).trim()
        : '';

    const coverUrl =
      body.cover_url
        ? String(body.cover_url).trim()
        : '';

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Song title is required'
      });
    }

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Audio URL is required'
      });
    }

    if (!coverUrl) {
      return res.status(400).json({
        success: false,
        error: 'Cover image is required. Songs without covers cannot be uploaded.',
        coverRequired: true
      });
    }

    const insertData = {
      id: body.id || undefined,
      artist_id: artistId,
      album_id: body.album_id || null,
      category_id: body.category_id || null,
      title: title,

      price: 700,
      currency: 'UGX',

      status: 'approved',

      cover_url: coverUrl,
      audio_url: audioUrl,

      preview_url:
        body.preview_url ||
        audioUrl,

      genre:
        body.genre ||
        null,

      description:
        body.description ||
        null,

      duration_seconds:
        Number(body.duration_seconds || 0),

      file_size:
        Number(body.file_size || 0),

      featured:
        Boolean(body.featured || false),

      plays:
        Number(body.plays || 0),

      downloads:
        Number(body.downloads || 0)
    };

    const result = await supabase
      .from('songs')
      .insert(insertData)
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }

    res.json({
      success: true,
      message: 'Song uploaded successfully',
      song: result.data
    });
  } catch (error) {
    console.error(
      'Create song error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   COMPATIBILITY POST /api/songs
========================================================= */

app.post('/api/songs', async function (req, res) {
  try {
    const body = req.body || {};

    if (!body.cover_url) {
      return res.status(400).json({
        success: false,
        error: 'Cover image is required.',
        coverRequired: true
      });
    }

    const insertData = {
      artist_id: body.artist_id || null,
      album_id: body.album_id || null,
      category_id: body.category_id || null,
      title: body.title || '',
      price: 700,
      currency: 'UGX',
      status: 'approved',
      cover_url: body.cover_url,
      audio_url: body.audio_url || '',
      preview_url: body.preview_url || body.audio_url || '',
      genre: body.genre || null,
      description: body.description || null,
      duration_seconds: Number(body.duration_seconds || 0),
      file_size: Number(body.file_size || 0),
      featured: Boolean(body.featured || false),
      plays: Number(body.plays || 0),
      downloads: Number(body.downloads || 0)
    };

    const result = await supabase
      .from('songs')
      .insert(insertData)
      .select()
      .single();

    if (result.error) {
      throw result.error;
    }

    res.json({
      success: true,
      song: result.data
    });
  } catch (error) {
    console.error(
      'POST /api/songs error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   COVER STATUS
========================================================= */

app.get('/api/songs/:id/cover-status', async function (req, res) {
  try {
    const result = await supabase
      .from('songs')
      .select('id,title,cover_url,status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    if (!result.data) {
      return res.status(404).json({
        success: false,
        error: 'Song not found'
      });
    }

    res.json({
      success: true,
      song: result.data,
      hasCover:
        Boolean(result.data.cover_url),
      approved:
        result.data.status === 'approved'
    });
  } catch (error) {
    console.error(
      'Cover status error:',
      error
    );

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, function () {
  console.log(
    'PASONG API running on port ' + PORT
  );
});


module.exports = app;
