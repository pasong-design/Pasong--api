// COMPLETE PASONG SONG PAYMENT
// MTN MoMo / other payment gateway calls this through Pasong--mom.
// The buyer identity MUST come from the verified Supabase Bearer token.

app.post("/api/payments/complete", async (req, res) => {
  try {
    const body = req.body || {};

    // ---------------------------------------------------------
    // 1. VERIFY INTERNAL PAYMENT SECRET
    // ---------------------------------------------------------

    const suppliedSecret =
      String(
        req.headers["x-pasong-payment-secret"] || ""
      ).trim();

    const expectedSecret =
      String(
        process.env.PASONG_PAYMENT_SECRET || ""
      ).trim();

    if (
      !suppliedSecret ||
      !expectedSecret
    ) {
      return res.status(500).json({
        error:
          "Payment security configuration is missing."
      });
    }

    const suppliedBuffer =
      Buffer.from(suppliedSecret);

    const expectedBuffer =
      Buffer.from(expectedSecret);

    if (
      suppliedBuffer.length !==
      expectedBuffer.length ||
      !crypto.timingSafeEqual(
        suppliedBuffer,
        expectedBuffer
      )
    ) {
      return res.status(401).json({
        error:
          "Invalid payment authorization."
      });
    }

    // ---------------------------------------------------------
    // 2. VERIFY THE REAL LOGGED-IN PASONG USER
    // ---------------------------------------------------------

    const accessToken =
      String(
        (req.headers.authorization || "")
          .replace(/^Bearer\s+/i, "")
          .trim()
      );

    if (!accessToken) {
      return res.status(401).json({
        error:
          "Authenticated payment session is required."
      });
    }

    const authResult =
      await supabase.auth.getUser(
        accessToken
      );

    if (
      authResult.error ||
      !authResult.data ||
      !authResult.data.user
    ) {
      return res.status(401).json({
        error:
          "Invalid or expired PASONG login session."
      });
    }

    const authenticatedBuyer =
      authResult.data.user;

    const buyerId =
      authenticatedBuyer.id;

    // ---------------------------------------------------------
    // 3. READ PAYMENT INFORMATION
    // ---------------------------------------------------------

    const songId =
      String(
        body.song_id || ""
      ).trim();

    const transactionId =
      String(
        body.transaction_id || ""
      ).trim();

    const externalReference =
      String(
        body.external_reference || ""
      ).trim();

    const provider =
      String(
        body.provider || "MTN MoMo"
      ).trim();

    const paidCurrency =
      String(
        body.currency || ""
      ).trim()
      .toUpperCase();

    const paymentStatus =
      String(
        body.payment_status || ""
      ).trim()
      .toUpperCase();

    const paidAmount =
      Number(
        body.amount || 0
      );

    const songAmount =
      Number(
        body.song_amount || 0
      );

    const tipAmount =
      Number(
        body.tip_amount || 0
      );

    const providerResponse =
      body.provider_response || null;

    // ---------------------------------------------------------
    // 4. BASIC VALIDATION
    // ---------------------------------------------------------

    if (!songId) {
      return res.status(400).json({
        error:
          "Song ID is required."
      });
    }

    if (!transactionId) {
      return res.status(400).json({
        error:
          "Payment transaction ID is required."
      });
    }

    if (!externalReference) {
      return res.status(400).json({
        error:
          "External payment reference is required."
      });
    }

    if (
      !Number.isFinite(paidAmount) ||
      paidAmount <= 0
    ) {
      return res.status(400).json({
        error:
          "Invalid payment amount."
      });
    }

    if (
      !Number.isFinite(songAmount) ||
      songAmount <= 0
    ) {
      return res.status(400).json({
        error:
          "Invalid song amount."
      });
    }

    if (
      !Number.isFinite(tipAmount) ||
      tipAmount < 0
    ) {
      return res.status(400).json({
        error:
          "Invalid tip amount."
      });
    }

    if (!paidCurrency) {
      return res.status(400).json({
        error:
          "Payment currency is required."
      });
    }

    if (
      Number(
        (songAmount + tipAmount).toFixed(2)
      ) !==
      Number(
        paidAmount.toFixed(2)
      )
    ) {
      return res.status(400).json({
        error:
          "Payment total does not match song amount plus tip."
      });
    }

    if (
      paymentStatus !== "SUCCESSFUL"
    ) {
      return res.status(400).json({
        error:
          "Payment is not successful."
      });
    }

    // ---------------------------------------------------------
    // 5. GET SONG
    // ---------------------------------------------------------

    const {
      data: song,
      error: songError
    } = await supabase
      .from("songs")
      .select(
        `
        id,
        title,
        price,
        currency,
        status,
        artist_user_id,
        producer_user_id,
        writer_user_id
        `
      )
      .eq("id", songId)
      .maybeSingle();

    if (songError) {
      console.error(
        "Song lookup error:",
        songError
      );

      return res.status(500).json({
        error:
          "Unable to verify the song."
      });
    }

    if (!song) {
      return res.status(404).json({
        error:
          "Song not found."
      });
    }

    // ---------------------------------------------------------
    // 6. SONG MUST BE APPROVED
    // ---------------------------------------------------------

    if (
      String(song.status || "")
        .toLowerCase() !==
      "approved"
    ) {
      return res.status(400).json({
        error:
          "This song is not available for purchase."
      });
    }

    // ---------------------------------------------------------
    // 7. VERIFY SONG PRICE AND CURRENCY
    // ---------------------------------------------------------

    const expectedPrice =
      Number(song.price || 0);

    const expectedCurrency =
      String(
        song.currency || ""
      ).trim()
      .toUpperCase();

    if (
      songAmount !== expectedPrice ||
      paidCurrency !== expectedCurrency
    ) {
      return res.status(400).json({
        error:
          "Song price or currency does not match the PASONG database."
      });
    }

    // ---------------------------------------------------------
    // 8. PREVENT DUPLICATE PAYMENT
    // ---------------------------------------------------------

    const {
      data: existingPayment,
      error: existingPaymentError
    } = await supabase
      .from("payments")
      .select(
        `
        id,
        order_id,
        status,
        transaction_id,
        external_reference
        `
      )
      .or(
        `transaction_id.eq.${transactionId},external_reference.eq.${externalReference}`
      )
      .maybeSingle();

    if (existingPaymentError) {
      console.error(
        "Existing payment lookup error:",
        existingPaymentError
      );

      return res.status(500).json({
        error:
          "Unable to verify previous payment."
      });
    }

    if (existingPayment) {
      return res.status(409).json({
        error:
          "This payment has already been processed.",
        payment_id:
          existingPayment.id,
        order_id:
          existingPayment.order_id,
        status:
          existingPayment.status
      });
    }

    // ---------------------------------------------------------
    // 9. CHECK IF USER ALREADY OWNS SONG
    // ---------------------------------------------------------

    const {
      data: existingDownload,
      error: existingDownloadError
    } = await supabase
      .from("downloads")
      .select(
        `
        id,
        song_id,
        order_id
        `
      )
      .eq("user_id", buyerId)
      .eq("song_id", songId)
      .maybeSingle();

    if (existingDownloadError) {
      console.error(
        "Existing ownership lookup error:",
        existingDownloadError
      );

      return res.status(500).json({
        error:
          "Unable to verify song ownership."
      });
    }

    if (existingDownload) {
      return res.status(409).json({
        error:
          "You already own this song.",
        download_id:
          existingDownload.id,
        order_id:
          existingDownload.order_id
      });
    }

    // ---------------------------------------------------------
    // 10. CREATE ORDER
    // ---------------------------------------------------------

    const {
      data: order,
      error: orderError
    } = await supabase
      .from("orders")
      .insert({
        buyer_id:
          buyerId,

        total_amount:
          paidAmount,

        currency:
          paidCurrency,

        status:
          "paid"
      })
      .select(
        `
        id,
        buyer_id,
        total_amount,
        currency,
        status,
        created_at
        `
      )
      .single();

    if (orderError) {
      console.error(
        "Order creation error:",
        orderError
      );

      return res.status(500).json({
        error:
          "Unable to create PASONG order."
      });
    }

    // ---------------------------------------------------------
    // 11. CREATE ORDER ITEM
    // IMPORTANT:
    // order total = song + tip
    // order item = song price only
    // ---------------------------------------------------------

    const {
      data: orderItem,
      error: orderItemError
    } = await supabase
      .from("order_items")
      .insert({
        order_id:
          order.id,

        song_id:
          songId,

        price:
          songAmount,

        currency:
          paidCurrency
      })
      .select(
        `
        id,
        order_id,
        song_id,
        price,
        currency,
        created_at
        `
      )
      .single();

    if (orderItemError) {
      console.error(
        "Order item creation error:",
        orderItemError
      );

      return res.status(500).json({
        error:
          "Unable to create PASONG order item."
      });
    }

    // ---------------------------------------------------------
    // 12. CREATE PAYMENT RECORD
    // ---------------------------------------------------------

    const {
      data: payment,
      error: paymentError
    } = await supabase
      .from("payments")
      .insert({
        order_id:
          order.id,

        user_id:
          buyerId,

        provider:
          provider,

        transaction_id:
          transactionId,

        external_reference:
          externalReference,

        amount:
          paidAmount,

        currency:
          paidCurrency,

        status:
          "successful",

        raw_response:
          providerResponse
      })
      .select(
        `
        id,
        order_id,
        user_id,
        provider,
        transaction_id,
        external_reference,
        amount,
        currency,
        status,
        created_at
        `
      )
      .single();

    if (paymentError) {
      console.error(
        "Payment record creation error:",
        paymentError
      );

      return res.status(500).json({
        error:
          "Unable to record PASONG payment."
      });
    }

    // ---------------------------------------------------------
    // 13. CREATE DOWNLOAD OWNERSHIP
    // ---------------------------------------------------------

    const {
      data: download,
      error: downloadError
    } = await supabase
      .from("downloads")
      .insert({
        user_id:
          buyerId,

        song_id:
          songId,

        order_id:
          order.id
      })
      .select(
        `
        id,
        user_id,
        song_id,
        order_id,
        downloaded_at
        `
      )
      .single();

    if (downloadError) {
      console.error(
        "Download ownership creation error:",
        downloadError
      );

      return res.status(500).json({
        error:
          "Unable to create song ownership."
      });
    }

    // ---------------------------------------------------------
    // 14. GET SONG ARTISTS
    // ---------------------------------------------------------

    const {
      data: artistRows,
      error: artistRowsError
    } = await supabase
      .from("song_artists")
      .select(
        `
        artist_user_id,
        artist_share_percent,
        artist_order
        `
      )
      .eq(
        "song_id",
        songId
      )
      .order(
        "artist_order",
        {
          ascending: true
        }
      );

    if (artistRowsError) {
      console.error(
        "Song artists lookup error:",
        artistRowsError
      );

      return res.status(500).json({
        error:
          "Unable to calculate artist royalties."
      });
    }

    // ---------------------------------------------------------
    // 15. CALCULATE SONG ROYALTIES
    // IMPORTANT:
    // Royalty is calculated ONLY from songAmount.
    // Tip is NOT included.
    // ---------------------------------------------------------

    const royalty =
      calculateRoyaltyAmounts(
        songAmount,
        artistRows || []
      );

    const royaltyRows = [];

    // ---------------------------------------------------------
    // 16. ARTIST ROYALTY
    // ---------------------------------------------------------

    for (
      const artist of royalty.artistAmounts
    ) {
      if (
        !artist.artist_user_id
      ) {
        continue;
      }

      royaltyRows.push({
        recipient_user_id:
          artist.artist_user_id,

        recipient_type:
          "artist",

        song_id:
          songId,

        sale_reference:
          transactionId,

        sale_amount:
          songAmount,

        currency:
          paidCurrency,

        percentage:
          artist.artist_share_percent,

        amount:
          artist.amount,

        entry_type:
          "credit",

        status:
          "available"
      });
    }

    // ---------------------------------------------------------
    // 17. PRODUCER ROYALTY
    // ---------------------------------------------------------

    if (
      royalty.producerAmount > 0
    ) {
      royaltyRows.push({
        recipient_user_id:
          song.producer_user_id ||
          process.env.PASONG_USER_ID ||
          null,

        recipient_type:
          "producer",

        song_id:
          songId,

        sale_reference:
          transactionId,

        sale_amount:
          songAmount,

        currency:
          paidCurrency,

        percentage:
          20,

        amount:
          royalty.producerAmount,

        entry_type:
          "credit",

        status:
          "available"
      });
    }

    // ---------------------------------------------------------
    // 18. WRITER ROYALTY
    // ---------------------------------------------------------

    if (
      royalty.writerAmount > 0
    ) {
      royaltyRows.push({
        recipient_user_id:
          song.writer_user_id ||
          process.env.PASONG_USER_ID ||
          null,

        recipient_type:
          "writer",

        song_id:
          songId,

        sale_reference:
          transactionId,

        sale_amount:
          songAmount,

        currency:
          paidCurrency,

        percentage:
          15,

        amount:
          royalty.writerAmount,

        entry_type:
          "credit",

        status:
          "available"
      });
    }

    // ---------------------------------------------------------
    // 19. PASONG SONG COMMISSION
    // ---------------------------------------------------------

    if (
      royalty.pasongAmount > 0
    ) {
      royaltyRows.push({
        recipient_user_id:
          process.env.PASONG_USER_ID ||
          null,

        recipient_type:
          "pasong",

        song_id:
          songId,

        sale_reference:
          transactionId,

        sale_amount:
          songAmount,

        currency:
          paidCurrency,

        percentage:
          25,

        amount:
          royalty.pasongAmount,

        entry_type:
          "credit",

        status:
          "available"
      });
    }

    // ---------------------------------------------------------
    // 20. SAVE SONG ROYALTY LEDGER
    // ---------------------------------------------------------

    if (
      royaltyRows.length > 0
    ) {
      const {
        error: royaltyError
      } = await supabase
        .from("royalty_ledger")
        .insert(
          royaltyRows
        );

      if (royaltyError) {
        console.error(
          "Royalty ledger error:",
          royaltyError
        );

        return res.status(500).json({
          error:
            "Payment completed but royalty ledger could not be recorded."
        });
      }
    }

    // ---------------------------------------------------------
    // 21. RECORD TIP SPLIT
    //
    // Tip:
    // Artist/DJ = 70%
    // PASONG    = 30%
    //
    // The tip is completely separate from the
    // 40/20/15/25 song royalty split.
    // ---------------------------------------------------------

    if (tipAmount > 0) {

      const tipArtistId =
        song.artist_user_id ||
        null;

      if (!tipArtistId) {
        console.error(
          "Tip artist is missing for song:",
          songId
        );

        return res.status(500).json({
          error:
            "Tip could not be allocated because the song artist is missing."
        });
      }

      const artistTipAmount =
        Number(
          (tipAmount * 0.70).toFixed(2)
        );

      const pasongTipAmount =
        Number(
          (tipAmount * 0.30).toFixed(2)
        );

      const tipRows = [];

      // -------------------------------------------------------
      // ARTIST TIP — 70%
      // -------------------------------------------------------

      if (
        artistTipAmount > 0
      ) {
        tipRows.push({
          recipient_user_id:
            tipArtistId,

          recipient_type:
            "artist",

          song_id:
            songId,

          sale_reference:
            `${transactionId}-TIP`,

          sale_amount:
            tipAmount,

          currency:
            paidCurrency,

          percentage:
            70,

          amount:
            artistTipAmount,

          entry_type:
            "credit",

          status:
            "available"
        });
      }

      // -------------------------------------------------------
      // PASONG TIP — 30%
      // -------------------------------------------------------

      if (
        pasongTipAmount > 0
      ) {
        tipRows.push({
          recipient_user_id:
            process.env.PASONG_USER_ID ||
            null,

          recipient_type:
            "pasong",

          song_id:
            songId,

          sale_reference:
            `${transactionId}-TIP`,

          sale_amount:
            tipAmount,

          currency:
            paidCurrency,

          percentage:
            30,

          amount:
            pasongTipAmount,

          entry_type:
            "credit",

          status:
            "available"
        });
      }

      // -------------------------------------------------------
      // SAVE TIP LEDGER
      // -------------------------------------------------------

      if (
        tipRows.length > 0
      ) {
        const {
          error: tipError
        } = await supabase
          .from("royalty_ledger")
          .insert(
            tipRows
          );

        if (tipError) {
          console.error(
            "Tip ledger error:",
            tipError
          );

          return res.status(500).json({
            error:
              "Payment completed but tip ledger could not be recorded."
          });
        }
      }
    }

    // ---------------------------------------------------------
    // 22. SUCCESS RESPONSE
    // ---------------------------------------------------------

    return res.status(200).json({
      success:
        true,

      order_id:
        order.id,

      payment_id:
        payment.id,

      download_id:
        download.id,

      order_item_id:
        orderItem.id,

      song_id:
        song.id,

      title:
        song.title,

      amount:
        paidAmount,

      song_amount:
        songAmount,

      tip_amount:
        tipAmount,

      currency:
        paidCurrency,

      status:
        "completed",

      pasong_completed:
        true
    });

  } catch (error) {
    console.error(
      "Payment completion error:",
      error
    );

    return res.status(500).json({
      error:
        "PASONG payment completion failed."
    });
  }
});
