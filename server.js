const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const PORT =
  process.env.PORT || 3000;

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME;

const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY;

const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET;


if(!SUPABASE_URL){
  console.error("Missing SUPABASE_URL");
}

if(!SUPABASE_SERVICE_ROLE_KEY){
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if(!CLOUDINARY_CLOUD_NAME){
  console.error("Missing CLOUDINARY_CLOUD_NAME");
}

if(!CLOUDINARY_API_KEY){
  console.error("Missing CLOUDINARY_API_KEY");
}

if(!CLOUDINARY_API_SECRET){
  console.error("Missing CLOUDINARY_API_SECRET");
}


const supabase =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth:{
        autoRefreshToken:false,
        persistSession:false
      }
    }
  );


/* =========================================================
   BASIC
========================================================= */

app.get("/", function(req, res){

  res.json({
    success:true,
    name:"PASONG API",
    status:"PASONG: LIVE"
  });

});


app.get("/health", function(req, res){

  res.json({
    success:true,
    status:"PASONG: LIVE",
    upload:"READY",
    cloudinary:
      CLOUDINARY_CLOUD_NAME &&
      CLOUDINARY_API_KEY &&
      CLOUDINARY_API_SECRET
        ? "READY"
        : "NOT READY",
    supabase:
      SUPABASE_URL &&
      SUPABASE_SERVICE_ROLE_KEY
        ? "READY"
        : "NOT READY"
  });

});


/* =========================================================
   AUTHENTICATED USER
========================================================= */

async function getAuthenticatedUser(req){

  try{

    const authHeader =
      req.headers.authorization ||
      "";

    if(
      !authHeader ||
      !authHeader.startsWith("Bearer ")
    ){

      return null;

    }

    const accessToken =
      authHeader
        .replace("Bearer ", "")
        .trim();

    if(!accessToken){

      return null;

    }

    const result =
      await supabase.auth.getUser(
        accessToken
      );

    if(result.error){

      console.error(
        "Supabase auth error:",
        result.error.message
      );

      return null;

    }

    return result.data.user || null;

  }catch(error){

    console.error(
      "Authentication error:",
      error
    );

    return null;

  }

}


/* =========================================================
   IP / COUNTRY
========================================================= */

function getClientIp(req){

  const forwarded =
    req.headers["x-forwarded-for"];

  if(forwarded){

    return String(forwarded)
      .split(",")[0]
      .trim();

  }

  return (
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    ""
  );

}


function getCountry(req){

  const country =
    req.headers["x-vercel-ip-country"] ||
    req.headers["cf-ipcountry"] ||
    req.headers["x-country-code"] ||
    "";

  return String(country)
    .trim()
    .toUpperCase();

}


function getPricing(req){

  const country =
    getCountry(req);


  /* Uganda */

  if(country === "UG"){

    return {
      amount:700,
      currency:"UGX",
      label:"UGX 700"
    };

  }


  /* East Africa */

  const eastAfrica = [
    "KE",
    "TZ",
    "RW",
    "BI",
    "SS"
  ];

  if(
    eastAfrica.includes(country)
  ){

    return {
      amount:1000,
      currency:"UGX",
      label:"UGX 1,000"
    };

  }


  /* Other Africa */

  const africa = [
    "NG",
    "GH",
    "ZA",
    "ZM",
    "ZW",
    "MW",
    "MZ",
    "ET",
    "SN",
    "CI",
    "CM",
    "CD",
    "CG",
    "AO",
    "BW",
    "NA",
    "SL",
    "LR"
  ];

  if(
    africa.includes(country)
  ){

    return {
      amount:0.57,
      currency:"USD",
      label:"$0.57"
    };

  }


  /* United Kingdom */

  if(country === "GB"){

    return {
      amount:1,
      currency:"GBP",
      label:"£1"
    };

  }


  /* Rest of world */

  return {
    amount:1,
    currency:"USD",
    label:"$1"
  };

}


/* =========================================================
   COVER DESIGN PRICE
========================================================= */

function getCoverDesignPrice(req){

  const country =
    getCountry(req);

  if(country === "UG"){

    return {
      amount:10000,
      currency:"UGX",
      label:"UGX 10,000"
    };

  }

  return {
    amount:10,
    currency:"USD",
    label:"$10"
  };

}


/* =========================================================
   TIP PRICE / SPLIT
========================================================= */

function getTipSplit(amount){

  const numericAmount =
    Number(amount) || 0;

  const artist =
    numericAmount * 0.70;

  const pasong =
    numericAmount * 0.30;

  return {
    artist:artist,
    pasong:pasong
  };

}


/* =========================================================
   CLOUDINARY SIGNATURE
   FIXED
========================================================= */

app.post(
  "/api/cloudinary/signature",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      if(
        !CLOUDINARY_CLOUD_NAME ||
        !CLOUDINARY_API_KEY ||
        !CLOUDINARY_API_SECRET
      ){

        return res.status(500).json({

          success:false,

          error:
            "Cloudinary environment variables are missing."

        });

      }


      const timestamp =
        Math.floor(
          Date.now() / 1000
        );


      const folder =
        "pasong-songs";


      /*
       * IMPORTANT:
       * Cloudinary signs the exact parameters
       * that will be sent during upload.
       */

      const stringToSign =
        "folder=" +
        folder +
        "&timestamp=" +
        timestamp;


      const signature =
        crypto
          .createHash("sha1")
          .update(
            stringToSign +
            CLOUDINARY_API_SECRET
          )
          .digest("hex");


      return res.json({

        success:true,

        signature:signature,

        timestamp:timestamp,

        folder:folder,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY

      });


    }catch(error){

      console.error(
        "Cloudinary signature error:",
        error
      );


      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not create Cloudinary signature."

      });

    }

  }
);


/* =========================================================
   CLOUDINARY SIGNATURE GET
========================================================= */

app.get(
  "/api/cloudinary/signature",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const timestamp =
        Math.floor(
          Date.now() / 1000
        );


      const folder =
        "pasong-songs";


      const stringToSign =
        "folder=" +
        folder +
        "&timestamp=" +
        timestamp;


      const signature =
        crypto
          .createHash("sha1")
          .update(
            stringToSign +
            CLOUDINARY_API_SECRET
          )
          .digest("hex");


      return res.json({

        success:true,

        signature:signature,

        timestamp:timestamp,

        folder:folder,

        cloud_name:
          CLOUDINARY_CLOUD_NAME,

        api_key:
          CLOUDINARY_API_KEY

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not create Cloudinary signature."

      });

    }

  }
);


/* =========================================================
   FIND USER BY EMAIL
========================================================= */

app.get(
  "/api/users/find",
  async function(req, res){

    try{

      const loggedInUser =
        await getAuthenticatedUser(req);

      if(!loggedInUser){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const email =
        String(
          req.query.email ||
          ""
        )
        .trim()
        .toLowerCase();


      if(!email){

        return res.status(400).json({

          success:false,

          error:
            "Email is required."

        });

      }


      const result =
        await supabase.auth.admin.listUsers({
          page:1,
          perPage:1000
        });


      if(result.error){

        throw result.error;

      }


      const users =
        result.data.users || [];


      const found =
        users.find(
          function(user){

            return (
              String(
                user.email ||
                ""
              )
              .trim()
              .toLowerCase() ===
              email
            );

          }
        );


      if(!found){

        return res.status(404).json({

          success:false,

          error:
            "No PASONG account was found for " +
            email

        });

      }


      return res.json({

        success:true,

        user_id:
          found.id

      });


    }catch(error){

      console.error(
        "User lookup error:",
        error
      );


      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not find PASONG account."

      });

    }

  }
);


/* =========================================================
   ARTIST PROFILE SAVE
========================================================= */

app.post(
  "/api/artist-profile/save",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const body =
        req.body || {};


      const existingResult =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();


      if(existingResult.error){

        throw existingResult.error;

      }


      const existing =
        existingResult.data || {};


      const performingName =
        String(
          body.performing_name ||
          body.stage_name ||
          body.artist_name ||
          existing.performing_name ||
          existing.stage_name ||
          existing.artist_name ||
          ""
        ).trim();


      const realName =
        String(
          body.real_name ||
          existing.real_name ||
          ""
        ).trim();


      const mobileMoneyProvider =
        String(
          body.mobile_money_provider ||
          existing.mobile_money_provider ||
          ""
        ).trim();


      const mobileMoneyNumber =
        String(
          body.mobile_money_number ||
          body.mobile_number ||
          existing.mobile_money_number ||
          existing.mobile_number ||
          ""
        ).trim();


      const profileImageUrl =
        body.profile_image_url !== undefined
          ? body.profile_image_url
          : existing.profile_image_url || null;


      const updateData = {

        user_id:
          user.id,

        artist_name:
          performingName,

        stage_name:
          performingName,

        real_name:
          realName,

        performing_name:
          performingName,

        mobile_number:
          mobileMoneyNumber,

        mobile_money_number:
          mobileMoneyNumber,

        mobile_money_provider:
          mobileMoneyProvider,

        profile_image_url:
          profileImageUrl

      };


      const result =
        await supabase
          .from("artist_profiles")
          .upsert(
            updateData,
            {
              onConflict:"user_id"
            }
          )
          .select()
          .single();


      if(result.error){

        throw result.error;

      }


      return res.json({

        success:true,

        profile:
          result.data

      });


    }catch(error){

      console.error(
        "Profile save error:",
        error
      );


      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not save artist profile."

      });

    }

  }
);


/* =========================================================
   ARTIST PROFILE GET
========================================================= */

app.get(
  "/api/artist-profile",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const result =
        await supabase
          .from("artist_profiles")
          .select("*")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();


      if(result.error){

        throw result.error;

      }


      return res.json({

        success:true,

        profile:
          result.data

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not load artist profile."

      });

    }

  }
);


/* =========================================================
   SONG SIGN UPLOAD CHECK
========================================================= */

app.post(
  "/api/songs/sign-upload",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const hasCover =
        req.body &&
        req.body.has_cover === true;


      if(!hasCover){

        return res.status(400).json({

          success:false,

          error:
            "Cover image is required before uploading a song."

        });

      }


      return res.json({

        success:true,

        message:
          "Song upload is allowed."

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   CREATE SONG
========================================================= */

app.post(
  "/api/songs/create",
  async function(req, res){

    try{

      const loggedInUser =
        await getAuthenticatedUser(req);

      if(!loggedInUser){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const body =
        req.body || {};


      const title =
        String(
          body.title ||
          ""
        ).trim();


      const artistId =
        body.artist_user_id ||
        body.artist_id ||
        loggedInUser.id;


      const producerId =
        body.producer_user_id ||
        null;


      const writerId =
        body.writer_user_id ||
        null;


      const uploaderId =
        loggedInUser.id;


      const labelName =
        String(
          body.label_name ||
          ""
        ).trim();


      const genre =
        String(
          body.genre ||
          ""
        ).trim();


      const coverUrl =
        String(
          body.cover_url ||
          ""
        ).trim();


      const audioUrl =
        String(
          body.audio_url ||
          ""
        ).trim();


      if(!title){

        return res.status(400).json({

          success:false,

          error:
            "Song title is required."

        });

      }


      if(!coverUrl){

        return res.status(400).json({

          success:false,

          error:
            "Cover image is required."

        });

      }


      if(!audioUrl){

        return res.status(400).json({

          success:false,

          error:
            "Audio file is required."

        });

      }


      /*
       * Validate artist account
       */

      const artistCheck =
        await supabase.auth.admin.getUserById(
          artistId
        );


      if(
        artistCheck.error ||
        !artistCheck.data.user
      ){

        return res.status(400).json({

          success:false,

          error:
            "Artist PASONG account could not be verified."

        });

      }


      /*
       * Validate producer
       */

      if(producerId){

        const producerCheck =
          await supabase.auth.admin.getUserById(
            producerId
          );


        if(
          producerCheck.error ||
          !producerCheck.data.user
        ){

          return res.status(400).json({

            success:false,

            error:
              "Producer PASONG account could not be verified."

          });

        }

      }


      /*
       * Validate writer
       */

      if(writerId){

        const writerCheck =
          await supabase.auth.admin.getUserById(
            writerId
          );


        if(
          writerCheck.error ||
          !writerCheck.data.user
        ){

          return res.status(400).json({

            success:false,

            error:
              "Writer PASONG account could not be verified."

          });

        }

      }


      /*
       * Duplicate song check
       */

      let duplicateQuery =
        supabase
          .from("songs")
          .select(
            "id,title,artist_user_id,producer_user_id,writer_user_id,uploader_user_id"
          )
          .ilike(
            "title",
            title
          )
          .limit(20);


      const duplicateResult =
        await duplicateQuery;


      if(duplicateResult.error){

        throw duplicateResult.error;

      }


      const duplicates =
        duplicateResult.data || [];


      const duplicate =
        duplicates.find(
          function(song){

            return (
              String(
                song.artist_user_id ||
                ""
              ) ===
              String(
                artistId ||
                ""
              )
              &&
              String(
                song.producer_user_id ||
                ""
              ) ===
              String(
                producerId ||
                ""
              )
              &&
              String(
                song.writer_user_id ||
                ""
              ) ===
              String(
                writerId ||
                ""
              )
              &&
              String(
                song.uploader_user_id ||
                ""
              ) ===
              String(
                uploaderId ||
                ""
              )
            );

          }
        );


      if(duplicate){

        let performingName =
          "";


        const profileResult =
          await supabase
            .from("artist_profiles")
            .select(
              "performing_name,stage_name,artist_name"
            )
            .eq(
              "user_id",
              duplicate.uploader_user_id ||
              duplicate.artist_user_id
            )
            .maybeSingle();


        if(
          profileResult.data
        ){

          performingName =
            profileResult.data.performing_name ||
            profileResult.data.stage_name ||
            profileResult.data.artist_name ||
            "";

        }


        return res.status(409).json({

          success:false,

          error:
            "This song has already been uploaded to PASONG" +
            (
              performingName
                ? " by " + performingName
                : ""
            ) +
            "."

        });

      }


      /*
       * IP-based pricing
       */

      const pricing =
        getPricing(req);


      /*
       * Insert song
       */

      const insertData = {

        uploader_user_id:
          uploaderId,

        artist_user_id:
          artistId,

        producer_user_id:
          producerId,

        writer_user_id:
          writerId,

        label_name:
          labelName || null,

        title:
          title,

        artist_id:
          artistId,

        category_id:
          null,

        album_id:
          null,

        genre:
          genre || null,

        price:
          pricing.amount,

        currency:
          pricing.currency,

        status:
          "approved",

        cover_url:
          coverUrl,

        audio_url:
          audioUrl

      };


      const result =
        await supabase
          .from("songs")
          .insert(
            insertData
          )
          .select()
          .single();


      if(result.error){

        console.error(
          "Song database error:",
          result.error
        );

        return res.status(400).json({

          success:false,

          error:
            result.error.message

        });

      }


      return res.status(201).json({

        success:true,

        message:
          "Song uploaded successfully.",

        song:
          result.data,

        pricing:
          pricing

      });


    }catch(error){

      console.error(
        "Create song error:",
        error
      );


      return res.status(500).json({

        success:false,

        error:
          error.message ||
          "Could not create song."

      });

    }

  }
);


/* =========================================================
   CREATE SONG COMPATIBILITY ROUTE
========================================================= */

app.post(
  "/api/songs",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const body =
        req.body || {};


      const pricing =
        getPricing(req);


      const data = {

        uploader_user_id:
          user.id,

        artist_user_id:
          body.artist_user_id ||
          body.artist_id ||
          user.id,

        producer_user_id:
          body.producer_user_id ||
          null,

        writer_user_id:
          body.writer_user_id ||
          null,

        label_name:
          body.label_name ||
          null,

        title:
          body.title,

        artist_id:
          body.artist_id ||
          user.id,

        category_id:
          body.category_id ||
          null,

        album_id:
          body.album_id ||
          null,

        price:
          pricing.amount,

        currency:
          pricing.currency,

        status:
          "approved",

        cover_url:
          body.cover_url,

        audio_url:
          body.audio_url

      };


      const result =
        await supabase
          .from("songs")
          .insert(data)
          .select()
          .single();


      if(result.error){

        return res.status(400).json({

          success:false,

          error:
            result.error.message

        });

      }


      return res.status(201).json({

        success:true,

        song:
          result.data,

        pricing:
          pricing

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   PUBLIC SONG LIST
========================================================= */

app.get(
  "/api/songs",
  async function(req, res){

    try{

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
          .order(
            "created_at",
            {
              ascending:false
            }
          );


      if(result.error){

        throw result.error;

      }


      const pricing =
        getPricing(req);


      const songs =
        (result.data || [])
          .map(
            function(song){

              return {

                ...song,

                display_price:
                  pricing.amount,

                display_currency:
                  pricing.currency,

                display_price_label:
                  pricing.label

              };

            }
          );


      return res.json({

        success:true,

        songs:songs,

        nextCursor:null,

        pricing:pricing

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   SINGLE SONG
========================================================= */

app.get(
  "/api/songs/:id",
  async function(req, res){

    try{

      const id =
        req.params.id;


      const result =
        await supabase
          .from("songs")
          .select("*")
          .eq(
            "id",
            id
          )
          .eq(
            "status",
            "approved"
          )
          .maybeSingle();


      if(result.error){

        throw result.error;

      }


      if(!result.data){

        return res.status(404).json({

          success:false,

          error:
            "Song not found."

        });

      }


      const pricing =
        getPricing(req);


      return res.json({

        success:true,

        song:{

          ...result.data,

          display_price:
            pricing.amount,

          display_currency:
            pricing.currency,

          display_price_label:
            pricing.label

        },

        pricing:
          pricing

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   COVER STATUS
========================================================= */

app.get(
  "/api/songs/:id/cover-status",
  async function(req, res){

    try{

      const result =
        await supabase
          .from("songs")
          .select(
            "id,cover_url,status"
          )
          .eq(
            "id",
            req.params.id
          )
          .maybeSingle();


      if(result.error){

        throw result.error;

      }


      if(!result.data){

        return res.status(404).json({

          success:false,

          error:
            "Song not found."

        });

      }


      return res.json({

        success:true,

        has_cover:
          !!result.data.cover_url,

        cover_url:
          result.data.cover_url,

        status:
          result.data.status

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   PRICING
========================================================= */

app.get(
  "/api/pricing",
  function(req, res){

    res.json({

      success:true,

      song:
        getPricing(req),

      cover_design:
        getCoverDesignPrice(req),

      tip_split:{
        artist_percent:70,
        pasong_percent:30
      }

    });

  }
);


/* =========================================================
   TIP SPLIT
========================================================= */

app.post(
  "/api/tips/split",
  async function(req, res){

    try{

      const user =
        await getAuthenticatedUser(req);

      if(!user){

        return res.status(401).json({

          success:false,

          error:
            "Missing authentication token"

        });

      }


      const amount =
        Number(
          req.body.amount
        );


      if(
        !amount ||
        amount <= 0
      ){

        return res.status(400).json({

          success:false,

          error:
            "Valid tip amount is required."

        });

      }


      const split =
        getTipSplit(
          amount
        );


      return res.json({

        success:true,

        amount:amount,

        artist:
          split.artist,

        pasong:
          split.pasong

      });


    }catch(error){

      return res.status(500).json({

        success:false,

        error:
          error.message

      });

    }

  }
);


/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
  function(err, req, res, next){

    console.error(
      "Unhandled error:",
      err
    );

    res.status(500).json({

      success:false,

      error:
        err.message ||
        "Internal server error."

    });

  }
);


/* =========================================================
   START
========================================================= */

app.listen(
  PORT,
  function(){

    console.log(
      "PASONG API running on port " +
      PORT
    );

  }
);
