const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { v2: cloudinary } = require("cloudinary");
const multer = require("multer");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 10000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY;

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;
const PASONG_PAYMENT_SECRET =
  process.env.PASONG_PAYMENT_SECRET;
const CORS_ORIGIN =
  process.env.CORS_ORIGIN || "";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Missing Supabase environment variables"
  );
  process.exit(1);
}

// Optional integrations must not crash the whole API when not configured.
// Upload/payment routes should report a clear configuration error when used.
const CLOUDINARY_READY = Boolean(
  CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
);
const PAYMENT_READY = Boolean(PASONG_PAYMENT_SECRET);

if (!CLOUDINARY_READY) {
  console.warn("Cloudinary is not configured; upload endpoints may be unavailable.");
}
if (!PAYMENT_READY) {
  console.warn("PASONG_PAYMENT_SECRET is not configured; payment endpoints may be unavailable.");
}
if (!CORS_ORIGIN.trim()) {
  console.warn("CORS_ORIGIN is empty; using safe PASONG frontend defaults.");
}

const allowedOrigins = [
  ...CORS_ORIGIN.split(",").map((v) => v.trim()).filter(Boolean),
  "https://pasong-frontend.vercel.app",
  "https://pasong.vercel.app",
].filter((v, i, a) => v && a.indexOf(v) === i);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("CORS not allowed")
      );
    },
  })
);

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb",
  })
);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

if (CLOUDINARY_READY) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
}

const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only JPG, JPEG, PNG and WEBP images are allowed"
        )
      );
    }
  },
});

app.get("/", (req, res) => {
  res.json({
    PASONG: "LIVE",
    upload: "READY",
    producer_marketplace: "READY",
    beats: "READY",
  });
});



// ============================================================
// PASONG PREMIUM
// Global Premium plan with localized currency display.
// Payment activation is intentionally NOT granted by the client;
// a verified payment webhook/admin completion must activate it.
// ============================================================

const PREMIUM_PLANS = {
  monthly: {
    id: "premium_monthly",
    interval: "month",
    days: 30,
    prices: {
      UG: { amount: 10000, currency: "UGX", label: "UGX 10,000" },
      KE: { amount: 399, currency: "KES", label: "KES 399" },
      TZ: { amount: 7500, currency: "TZS", label: "TZS 7,500" },
      RW: { amount: 3500, currency: "RWF", label: "RWF 3,500" },
      NG: { amount: 5000, currency: "NGN", label: "NGN 5,000" },
      GH: { amount: 45, currency: "GHS", label: "GHS 45" },
      ZA: { amount: 59, currency: "ZAR", label: "ZAR 59" },
      GB: { amount: 2.49, currency: "GBP", label: "£2.49" },
      EU: { amount: 2.99, currency: "EUR", label: "€2.99" },
      US: { amount: 2.99, currency: "USD", label: "$2.99" },
      CA: { amount: 4.09, currency: "CAD", label: "CA$4.09" },
      AU: { amount: 4.49, currency: "AUD", label: "A$4.49" },
      DEFAULT: { amount: 2.99, currency: "USD", label: "$2.99" },
    },
  },
  yearly: {
    id: "premium_yearly",
    interval: "year",
    days: 365,
    prices: {
      UG: { amount: 100000, currency: "UGX", label: "UGX 100,000" },
      KE: { amount: 3990, currency: "KES", label: "KES 3,990" },
      TZ: { amount: 75000, currency: "TZS", label: "TZS 75,000" },
      RW: { amount: 35000, currency: "RWF", label: "RWF 35,000" },
      NG: { amount: 50000, currency: "NGN", label: "NGN 50,000" },
      GH: { amount: 450, currency: "GHS", label: "GHS 450" },
      ZA: { amount: 590, currency: "ZAR", label: "ZAR 590" },
      GB: { amount: 24.90, currency: "GBP", label: "£24.90" },
      EU: { amount: 29.90, currency: "EUR", label: "€29.90" },
      US: { amount: 29.90, currency: "USD", label: "$29.90" },
      CA: { amount: 40.90, currency: "CAD", label: "CA$40.90" },
      AU: { amount: 44.90, currency: "AUD", label: "A$44.90" },
      DEFAULT: { amount: 29.90, currency: "USD", label: "$29.90" },
    },
  },
};

const PREMIUM_FEATURES = [
  "Premium badge",
  "Ad-free listening",
  "Higher-quality audio",
  "Offline listening for eligible content",
  "Premium-exclusive releases",
  "Early access to selected releases",
  "Premium-only playlists",
];

function getPremiumCountry(req) {
  return getCountry(req) || "US";
}

function getPremiumPrice(req, planKey = "monthly") {
  const plan = PREMIUM_PLANS[planKey] || PREMIUM_PLANS.monthly;
  const country = getPremiumCountry(req);
  return {
    plan: plan.id,
    interval: plan.interval,
    days: plan.days,
    country,
    ...(plan.prices[country] || plan.prices.DEFAULT),
  };
}

app.get("/api/premium/pricing", (req, res) => {
  const monthly = getPremiumPrice(req, "monthly");
  const yearly = getPremiumPrice(req, "yearly");
  res.json({
    success: true,
    country: monthly.country,
    currency: monthly.currency,
    monthly,
    yearly,
    features: PREMIUM_FEATURES,
    pricing_note: "PASONG uses fixed regional price points. IP/country detection is for display; the payment provider must confirm the billing country before charging.",
  });
});

app.get("/api/premium/status", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.json({
        success: true,
        authenticated: false,
        premium: false,
        status: "free",
      });
    }

    const result = await supabase
      .from("premium_subscriptions")
      .select("id,user_id,plan,status,started_at,expires_at,currency,amount,payment_reference")
      .eq("user_id", user.id)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (result.error) {
      console.error("Premium status lookup failed:", result.error);
      return res.status(500).json({ success: false, error: "Unable to load Premium status." });
    }

    const subscription = result.data || null;
    const active = !!subscription &&
      subscription.status === "active" &&
      (!subscription.expires_at || new Date(subscription.expires_at).getTime() > Date.now());

    res.json({
      success: true,
      authenticated: true,
      premium: active,
      status: active ? "active" : (subscription?.status || "free"),
      subscription,
    });
  } catch (error) {
    console.error("Premium status error:", error);
    res.status(500).json({ success: false, error: "Unable to load Premium status." });
  }
});


app.post("/api/premium/complete", async (req, res) => {
  try {
    const secret = String(req.headers["x-pasong-payment-secret"] || "");
    if (!PASONG_PAYMENT_SECRET || secret !== PASONG_PAYMENT_SECRET) {
      return res.status(401).json({ success: false, error: "Unauthorized payment completion." });
    }

    const { payment_reference, payment_status, provider_reference } = req.body || {};
    if (!payment_reference || payment_status !== "paid") {
      return res.status(400).json({ success: false, error: "A paid Premium payment is required." });
    }

    const paymentResult = await supabase
      .from("premium_payments")
      .select("*")
      .eq("payment_reference", String(payment_reference))
      .maybeSingle();

    if (paymentResult.error || !paymentResult.data) {
      return res.status(404).json({ success: false, error: "Premium payment not found." });
    }

    const payment = paymentResult.data;
    if (payment.status === "paid") {
      return res.json({ success: true, already_completed: true, payment });
    }

    const days = payment.plan === "premium_yearly" ? 365 : 30;
    const now = new Date();
    const start = now.toISOString();
    const expires = new Date(now.getTime() + days * 86400000).toISOString();

    const subscription = await supabase
      .from("premium_subscriptions")
      .insert({
        user_id: payment.user_id,
        plan: payment.plan,
        status: "active",
        started_at: start,
        expires_at: expires,
        currency: payment.currency,
        amount: payment.amount,
        payment_reference: payment.payment_reference,
      })
      .select()
      .single();

    if (subscription.error) {
      console.error("Premium subscription activation failed:", subscription.error);
      return res.status(500).json({ success: false, error: "Premium activation failed." });
    }

    const updatedPayment = await supabase
      .from("premium_payments")
      .update({
        status: "paid",
        provider_reference: provider_reference || null,
        paid_at: start,
      })
      .eq("id", payment.id)
      .select()
      .single();

    if (updatedPayment.error) {
      console.error("Premium payment update failed:", updatedPayment.error);
      return res.status(500).json({ success: false, error: "Premium payment status update failed." });
    }

    res.json({
      success: true,
      premium: true,
      subscription: subscription.data,
      payment: updatedPayment.data,
    });
  } catch (error) {
    console.error("Premium completion error:", error);
    res.status(500).json({ success: false, error: "Premium payment completion failed." });
  }
});

app.post("/api/premium/checkout", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "You must be logged in to subscribe to PASONG Premium." });
    }

    const planKey = req.body?.plan === "yearly" ? "yearly" : "monthly";
    const pricing = getPremiumPrice(req, planKey);

    // A checkout record is created, but Premium is NOT activated here.
    // Your payment provider/webhook must verify the payment first.
    const reference = "PREM-" + crypto.randomBytes(10).toString("hex").toUpperCase();

    const result = await supabase
      .from("premium_payments")
      .insert({
        user_id: user.id,
        plan: pricing.plan,
        amount: pricing.amount,
        currency: pricing.currency,
        country: pricing.country,
        status: "pending",
        payment_reference: reference,
      })
      .select()
      .single();

    if (result.error) {
      console.error("Premium checkout creation failed:", result.error);
      return res.status(500).json({ success: false, error: "Unable to start Premium checkout." });
    }

    res.status(201).json({
      success: true,
      payment: result.data,
      pricing,
      message: "Premium checkout created. Complete payment through the configured payment provider before Premium is activated.",
    });
  } catch (error) {
    console.error("Premium checkout error:", error);
    res.status(500).json({ success: false, error: "Unable to start Premium checkout." });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

async function getAuthenticatedUser(req) {
  try {
    const header =
      req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return null;
    }

    const token = header
      .substring(7)
      .trim();

    if (!token) {
      return null;
    }

    const result =
      await supabase.auth.getUser(token);

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
      label: "UGX 700",
    };
  }

  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS",
    "ET",
  ];

  if (eastAfrica.includes(country)) {
    return {
      amount: 1000,
      currency: "UGX",
      label: "UGX 1,000",
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
    "TN",
  ];

  if (africa.includes(country)) {
    return {
      amount: 0.57,
      currency: "USD",
      label: "$0.57",
    };
  }

  if (country === "GB") {
    return {
      amount: 1,
      currency: "GBP",
      label: "£1",
    };
  }

  return {
    amount: 1,
    currency: "USD",
    label: "$1",
  };
}

function getCoverDesignPrice(req) {
  if (getCountry(req) === "UG") {
    return {
      amount: 10000,
      currency: "UGX",
      label: "UGX 10,000",
    };
  }

  return {
    amount: 10,
    currency: "USD",
    label: "$10",
  };
}

function safeSecretCompare(a, b) {
  const first = Buffer.from(
    String(a || "")
  );

  const second = Buffer.from(
    String(b || "")
  );

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    first,
    second
  );
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
    "AIRTEL MONEY",
    "PESAPAL",
    "FLUTTERWAVE",
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

function cleanText(value, maxLength) {
  const text = String(value || "").trim();

  if (
    maxLength &&
    text.length > maxLength
  ) {
    return null;
  }

  return text;
}

function isSameAmount(a, b) {
  return Number(a) === Number(b);
}

function validUrl(value) {
  try {
    const url = new URL(
      String(value || "").trim()
    );

    return (
      url.protocol === "https:" ||
      url.protocol === "http:"
    );
  } catch {
    return false;
  }
}

function isSameUrl(a, b) {
  return (
    String(a || "").trim() ===
    String(b || "").trim()
  );
}

app.get("/api/pricing", (req, res) => {
  const pricing = getPricing(req);

  res.json({
    country: getCountry(req),
    price: pricing.amount,
    currency: pricing.currency,
    label: pricing.label,
  });
});

app.get(
  "/api/cover-design-price",
  (req, res) => {
    const pricing =
      getCoverDesignPrice(req);

    res.json({
      country: getCountry(req),
      price: pricing.amount,
      currency: pricing.currency,
      label: pricing.label,
    });
  }
);

app.get("/api/tip-split", (req, res) => {
  res.json({
    artist_percent: 70,
    pasong_percent: 30,
  });
});

app.post(
  "/api/upload/cover",
  coverUpload.single("file"),
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: "No cover",
        });
      }

      const result = await new Promise(
        (resolve, reject) => {
          const stream =
            cloudinary.uploader.upload_stream(
              {
                folder:
                  "pasong/covers",
                resource_type:
                  "image",
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
        }
      );

      res.json({
        success: true,
        secure_url:
          result.secure_url,
        public_id:
          result.public_id,
      });
    } catch {
      res.status(500).json({
        error:
          "Cover upload failed",
      });
    }
  }
);

function allowedCloudinaryFolder(
  folder
) {
  const value = String(
    folder || ""
  ).trim();

  if (
    [
      "pasong-songs",
      "pasong/songs",
      "pasong/covers",
      "pasong-beats/audio",
      "pasong-beats/covers",
      "pasong-producers/profile",
    ].includes(value)
  ) {
    return true;
  }

  if (
    /^pasong-beats\/deliveries\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return true;
  }

  return false;
}

function createCloudinarySignature(
  folder,
  timestamp
) {
  return crypto
    .createHash("sha1")
    .update(
      `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`
    )
    .digest("hex");
}

app.post(
  "/api/cloudinary/signature",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      const folder = String(
        req.body.folder ||
          "pasong-songs"
      ).trim();

      if (
        !allowedCloudinaryFolder(
          folder
        )
      ) {
        return res.status(403).json({
          error:
            "Invalid upload folder",
        });
      }

      const timestamp = Math.floor(
        Date.now() / 1000
      );

      res.json({
        cloud_name:
          CLOUDINARY_CLOUD_NAME,
        api_key:
          CLOUDINARY_API_KEY,
        timestamp,
        signature:
          createCloudinarySignature(
            folder,
            timestamp
          ),
        folder,
      });
    } catch {
      res.status(500).json({
        error: "Signature error",
      });
    }
  }
);

app.get(
  "/api/cloudinary/signature",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      const folder = String(
        req.query.folder ||
          "pasong-songs"
      ).trim();

      if (
        !allowedCloudinaryFolder(
          folder
        )
      ) {
        return res.status(403).json({
          error:
            "Invalid upload folder",
        });
      }

      const timestamp = Math.floor(
        Date.now() / 1000
      );

      res.json({
        cloud_name:
          CLOUDINARY_CLOUD_NAME,
        api_key:
          CLOUDINARY_API_KEY,
        timestamp,
        signature:
          createCloudinarySignature(
            folder,
            timestamp
          ),
        folder,
      });
    } catch {
      res.status(500).json({
        error: "Signature error",
      });
    }
  }
);

async function validateUserId(userId) {
  if (!validUuid(userId)) {
    return null;
  }

  const result =
    await supabase.auth.admin.getUserById(
      userId
    );

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

function normalizeArtistIds(
  body,
  loggedInUserId
) {
  let ids = [];

  if (
    Array.isArray(
      body.artist_user_ids
    )
  ) {
    ids = body.artist_user_ids
      .map((id) =>
        String(id || "").trim()
      )
      .filter(validUuid);
  }

  if (
    ids.length === 0 &&
    typeof body.artist_user_ids ===
      "string"
  ) {
    ids = body.artist_user_ids
      .split(",")
      .map((id) =>
        String(id || "").trim()
      )
      .filter(validUuid);
  }

  if (
    ids.length === 0 &&
    body.artist_user_id &&
    validUuid(body.artist_user_id)
  ) {
    ids = [
      String(
        body.artist_user_id
      ).trim(),
    ];
  }

  if (ids.length === 0) {
    ids = [loggedInUserId];
  }

  return Array.from(
    new Set(ids)
  );
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

  for (
    let i = 0;
    i < artistIds.length;
    i++
  ) {
    if (
      i ===
      artistIds.length - 1
    ) {
      shares.push(
        Number(
          (
            totalArtistPercent -
            used
          ).toFixed(4)
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

function buildRoyaltyRow({
  recipientUserId,
  recipientType,
  songId,
  beatId,
  orderId,
  saleReference,
  saleAmount,
  currency,
  percentage,
  amount,
}) {
  const row = {
    recipient_type:
      recipientType,
    order_id: orderId,
    sale_reference:
      saleReference,
    sale_amount:
      saleAmount,
    currency,
    percentage,
    amount,
    entry_type: "credit",
    status: "available",
  };

  if (validUuid(recipientUserId)) {
    row.recipient_user_id =
      recipientUserId;
  }

  if (validUuid(songId)) {
    row.song_id = songId;
  }

  if (validUuid(beatId)) {
    row.beat_id = beatId;
  }

  return row;
}

app.post(
  "/api/songs/create",
  async (req, res) => {
    try {
      const loggedInUser =
        await getAuthenticatedUser(req);

      if (!loggedInUser) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      const body = req.body || {};

      const title = cleanText(
        body.title,
        200
      );

      const audioUrl = cleanText(
        body.audio_url,
        2000
      );

      const previewUrl = cleanText(
        body.preview_url,
        2000
      );

      const coverUrl = cleanText(
        body.cover_url,
        2000
      );

      if (
        !title ||
        !audioUrl ||
        !previewUrl ||
        !coverUrl
      ) {
        return res.status(400).json({
          error:
            "Title + audio + cover + preview required",
        });
      }

      if (
        !validUrl(audioUrl) ||
        !validUrl(previewUrl) ||
        !validUrl(coverUrl)
      ) {
        return res.status(400).json({
          error:
            "Invalid audio, preview or cover URL",
        });
      }

      if (
        isSameUrl(
          audioUrl,
          previewUrl
        )
      ) {
        return res.status(400).json({
          error:
            "Preview must be different from full audio",
        });
      }

      const artistIds =
        normalizeArtistIds(
          body,
          loggedInUser.id
        );

      const artistUsers = [];

      for (const id of artistIds) {
        const user =
          await validateUserId(id);

        if (!user) {
          return res.status(400).json({
            error:
              "Artist not found",
          });
        }

        const profile =
          await getArtistProfile(id);

        if (!profile) {
          return res.status(400).json({
            error:
              "Artist profile missing",
          });
        }

        artistUsers.push({
          user,
          profile,
        });
      }

      const producerUserId =
        body.producer_user_id
          ? String(
              body.producer_user_id
            ).trim()
          : null;

      if (
        !producerUserId ||
        !validUuid(
          producerUserId
        )
      ) {
        return res.status(400).json({
          error: "Producer required",
        });
      }

      const producer =
        await validateUserId(
          producerUserId
        );

      if (!producer) {
        return res.status(400).json({
          error:
            "Producer not found",
        });
      }

      const writerUserId =
        body.writer_user_id
          ? String(
              body.writer_user_id
            ).trim()
          : null;

      if (
        writerUserId &&
        !validUuid(writerUserId)
      ) {
        return res.status(400).json({
          error: "Invalid writer",
        });
      }

      if (writerUserId) {
        const writer =
          await validateUserId(
            writerUserId
          );

        if (!writer) {
          return res.status(400).json({
            error:
              "Writer not found",
          });
        }
      }

      const pricing = getPricing(req);

      const songResult =
        await supabase
          .from("songs")
          .insert({
            artist_id:
              artistUsers[0]
                .profile.id,
            artist_user_id:
              artistIds[0],
            uploader_user_id:
              loggedInUser.id,
            producer_user_id:
              producerUserId,
            writer_user_id:
              writerUserId,
            label_name:
              cleanText(
                body.label_name,
                200
              ) || null,
            title,
            price:
              pricing.amount,
            currency:
              pricing.currency,
            status: "approved",
            cover_url: coverUrl,
            audio_url: audioUrl,
            preview_url:
              previewUrl,
            artist_count:
              artistIds.length,
          })
          .select()
          .single();

      if (songResult.error) {
        return res.status(500).json({
          error:
            "Song creation failed",
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
          artist_user_id: id,
          artist_order:
            index + 1,
          artist_share_percent:
            artistShares[index],
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
            "Artist setup failed",
        });
      }

      res.status(201).json({
        success: true,
        song:
          songResult.data,
        royalty_split: {
          pasong_percent: 25,
          producer_percent:
            37.5,
          artist_percent:
            writerUserId
              ? 31.875
              : 37.5,
          writer_percent:
            writerUserId
              ? 5.625
              : 0,
        },
      });
    } catch {
      res.status(500).json({
        error:
          "Song creation failed",
      });
    }
  }
);

function publicSong(song) {
  if (!song) {
    return null;
  }

  const safeSong = {
    ...song,
  };

  delete safeSong.audio_url;

  safeSong.preview_url =
    song.preview_url || null;

  safeSong.audio_url =
    song.preview_url || null;

  return safeSong;
}

async function getPublicArtistProfile(
  artistProfileId,
  artistUserId
) {
  let profile = null;

  if (
    validUuid(
      artistProfileId
    )
  ) {
    const result =
      await supabase
        .from(
          "artist_profiles"
        )
        .select(
          "id,user_id,artist_name,stage_name,performing_name,profile_image_url,bio,location"
        )
        .eq(
          "id",
          artistProfileId
        )
        .maybeSingle();

    if (
      result.error
    ) {
      throw result.error;
    }

    profile =
      result.data || null;
  }

  if (
    !profile &&
    validUuid(artistUserId)
  ) {
    const result =
      await supabase
        .from(
          "artist_profiles"
        )
        .select(
          "id,user_id,artist_name,stage_name,performing_name,profile_image_url,bio,location"
        )
        .eq(
          "user_id",
          artistUserId
        )
        .maybeSingle();

    if (
      result.error
    ) {
      throw result.error;
    }

    profile =
      result.data || null;
  }

  if (!profile) {
    return null;
  }

  return {
    id:
      profile.id,
    user_id:
      profile.user_id || null,
    artist_name:
      profile.artist_name ||
      null,
    stage_name:
      profile.stage_name ||
      null,
    performing_name:
      profile.performing_name ||
      null,
    profile_image_url:
      profile.profile_image_url ||
      null,
    bio:
      profile.bio ||
      null,
    location:
      profile.location ||
      null,
  };
}

async function getSongPlayCount(
  songId
) {
  if (!validUuid(songId)) {
    return 0;
  }

  const result =
    await supabase.rpc(
      "get_song_play_count",
      {
        p_song_id:
          songId,
      }
    );

  if (result.error) {
    console.error(
      "Song play count error:",
      result.error
    );

    return 0;
  }

  return Number(
    result.data || 0
  );
}

app.get(
  "/api/songs",
  async (req, res) => {
    try {
      const result =
        await supabase
          .from("songs")
          .select("*")
          .eq(
            "status",
            "approved"
          )
          .not(
            "cover_url",
            "is",
            null
          )
          .order("created_at", {
            ascending: false,
          });

      if (result.error) {
        return res.status(500).json({
          error:
            "Unable to load songs",
        });
      }

      const songs =
        result.data || [];

      const profileIds =
        Array.from(
          new Set(
            songs
              .map(
                (song) =>
                  song.artist_id
              )
              .filter(validUuid)
          )
        );

      const userIds =
        Array.from(
          new Set(
            songs
              .map(
                (song) =>
                  song.artist_user_id
              )
              .filter(validUuid)
          )
        );

      let profiles = [];

      if (
        profileIds.length > 0
      ) {
        const profileResult =
          await supabase
            .from(
              "artist_profiles"
            )
            .select(
              "id,user_id,artist_name,stage_name,performing_name,profile_image_url,bio,location"
            )
            .in(
              "id",
              profileIds
            );

        if (
          profileResult.error
        ) {
          return res.status(500).json({
            error:
              "Unable to load artist profiles",
          });
        }

        profiles =
          profileResult.data || [];
      }

      const foundProfileUserIds =
        new Set(
          profiles
            .map(
              (profile) =>
                profile.user_id
            )
            .filter(validUuid)
        );

      const missingUserIds =
        userIds.filter(
          (id) =>
            !foundProfileUserIds.has(
              id
            )
        );

      if (
        missingUserIds.length > 0
      ) {
        const fallbackResult =
          await supabase
            .from(
              "artist_profiles"
            )
            .select(
              "id,user_id,artist_name,stage_name,performing_name,profile_image_url,bio,location"
            )
            .in(
              "user_id",
              missingUserIds
            );

        if (
          fallbackResult.error
        ) {
          return res.status(500).json({
            error:
              "Unable to load artist profiles",
          });
        }

        profiles = [
          ...profiles,
          ...(fallbackResult.data ||
            []),
        ];
      }

      const profileById =
        new Map();

      const profileByUserId =
        new Map();

      profiles.forEach(
        (profile) => {
          profileById.set(
            profile.id,
            profile
          );

          if (
            validUuid(
              profile.user_id
            )
          ) {
            profileByUserId.set(
              profile.user_id,
              profile
            );
          }
        }
      );

      const publicSongs =
        await Promise.all(
          songs.map(async (song) => {
            const profile =
              profileById.get(
                song.artist_id
              ) ||
              profileByUserId.get(
                song.artist_user_id
              ) ||
              null;

            const publicArtist =
              profile
                ? {
                    id:
                      profile.id,
                    user_id:
                      profile.user_id ||
                      null,
                    artist_name:
                      profile.artist_name ||
                      null,
                    stage_name:
                      profile.stage_name ||
                      null,
                    performing_name:
                      profile.performing_name ||
                      null,
                    profile_image_url:
                      profile.profile_image_url ||
                      null,
                    bio:
                      profile.bio ||
                      null,
                    location:
                      profile.location ||
                      null,
                  }
                : null;

            const safeSong =
              publicSong(song);

            safeSong.artist =
              publicArtist;

            safeSong.artist_profile =
              publicArtist;

            safeSong.artist_profiles =
              publicArtist;

            safeSong.play_count =
              await getSongPlayCount(
                song.id
              );

            return safeSong;
          })
        );

      res.json({
        songs:
          publicSongs,
        pricing:
          getPricing(req),
      });
    } catch (error) {
      console.error(
        "Songs loading error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load songs",
      });
    }
  }
);

app.get(
  "/api/songs/:id",
  async (req, res) => {
    try {
      if (
        !validUuid(req.params.id)
      ) {
        return res.status(400).json({
          error:
            "Invalid song id",
        });
      }

      const result =
        await supabase
          .from("songs")
          .select("*")
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
        result.error ||
        !result.data
      ) {
        return res.status(404).json({
          error: "Not found",
        });
      }

      const song =
        result.data;

      const publicArtist =
        await getPublicArtistProfile(
          song.artist_id,
          song.artist_user_id
        );

      const safeSong =
        publicSong(song);

      safeSong.artist =
        publicArtist;

      safeSong.artist_profile =
        publicArtist;

      safeSong.artist_profiles =
        publicArtist;

      res.json({
        song:
          safeSong,
      });
    } catch (error) {
      console.error(
        "Song loading error:",
        error
      );

      res.status(500).json({
        error:
          "Unable to load song",
      });
    }
  }
);

app.get(
  "/api/songs/:id/deliver",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      if (
        !validUuid(req.params.id)
      ) {
        return res.status(400).json({
          error:
            "Invalid song id",
        });
      }

      const download =
        await supabase
          .from("downloads")
          .select(
            "id,song_id,user_id,order_id"
          )
          .eq(
            "song_id",
            req.params.id
          )
          .eq(
            "user_id",
            user.id
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (
        download.error ||
        !download.data
      ) {
        return res.status(403).json({
          error:
            "Not purchased",
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
          error:
            "Song not found",
        });
      }

      if (!song.data.audio_url) {
        return res.status(404).json({
          error:
            "Download file unavailable",
        });
      }

      const upstream =
        await fetch(
          song.data.audio_url
        );

      if (
        !upstream.ok ||
        !upstream.body
      ) {
        return res.status(502).json({
          error:
            "Download file unavailable",
        });
      }

      const safeTitle =
        String(
          song.data.title ||
            "PASONG-Song"
        )
          .replace(
            /[^a-z0-9-_]+/gi,
            "_"
          )
          .replace(
            /^_+|_+$/g,
            ""
          ) ||
        "PASONG-Song";

      res.setHeader(
        "Content-Type",
        upstream.headers.get(
          "content-type"
        ) ||
          "audio/mpeg"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeTitle}.mp3"`
      );

      const contentLength =
        upstream.headers.get(
          "content-length"
        );

      if (contentLength) {
        res.setHeader(
          "Content-Length",
          contentLength
        );
      }

      Readable.fromWeb(
        upstream.body
      ).pipe(res);
    } catch (error) {
      console.error(
        "Song delivery error:",
        error
      );

      if (!res.headersSent) {
        return res.status(500).json({
          error:
            "Delivery failed",
        });
      }

      res.end();
    }
  }
);

app.get(
  "/api/earnings",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      const result =
        await supabase
          .from(
            "royalty_ledger"
          )
          .select("*")
          .eq(
            "recipient_user_id",
            user.id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (result.error) {
        return res.status(500).json({
          error:
            "Unable to load earnings",
        });
      }

      let balance = 0;

      (
        result.data || []
      ).forEach((entry) => {
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
      });

      res.json({
        available_balance:
          Number(
            balance.toFixed(2)
          ),
        entries:
          result.data || [],
      });
    } catch {
      res.status(500).json({
        error:
          "Unable to load earnings",
      });
    }
  }
);

app.post(
  "/api/payments/complete",
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
          error: "Unauthorized",
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
        payment_status,
      } = req.body || {};

      if (
        !validUuid(buyer_id) ||
        !validUuid(song_id)
      ) {
        return res.status(400).json({
          error:
            "Invalid buyer or song",
        });
      }

      const transaction =
        String(
          transaction_id || ""
        ).trim();

      const reference =
        String(
          external_reference || ""
        ).trim();

      if (
        !transaction ||
        !reference
      ) {
        return res.status(400).json({
          error:
            "Transaction and reference required",
        });
      }

      if (
        payment_status !==
        "SUCCESSFUL"
      ) {
        return res.status(400).json({
          error:
            "Not successful",
        });
      }

      if (
        !validPositiveNumber(
          amount
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid payment amount",
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
            "Invalid payment provider",
        });
      }

      const buyer =
        await validateUserId(
          buyer_id
        );

      if (!buyer) {
        return res.status(400).json({
          error:
            "Buyer not found",
        });
      }

      const songResult =
        await supabase
          .from("songs")
          .select("*")
          .eq("id", song_id)
          .eq(
            "status",
            "approved"
          )
          .maybeSingle();

      if (
        songResult.error ||
        !songResult.data
      ) {
        return res.status(404).json({
          error:
            "Song not found",
        });
      }

      const song =
        songResult.data;

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
        !validPositiveNumber(
          storedAmount
        ) ||
        !storedCurrency
      ) {
        return res.status(500).json({
          error:
            "Song price unavailable",
        });
      }

      if (
        requestedCurrency !==
        storedCurrency
      ) {
        return res.status(400).json({
          error:
            "Payment currency does not match song currency",
        });
      }

      const paidTotal =
        Number(amount);

      if (
        paidTotal <
        storedAmount
      ) {
        return res.status(400).json({
          error:
            "Payment amount is below song price",
        });
      }

      const tipAmount =
        Number(
          (
            paidTotal -
            storedAmount
          ).toFixed(2)
        );

      const existingTransaction =
        await supabase
          .from("payments")
          .select(
            "id,order_id,user_id,song_id"
          )
          .eq(
            "transaction_id",
            transaction
          )
          .maybeSingle();

      if (
        existingTransaction.error
      ) {
        return res.status(500).json({
          error:
            "Payment verification failed",
        });
      }

      if (
        existingTransaction.data
      ) {
        if (
          existingTransaction.data
            .user_id !== buyer_id ||
          existingTransaction.data
            .song_id !== song_id
        ) {
          return res.status(409).json({
            error:
              "Transaction already belongs to another purchase",
          });
        }

        return res.json({
          success: true,
          already_completed:
            true,
          order_id:
            existingTransaction
              .data.order_id,
        });
      }

      const existingReference =
        await supabase
          .from("payments")
          .select(
            "id,order_id,user_id,song_id"
          )
          .eq(
            "external_reference",
            reference
          )
          .maybeSingle();

      if (
        existingReference.error
      ) {
        return res.status(500).json({
          error:
            "Payment verification failed",
        });
      }

      if (
        existingReference.data
      ) {
        if (
          existingReference.data
            .user_id !== buyer_id ||
          existingReference.data
            .song_id !== song_id
        ) {
          return res.status(409).json({
            error:
              "Payment reference already belongs to another purchase",
          });
        }

        return res.json({
          success: true,
          already_completed:
            true,
          order_id:
            existingReference.data
              .order_id,
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
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (
        existingDownload.error
      ) {
        return res.status(500).json({
          error:
            "Purchase verification failed",
        });
      }

      if (
        existingDownload.data
      ) {
        return res.json({
          success: true,
          already_completed:
            true,
          order_id:
            existingDownload.data
              .order_id,
        });
      }

      const order =
        await supabase
          .from("orders")
          .insert({
            buyer_id,
            total_amount:
              paidTotal,
            currency:
              storedCurrency,
            status: "paid",
          })
          .select()
          .single();

      if (order.error) {
        return res.status(500).json({
          error:
            "Order creation failed",
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
              storedCurrency,
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
            "Order item creation failed",
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
            song_id,
            provider:
              normalizedProvider,
            transaction_id:
              transaction,
            external_reference:
              reference,
            amount:
              paidTotal,
            currency:
              storedCurrency,
            status:
              "successful",
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
            "Payment record failed",
        });
      }

      const hasWriter =
        Boolean(
          song.writer_user_id
        );

      const pasongPercent = 25;
      const producerPercent =
        37.5;
      const artistPercent =
        hasWriter
          ? 31.875
          : 37.5;
      const writerPercent =
        hasWriter
          ? 5.625
          : 0;

      const artistRows =
        await supabase
          .from("song_artists")
          .select(
            "artist_user_id,artist_order,artist_share_percent"
          )
          .eq(
            "song_id",
            song_id
          )
          .order(
            "artist_order",
            {
              ascending: true,
            }
          );

      if (artistRows.error) {
        await supabase
          .from(
            "payments"
          )
          .delete()
          .eq(
            "id",
            payment.data?.id ||
              ""
          );

        await supabase
          .from(
            "order_items"
          )
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
            "Artist royalty data unavailable",
        });
      }

      let artistIds =
        (
          artistRows.data ||
          []
        )
          .map(
            (row) =>
              row.artist_user_id
          )
          .filter(validUuid);

      if (
        artistIds.length === 0 &&
        validUuid(
          song.artist_user_id
        )
      ) {
        artistIds = [
          song.artist_user_id,
        ];
      }

      if (
        artistIds.length === 0
      ) {
        await supabase
          .from(
            "payments"
          )
          .delete()
          .eq(
            "id",
            payment.data?.id ||
              ""
          );

        await supabase
          .from(
            "order_items"
          )
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
            "No valid artist found for royalty distribution",
        });
      }

      const calculatedArtistShares =
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
          calculatedArtistShares[
            i
          ];

        royaltyRows.push(
          buildRoyaltyRow({
            recipientUserId:
              artistIds[i],
            recipientType:
              "artist",
            songId:
              song_id,
            orderId:
              order.data.id,
            saleReference:
              reference,
            saleAmount:
              storedAmount,
            currency:
              storedCurrency,
            percentage:
              percent,
            amount:
              Number(
                (
                  (storedAmount *
                    percent) /
                  100
                ).toFixed(2)
              ),
          })
        );
      }

      if (
        validUuid(
          song.producer_user_id
        )
      ) {
        royaltyRows.push(
          buildRoyaltyRow({
            recipientUserId:
              song.producer_user_id,
            recipientType:
              "producer",
            songId:
              song_id,
            orderId:
              order.data.id,
            saleReference:
              reference,
            saleAmount:
              storedAmount,
            currency:
              storedCurrency,
            percentage:
              producerPercent,
            amount:
              Number(
                (
                  (storedAmount *
                    producerPercent) /
                  100
                ).toFixed(2)
              ),
          })
        );
      }

      if (
        hasWriter &&
        validUuid(
          song.writer_user_id
        )
      ) {
        royaltyRows.push(
          buildRoyaltyRow({
            recipientUserId:
              song.writer_user_id,
            recipientType:
              "writer",
            songId:
              song_id,
            orderId:
              order.data.id,
            saleReference:
              reference,
            saleAmount:
              storedAmount,
            currency:
              storedCurrency,
            percentage:
              writerPercent,
            amount:
              Number(
                (
                  (storedAmount *
                    writerPercent) /
                  100
                ).toFixed(2)
              ),
          })
        );
      }

      royaltyRows.push(
        buildRoyaltyRow({
          recipientType:
            "pasong_song",
          songId:
            song_id,
          orderId:
            order.data.id,
          saleReference:
            reference,
          saleAmount:
            storedAmount,
          currency:
            storedCurrency,
          percentage:
            pasongPercent,
          amount:
            Number(
              (
                (storedAmount *
                  pasongPercent) /
                100
              ).toFixed(2)
            ),
        })
      );

      if (tipAmount > 0) {
        const artistTipTotal =
          Number(
            (
              tipAmount * 0.70
            ).toFixed(2)
          );

        const pasongTipAmount =
          Number(
            (
              tipAmount * 0.30
            ).toFixed(2)
          );

        let artistTipUsed = 0;

        for (
          let i = 0;
          i < artistIds.length;
          i++
        ) {
          const songArtistPercent =
            Number(
              calculatedArtistShares[
                i
              ]
            );

          let artistTipAmount =
            Number(
              (
                artistTipTotal *
                (
                  songArtistPercent /
                  artistPercent
                )
              ).toFixed(2)
            );

          if (
            i ===
            artistIds.length - 1
          ) {
            artistTipAmount =
              Number(
                (
                  artistTipTotal -
                  artistTipUsed
                ).toFixed(2)
              );
          }

          artistTipUsed =
            Number(
              (
                artistTipUsed +
                artistTipAmount
              ).toFixed(2)
            );

          royaltyRows.push(
            buildRoyaltyRow({
              recipientUserId:
                artistIds[i],
              recipientType:
                "artist_tip",
              songId:
                song_id,
              orderId:
                order.data.id,
              saleReference:
                reference,
              saleAmount:
                tipAmount,
              currency:
                storedCurrency,
              percentage:
                Number(
                  (
                    70 *
                    (
                      songArtistPercent /
                      artistPercent
                    )
                  ).toFixed(4)
                ),
              amount:
                artistTipAmount,
            })
          );
        }

        royaltyRows.push(
          buildRoyaltyRow({
            recipientType:
              "pasong_tip",
            songId:
              song_id,
            orderId:
              order.data.id,
            saleReference:
              reference,
            saleAmount:
              tipAmount,
            currency:
              storedCurrency,
            percentage: 30,
            amount:
              pasongTipAmount,
          })
        );
      }

      const royaltyResult =
        await supabase
          .from(
            "royalty_ledger"
          )
          .insert(
            royaltyRows
          );

      if (
        royaltyResult.error
      ) {
        await supabase
          .from(
            "payments"
          )
          .delete()
          .eq(
            "id",
            payment.data?.id ||
              ""
          );

        await supabase
          .from(
            "order_items"
          )
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
            "Royalty distribution failed",
          details:
            royaltyResult.error
              .message || null,
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
              order.data.id,
          });

      if (download.error) {
        await supabase
          .from(
            "royalty_ledger"
          )
          .delete()
          .eq(
            "order_id",
            order.data.id
          );

        await supabase
          .from(
            "payments"
          )
          .delete()
          .eq(
            "id",
            payment.data?.id ||
              ""
          );

        await supabase
          .from(
            "order_items"
          )
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
            "Download record failed",
        });
      }

      res.json({
        success: true,
        order_id:
          order.data.id,
        song_amount:
          storedAmount,
        tip_amount:
          tipAmount,
        total_paid:
          paidTotal,
        currency:
          storedCurrency,
        download_created:
          true,
        royalty_split: {
          pasong_percent:
            pasongPercent,
          producer_percent:
            producerPercent,
          artist_percent:
            artistPercent,
          writer_percent:
            writerPercent,
          tip_artist_percent:
            70,
          tip_pasong_percent:
            30,
        },
      });
    } catch (error) {
      console.error(
        "Payment completion error:",
        error
      );

      res.status(500).json({
        error:
          "Payment completion failed",
      });
    }
  }
);

function publicBeat(beat) {
  if (!beat) {
    return null;
  }

  return {
    id: beat.id,
    producer_id:
      beat.producer_id,
    title: beat.title,
    audio_url:
      beat.audio_url || null,
    preview_url:
      beat.preview_url ||
      beat.audio_url ||
      null,
    cover_url:
      beat.cover_url || null,
    bpm: beat.bpm || null,
    musical_key:
      beat.musical_key || null,
    genre:
      beat.genre || null,
    description:
      beat.description || null,
    lease_mp3_price:
      Number(
        beat.lease_mp3_price
      ) || 0,
    lease_wav_price:
      Number(
        beat.lease_wav_price
      ) || 0,
    stems_price:
      Number(
        beat.stems_price
      ) || 0,
    exclusive_price:
      Number(
        beat.exclusive_price
      ) || 0,
    status:
      beat.status,
    is_exclusive_sold:
      Boolean(
        beat.is_exclusive_sold
      ),
    created_at:
      beat.created_at,
  };
}

app.post(
  "/api/beats/create",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      const body =
        req.body || {};

      const cleanTitle =
        cleanText(
          body.title,
          200
        );

      const audioUrl =
        cleanText(
          body.audio_url,
          2000
        );

      const previewUrl =
        cleanText(
          body.preview_url ||
            body.audio_url,
          2000
        );

      const coverUrl =
        cleanText(
          body.cover_url,
          2000
        );

      const producerId =
        cleanText(
          body.producer_id,
          100
        );

      const cleanGenre =
        cleanText(
          body.genre,
          100
        ) || "Afrobeat";

      const cleanKey =
        cleanText(
          body.musical_key ||
            body.key,
          50
        );

      const cleanBpm =
        body.bpm ===
          undefined ||
        body.bpm === null ||
        body.bpm === ""
          ? null
          : Number(body.bpm);

      const getPriceInput = (
        ...values
      ) => {
        for (
          const value of values
        ) {
          if (
            value !==
              undefined &&
            value !== null &&
            String(value).trim() !==
              ""
          ) {
            return value;
          }
        }

        return null;
      };

      const mp3PriceRaw =
        getPriceInput(
          body.lease_mp3_price,
          body.mp3_price,
          body.mp3_lease_price
        );

      const wavPriceRaw =
        getPriceInput(
          body.lease_wav_price,
          body.wav_price,
          body.lease_wav_price
        );

      const stemsPriceRaw =
        getPriceInput(
          body.stems_price,
          body.trackout_price,
          body.lease_stems_price,
          body.stems_lease_price
        );

      const exclusivePriceRaw =
        getPriceInput(
          body.exclusive_price
        );

      const mp3Price =
        mp3PriceRaw === null
          ? 10000
          : Number(
              mp3PriceRaw
            );

      const wavPrice =
        wavPriceRaw === null
          ? 25000
          : Number(
              wavPriceRaw
            );

      const stemsPrice =
        stemsPriceRaw === null
          ? 50000
          : Number(
              stemsPriceRaw
            );

      const exclusivePrice =
        exclusivePriceRaw === null
          ? 500000
          : Number(
              exclusivePriceRaw
            );

      if (!cleanTitle) {
        return res.status(400).json({
          error:
            "Beat title required",
        });
      }

      if (!audioUrl) {
        return res.status(400).json({
          error:
            "Audio file required",
        });
      }

      if (!validUrl(audioUrl)) {
        return res.status(400).json({
          error:
            "Invalid audio URL",
        });
      }

      if (!previewUrl) {
        return res.status(400).json({
          error:
            "Preview URL required",
        });
      }

      if (
        !validUrl(previewUrl)
      ) {
        return res.status(400).json({
          error:
            "Invalid preview URL",
        });
      }

      if (
        coverUrl &&
        !validUrl(coverUrl)
      ) {
        return res.status(400).json({
          error:
            "Invalid cover URL",
        });
      }

      if (
        cleanBpm !== null &&
        (
          !Number.isFinite(
            cleanBpm
          ) ||
          cleanBpm < 1 ||
          cleanBpm > 400
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid BPM",
        });
      }

      if (
        !producerId ||
        !validUuid(producerId)
      ) {
        return res.status(400).json({
          error:
            "Producer profile required",
        });
      }

      if (
        !Number.isFinite(
          mp3Price
        ) ||
        mp3Price < 10000 ||
        mp3Price > 1500000
      ) {
        return res.status(400).json({
          error:
            "MP3 lease price must be between UGX 10,000 and UGX 1,500,000",
        });
      }

      if (
        !Number.isFinite(
          wavPrice
        ) ||
        wavPrice < 10000 ||
        wavPrice > 1500000
      ) {
        return res.status(400).json({
          error:
            "WAV lease price must be between UGX 10,000 and UGX 1,500,000",
        });
      }

      if (
        !Number.isFinite(
          stemsPrice
        ) ||
        stemsPrice < 10000 ||
        stemsPrice > 1500000
      ) {
        return res.status(400).json({
          error:
            "Stems/Trackout price must be between UGX 10,000 and UGX 1,500,000",
        });
      }

      if (
        !Number.isFinite(
          exclusivePrice
        ) ||
        exclusivePrice < 500000 ||
        exclusivePrice > 10000000
      ) {
        return res.status(400).json({
          error:
            "Exclusive price must be between UGX 500,000 and UGX 10,000,000",
        });
      }

      const producerProfile =
        await supabase
          .from(
            "artist_profiles"
          )
          .select(
            "id,user_id"
          )
          .eq(
            "id",
            producerId
          )
          .maybeSingle();

      if (
        producerProfile.error
      ) {
        return res.status(500).json({
          error:
            "Producer profile lookup failed",
          details:
            producerProfile.error
              .message || null,
        });
      }

      if (
        !producerProfile.data
      ) {
        return res.status(400).json({
          error:
            "Producer profile not found",
        });
      }

      if (
        producerProfile.data
          .user_id !== user.id
      ) {
        return res.status(403).json({
          error:
            "Producer profile does not belong to this account",
        });
      }

      const beatResult =
        await supabase
          .from("beats")
          .insert({
            producer_id:
              producerId,
            title:
              cleanTitle,
            audio_url:
              audioUrl,
            preview_url:
              previewUrl,
            cover_url:
              coverUrl || null,
            genre:
              cleanGenre,
            bpm:
              cleanBpm,
            musical_key:
              cleanKey || null,
            lease_mp3_price:
              mp3Price,
            lease_wav_price:
              wavPrice,
            stems_price:
              stemsPrice,
            exclusive_price:
              exclusivePrice,
            status:
              "approved",
            is_exclusive_sold:
              false,
          })
          .select()
          .single();

      if (beatResult.error) {
        return res.status(500).json({
          error:
            "Beat creation failed",
          details:
            beatResult.error
              .message || null,
          code:
            beatResult.error
              .code || null,
          hint:
            beatResult.error
              .hint || null,
        });
      }

      res.status(201).json({
        success: true,
        beat: publicBeat(
          beatResult.data
        ),
        prices: {
          mp3: mp3Price,
          wav: wavPrice,
          stems: stemsPrice,
          exclusive:
            exclusivePrice,
        },
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Beat creation failed",
        details:
          error &&
          error.message
            ? error.message
            : null,
      });
    }
  }
);

app.get(
  "/api/producers",
  async (req, res) => {
    try {
      const profilesResult =
        await supabase
          .from(
            "artist_profiles"
          )
          .select(`
            id,
            artist_name,
            stage_name,
            performing_name,
            profile_image_url,
            location,
            bio
          `)
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (
        profilesResult.error
      ) {
        return res.status(500).json({
          error:
            "Unable to load producers",
          details:
            profilesResult.error
              .message || null,
        });
      }

      const beatsResult =
        await supabase
          .from("beats")
          .select("*")
          .in("status", [
            "approved",
            "sold_exclusive",
          ])
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (beatsResult.error) {
        return res.status(500).json({
          error:
            "Unable to load producer beats",
          details:
            beatsResult.error
              .message || null,
        });
      }

      const beats =
        beatsResult.data || [];

      const producerIds =
        new Set(
          beats
            .map(
              (beat) =>
                beat.producer_id
            )
            .filter(Boolean)
        );

      const producers =
        (
          profilesResult.data ||
          []
        )
          .filter(
            (profile) =>
              producerIds.has(
                profile.id
              )
          )
          .map((profile) => ({
            id: profile.id,
            artist_name:
              profile.artist_name ||
              null,
            stage_name:
              profile.stage_name ||
              null,
            performing_name:
              profile.performing_name ||
              null,
            profile_image_url:
              profile.profile_image_url ||
              null,
            location:
              profile.location ||
              null,
            bio:
              profile.bio ||
              null,
            beats: beats
              .filter(
                (beat) =>
                  beat.producer_id ===
                  profile.id
              )
              .map(publicBeat),
          }));

      res.json({
        producers,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Unable to load producers",
        details:
          error &&
          error.message
            ? error.message
            : null,
      });
    }
  }
);

app.get(
  "/api/beats",
  async (req, res) => {
    const result =
      await supabase
        .from("beats")
        .select("*")
        .in("status", [
          "approved",
          "sold_exclusive",
        ])
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (result.error) {
      return res.status(500).json({
        error:
          "Unable to load beats",
        details:
          result.error.message ||
          null,
      });
    }

    res.json({
      beats: (
        result.data || []
      ).map(publicBeat),
    });
  }
);

app.get(
  "/api/beats/:id",
  async (req, res) => {
    if (
      !validUuid(req.params.id)
    ) {
      return res.status(400).json({
        error:
          "Invalid beat id",
      });
    }

    const result =
      await supabase
        .from("beats")
        .select("*")
        .eq(
          "id",
          req.params.id
        )
        .in("status", [
          "approved",
          "sold_exclusive",
        ])
        .maybeSingle();

    if (
      result.error ||
      !result.data
    ) {
      return res.status(404).json({
        error:
          "Beat not found",
      });
    }

    res.json({
      beat: publicBeat(
        result.data
      ),
    });
  }
);

app.post(
  "/api/beats/:id/pay",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(
          req
        );

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid beat id",
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
          "exclusive",
        ].includes(packageType)
      ) {
        return res.status(400).json({
          error:
            "Invalid package",
        });
      }

      if (
        !allowedPaymentProvider(
          provider
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid payment provider",
        });
      }

      const beatResult =
        await supabase
          .from("beats")
          .select(
            "id,producer_id,status,title,lease_mp3_price,lease_wav_price,stems_price,exclusive_price,is_exclusive_sold"
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
            "Beat not found",
        });
      }

      const beat =
        beatResult.data;

      if (
        beat.status !==
          "approved" ||
        beat.is_exclusive_sold
      ) {
        return res.status(400).json({
          error:
            "Beat is not available",
        });
      }

      const producerProfile =
        await supabase
          .from(
            "artist_profiles"
          )
          .select(
            "id,user_id"
          )
          .eq(
            "id",
            beat.producer_id
          )
          .maybeSingle();

      if (
        producerProfile.error ||
        !producerProfile.data
      ) {
        return res.status(404).json({
          error:
            "Producer profile not found",
        });
      }

      if (
        producerProfile.data
          .user_id === user.id
      ) {
        return res.status(400).json({
          error:
            "You cannot purchase your own beat",
        });
      }

      let packagePrice = 0;

      if (
        packageType === "mp3"
      ) {
        packagePrice =
          Number(
            beat.lease_mp3_price
          );
      }

      if (
        packageType === "wav"
      ) {
        packagePrice =
          Number(
            beat.lease_wav_price
          );
      }

      if (
        packageType === "stems"
      ) {
        packagePrice =
          Number(
            beat.stems_price
          );
      }

      if (
        packageType ===
        "exclusive"
      ) {
        packagePrice =
          Number(
            beat.exclusive_price
          );
      }

      if (
        !Number.isFinite(
          packagePrice
        ) ||
        packagePrice <= 0
      ) {
        return res.status(400).json({
          error:
            "Package price unavailable",
        });
      }

      const existingPurchase =
        await supabase
          .from(
            "beat_orders"
          )
          .select(
            "id,status"
          )
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
        existingPurchase.error
      ) {
        return res.status(500).json({
          error:
            "Purchase check failed",
        });
      }

      if (
        existingPurchase.data
      ) {
        return res.status(400).json({
          error:
            "You already purchased this package",
        });
      }

      if (
        packageType ===
        "exclusive"
      ) {
        const exclusiveCheck =
          await supabase
            .from(
              "beat_orders"
            )
            .select("id")
            .eq(
              "beat_id",
              req.params.id
            )
            .eq(
              "package_type",
              "exclusive"
            )
            .eq(
              "status",
              "paid"
            )
            .limit(1)
            .maybeSingle();

        if (
          exclusiveCheck.error
        ) {
          return res.status(500).json({
            error:
              "Exclusive availability check failed",
          });
        }

        if (
          exclusiveCheck.data
        ) {
          return res.status(400).json({
            error:
              "Exclusive already sold",
          });
        }
      }

      const externalReference =
        `PASONG-BEAT-${Date.now()}-${crypto
          .randomBytes(8)
          .toString("hex")}`;

      const orderResult =
        await supabase
          .from(
            "beat_orders"
          )
          .insert({
            buyer_id:
              user.id,
            beat_id:
              req.params.id,
            package_type:
              packageType,
            price:
              packagePrice,
            currency:
              "UGX",
            provider,
            status:
              "pending",
            external_reference:
              externalReference,
          })
          .select()
          .single();

      if (
        orderResult.error
      ) {
        return res.status(500).json({
          error:
            "Beat order creation failed",
          details:
            orderResult.error
              .message || null,
        });
      }

      res.json({
        success: true,
        order:
          orderResult.data,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Beat payment setup failed",
        details:
          error &&
          error.message
            ? error.message
            : null,
      });
    }
  }
);

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
          error: "Unauthorized",
        });
      }

      const {
        order_id,
        transaction_id,
        external_reference,
        payment_status,
        amount,
        currency,
      } = req.body || {};

      if (
        !validUuid(order_id)
      ) {
        return res.status(400).json({
          error:
            "Invalid order",
        });
      }

      const transaction =
        String(
          transaction_id || ""
        ).trim();

      const reference =
        String(
          external_reference || ""
        ).trim();

      if (
        !transaction ||
        !reference
      ) {
        return res.status(400).json({
          error:
            "Transaction and reference required",
        });
      }

      if (
        payment_status !==
        "SUCCESSFUL"
      ) {
        return res.status(400).json({
          error:
            "Not successful",
        });
      }

      if (
        !validPositiveNumber(
          amount
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid amount",
        });
      }

      const orderResult =
        await supabase
          .from("beat_orders")
          .select("*")
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
            "Order not found",
        });
      }

      const order =
        orderResult.data;

      if (
        order.status ===
        "paid"
      ) {
        return res.json({
          success: true,
          already_completed:
            true,
        });
      }

      if (
        String(
          order.external_reference ||
            ""
        ) !== reference
      ) {
        return res.status(400).json({
          error:
            "Payment reference does not match order",
        });
      }

      const storedAmount =
        Number(order.price);

      const storedCurrency =
        String(
          order.currency || ""
        ).toUpperCase();

      const paidCurrency =
        String(
          currency || ""
        ).toUpperCase();

      if (
        !isSameAmount(
          amount,
          storedAmount
        ) ||
        paidCurrency !==
          storedCurrency
      ) {
        return res.status(400).json({
          error:
            "Payment amount or currency does not match order",
        });
      }

      const beatResult =
        await supabase
          .from("beats")
          .select("*")
          .eq(
            "id",
            order.beat_id
          )
          .maybeSingle();

      if (
        beatResult.error ||
        !beatResult.data
      ) {
        return res.status(404).json({
          error:
            "Beat not found",
        });
      }

      const beat =
        beatResult.data;

      if (
        order.package_type ===
          "exclusive" &&
        beat.is_exclusive_sold
      ) {
        return res.status(400).json({
          error:
            "Exclusive already sold",
        });
      }

      const producerProfile =
        await supabase
          .from(
            "artist_profiles"
          )
          .select(
            "id,user_id"
          )
          .eq(
            "id",
            beat.producer_id
          )
          .maybeSingle();

      if (
        producerProfile.error ||
        !producerProfile.data
      ) {
        return res.status(404).json({
          error:
            "Producer profile not found",
        });
      }

      const producerUserId =
        producerProfile.data
          .user_id;

      const existingTransaction =
        await supabase
          .from(
            "beat_orders"
          )
          .select(
            "id,status,buyer_id,beat_id,package_type"
          )
          .eq(
            "transaction_id",
            transaction
          )
          .neq(
            "id",
            order_id
          )
          .maybeSingle();

      if (
        existingTransaction.error
      ) {
        return res.status(500).json({
          error:
            "Transaction verification failed",
        });
      }

      if (
        existingTransaction.data
      ) {
        return res.status(400).json({
          error:
            "Transaction already used",
        });
      }

      const existingReference =
        await supabase
          .from(
            "beat_orders"
          )
          .select(
            "id,status,buyer_id,beat_id,package_type"
          )
          .eq(
            "external_reference",
            reference
          )
          .neq(
            "id",
            order_id
          )
          .maybeSingle();

      if (
        existingReference.error
      ) {
        return res.status(500).json({
          error:
            "Reference verification failed",
        });
      }

      if (
        existingReference.data
      ) {
        return res.status(400).json({
          error:
            "Reference already used",
        });
      }

      const existingDownload =
        await supabase
          .from(
            "beat_downloads"
          )
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
        existingDownload.error
      ) {
        return res.status(500).json({
          error:
            "Download verification failed",
        });
      }

      if (
        existingDownload.data
      ) {
        return res.json({
          success: true,
          already_completed:
            true,
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
          .from(
            "beat_licenses"
          )
          .insert({
            beat_id:
              beat.id,
            order_id:
              order.id,
            buyer_id:
              order.buyer_id,
            producer_user_id:
              producerUserId,
            package_type:
              order.package_type,
            license_text:
              `License for ${beat.title} - ${order.package_type}`,
          });

      if (license.error) {
        return res.status(500).json({
          error:
            "License creation failed",
          details:
            license.error
              .message || null,
        });
      }

      const download =
        await supabase
          .from(
            "beat_downloads"
          )
          .insert({
            user_id:
              order.buyer_id,
            beat_id:
              beat.id,
            order_id:
              order.id,
            package_type:
              order.package_type,
          });

      if (download.error) {
        return res.status(500).json({
          error:
            "Beat download creation failed",
          details:
            download.error
              .message || null,
        });
      }

      const producerRoyalty =
        await supabase
          .from(
            "royalty_ledger"
          )
          .insert(
            buildRoyaltyRow({
              recipientUserId:
                producerUserId,
              recipientType:
                "beat_producer",
              beatId:
                beat.id,
              orderId:
                order.id,
              saleReference:
                reference,
              saleAmount:
                storedAmount,
              currency:
                storedCurrency,
              percentage: 75,
              amount:
                producerAmount,
            })
          );

      if (
        producerRoyalty.error
      ) {
        return res.status(500).json({
          error:
            "Producer royalty failed",
          details:
            producerRoyalty.error
              .message || null,
        });
      }

      const pasongRoyalty =
        await supabase
          .from(
            "royalty_ledger"
          )
          .insert(
            buildRoyaltyRow({
              recipientType:
                "pasong_beat",
              beatId:
                beat.id,
              orderId:
                order.id,
              saleReference:
                reference,
              saleAmount:
                storedAmount,
              currency:
                storedCurrency,
              percentage: 25,
              amount:
                pasongAmount,
            })
          );

      if (
        pasongRoyalty.error
      ) {
        return res.status(500).json({
          error:
            "PASONG royalty failed",
          details:
            pasongRoyalty.error
              .message || null,
        });
      }

      const orderUpdateData = {
        status: "paid",
        transaction_id:
          transaction,
        external_reference:
          reference,
        paid_amount:
          storedAmount,
        paid_currency:
          storedCurrency,
      };

      const orderUpdate =
        await supabase
          .from(
            "beat_orders"
          )
          .update(
            orderUpdateData
          )
          .eq(
            "id",
            order.id
          );

      if (
        orderUpdate.error
      ) {
        return res.status(500).json({
          error:
            "Beat order completion failed",
          details:
            orderUpdate.error
              .message || null,
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
                "sold_exclusive",
              is_exclusive_sold:
                true,
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
              "Exclusive status update failed",
            details:
              exclusiveUpdate.error
                .message || null,
          });
        }
      }

      const notification =
        await supabase
          .from(
            "producer_notifications"
          )
          .insert({
            producer_user_id:
              producerUserId,
            type:
              "beat_sale",
            message:
              `Your beat ${beat.title} sold ${order.package_type} for ${storedAmount} ${storedCurrency}`,
            beat_id:
              beat.id,
            order_id:
              order.id,
          });

      res.json({
        success: true,
        producer_earning:
          producerAmount,
        pasong_earning:
          pasongAmount,
        notification_saved:
          !notification.error,
      });
    } catch (error) {
      res.status(500).json({
        error:
          "Beat payment completion failed",
        details:
          error &&
          error.message
            ? error.message
            : null,
      });
    }
  }
);

app.get(
  "/api/beats/orders/my",
  async (req, res) => {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth",
      });
    }

    const result =
      await supabase
        .from("beat_orders")
        .select(
          "*, beats(*)"
        )
        .eq(
          "buyer_id",
          user.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (result.error) {
      return res.status(500).json({
        error:
          "Unable to load orders",
      });
    }

    const orders =
      (
        result.data || []
      ).map((order) => {
        if (order.beats) {
          order.beats =
            publicBeat(
              order.beats
            );
        }

        return order;
      });

    res.json({
      orders,
    });
  }
);

app.get(
  "/api/beats/orders/producer",
  async (req, res) => {
    const user =
      await getAuthenticatedUser(req);

    if (!user) {
      return res.status(401).json({
        error: "Auth",
      });
    }

    const profile =
      await supabase
        .from(
          "artist_profiles"
        )
        .select(
          "id,user_id"
        )
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();

    if (
      profile.error ||
      !profile.data
    ) {
      return res.status(404).json({
        error:
          "Producer profile not found",
      });
    }

    const result =
      await supabase
        .from(
          "beat_orders"
        )
        .select(
          "*, beats!inner(*)"
        )
        .eq(
          "beats.producer_id",
          profile.data.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

    if (result.error) {
      return res.status(500).json({
        error:
          "Unable to load producer orders",
      });
    }

    res.json({
      orders:
        result.data || [],
    });
  }
);

app.get(
  "/api/beats/:id/deliver",
  async (req, res) => {
    try {
      const user =
        await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          error: "Auth",
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid beat id",
        });
      }

      const result =
        await supabase
          .from(
            "beat_downloads"
          )
          .select(
            "*, beats(*)"
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
              ascending: false,
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
            "Not purchased",
        });
      }

      const beat =
        result.data.beats;

      if (!beat) {
        return res.status(404).json({
          error:
            "Beat not found",
        });
      }

      let url = null;

      if (
        result.data
          .package_type ===
        "mp3"
      ) {
        url =
          beat.audio_url ||
          beat.preview_url;
      }

      if (
        result.data
          .package_type ===
        "wav"
      ) {
        url =
          beat.audio_url;
      }

      if (
        result.data
          .package_type ===
        "stems"
      ) {
        url =
          beat.audio_url;
      }

      if (
        result.data
          .package_type ===
        "exclusive"
      ) {
        url =
          beat.audio_url;
      }

      if (!url) {
        return res.status(404).json({
          error:
            "File not available",
        });
      }

      res.json({
        download_url:
          url,
        package_type:
          result.data
            .package_type,
      });
    } catch {
      res.status(500).json({
        error:
          "Beat delivery failed",
      });
    }
  }
);

async function getProducerBalance(
  userId
) {
  const result =
    await supabase
      .from(
        "royalty_ledger"
      )
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
      "Unable to calculate balance"
    );
  }

  let balance = 0;

  (
    result.data || []
  ).forEach((entry) => {
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
  });

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
          error: "Auth",
        });
      }

      const result =
        await supabase
          .from(
            "royalty_ledger"
          )
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
              ascending: false,
            }
          );

      if (result.error) {
        return res.status(500).json({
          error:
            "Unable to load producer earnings",
        });
      }

      let balance = 0;

      (
        result.data || []
      ).forEach((entry) => {
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
      });

      res.json({
        available_balance:
          Number(
            balance.toFixed(2)
          ),
        entries:
          result.data || [],
      });
    } catch {
      res.status(500).json({
        error:
          "Unable to load producer earnings",
      });
    }
  }
);

app.post(
  "/api/producer/withdraw",
  async (req, res) => {
    try {
      // 1. Verify the Supabase user from the dashboard's access token.
      const user = await getAuthenticatedUser(req);

      if (!user) {
        return res.status(401).json({
          success: false,
          error: "You must be logged in to request a withdrawal.",
        });
      }

      // 2. Verify that this authenticated user actually has a producer
      //    profile. The Producer Dashboard uses artist_profiles for the
      //    producer account, so we verify ownership by user_id here.
      const profileResult = await supabase
        .from("artist_profiles")
        .select("id,user_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (profileResult.error) {
        console.error(
          "Producer profile lookup failed:",
          profileResult.error
        );

        return res.status(500).json({
          success: false,
          error: "Unable to verify your producer account.",
        });
      }

      if (!profileResult.data || profileResult.data.user_id !== user.id) {
        return res.status(403).json({
          success: false,
          error: "Producer profile not found for this account.",
        });
      }

      const {
        amount,
        provider,
        mobile_number,
      } = req.body || {};

      // 3. Validate withdrawal amount.
      const requestedAmount = Number(
        String(amount ?? "")
          .replace(/,/g, "")
          .trim()
      );

      if (!validPositiveNumber(requestedAmount)) {
        return res.status(400).json({
          success: false,
          error: "Invalid withdrawal amount.",
        });
      }

      // Producer withdrawals must be at least UGX 10,000.
      if (requestedAmount < 10000) {
        return res.status(400).json({
          success: false,
          error: "Minimum withdrawal amount is UGX 10,000.",
        });
      }

      // Only the two mobile-money providers supported by the Producer UI.
      const normalizedProvider = normalizeProvider(provider);

      if (!["MTN", "AIRTEL"].includes(normalizedProvider)) {
        return res.status(400).json({
          success: false,
          error: "Mobile Money provider must be MTN or AIRTEL.",
        });
      }

      // 4. Validate and normalize the Uganda mobile number.
      let mobile = String(mobile_number || "")
        .trim()
        .replace(/\s+/g, "");

      if (!/^(?:\+256|256|0)7[0-9]{8}$/.test(mobile)) {
        return res.status(400).json({
          success: false,
          error: "Invalid Uganda mobile number.",
        });
      }

      // Store one consistent local format: 07XXXXXXXX.
      if (mobile.startsWith("+256")) {
        mobile = "0" + mobile.substring(4);
      } else if (mobile.startsWith("256")) {
        mobile = "0" + mobile.substring(3);
      }

      // 5. Calculate the producer's currently available balance.
      //    This includes existing credits and subtracts every debit,
      //    including pending withdrawal debits, so the same money cannot
      //    be withdrawn twice.
      const availableBalance = await getProducerBalance(user.id);

      if (requestedAmount > availableBalance) {
        return res.status(400).json({
          success: false,
          error:
            "Insufficient producer balance. Available balance is UGX " +
            Number(availableBalance).toLocaleString("en-UG") + ".",
          available_balance: availableBalance,
        });
      }

      // 6. Create the withdrawal request first as PENDING.
      //    Payment processing can later move it to processing/paid/failed.
      const withdrawal = await supabase
        .from("producer_withdrawals")
        .insert({
          producer_user_id: user.id,
          amount: requestedAmount,
          currency: "UGX",
          provider: normalizedProvider,
          mobile_number: mobile,
          status: "pending",
        })
        .select()
        .single();

      if (withdrawal.error) {
        console.error(
          "Producer withdrawal insert failed:",
          withdrawal.error
        );

        return res.status(500).json({
          success: false,
          error: "Withdrawal request could not be created.",
        });
      }

      // 7. Reserve the requested amount in the producer ledger.
      //    The debit is tied to the withdrawal ID so the payout can be
      //    traced and reconciled later.
      const debit = await supabase
        .from("royalty_ledger")
        .insert({
          recipient_user_id: user.id,
          recipient_type: "beat_producer",
          amount: requestedAmount,
          percentage: 100,
          entry_type: "debit",
          status: "pending_withdrawal",
          withdrawal_id: withdrawal.data.id,
        });

      if (debit.error) {
        console.error(
          "Producer withdrawal ledger debit failed:",
          debit.error
        );

        // Do not leave an orphaned withdrawal request if the balance
        // reservation could not be created.
        await supabase
          .from("producer_withdrawals")
          .delete()
          .eq("id", withdrawal.data.id);

        return res.status(500).json({
          success: false,
          error: "Withdrawal balance reservation failed.",
        });
      }

      const remainingBalance = Number(
        (availableBalance - requestedAmount).toFixed(2)
      );

      return res.status(201).json({
        success: true,
        message: "Withdrawal request submitted successfully.",
        withdrawal: withdrawal.data,
        available_balance: remainingBalance,
      });
    } catch (error) {
      console.error(
        "Producer withdrawal error:",
        error
      );

      return res.status(500).json({
        success: false,
        error: "Withdrawal failed. Please try again.",
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
          error: "Auth",
        });
      }

      const {
        title,
        description,
        price,
        delivery_days,
      } = req.body || {};

      const cleanTitle =
        cleanText(
          title,
          200
        );

      const cleanDescription =
        cleanText(
          description,
          5000
        );

      const cleanPrice =
        Number(price);

      const cleanDays =
        Number(
          delivery_days
        );

      if (!cleanTitle) {
        return res.status(400).json({
          error:
            "Title required",
        });
      }

      if (
        !validPositiveNumber(
          cleanPrice
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid price",
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
            "Invalid delivery days",
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
              cleanDescription ||
              null,
            price:
              cleanPrice,
            delivery_days:
              cleanDays,
            status:
              "active",
          })
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            "Service creation failed",
        });
      }

      res.json({
        service:
          result.data,
      });
    } catch {
      res.status(500).json({
        error:
          "Service creation failed",
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
          "Unable to load services",
      });
    }

    res.json({
      services:
        result.data || [],
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
          error: "Auth",
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid service id",
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
            "Service not found",
        });
      }

      if (
        service.data
          .producer_user_id ===
        user.id
      ) {
        return res.status(400).json({
          error:
            "You cannot order your own service",
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
              "pending_payment",
          })
          .select()
          .single();

      if (order.error) {
        return res.status(500).json({
          error:
            "Service order failed",
        });
      }

      res.json({
        order:
          order.data,
      });
    } catch {
      res.status(500).json({
        error:
          "Service order failed",
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
          error: "Auth",
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid order id",
        });
      }

      const message =
        cleanText(
          req.body.message,
          5000
        );

      if (!message) {
        return res.status(400).json({
          error:
            "Message required",
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
            "Order not found",
        });
      }

      const isParticipant =
        order.data
          .buyer_id ===
          user.id ||
        order.data
          .producer_user_id ===
          user.id;

      if (!isParticipant) {
        return res.status(403).json({
          error:
            "Not authorized",
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
            message,
          })
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            "Message failed",
        });
      }

      res.json({
        message:
          result.data,
      });
    } catch {
      res.status(500).json({
        error:
          "Message failed",
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
          error: "Auth",
        });
      }

      if (
        !validUuid(
          req.params.id
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid order id",
        });
      }

      const existing =
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
        existing.error ||
        !existing.data
      ) {
        return res.status(404).json({
          error:
            "Order not found",
        });
      }

      if (
        existing.data
          .producer_user_id !==
        user.id
      ) {
        return res.status(403).json({
          error:
            "Not authorized",
        });
      }

      if (
        existing.data.status ===
        "completed"
      ) {
        return res.json({
          success: true,
          order:
            existing.data,
        });
      }

      const result =
        await supabase
          .from(
            "producer_service_orders"
          )
          .update({
            status:
              "completed",
          })
          .eq(
            "id",
            req.params.id
          )
          .eq(
            "producer_user_id",
            user.id
          )
          .select()
          .single();

      if (result.error) {
        return res.status(500).json({
          error:
            "Order completion failed",
        });
      }

      res.json({
        success: true,
        order:
          result.data,
      });
    } catch {
      res.status(500).json({
        error:
          "Order completion failed",
      });
    }
  }
);

// ============================================================
// PASONG LICENSING CENTRE API — additive routes
// These routes use the existing Supabase service-role client and
// existing getAuthenticatedUser(req) helper. Keep before the 404 handler.
// ============================================================
function licensingText(v, max = 200) { return String(v || '').trim().slice(0, max); }
function licensingScopes(v) { return Array.isArray(v) ? v.map(x => licensingText(x, 60)).filter(Boolean).slice(0, 10) : []; }

app.post('/api/dj-licenses/register', async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Please sign in to your PASONG account first.' });
    const b = req.body || {};
    const dj_name = licensingText(b.dj_name, 120), legal_name = licensingText(b.legal_name, 120);
    const contact_phone = licensingText(b.contact_phone, 40), country = licensingText(b.country, 100);
    const district = licensingText(b.district, 120), requested_scopes = licensingScopes(b.requested_scopes);
    if (!dj_name || !legal_name || !contact_phone || !country || !district || !b.accepted_terms || !requested_scopes.length)
      return res.status(400).json({ error: 'Complete all required fields, select at least one DJ activity, and accept the terms.' });
    const payload = { user_id:user.id, email:user.email || null, dj_name, legal_name, contact_phone, country, district, city:licensingText(b.city,120)||null, requested_scopes, accepted_terms:true, accepted_terms_at:new Date().toISOString(), updated_at:new Date().toISOString() };
    const result = await supabase.from('dj_license_profiles').upsert(payload, { onConflict:'user_id' }).select().single();
    if (result.error) { console.error('DJ licence registration:', result.error); return res.status(500).json({ error: 'DJ application could not be saved. Check that PASONG Licensing SQL has been run in Supabase.' }); }
    return res.status(201).json({ success:true, message:'DJ licence application submitted. It is not active until approved and payment is verified.', profile:result.data });
  } catch (e) { console.error('DJ licence registration error:', e); return res.status(500).json({ error:'Unable to submit DJ licence application.' }); }
});

app.get('/api/dj-licenses/me', async (req, res) => {
  try { const user=await getAuthenticatedUser(req); if(!user) return res.status(401).json({error:'Please sign in first.'});
    const r=await supabase.from('dj_license_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(r.error) { console.error('DJ profile:',r.error); return res.status(500).json({error:'Unable to load DJ application. Check licensing database setup.'}); }
    return res.json({success:true,profile:r.data});
  } catch(e) { return res.status(500).json({error:'Unable to load DJ application.'}); }
});

app.post('/api/music-sellers/register', async (req, res) => {
  try {
    const user=await getAuthenticatedUser(req); if(!user) return res.status(401).json({error:'Please sign in to your PASONG account first.'});
    const b=req.body||{}; const seller_type=b.seller_type==='shop'?'shop':'individual';
    const legal_name=licensingText(b.legal_name,120), contact_phone=licensingText(b.contact_phone,40), country=licensingText(b.country,100), district=licensingText(b.district,120), business_name=licensingText(b.business_name,150);
    if(!legal_name||!contact_phone||!country||!district||!b.accepted_terms||(seller_type==='shop'&&!business_name)) return res.status(400).json({error:'Complete all required fields and accept the terms.'});
    const payload={user_id:user.id,email:user.email||null,seller_type,legal_name,business_name:business_name||null,contact_phone,country,district,city:licensingText(b.city,120)||null,registration_number:licensingText(b.registration_number,120)||null,accepted_terms:true,accepted_terms_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const r=await supabase.from('music_sellers').upsert(payload,{onConflict:'user_id'}).select().single();
    if(r.error){console.error('Music seller registration:',r.error);return res.status(500).json({error:'Music Seller application could not be saved. Check that the Music Seller SQL has been run in Supabase.'});}
    return res.status(201).json({success:true,message:'Music Seller application submitted. It is not active until approved and payment is verified.',seller:r.data});
  } catch(e){console.error('Music seller registration error:',e);return res.status(500).json({error:'Unable to submit Music Seller application.'});}
});

app.get('/api/music-sellers/me', async (req,res)=>{
  try{const user=await getAuthenticatedUser(req);if(!user)return res.status(401).json({error:'Please sign in first.'});
    const r=await supabase.from('music_sellers').select('*').eq('user_id',user.id).maybeSingle();
    if(r.error){console.error('Music seller profile:',r.error);return res.status(500).json({error:'Unable to load Music Seller application. Check database setup.'});}
    return res.json({success:true,seller:r.data});
  }catch(e){return res.status(500).json({error:'Unable to load Music Seller application.'});}
});

app.get('/api/licensing/catalog', async (req,res)=>{
  try{const user=await getAuthenticatedUser(req);if(!user)return res.status(401).json({error:'Please sign in first.'});
    const type=req.query.type==='seller'?'seller':'dj';
    const table='pasong_licensing_catalog';
    let q=supabase.from(table).select('*').eq('is_active',true).eq('rights_confirmed',true).lte('rights_valid_from',new Date().toISOString()).gte('rights_valid_until',new Date().toISOString()).order('title');
    const r=await q;
    if(r.error){console.error('Licensing catalogue:',r.error);return res.status(500).json({error:'Unable to load licensing catalogue. Check PASONG Licensing SQL setup.'});}
    let catalog=(r.data||[]).map(t=>({...t,licence_summary:t.licence_summary||'',dj_performance_rights:!!t.dj_performance_rights,dj_mix_recording_rights:!!t.dj_mix_recording_rights,dj_online_distribution_rights:!!t.dj_online_distribution_rights,digital_distribution_rights:!!t.digital_distribution_rights,physical_distribution_rights:!!t.physical_distribution_rights}));
    if(type==='seller') catalog=catalog.filter(t=>t.digital_distribution_rights||t.physical_distribution_rights);
    else catalog=catalog.filter(t=>t.dj_performance_rights||t.dj_mix_recording_rights||t.dj_online_distribution_rights);
    return res.json({success:true,type,note:'Only titles with confirmed, current rights are shown.',catalog});
  }catch(e){console.error('Licensing catalogue error:',e);return res.status(500).json({error:'Unable to load licensing catalogue.'});}
});

app.post('/api/licensing/requests', async (req,res)=>{
  try{const user=await getAuthenticatedUser(req);if(!user)return res.status(401).json({error:'Please sign in first.'});
    const b=req.body||{},type=b.licence_type==='seller'?'seller':'dj',scope=licensingText(b.scope,80),catalog_id=licensingText(b.catalog_id,80);
    if(!catalog_id||!scope||b.accepted_terms!==true)return res.status(400).json({error:'Confirm the licence terms and choose a valid licence scope.'});
    const profileTable=type==='dj'?'dj_license_profiles':'music_sellers';
    const profile=await supabase.from(profileTable).select('id,status').eq('user_id',user.id).maybeSingle();
    if(profile.error)return res.status(500).json({error:'Unable to verify your application.'});
    if(!profile.data||profile.data.status!=='approved')return res.status(403).json({error:'Your relevant application must be approved before requesting catalogue licences.'});
    const c=await supabase.from('pasong_licensing_catalog').select('*').eq('id',catalog_id).eq('is_active',true).eq('rights_confirmed',true).maybeSingle();
    if(c.error||!c.data)return res.status(404).json({error:'This title is not currently available for licensing.'});
    const t=c.data; const allowed=type==='dj'?({public_performance:t.dj_performance_rights,dj_mix_recording:t.dj_mix_recording_rights,online_mix_distribution:t.dj_online_distribution_rights}[scope]):({digital_distribution:t.digital_distribution_rights,physical_distribution:t.physical_distribution_rights}[scope]);
    if(!allowed)return res.status(403).json({error:'The rights holder has not authorised that use for this title.'});
    const feeKey={public_performance:'dj_performance_fee',dj_mix_recording:'dj_mix_recording_fee',online_mix_distribution:'dj_online_distribution_fee',digital_distribution:'digital_distribution_fee',physical_distribution:'physical_distribution_fee'}[scope];
    const r=await supabase.from('pasong_licence_requests').insert({user_id:user.id,licence_type:type,profile_id:profile.data.id,catalog_id:t.id,track_title:t.title,artist_name:t.artist_name,requested_scope:scope,fee:Number(t[feeKey]||0),currency:t.currency||'UGX',status:'pending_review',accepted_terms:true,accepted_terms_at:new Date().toISOString()}).select().single();
    if(r.error){console.error('Licence request:',r.error);return res.status(500).json({error:'Could not create licence request.'});}
    return res.status(201).json({success:true,message:'Licence request submitted. It is not a licence until payment is verified and the request is activated.',request:r.data});
  }catch(e){console.error('Licence request error:',e);return res.status(500).json({error:'Unable to create licence request.'});}
});


// PASONG licensing checkout: MTN MoMo RequestToPay. Payment is recorded before
// contacting MTN so an accepted request is never lost if the database write fails.
// Secrets are read only from Render environment variables; no client can mark paid.
const licensingEnv = (...names) => {
  for (const name of names) if (process.env[name] && String(process.env[name]).trim()) return String(process.env[name]).trim();
  return '';
};
const mtnConfig = () => ({
  base: (licensingEnv('MTN_MOMO_BASE_URL','MTN_BASE_URL') || 'https://momodeveloper.mtn.com').replace(/\/$/, ''),
  subscription: licensingEnv('MTN_MOMO_SUBSCRIPTION_KEY','MTN_COLLECTION_SUBSCRIPTION_KEY','MTN_SUBSCRIPTION_KEY'),
  apiUser: licensingEnv('MTN_MOMO_API_USER','MTN_API_USER'),
  apiKey: licensingEnv('MTN_MOMO_API_KEY','MTN_API_KEY'),
  target: licensingEnv('MTN_MOMO_TARGET_ENVIRONMENT','MTN_TARGET_ENVIRONMENT') || 'production'
});
function licensingPhone(v) {
  let p=String(v||'').replace(/[\s()-]/g,'');
  if (/^0[37]\d{8}$/.test(p)) p='256'+p.slice(1);
  else if (/^\+[37]\d+$/.test(p)) p=p.slice(1);
  else if (p.startsWith('+')) p=p.slice(1);
  return /^256[37]\d{8}$/.test(p) ? p : '';
}
async function mtnToken(cfg) {
  const basic=Buffer.from(cfg.apiUser+':'+cfg.apiKey).toString('base64');
  const r=await fetch(cfg.base+'/collection/token/',{method:'POST',headers:{'Authorization':'Basic '+basic,'Ocp-Apim-Subscription-Key':cfg.subscription}});
  const txt=await r.text(); let data={}; try{data=JSON.parse(txt)}catch{}
  if(!r.ok||!data.access_token) throw new Error('MTN authentication failed ('+r.status+'). Check the Collection API credentials and environment on Render.');
  return data.access_token;
}
app.post('/api/licensing/checkout', async (req,res) => {
  let paymentId=null;
  try {
    const user=await getAuthenticatedUser(req);
    if(!user) return res.status(401).json({success:false,error:'Please sign in first.'});
    const type=String(req.body?.licence_type||'').toLowerCase();
    const amount=type==='dj'?35000:type==='seller'?50000:0;
    if(!amount) return res.status(400).json({success:false,error:'Invalid licence type.'});
    const method=String(req.body?.payment_method||'MTN_MOMO').toUpperCase();
    if(!['MTN_MOMO','MTN','MTN MOMO'].includes(method)) return res.status(400).json({success:false,error:'MTN Mobile Money is the only licensing payment method currently connected.'});
    const phone=licensingPhone(req.body?.phone_number);
    if(!phone) return res.status(400).json({success:false,error:'Enter a valid mobile money number with country code, for example +2567XXXXXXXX.'});
    const cfg=mtnConfig();
    if(!cfg.subscription||!cfg.apiUser||!cfg.apiKey) return res.status(503).json({success:false,code:'LICENSING_MTN_NOT_CONFIGURED',error:'The licensing checkout is not connected to MTN yet. The required MTN Collection credentials are not available to the server. No payment was requested.'});
    // This table is supplied in PASONG_Licensing_Payments.sql. Insert BEFORE any MTN request.
    const ref='PASONG-LIC-'+crypto.randomUUID();
    const saved=await supabase.from('pasong_licence_payments').insert({user_id:user.id,licence_type:type,amount,currency:'UGX',provider:'MTN_MOMO',external_reference:ref,phone_number:phone,status:'initiating'}).select('id').single();
    if(saved.error){console.error('Licensing payment record creation failed:',saved.error);return res.status(500).json({success:false,error:'Could not create the licensing payment record. No payment request was sent.'});}
    paymentId=saved.data.id;
    const token=await mtnToken(cfg);
    const uuid=crypto.randomUUID();
    const payload={amount:String(amount),currency:'UGX',externalId:ref,payer:{partyIdType:'MSISDN',partyId:phone},payerMessage:type==='dj'?'PASONG DJ licence':'PASONG Music Seller licence',payeeNote:ref};
    const headers={'Authorization':'Bearer '+token,'X-Reference-Id':uuid,'X-Target-Environment':cfg.target,'Ocp-Apim-Subscription-Key':cfg.subscription,'Content-Type':'application/json','X-Callback-Url':licensingEnv('MTN_MOMO_CALLBACK_URL','MTN_CALLBACK_URL')};
    if(!headers['X-Callback-Url']) delete headers['X-Callback-Url'];
    const request=await fetch(cfg.base+'/collection/v1_0/requesttopay',{method:'POST',headers,body:JSON.stringify(payload)});
    if(request.status!==202){const msg=await request.text();await supabase.from('pasong_licence_payments').update({status:'failed',provider_message:msg.slice(0,500)}).eq('id',paymentId);return res.status(502).json({success:false,error:'MTN did not accept the payment request ('+request.status+'). No licence has been activated.'});}
    await supabase.from('pasong_licence_payments').update({status:'pending',provider_transaction_id:uuid}).eq('id',paymentId);
    return res.status(202).json({success:true,payment_id:paymentId,external_reference:ref,message:'Payment request sent to '+phone+'. Approve the MTN Mobile Money prompt on your phone. PASONG will verify the payment before activating the licence.'});
  } catch(e) {
    console.error('Licensing checkout error:',e);
    if(paymentId) await supabase.from('pasong_licence_payments').update({status:'failed',provider_message:String(e.message||e).slice(0,500)}).eq('id',paymentId);
    return res.status(502).json({success:false,error:e.message||'Unable to start licensing payment. No licence has been activated.'});
  }
});

// Server-side payment status check. A browser redirect or client status is never trusted.
app.get('/api/licensing/payment-status/:id', async (req,res)=>{
  try {
    const user=await getAuthenticatedUser(req); if(!user)return res.status(401).json({success:false,error:'Please sign in first.'});
    const row=await supabase.from('pasong_licence_payments').select('*').eq('id',req.params.id).eq('user_id',user.id).maybeSingle();
    if(row.error||!row.data)return res.status(404).json({success:false,error:'Licensing payment not found.'});
    const p=row.data; if(p.status==='successful'||p.status==='failed')return res.json({success:true,status:p.status,licence_type:p.licence_type});
    if(!p.provider_transaction_id)return res.json({success:true,status:p.status,licence_type:p.licence_type});
    const cfg=mtnConfig(); if(!cfg.subscription||!cfg.apiUser||!cfg.apiKey)return res.json({success:true,status:p.status,licence_type:p.licence_type});
    const token=await mtnToken(cfg);
    const r=await fetch(cfg.base+'/collection/v1_0/requesttopay/'+encodeURIComponent(p.provider_transaction_id),{headers:{'Authorization':'Bearer '+token,'X-Target-Environment':cfg.target,'Ocp-Apim-Subscription-Key':cfg.subscription}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return res.json({success:true,status:p.status,licence_type:p.licence_type});
    const providerStatus=String(data.status||'').toUpperCase();
    if(providerStatus==='SUCCESSFUL'){
      await supabase.from('pasong_licence_payments').update({status:'successful',paid_at:new Date().toISOString(),provider_message:'MTN status verified'}).eq('id',p.id);
      // Profile approval remains a separate PASONG admin action.
      return res.json({success:true,status:'successful',licence_type:p.licence_type,message:'Payment verified. Your licence application still requires PASONG review.'});
    }
    if(['FAILED','REJECTED','TIMEOUT','EXPIRED'].includes(providerStatus)){
      await supabase.from('pasong_licence_payments').update({status:'failed',provider_message:providerStatus}).eq('id',p.id);
      return res.json({success:true,status:'failed',licence_type:p.licence_type});
    }
    return res.json({success:true,status:'pending',licence_type:p.licence_type});
  }catch(e){console.error('Licensing payment status error:',e);return res.status(500).json({success:false,error:'Unable to check payment status.'});}
});


app.get('/api/licensing/my-requests',async(req,res)=>{
  try{const user=await getAuthenticatedUser(req);if(!user)return res.status(401).json({error:'Please sign in first.'});
    const r=await supabase.from('pasong_licence_requests').select('*').eq('user_id',user.id).order('created_at',{ascending:false});
    if(r.error){console.error('My licence requests:',r.error);return res.status(500).json({error:'Unable to load your licence requests.'});}
    return res.json({success:true,requests:r.data||[]});
  }catch(e){return res.status(500).json({error:'Unable to load licence requests.'});}
});


app.use(
  (error, req, res, next) => {
    if (
      error instanceof
      multer.MulterError
    ) {
      return res.status(400).json({
        error:
          "File upload error",
      });
    }

    if (error) {
      if (
        error.message ===
        "CORS not allowed"
      ) {
        return res.status(403).json({
          error:
            "Request origin not allowed",
        });
      }

      return res.status(400).json({
        error:
          error.message ||
          "Request error",
      });
    }

    next();
  }
);

app.use(
  (req, res) => {
    res.status(404).json({
      error:
        "Endpoint not found",
    });
  }
);

app.listen(
  PORT,
  () => {
    console.log(
      "PASONG SAFE + PRODUCER READY " +
        PORT
    );
  }
);
t
