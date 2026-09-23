const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map(v => v.trim())
    : "*"
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const PASONG_PAYMENT_SECRET = process.env.PASONG_PAYMENT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

if (
  !CLOUDINARY_CLOUD_NAME ||
  !CLOUDINARY_API_KEY ||
  !CLOUDINARY_API_SECRET
) {
  console.error("Missing Cloudinary environment variables");
  process.exit(1);
}

if (!PASONG_PAYMENT_SECRET) {
  console.error("Missing PASONG_PAYMENT_SECRET");
  process.exit(1);
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed"));
    }
  }
});

app.get("/", (req, res) => {
  res.json({
    PASONG: "LIVE",
    upload: "READY",
    producer_marketplace: "READY",
    beats: "READY"
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

async function getAuthenticatedUser(req) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return null;
    }

    const token = header.substring(7).trim();

    if (!token) {
      return null;
    }

    const result = await supabase.auth.getUser(token);

    if (
      result.error ||
      !result.data ||
      !result.data.user
    ) {
      return null;
    }

    return result.data.user;
  } catch {
    return null;
  }
}

function getCountry(req) {
  return String(
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    ""
  )
    .trim()
    .toUpperCase();
}

function getPricing(req) {
  const country = getCountry(req);

  if (country === "UG") {
    return {
      amount: 700,
      currency: "UGX",
      label: "UGX 700"
    };
  }

  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS",
    "ET"
  ];

  if (eastAfrica.includes(country)) {
    return {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000"
    };
  }

  const africa = [
    "NG",
    "GH",
    "ZA",
    "ZM",
    "ZW",
    "MW",
    "MZ",
    "BW",
    "NA",
    "CM",
    "SN",
    "CI",
    "SL",
    "LR",
    "GM",
    "GN",
    "EG",
    "MA",
    "DZ",
    "TN"
  ];

  if (africa.includes(country)) {
    return {
      amount: 0.57,
      currency: "USD",
      label: "$0.57"
    };
  }

  if (country === "GB") {
    return {
      amount: 1,
      currency: "GBP",
      label: "£1"
    };
  }

  return {
    amount: 1,
    currency: "USD",
    label: "$1"
  };
}

function getCoverDesignPrice(req) {
  if (getCountry(req) === "UG") {
    return {
      amount: 10000,
      currency: "UGX",
      label: "UGX 10,000"
    };
  }

  return {
    amount: 10,
    currency: "USD",
    label: "$10"
  };
}

function safeSecretCompare(a, b) {
  const first = Buffer.from(String(a || ""));
  const second = Buffer.from(String(b || ""));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function validPositiveNumber(value) {
  const number = Number(value);

  return (
    Number.isFinite(number) &&
    number > 0
  );
}

function allowedPaymentProvider(provider) {
  return [
    "MTN",
    "AIRTEL",
    "MTN MOMO",
    "AIRTEL MONEY"
  ].includes(
    String(provider || "")
      .trim()
      .toUpperCase()
  );
}

function normalizeProvider(provider) {
  const value = String(provider || "")
    .trim()
    .toUpperCase();

  if (value === "MTN MOMO") {
    return "MTN";
  }

  if (value === "AIRTEL MONEY") {
    return "AIRTEL";
  }

  return value;
}

app.get("/api/pricing", (req, res) => {
  const pricing = getPricing(req);

  res.json({
    country: getCountry(req),
    price: pricing.amount,
    currency: pricing.currency,
    label: pricing.label
  });
});

app.get("/api/cover-design-price", (req, res) => {
  const pricing = getCoverDesignPrice(req);

  res.json({
    country: getCountry(req),
    price: pricing.amount,
    currency: pricing.currency,
    label: pricing.label
  });
});

app.get("/api/tip-split", (req, res) => {
  res.json({
    artist_percent: 70,
    pasong_percent: 30
  });
});

app.post(
  "/api/upload/cover",
  coverUpload.single("file"),
  async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No cover"
        });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "pasong/covers",
            resource_type: "image"
          },
          (error, uploaded) => {
            if (error) {
              reject(error);
            } else {
              resolve(uploaded);
            }
          }
        );

        stream.end(req.file.buffer);
      });

      res.json({
        success: true,
        secure_url: result.secure_url,
        public_id: result.public_id
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

function allowedCloudinaryFolder(folder) {
  const value = String(folder || "").trim();

  return value === "pasong-songs";
}

function createCloudinarySignature(folder, timestamp) {
  return crypto
    .createHash("sha1")
    .update(
      `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
    )
    .digest("hex");
}

app.post("/api/cloudinary/signature", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    const folder = String(
      req.body.folder || "pasong-songs"
    ).trim();

    if (!allowedCloudinaryFolder(folder)) {
      return res.status(403).json({
        error: "Invalid upload folder"
      });
    }

    const timestamp = Math.floor(
      Date.now() / 1000
    );

    res.json({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      timestamp,
      signature: createCloudinarySignature(
        folder,
        timestamp
      ),
      folder
    });
  } catch {
    res.status(500).json({
      error: "Signature error"
    });
  }
});

app.get("/api/cloudinary/signature", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    const folder = String(
      req.query.folder || "pasong-songs"
    ).trim();

    if (!allowedCloudinaryFolder(folder)) {
      return res.status(403).json({
        error: "Invalid upload folder"
      });
    }

    const timestamp = Math.floor(
      Date.now() / 1000
    );

    res.json({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      timestamp,
      signature: createCloudinarySignature(
        folder,
        timestamp
      ),
      folder
    });
  } catch {
    res.status(500).json({
      error: "Signature error"
    });
  }
});

async function validateUserId(userId) {
  if (!validUuid(userId)) {
    return null;
  }

  const result =
    await supabase.auth.admin.getUserById(userId);

  if (
    result.error ||
    !result.data ||
    !result.data.user
  ) {
    return null;
  }

  return result.data.user;
}

async function getArtistProfile(userId) {
  const result = await supabase
    .from("artist_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (result.error) {
    return null;
  }

  return result.data || null;
}

function normalizeArtistIds(body, loggedInUserId) {
  let ids = [];

  if (Array.isArray(body.artist_user_ids)) {
    ids = body.artist_user_ids
      .map(id => String(id || "").trim())
      .filter(validUuid);
  }

  if (
    ids.length === 0 &&
    typeof body.artist_user_ids === "string"
  ) {
    ids = body.artist_user_ids
      .split(",")
      .map(id => String(id || "").trim())
      .filter(validUuid);
  }

  if (
    ids.length === 0 &&
    body.artist_user_id &&
    validUuid(body.artist_user_id)
  ) {
    ids = [
      String(body.artist_user_id).trim()
    ];
  }

  if (ids.length === 0) {
    ids = [loggedInUserId];
  }

  return Array.from(new Set(ids));
}

function calculateArtistShares(
  artistIds,
  hasWriter
) {
  const totalArtistPercent =
    hasWriter ? 31.875 : 37.5;

  if (!artistIds.length) {
    return [];
  }

  const shares = [];
  let used = 0;

  for (let i = 0; i < artistIds.length; i++) {
    if (i === artistIds.length - 1) {
      shares.push(
        Number(
          (totalArtistPercent - used).toFixed(4)
        )
      );
    } else {
      const share = Number(
        (
          totalArtistPercent /
          artistIds.length
        ).toFixed(4)
      );

      shares.push(share);
      used = Number(
        (used + share).toFixed(4)
      );
    }
  }

  return shares;
}

app.post("/api/songs/create", async (req, res) => {
  try {
    const loggedInUser =
      await getAuthenticatedUser(req);

    if (!loggedInUser) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    const body = req.body || {};

    const title = String(
      body.title || ""
    ).trim();

    const audioUrl = String(
      body.audio_url || ""
    ).trim();

    const coverUrl = String(
      body.cover_url || ""
    ).trim();

    if (!title || !audioUrl || !coverUrl) {
      return res.status(400).json({
        error: "title/audio/cover required"
      });
    }

    if (title.length > 200) {
      return res.status(400).json({
        error: "Title too long"
      });
    }

    const artistIds =
      normalizeArtistIds(
        body,
        loggedInUser.id
      );

    const artistUsers = [];

    for (const id of artistIds) {
      const user = await validateUserId(id);

      if (!user) {
        return res.status(400).json({
          error: "Artist not found"
        });
      }

      const profile =
        await getArtistProfile(id);

      if (!profile) {
        return res.status(400).json({
          error: "Artist profile missing"
        });
      }

      artistUsers.push({
        user,
        profile
      });
    }

    const producerUserId =
      body.producer_user_id
        ? String(
            body.producer_user_id
          ).trim()
        : null;

    if (!producerUserId) {
      return res.status(400).json({
        error: "Producer required"
      });
    }

    const producer =
      await validateUserId(
        producerUserId
      );

    if (!producer) {
      return res.status(400).json({
        error: "Producer not found"
      });
    }

    const writerUserId =
      body.writer_user_id
        ? String(
            body.writer_user_id
          ).trim()
        : null;

    if (writerUserId) {
      const writer =
        await validateUserId(
          writerUserId
        );

      if (!writer) {
        return res.status(400).json({
          error: "Writer not found"
        });
      }
    }

    const pricing = getPricing(req);

    const songResult = await supabase
      .from("songs")
      .insert({
        artist_id:
          artistUsers[0].profile.id,
        artist_user_id:
          artistIds[0],
        uploader_user_id:
          loggedInUser.id,
        producer_user_id:
          producerUserId,
        writer_user_id:
          writerUserId,
        label_name:
          body.label_name || null,
        title,
        price:
          pricing.amount,
        currency:
          pricing.currency,
        status: "approved",
        cover_url:
          coverUrl,
        audio_url:
          audioUrl,
        artist_count:
          artistIds.length
      })
      .select()
      .single();

    if (songResult.error) {
      return res.status(500).json({
        error:
          songResult.error.message
      });
    }

    const artistShares =
      calculateArtistShares(
        artistIds,
        Boolean(writerUserId)
      );

    const rows = artistIds.map(
      (id, index) => ({
        song_id:
          songResult.data.id,
        artist_user_id:
          id,
        artist_order:
          index + 1,
        artist_share_percent:
          artistShares[index]
      })
    );

    const artistRows =
      await supabase
        .from("song_artists")
        .insert(rows);

    if (artistRows.error) {
      await supabase
        .from("songs")
        .delete()
        .eq(
          "id",
          songResult.data.id
        );

      return res.status(500).json({
        error:
          artistRows.error.message
      });
    }

    res.status(201).json({
      success: true,
      song: songResult.data,
      royalty_split: {
        pasong_percent: 25,
        producer_percent: 37.5,
        artist_percent:
          writerUserId
            ? 31.875
            : 37.5,
        writer_percent:
          writerUserId
            ? 5.625
            : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

function publicSong(song) {
  if (!song) {
    return null;
  }

  const {
    audio_url,
    ...safeSong
  } = song;

  safeSong.preview_url =
    song.preview_url ||
    null;

  return safeSong;
}

app.get("/api/songs", async (req, res) => {
  const result = await supabase
    .from("songs")
    .select(
      `*, artist_profiles:artist_id(artist_name,stage_name,performing_name)`
    )
    .eq("status", "approved")
    .not("cover_url", "is", null)
    .order("created_at", {
      ascending: false
    });

  if (result.error) {
    return res.status(500).json({
      error: result.error.message
    });
  }

  res.json({
    songs: (result.data || []).map(
      publicSong
    ),
    pricing: getPricing(req)
  });
});

app.get("/api/songs/:id", async (req, res) => {
  if (!validUuid(req.params.id)) {
    return res.status(400).json({
      error: "Invalid song id"
    });
  }

  const result = await supabase
    .from("songs")
    .select(
      `*, artist_profiles:artist_id(artist_name,stage_name,performing_name)`
    )
    .eq("id", req.params.id)
    .eq("status", "approved")
    .maybeSingle();

  if (
    result.error ||
    !result.data
  ) {
    return res.status(404).json({
      error: "Not found"
    });
  }

  res.json({
    song: publicSong(
      result.data
    )
  });
});

app.get("/api/songs/:id/deliver", async (req, res) => {
  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    if (!validUuid(req.params.id)) {
      return res.status(400).json({
        error: "Invalid song id"
      });
    }

    const download =
      await supabase
        .from("downloads")
        .select(
          "id, song_id, user_id, order_id"
        )
        .eq(
          "song_id",
          req.params.id
        )
        .eq(
          "user_id",
          user.id
        )
        .limit(1)
        .maybeSingle();

    if (
      download.error ||
      !download.data
    ) {
      return res.status(403).json({
        error: "Not purchased"
      });
    }

    const song =
      await supabase
        .from("songs")
        .select(
          "id,title,audio_url,preview_url"
        )
        .eq(
          "id",
          req.params.id
        )
        .eq(
          "status",
          "approved"
        )
        .maybeSingle();

    if (
      song.error ||
      !song.data
    ) {
      return res.status(404).json({
        error: "Song not found"
      });
    }

    res.json({
      download_url:
        song.data.audio_url,
      preview_url:
        song.data.preview_url ||
        null
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/earnings", async (req, res) => {
  const user =
    await getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      error: "Auth"
    });
  }

  const result =
    await supabase
      .from("royalty_ledger")
      .select("*")
      .eq(
        "recipient_user_id",
        user.id
      )
      .order("created_at", {
        ascending: false
      });

  if (result.error) {
    return res.status(500).json({
      error:
        result.error.message
    });
  }

  let balance = 0;

  (result.data || []).forEach(
    entry => {
      if (
        entry.entry_type ===
          "credit" &&
        entry.status ===
          "available"
      ) {
        balance +=
          Number(entry.amount) ||
          0;
      }

      if (
        entry.entry_type ===
        "debit"
      ) {
        balance -=
          Number(entry.amount) ||
          0;
      }
    }
  );

  res.json({
    available_balance:
      Number(
        balance.toFixed(2)
      ),
    entries:
      result.data || []
  });
});

app.post("/api/payments/complete", async (req, res) => {
  try {
    if (
      !safeSecretCompare(
        req.headers[
          "x-pasong-payment-secret"
        ],
        PASONG_PAYMENT_SECRET
      )
    ) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const {
      buyer_id,
      song_id,
      transaction_id,
      external_reference,
      provider,
      amount,
      currency,
      payment_status
    } = req.body;

    if (
      !validUuid(buyer_id) ||
      !validUuid(song_id)
    ) {
      return res.status(400).json({
        error: "Invalid buyer or song"
      });
    }

    if (
      !transaction_id ||
      !external_reference
    ) {
      return res.status(400).json({
        error:
          "Transaction and reference required"
      });
    }

    if (
      payment_status !==
      "SUCCESSFUL"
    ) {
      return res.status(400).json({
        error: "Not successful"
      });
    }

    if (!validPositiveNumber(amount)) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }

    const buyer =
      await validateUserId(
        buyer_id
      );

    if (!buyer) {
      return res.status(400).json({
        error: "Buyer not found"
      });
    }

    const songResult =
      await supabase
        .from("songs")
        .select("*")
        .eq("id", song_id)
        .eq("status", "approved")
        .maybeSingle();

    if (
      songResult.error ||
      !songResult.data
    ) {
      return res.status(404).json({
        error: "Song not found"
      });
    }

    const song =
      songResult.data;

    const requestedAmount =
      Number(amount);

    const storedAmount =
      Number(song.price);

    const storedCurrency =
      String(
        song.currency || ""
      ).toUpperCase();

    const requestedCurrency =
      String(
        currency || ""
      ).toUpperCase();

    if (
      requestedAmount !==
        storedAmount ||
      requestedCurrency !==
        storedCurrency
    ) {
      return res.status(400).json({
        error:
          "Payment amount or currency does not match song price"
      });
    }

    const existingTransaction =
      await supabase
        .from("payments")
        .select(
          "id,order_id,user_id"
        )
        .eq(
          "transaction_id",
          String(
            transaction_id
          )
        )
        .maybeSingle();

    if (
      existingTransaction.data
    ) {
      return res.json({
        success: true,
        already_completed: true,
        order_id:
          existingTransaction
            .data.order_id
      });
    }

    const existingReference =
      await supabase
        .from("payments")
        .select(
          "id,order_id,user_id"
        )
        .eq(
          "external_reference",
          String(
            external_reference
          )
        )
        .maybeSingle();

    if (
      existingReference.data
    ) {
      return res.json({
        success: true,
        already_completed: true,
        order_id:
          existingReference
            .data.order_id
      });
    }

    const existingDownload =
      await supabase
        .from("downloads")
        .select(
          "id,order_id"
        )
        .eq(
          "user_id",
          buyer_id
        )
        .eq(
          "song_id",
          song_id
        )
        .limit(1)
        .maybeSingle();

    if (
      existingDownload.data
    ) {
      return res.json({
        success: true,
        already_completed: true,
        order_id:
          existingDownload
            .data.order_id
      });
    }

    const order =
      await supabase
        .from("orders")
        .insert({
          buyer_id,
          total_amount:
            storedAmount,
          currency:
            storedCurrency,
          status: "paid"
        })
        .select()
        .single();

    if (order.error) {
      return res.status(500).json({
        error:
          order.error.message
      });
    }

    const orderItem =
      await supabase
        .from("order_items")
        .insert({
          order_id:
            order.data.id,
          song_id,
          price:
            storedAmount,
          currency:
            storedCurrency
        });

    if (orderItem.error) {
      await supabase
        .from("orders")
        .delete()
        .eq(
          "id",
          order.data.id
        );

      return res.status(500).json({
        error:
          orderItem.error.message
      });
    }

    const payment =
      await supabase
        .from("payments")
        .insert({
          order_id:
            order.data.id,
          user_id:
            buyer_id,
          provider:
            String(
              provider || ""
            ).trim(),
          transaction_id:
            String(
              transaction_id
            ).trim(),
          external_reference:
            String(
              external_reference
            ).trim(),
          amount:
            storedAmount,
          currency:
            storedCurrency,
          status:
            "successful"
        });

    if (payment.error) {
      await supabase
        .from("order_items")
        .delete()
        .eq(
          "order_id",
          order.data.id
        );

      await supabase
        .from("orders")
        .delete()
        .eq(
          "id",
          order.data.id
        );

      return res.status(500).json({
        error:
          payment.error.message
      });
    }

    const download =
      await supabase
        .from("downloads")
        .insert({
          user_id:
            buyer_id,
          song_id,
          order_id:
            order.data.id
        });

    if (download.error) {
      return res.status(500).json({
        error:
          download.error.message
      });
    }

    const hasWriter =
      Boolean(
        song.writer_user_id
      );

    const artistTotalPercent =
      hasWriter
        ? 31.875
        : 37.5;

    const writerPercent =
      hasWriter
        ? 5.625
        : 0;

    const producerPercent =
      37.5;

    const pasongPercent =
      25;

    const artistRows =
      await supabase
        .from("song_artists")
        .select("*")
        .eq(
          "song_id",
          song_id
        )
        .order(
          "artist_order",
          {
            ascending: true
          }
        );

    let artistIds = [];

    if (
      artistRows.data &&
      artistRows.data.length
    ) {
      artistIds =
        artistRows.data
          .map(
            row =>
              row.artist_user_id
          )
          .filter(
            validUuid
          );
    }

    if (
      artistIds.length === 0 &&
      validUuid(
        song.artist_user_id
      )
    ) {
      artistIds = [
        song.artist_user_id
      ];
    }

    if (
      artistIds.length === 0
    ) {
      return res.status(500).json({
        error:
          "No valid artist found for royalty distribution"
      });
    }

    const artistShares =
      calculateArtistShares(
        artistIds,
        hasWriter
      );

    const royaltyRows = [];

    for (
      let i = 0;
      i < artistIds.length;
      i++
    ) {
      const percent =
        artistShares[i];

      royaltyRows.push({
        recipient_user_id:
          artistIds[i],
        recipient_type:
          "artist",
        song_id,
        order_id:
          order.data.id,
        sale_reference:
          String(
            external_reference
          ),
        sale_amount:
          storedAmount,
        currency:
          storedCurrency,
        percentage:
          percent,
        amount:
          Number(
            (
              storedAmount *
              percent /
              100
            ).toFixed(2)
          ),
        entry_type:
          "credit",
        status:
          "available"
      });
    }

    if (
      validUuid(
        song.producer_user_id
      )
    ) {
      royaltyRows.push({
        recipient_user_id:
          song.producer_user_id,
        recipient_type:
          "producer",
        song_id,
        order_id:
          order.data.id,
        sale_reference:
          String(
            external_reference
          ),
        sale_amount:
          storedAmount,
        currency:
          storedCurrency,
        percentage:
          producerPercent,
        amount:
          Number(
            (
              storedAmount *
              producerPercent /
              100
            ).toFixed(2)
          ),
        entry_type:
          "credit",
        status:
          "available"
      });
    }

    if (
      hasWriter &&
      validUuid(
        song.writer_user_id
      )
    ) {
      royaltyRows.push({
        recipient_user_id:
          song.writer_user_id,
        recipient_type:
          "writer",
        song_id,
        order_id:
          order.data.id,
        sale_reference:
          String(
            external_reference
          ),
        sale_amount:
          storedAmount,
        currency:
          storedCurrency,
        percentage:
          writerPercent,
        amount:
          Number(
            (
              storedAmount *
              writerPercent /
              100
            ).toFixed(2)
          ),
        entry_type:
          "credit",
        status:
          "available"
      });
    }

    const royaltyResult =
      await supabase
        .from("royalty_ledger")
        .insert(
          royaltyRows
        );

    if (royaltyResult.error) {
      return res.status(500).json({
        error:
          royaltyResult.error.message
      });
    }

    res.json({
      success: true,
      order_id:
        order.data.id,
      royalty_split: {
        pasong_percent:
          pasongPercent,
        producer_percent:
          producerPercent,
        artist_percent:
          artistTotalPercent,
        writer_percent:
          writerPercent
      }
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

function getBeatPackagePricing(
  packageType
) {
  if (packageType === "mp3") {
    return {
      amount: 10000,
      currency: "UGX"
    };
  }

  if (packageType === "wav") {
    return {
      amount: 25000,
      currency: "UGX"
    };
  }

  if (packageType === "stems") {
    return {
      amount: 50000,
      currency: "UGX"
    };
  }

  if (packageType === "exclusive") {
    return {
      amount: 500000,
      currency: "UGX"
    };
  }

  return null;
}

function publicBeat(beat) {
  if (!beat) {
    return null;
  }

  return {
    id: beat.id,
    producer_user_id:
      beat.producer_user_id,
    title: beat.title,
    audio_url_preview:
      beat.audio_url_preview ||
      null,
    cover_url:
      beat.cover_url ||
      null,
    bpm:
      beat.bpm ||
      null,
    key:
      beat.key ||
      null,
    genre:
      beat.genre ||
      null,
    description:
      beat.description ||
      null,
    sales_count:
      beat.sales_count ||
      0,
    status:
      beat.status,
    created_at:
      beat.created_at,
    beat_packages:
      beat.beat_packages ||
      []
  };
}

app.post("/api/beats/create", async (req, res) => {
  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    const {
      title,
      audio_url_preview,
      audio_url_mp3,
      audio_url_wav,
      audio_url_stems,
      audio_url_exclusive,
      cover_url,
      bpm,
      key,
      genre,
      description
    } = req.body;

    const cleanTitle =
      String(title || "").trim();

    const preview =
      String(
        audio_url_preview || ""
      ).trim();

    if (!cleanTitle || !preview) {
      return res.status(400).json({
        error:
          "Title + preview required"
      });
    }

    if (cleanTitle.length > 200) {
      return res.status(400).json({
        error:
          "Title too long"
      });
    }

    const beatResult =
      await supabase
        .from("beats")
        .insert({
          producer_user_id:
            user.id,
          title:
            cleanTitle,
          audio_url_preview:
            preview,
          audio_url_mp3:
            audio_url_mp3 ||
            null,
          audio_url_wav:
            audio_url_wav ||
            null,
          audio_url_stems:
            audio_url_stems ||
            null,
          audio_url_exclusive:
            audio_url_exclusive ||
            null,
          cover_url:
            cover_url ||
            null,
          bpm:
            bpm || null,
          key:
            key || null,
          genre:
            genre ||
            "Afrobeat",
          description:
            description ||
            null,
          sales_count: 0,
          status:
            "approved"
        })
        .select()
        .single();

    if (beatResult.error) {
      return res.status(500).json({
        error:
          beatResult.error.message
      });
    }

    const packageTypes = [
      "mp3",
      "wav",
      "stems",
      "exclusive"
    ];

    const packages =
      packageTypes.map(
        packageType => {
          const pricing =
            getBeatPackagePricing(
              packageType
            );

          return {
            beat_id:
              beatResult.data.id,
            package_type:
              packageType,
            price:
              pricing.amount,
            currency:
              pricing.currency,
            sales_count: 0,
            max_sales:
              packageType ===
              "exclusive"
                ? 1
                : 100
          };
        }
      );

    const packageResult =
      await supabase
        .from("beat_packages")
        .insert(
          packages
        );

    if (packageResult.error) {
      await supabase
        .from("beats")
        .delete()
        .eq(
          "id",
          beatResult.data.id
        );

      return res.status(500).json({
        error:
          packageResult.error.message
      });
    }

    res.status(201).json({
      success: true,
      beat:
        publicBeat(
          beatResult.data
        )
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.get("/api/beats", async (req, res) => {
  const result =
    await supabase
      .from("beats")
      .select(
        `*, beat_packages(*)`
      )
      .eq(
        "status",
        "approved"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (result.error) {
    return res.status(500).json({
      error:
        result.error.message
    });
  }

  res.json({
    beats:
      (result.data || [])
        .map(publicBeat)
  });
});

app.get("/api/beats/:id", async (req, res) => {
  if (!validUuid(req.params.id)) {
    return res.status(400).json({
      error: "Invalid beat id"
    });
  }

  const result =
    await supabase
      .from("beats")
      .select(
        `*, beat_packages(*)`
      )
      .eq(
        "id",
        req.params.id
      )
      .in(
        "status",
        [
          "approved",
          "sold_exclusive"
        ]
      )
      .maybeSingle();

  if (
    result.error ||
    !result.data
  ) {
    return res.status(404).json({
      error:
        "Beat not found"
    });
  }

  res.json({
    beat:
      publicBeat(
        result.data
      )
  });
});

app.post("/api/beats/:id/pay", async (req, res) => {
  try {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    if (!validUuid(req.params.id)) {
      return res.status(400).json({
        error:
          "Invalid beat id"
      });
    }

    const packageType =
      String(
        req.body.package_type ||
        ""
      ).trim();

    const provider =
      normalizeProvider(
        req.body.provider
      );

    if (
      ![
        "mp3",
        "wav",
        "stems",
        "exclusive"
      ].includes(packageType)
    ) {
      return res.status(400).json({
        error:
          "Invalid package"
      });
    }

    if (
      !allowedPaymentProvider(
        provider
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid payment provider"
      });
    }

    const beatResult =
      await supabase
        .from("beats")
        .select(
          "id,producer_user_id,status,title"
        )
        .eq(
          "id",
          req.params.id
        )
        .maybeSingle();

    if (
      beatResult.error ||
      !beatResult.data
    ) {
      return res.status(404).json({
        error:
          "Beat not found"
      });
    }

    const beat =
      beatResult.data;

    if (
      beat.status !==
      "approved"
    ) {
      return res.status(400).json({
        error:
          "Beat is not available"
      });
    }

    if (
      beat.producer_user_id ===
      user.id
    ) {
      return res.status(400).json({
        error:
          "You cannot purchase your own beat"
      });
    }

    const packageResult =
      await supabase
        .from("beat_packages")
        .select("*")
        .eq(
          "beat_id",
          req.params.id
        )
        .eq(
          "package_type",
          packageType
        )
        .maybeSingle();

    if (
      packageResult.error ||
      !packageResult.data
    ) {
      return res.status(404).json({
        error:
          "Package not found"
      });
    }

    const pkg =
      packageResult.data;

    const maxSales =
      Number(
        pkg.max_sales
      );

    const salesCount =
      Number(
        pkg.sales_count
      );

    if (
      salesCount >=
      maxSales
    ) {
      return res.status(400).json({
        error:
          packageType ===
          "exclusive"
            ? "Exclusive already sold"
            : "Beat package sold out"
      });
    }

    const existingPurchase =
      await supabase
        .from("beat_orders")
        .select("id,status")
        .eq(
          "buyer_id",
          user.id
        )
        .eq(
          "beat_id",
          req.params.id
        )
        .eq(
          "package_type",
          packageType
        )
        .eq(
          "status",
          "paid"
        )
        .limit(1)
        .maybeSingle();

    if (
      existingPurchase.data
    ) {
      return res.status(400).json({
        error:
          "You already purchased this package"
      });
    }

    const externalReference =
      `PASONG-BEAT-${Date.now()}-${crypto
        .randomBytes(8)
        .toString("hex")}`;

    const orderResult =
      await supabase
        .from("beat_orders")
        .insert({
          buyer_id:
            user.id,
          beat_id:
            req.params.id,
          package_type:
            packageType,
          price:
            pkg.price,
          currency:
            pkg.currency,
          provider,
          status:
            "pending",
          external_reference:
            externalReference
        })
        .select()
        .single();

    if (orderResult.error) {
      return res.status(500).json({
        error:
          orderResult.error.message
      });
    }

    res.json({
      success: true,
      order:
        orderResult.data
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post(
  "/api/beats/payments/complete",
  async (req, res) => {
    try {
      if (
        !safeSecretCompare(
          req.headers[
            "x-pasong-payment-secret"
          ],
          PASONG_PAYMENT_SECRET
        )
      ) {
        return res.status(401).json({
          error:
            "Unauthorized"
        });
      }

      const {
        order_id,
        transaction_id,
        external_reference,
        payment_status,
        amount,
        currency
      } = req.body;

      if (
        !validUuid(order_id)
      ) {
        return res.status(400).json({
          error:
            "Invalid order"
        });
      }

      if (
        !transaction_id ||
        !external_reference
      ) {
        return res.status(400).json({
          error:
            "Transaction and reference required"
        });
      }

      if (
        payment_status !==
        "SUCCESSFUL"
      ) {
        return res.status(400).json({
          error:
            "Not successful"
        });
      }

      if (
        !validPositiveNumber(
          amount
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid amount"
        });
      }

      const orderResult =
        await supabase
          .from("beat_orders")
          .select(
            `*, beats(*)`
          )
          .eq(
            "id",
            order_id
          )
          .maybeSingle();

      if (
        orderResult.error ||
        !orderResult.data
      ) {
        return res.status(404).json({
          error:
            "Order not found"
        });
      }

      const order =
        orderResult.data;

      const beat =
        order.beats;

      if (!beat) {
        return res.status(404).json({
          error:
            "Beat not found"
        });
      }

      if (
        order.status ===
        "paid"
      ) {
        return res.json({
          success: true,
          already_completed:
            true
        });
      }

      if (
        String(
          order.external_reference ||
          ""
        ) !==
        String(
          external_reference
        )
      ) {
        return res.status(400).json({
          error:
            "Payment reference does not match order"
        });
      }

      const storedAmount =
        Number(
          order.price
        );

      const storedCurrency =
        String(
          order.currency ||
            ""
        ).toUpperCase();

      const paidAmount =
        Number(amount);

      const paidCurrency =
        String(
          currency || ""
        ).toUpperCase();

      if (
        paidAmount !==
          storedAmount ||
        paidCurrency !==
          storedCurrency
      ) {
        return res.status(400).json({
          error:
            "Payment amount or currency does not match order"
        });
      }

      const existingTransaction =
        await supabase
          .from("beat_orders")
          .select(
            "id,status"
          )
          .eq(
            "transaction_id",
            String(
              transaction_id
            )
          )
          .neq(
            "id",
            order_id
          )
          .maybeSingle();

      if (
        existingTransaction.data
      ) {
        return res.status(400).json({
          error:
            "Transaction already used"
        });
      }

      const existingReference =
        await supabase
          .from("beat_orders")
          .select(
            "id,status"
          )
          .eq(
            "external_reference",
            String(
              external_reference
            )
          )
          .neq(
            "id",
            order_id
          )
          .maybeSingle();

      if (
        existingReference.data
      ) {
        return res.status(400).json({
          error:
            "Reference already used"
        });
      }

      const packageResult =
        await supabase
          .from("beat_packages")
          .select("*")
          .eq(
            "beat_id",
            beat.id
          )
          .eq(
            "package_type",
            order.package_type
          )
          .maybeSingle();

      if (
        packageResult.error ||
        !packageResult.data
      ) {
        return res.status(404).json({
          error:
            "Package not found"
        });
      }

      const pkg =
        packageResult.data;

      if (
        Number(
          pkg.sales_count
        ) >=
        Number(
          pkg.max_sales
        )
      ) {
        return res.status(400).json({
          error:
            "Package is sold out"
        });
      }

      const existingDownload =
        await supabase
          .from("beat_downloads")
          .select("id")
          .eq(
            "user_id",
            order.buyer_id
          )
          .eq(
            "beat_id",
            beat.id
          )
          .eq(
            "package_type",
            order.package_type
          )
          .limit(1)
          .maybeSingle();

      if (
        existingDownload.data
      ) {
        return res.json({
          success: true,
          already_completed:
            true
        });
      }

      const producerAmount =
        Number(
          (
            storedAmount *
            0.75
          ).toFixed(2)
        );

      const pasongAmount =
        Number(
          (
            storedAmount *
            0.25
          ).toFixed(2)
        );

      const license =
        await supabase
          .from("beat_licenses")
          .insert({
            beat_id:
              beat.id,
            order_id:
              order.id,
            buyer_id:
              order.buyer_id,
            producer_user_id:
              beat.producer_user_id,
            package_type:
              order.package_type,
            license_text:
              `License for ${beat.title} - ${order.package_type}`
          });

      if (license.error) {
        return res.status(500).json({
          error:
            license.error.message
        });
      }

      const download =
        await supabase
          .from("beat_downloads")
          .insert({
            user_id:
              order.buyer_id,
            beat_id:
              beat.id,
            order_id:
              order.id,
            package_type:
              order.package_type
          });

      if (download.error) {
        return res.status(500).json({
          error:
            download.error.message
        });
      }

      const producerRoyalty =
        await supabase
          .from("royalty_ledger")
          .insert({
            recipient_user_id:
              beat.producer_user_id,
            recipient_type:
              "beat_producer",
            beat_id:
              beat.id,
            order_id:
              order.id,
            sale_reference:
              String(
                external_reference
              ),
            sale_amount:
              storedAmount,
            currency:
              storedCurrency,
            percentage: 75,
            amount:
              producerAmount,
            entry_type:
              "credit",
            status:
              "available"
          });

      if (
        producerRoyalty.error
      ) {
        return res.status(500).json({
          error:
            producerRoyalty.error.message
        });
      }

      const pasongRoyalty =
        await supabase
          .from("royalty_ledger")
          .insert({
            recipient_type:
              "pasong_beat",
            beat_id:
              beat.id,
            order_id:
              order.id,
            sale_reference:
              String(
                external_reference
              ),
            sale_amount:
              storedAmount,
            currency:
              storedCurrency,
            percentage: 25,
            amount:
              pasongAmount,
            entry_type:
              "credit",
            status:
              "available"
          });

      if (
        pasongRoyalty.error
      ) {
        return res.status(500).json({
          error:
            pasongRoyalty.error.message
        });
      }

      const newBeatSales =
        Number(
          beat.sales_count || 0
        ) + 1;

      const newPackageSales =
        Number(
          pkg.sales_count || 0
        ) + 1;

      const beatUpdate =
        await supabase
          .from("beats")
          .update({
            sales_count:
              newBeatSales
          })
          .eq(
            "id",
            beat.id
          );

      if (beatUpdate.error) {
        return res.status(500).json({
          error:
            beatUpdate.error.message
        });
      }

      const packageUpdate =
        await supabase
          .from("beat_packages")
          .update({
            sales_count:
              newPackageSales
          })
          .eq(
            "beat_id",
            beat.id
          )
          .eq(
            "package_type",
            order.package_type
          );

      if (packageUpdate.error) {
        return res.status(500).json({
          error:
            packageUpdate.error.message
        });
      }

      if (
        order.package_type ===
        "exclusive"
      ) {
        const exclusiveUpdate =
          await supabase
            .from("beats")
            .update({
              status:
                "sold_exclusive"
            })
            .eq(
              "id",
              beat.id
            );

        if (
          exclusiveUpdate.error
        ) {
          return res.status(500).json({
            error:
              exclusiveUpdate.error.message
          });
        }
      }

      const orderUpdate =
        await supabase
          .from("beat_orders")
          .update({
            status:
              "paid",
            transaction_id:
              String(
                transaction_id
              ),
            external_reference:
              String(
                external_reference
              ),
            paid_amount:
              storedAmount,
            paid_currency:
              storedCurrency
          })
          .eq(
            "id",
            order.id
          );

      if (orderUpdate.error) {
        return res.status(500).json({
          error:
            orderUpdate.error.message
        });
      }

      await supabase
        .from("producer_notifications")
        .insert({
          producer_user_id:
            beat.producer_user_id,
          type:
            "beat_sale",
          message:
            `Your beat ${beat.title} sold ${order.package_type} for ${storedAmount} ${storedCurrency}`,
          beat_id:
            beat.id,
          order_id:
            order.id
        });

      res.json({
        success: true,
        producer_earning:
          producerAmount,
        pasong_earning:
          pasongAmount
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.get("/api/beats/orders/my", async (req, res) => {
  const user =
    await getAuthenticatedUser(req);

  if (!user) {
    return res.status(401).json({
      error: "Auth"
    });
  }

  const result =
    await supabase
      .from("beat_orders")
      .select(
        `*, beats(*)`
      )
      .eq(
        "buyer_id",
        user.id
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (result.error) {
    return res.status(500).json({
      error:
        result.error.message
    });
  }

  res.json({
    orders:
      result.data || []
  });
});

app.get(
  "/api/beats/orders/producer",
  async (req, res) => {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    const result =
      await supabase
        .from("beat_orders")
        .select(
          `*, beats!inner(*)`
        )
        .eq(
          "beats.producer_user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        );

    if (result.error) {
      return res.status(500).json({
        error:
          result.error.message
      });
    }

    res.json({
      orders:
        result.data || []
    });
  }
);

app.get(
  "/api/beats/:id/deliver",
  async (req, res) => {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth"
      });
    }

    if (!validUuid(req.params.id)) {
      return res.status(400).json({
        error:
          "Invalid beat id"
      });
    }

    const result =
      await supabase
        .from("beat_downloads")
        .select(
          `*, beats(*)`
        )
        .eq(
          "beat_id",
          req.params.id
        )
        .eq(
          "user_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(1)
        .maybeSingle();

    if (
      result.error ||
      !result.data
    ) {
      return res.status(403).json({
        error:
          "Not purchased"
      });
    }

    const beat =
      result.data.beats;

    if (!beat) {
      return res.status(404).json({
        error:
          "Beat not found"
      });
    }

    let url = null;

    if (
      result.data.package_type ===
      "mp3"
    ) {
      url =
        beat.audio_url_mp3 ||
        beat.audio_url_preview;
    }

    if (
      result.data.package_type ===
      "wav"
    ) {
      url =
        beat.audio_url_wav;
    }

    if (
      result.data.package_type ===
      "stems"
    ) {
      url =
        beat.audio_url_stems;
    }

    if (
      result.data.package_type ===
      "exclusive"
    ) {
      url =
        beat.audio_url_exclusive;
    }

    if (!url) {
      return res.status(404).json({
        error:
          "File not available"
      });
    }

    res.json({
      download_url:
        url,
      package_type:
        result.data.package_type
    });
  }
);

async function getProducerBalance(
  userId
) {
  const result =
    await supabase
      .from("royalty_ledger")
      .select(
        "amount,entry_type,status"
      )
      .eq(
        "recipient_user_id",
        userId
      )
      .eq(
        "recipient_type",
        "beat_producer"
      );

  if (result.error) {
    throw new Error(
      result.error.message
    );
  }

  let balance = 0;

  (result.data || []).forEach(
    entry => {
      if (
        entry.entry_type ===
          "credit" &&
        entry.status ===
          "available"
      ) {
        balance +=
          Number(entry.amount) ||
          0;
      }

      if (
        entry.entry_type ===
        "debit"
      ) {
        balance -=
          Number(entry.amount) ||
          0;
      }
    }
  );

  return Number(
    balance.toFixed(2)
  );
}

app.get(
  "/api/producer/earnings",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      const result =
        await supabase
          .from("royalty_ledger")
          .select("*")
          .eq(
            "recipient_user_id",
            user.id
          )
          .eq(
            "recipient_type",
            "beat_producer"
          )
          .order(
            "created_at",
            {
              ascending: false
            }
          );

      if (result.error) {
        return res.status(500).json({
          error:
            result.error.message
        });
      }

      let balance = 0;

      (result.data || []).forEach(
        entry => {
          if (
            entry.entry_type ===
              "credit" &&
            entry.status ===
              "available"
          ) {
            balance +=
              Number(
                entry.amount
              ) || 0;
          }

          if (
            entry.entry_type ===
            "debit"
          ) {
            balance -=
              Number(
                entry.amount
              ) || 0;
          }
        }
      );

      res.json({
        available_balance:
          Number(
            balance.toFixed(2)
          ),
        entries:
          result.data || []
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.post(
  "/api/producer/withdraw",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      const {
        amount,
        provider,
        mobile_number
      } = req.body;

      const requestedAmount =
        Number(amount);

      if (
        !validPositiveNumber(
          requestedAmount
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid withdrawal amount"
        });
      }

      const normalizedProvider =
        normalizeProvider(
          provider
        );

      if (
        !allowedPaymentProvider(
          normalizedProvider
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid payment provider"
        });
      }

      const mobile =
        String(
          mobile_number || ""
        )
          .trim()
          .replace(/\s+/g, "");

      if (
        !/^[0-9+]{9,15}$/.test(
          mobile
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid mobile number"
        });
      }

      const availableBalance =
        await getProducerBalance(
          user.id
        );

      if (
        requestedAmount >
        availableBalance
      ) {
        return res.status(400).json({
          error:
            "Insufficient balance"
        });
      }

      const withdrawal =
        await supabase
          .from(
            "producer_withdrawals"
          )
          .insert({
            producer_user_id:
              user.id,
            amount:
              requestedAmount,
            currency:
              "UGX",
            provider:
              normalizedProvider,
            mobile_number:
              mobile,
            status:
              "pending"
          })
          .select()
          .single();

      if (withdrawal.error) {
        return res.status(500).json({
          error:
            withdrawal.error.message
        });
      }

      const debit =
        await supabase
          .from(
            "royalty_ledger"
          )
          .insert({
            recipient_user_id:
              user.id,
            recipient_type:
              "beat_producer",
            amount:
              requestedAmount,
            percentage:
              100,
            entry_type:
              "debit",
            status:
              "pending_withdrawal",
            withdrawal_id:
              withdrawal.data.id
          });

      if (debit.error) {
        await supabase
          .from(
            "producer_withdrawals"
          )
          .delete()
          .eq(
            "id",
            withdrawal.data.id
          );

        return res.status(500).json({
          error:
            debit.error.message
        });
      }

      res.json({
        success: true,
        withdrawal:
          withdrawal.data
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.post(
  "/api/producer/services/create",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      const {
        title,
        description,
        price,
        delivery_days
      } = req.body;

      const cleanTitle =
        String(
          title || ""
        ).trim();

      const cleanPrice =
        Number(price);

      const cleanDays =
        Number(
          delivery_days
        );

      if (!cleanTitle) {
        return res.status(400).json({
          error:
            "Title required"
        });
      }

      if (
        !validPositiveNumber(
          cleanPrice
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid price"
        });
      }

      if (
        !Number.isInteger(
          cleanDays
        ) ||
        cleanDays <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid delivery days"
        });
      }

      const result =
        await supabase
          .from(
            "producer_services"
          )
          .insert({
            producer_user_id:
              user.id,
            title:
              cleanTitle,
            description:
              description ||
              null,
            price:
              cleanPrice,
            delivery_days:
              cleanDays,
            status:
              "active"
          })
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            result.error.message
        });
      }

      res.json({
        service:
          result.data
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.get(
  "/api/producer/services",
  async (req, res) => {
    const result =
      await supabase
        .from(
          "producer_services"
        )
        .select("*")
        .eq(
          "status",
          "active"
        );

    if (result.error) {
      return res.status(500).json({
        error:
          result.error.message
      });
    }

    res.json({
      services:
        result.data || []
    });
  }
);

app.post(
  "/api/producer/services/:id/order",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid service id"
        });
      }

      const service =
        await supabase
          .from(
            "producer_services"
          )
          .select("*")
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "status",
            "active"
          )
          .maybeSingle();

      if (
        service.error ||
        !service.data
      ) {
        return res.status(404).json({
          error:
            "Service not found"
        });
      }

      if (
        service.data
          .producer_user_id ===
        user.id
      ) {
        return res.status(400).json({
          error:
            "You cannot order your own service"
        });
      }

      const order =
        await supabase
          .from(
            "producer_service_orders"
          )
          .insert({
            service_id:
              req.params.id,
            buyer_id:
              user.id,
            producer_user_id:
              service.data
                .producer_user_id,
            price:
              service.data.price,
            status:
              "pending_payment"
          })
          .select()
          .single();

      if (order.error) {
        return res.status(500).json({
          error:
            order.error.message
        });
      }

      res.json({
        order:
          order.data
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.post(
  "/api/producer/service-orders/:id/message",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid order id"
        });
      }

      const message =
        String(
          req.body.message ||
            ""
        ).trim();

      if (!message) {
        return res.status(400).json({
          error:
            "Message required"
        });
      }

      if (message.length > 5000) {
        return res.status(400).json({
          error:
            "Message too long"
        });
      }

      const order =
        await supabase
          .from(
            "producer_service_orders"
          )
          .select(
            "id,buyer_id,producer_user_id,status"
          )
          .eq(
            "id",
            req.params.id
          )
          .maybeSingle();

      if (
        order.error ||
        !order.data
      ) {
        return res.status(404).json({
          error:
            "Order not found"
        });
      }

      const isParticipant =
        order.data.buyer_id ===
          user.id ||
        order.data
          .producer_user_id ===
          user.id;

      if (!isParticipant) {
        return res.status(403).json({
          error:
            "Not authorized"
        });
      }

      const result =
        await supabase
          .from(
            "producer_service_messages"
          )
          .insert({
            order_id:
              req.params.id,
            sender_user_id:
              user.id,
            message
          })
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            result.error.message
        });
      }

      res.json({
        message:
          result.data
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.post(
  "/api/producer/service-orders/:id/complete",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth"
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid order id"
        });
      }

      const result =
        await supabase
          .from(
            "producer_service_orders"
          )
          .update({
            status:
              "completed"
          })
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "producer_user_id",
            user.id
          )
          .neq(
            "status",
            "completed"
          )
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            result.error.message
        });
      }

      res.json({
        success: true,
        order:
          result.data
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message
      });
    }
  }
);

app.use(
  (error, req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        error:
          error.message
      });
    }

    if (error) {
      return res.status(400).json({
        error:
          error.message ||
          "Request error"
      });
    }

    next();
  }
);

app.listen(PORT, () => {
  console.log(
    "PASONG SAFE + PRODUCER READY " +
      PORT
  );
});
