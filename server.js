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
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

return String(country).trim().toUpperCase();
}

// ======================================================
// COUNTRY GROUPS
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
'ST',
'SN',
'SC',
'SL',
'SO',
'ZA',
'SD',
'TG',
'TN',
'UG',
'ZM',
'ZW'
];

// ======================================================
// SONG PRICING
// ======================================================

function getSongPricing(country) {
const code =
String(country || 'UG')
.trim()
.toUpperCase();

// Uganda
if (code === 'UG') {
return {
country: 'UG',
amount: 700,
currency: 'UGX',
label: 'UGX 700'
};
}

// East Africa
if (EAST_AFRICA.includes(code)) {
return {
country: code,
amount: 1000,
currency: 'UGX',
label: 'UGX 1,000'
};
}

// Other African countries
if (AFRICA.includes(code)) {
return {
country: code,
amount: 0.57,
currency: 'USD',
label: '$0.57'
};
}

// United Kingdom
if (code === 'GB') {
return {
country: 'GB',
amount: 1,
currency: 'GBP',
label: '£1'
};
}

// Rest of world
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
const code =
String(country || 'UG')
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
// TIP SPLIT
// ARTIST 70%
// PASONG 30%
// ======================================================

function calculateTipSplit(tipAmount) {
const amount = Number(tipAmount) || 0;

if (amount < 0) {
throw new Error('Tip amount cannot be negative');
}

const artistTip =
Math.floor(amount * 0.70 * 100) / 100;

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
cloudinary: 'READY'
});
});

// ======================================================
// HEALTH
// ======================================================

app.get('/health', (req, res) => {
res.json({
PASONG: 'LIVE',
upload: 'READY',
pricing: 'READY',
coverWorkflow: 'READY',
tips: 'READY',
cloudinary: 'READY',
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
// PRICING API
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
// TIP VALIDATION
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
// CLOUDINARY SIGNATURE HELPER
// ======================================================

function createCloudinarySignature(req) {
const key =
process.env.CLOUDINARY_API_KEY;

const secret =
process.env.CLOUDINARY_API_SECRET;

const cloud =
process.env.CLOUDINARY_CLOUD_NAME;

if (!key || !secret || !cloud) {
throw new Error(
'Missing Cloudinary ENV'
);
}

const timestamp =
Math.round(Date.now() / 1000);

const folder =
req.body?.folder ||
req.query?.folder ||
'pasong-profiles';

// IMPORTANT:
// This is a JavaScript template literal.
// Date.now() WILL be evaluated.
const publicId =
req.body?.public_id ||
req.query?.public_id ||
"pasong_${Date.now()}";

const sign = params => {
return crypto
.createHash('sha1')
.update(params + secret)
.digest('hex');
};

const signatureString =
"folder=${folder}" +
"&public_id=${publicId}" +
"&timestamp=${timestamp}";

return {
success: true,

cloud_name:
  cloud,

cloudName:
  cloud,

api_key:
  key,

apiKey:
  key,

timestamp,

signature:
  sign(signatureString),

folder,

public_id:
  publicId,

publicId:
  publicId,

upload_url:
  `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,

uploadUrl:
  `https://api.cloudinary.com/v1_1/${cloud}/image/upload`

};
}

// ======================================================
// CLOUDINARY SIGNATURE - GET
// USED BY PROFILE PICTURE
// ======================================================

app.get(
'/api/cloudinary/signature',
(req, res) => {
try {
const result =
createCloudinarySignature(req);

  res.json(result);

} catch (e) {
  console.error(
    'GET /api/cloudinary/signature ERROR:',
    e
  );

  res.status(500).json({
    success: false,
    error: e.message
  });
}

}
);

// ======================================================
// CLOUDINARY SIGNATURE - POST
// ======================================================

app.post(
'/api/cloudinary/signature',
(req, res) => {
try {
const result =
createCloudinarySignature(req);

  res.json(result);

} catch (e) {
  console.error(
    'POST /api/cloudinary/signature ERROR:',
    e
  );

  res.status(500).json({
    success: false,
    error: e.message
  });
}

}
);

// ======================================================
// GET APPROVED SONGS
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
} =
  await sb
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
    .map(song => {
      return {
        ...song,

        artist_id:
          song.artist_id || null,

        artist:
          song.artist || null,

        artist_name:
          song.artist?.stage_name ||
          song.artist?.artist_name ||
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
    });

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
// GET ONE SONG
// ======================================================

app.get(
'/api/songs/:id',
async (req, res) => {
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
  } =
    await sb
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

}
);

// ======================================================
// SIGN SONG + COVER UPLOAD
// ======================================================

app.post(
'/api/songs/sign-upload',
async (req, res) => {
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

  // COVER IS REQUIRED
  if (!coverFileName) {
    return res.status(400).json({
      success: false,
      code: 'COVER_REQUIRED',
      error:
        'Cover artwork is required. Please upload a cover before uploading your song.'
    });
  }

  // SONG SIZE
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

  // COVER SIZE
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
  // FIND ARTIST PROFILE
  // ==================================================

  let artistProfile = null;

  const {
    data: existingArtist,
    error: artistFindError
  } =
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
    artistProfile =
      existingArtist;
  } else {
    const {
      data: newArtist,
      error: createArtistError
    } =
      await sb
        .from('artist_profiles')
        .insert([
          {
            artist_name:
              artistName,

            stage_name:
              artistName,

            genre:
              genre ||
              'Afrobeats',

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

  const sign = params => {
    return crypto
      .createHash('sha1')
      .update(params + secret)
      .digest('hex');
  };

  // ==================================================
  // SONG UPLOAD
  // ==================================================

  const songFolder =
    'pasong-songs';

  const songSignatureString =
    `folder=${songFolder}` +
    `&public_id=${songPublicId}` +
    `&timestamp=${timestamp}`;

  const songUpload = {
    apiKey:
      key,

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
  // COVER UPLOAD
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
    apiKey:
      key,

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

  const country =
    getCountryFromRequest(req);

  const pricing =
    getSongPricing(country);

  const coverPricing =
    getCoverPricing(country);

  res.json({
    success: true,

    songId,

    artistId:
      artistProfile?.id ||
      null,

    country,

    pricing,

    coverPricing,

    songUpload,

    coverUpload,

    // Compatibility aliases
    audio:
      songUpload,

    cover:
      coverUpload,

    hasCover:
      true,

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

}
);

// ======================================================
// CREATE SONG
// ======================================================

app.post(
'/api/songs/create',
async (req, res) => {
try {
const sb =
getSupabase();

  const {
    id,
    title,
    artist_id,
    genre,
    description,
    audio_url,
    cover_url,
    preview_url,
    duration_seconds,
    file_size
  } = req.body;

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'Song ID is required'
    });
  }

  if (!title) {
    return res.status(400).json({
      success: false,
      error: 'Song title is required'
    });
  }

  if (!audio_url) {
    return res.status(400).json({
      success: false,
      error: 'Audio URL is required'
    });
  }

  // COVER REQUIRED
  if (
    !cover_url ||
    !String(cover_url).trim()
  ) {
    return res.status(400).json({
      success: false,
      code: 'COVER_REQUIRED',
      error:
        'Cover artwork is required. Song was not created.'
    });
  }

  const country =
    getCountryFromRequest(req);

  const pricing =
    getSongPricing(country);

  // Internal catalog price.
  // Visitor-facing price is calculated from IP.
  const catalogPrice =
    700;

  const catalogCurrency =
    'UGX';

  const {
    data,
    error
  } =
    await sb
      .from('songs')
      .insert([
        {
          id,

          title,

          artist_id:
            artist_id ||
            null,

          genre:
            genre ||
            'Afrobeats',

          description:
            description ||
            null,

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
    status: 'approved',
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

}
);

// ======================================================
// COMPATIBILITY SONG CREATE
// ======================================================

app.post(
'/api/songs',
async (req, res) => {
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
      code: 'COVER_REQUIRED',
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
  } =
    await sb
      .from('songs')
      .insert([
        {
          title,

          artist_id:
            artist_id ||
            null,

          genre:
            genre ||
            'Afrobeats',

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

}
);

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
  } =
    await sb
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
      error: 'Song not found'
    });
  }

  const hasCover =
    Boolean(
      data.cover_url &&
      String(data.cover_url).trim()
    );

  res.json({
    success: true,

    songId:
      data.id,

    title:
      data.title,

    hasCover,

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
    error: 'Song not found'
  });
}

}
);

// ======================================================
// 404 API HANDLER
// ======================================================

app.use('/api', (req, res) => {
res.status(404).json({
success: false,
error: 'PASONG API endpoint not found',
path: req.originalUrl
});
});

// ======================================================
// SERVER
// ======================================================

const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {
console.log(
"PASONG API running on port ${PORT}"
);
});

module.exports = app;
