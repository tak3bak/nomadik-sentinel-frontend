// server.js
// Complete, ready-to-run Express server implementing Stripe Connect V2 integration.
// Run: npm install express stripe dotenv

require('dotenv').config();
const express = require('express');
const Stripe = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================================================
// INITIALIZATION & CONFIGURATION
// =============================================================================

// Check required environment variables and throw helpful errors if missing
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('ERROR: Missing environment variable STRIPE_SECRET_KEY.');
  console.error('Please set STRIPE_SECRET_KEY in your .env file or environment.');
  process.exit(1);
}

// Initialize the Stripe Client using the secret key
// Use the `stripeClient` instance for all requests as per integration requirements.
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

// In-Memory Database for Demo Purposes
// In a production application, replace these objects with your database operations (e.g., PostgreSQL, MongoDB).
const db = {
  // Maps user ID to Stripe Connected Account ID
  // e.g., 'user_123': 'acct_123456789'
  usersToAccounts: {},
  
  // Maps Connected Account ID / Customer Account ID to platform subscription status
  // e.g., 'acct_123456789': { status: 'active', priceId: 'price_123' }
  subscriptions: {}
};

// Raw body parser middleware specifically for Stripe webhook endpoints to verify signatures
app.use('/webhooks/thin', express.raw({ type: 'application/json' }));
app.use('/webhooks/standard', express.raw({ type: 'application/json' }));

// Regular JSON & URL-encoded body parser for standard REST API endpoints
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple HTML styling for demo views
const pageStyle = `
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1, h2, h3 { color: #1a1f36; }
    .card { border: 1px solid #e3e8ee; border-radius: 8px; padding: 20px; margin-bottom: 20px; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
    .btn { display: inline-block; background-color: #635bff; color: white; border: none; padding: 10px 18px; border-radius: 4px; font-weight: 600; text-decoration: none; cursor: pointer; }
    .btn:hover { background-color: #0a2540; }
    .btn-secondary { background-color: #e3e8ee; color: #3c4257; }
    .btn-secondary:hover { background-color: #c1c9d2; }
    .status-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: bold; }
    .status-active { background-color: #d1e7dd; color: #0f5132; }
    .status-pending { background-color: #fff3cd; color: #664d03; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 15px; }
    .product-card { border: 1px solid #e3e8ee; border-radius: 6px; padding: 15px; text-align: center; }
    input[type="text"], input[type="number"], input[type="email"] { width: 100%; padding: 8px; margin: 8px 0 16px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
  </style>
`;

// =============================================================================
// 1. CONNECTED ACCOUNTS & ONBOARDING
// =============================================================================

/**
 * Helper: Retrieve or create a connected account for a demo user.
 * Uses V2 Core Accounts API.
 */
async function getOrCreateAccountForUser(userId, email, displayName) {
  if (db.usersToAccounts[userId]) {
    return db.usersToAccounts[userId];
  }

  // Create Connected Account using V2 API
  // WARNING: Do NOT pass top-level `type` property (e.g. type: 'express').
  const account = await stripeClient.v2.core.accounts.create({
    display_name: displayName || `Merchant ${userId}`,
    contact_email: email || `user_${userId}@example.com`,
    identity: {
      country: 'us',
    },
    dashboard: 'full',
    defaults: {
      responsibilities: {
        fees_collector: 'stripe',
        losses_collector: 'stripe',
      },
    },
    configuration: {
      customer: {},
      merchant: {
        capabilities: {
          card_payments: {
            requested: true,
          },
        },
      },
    },
  });

  // Store mapping from user ID to the new Stripe Account ID in DB
  db.usersToAccounts[userId] = account.id;
  return account.id;
}

/**
 * Route: Merchant Dashboard
 * Displays onboarding status, product creation form, and platform subscription management.
 */
app.get('/dashboard', async (req, res) => {
  const userId = req.query.userId || 'user_demo_123';
  const accountId = await getOrCreateAccountForUser(userId, 'merchant@example.com', 'Demo Merchant Store');

  // Fetch account status directly from the API (not stored in DB per requirements)
  const account = await stripeClient.v2.core.accounts.retrieve(accountId, {
    include: ['configuration.merchant', 'requirements'],
  });

  const readyToProcessPayments =
    account?.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
  
  const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== 'currently_due' && requirementsStatus !== 'past_due';

  // Retrieve subscription status from database
  const subInfo = db.subscriptions[accountId] || { status: 'inactive' };

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Merchant Dashboard</title>
        ${pageStyle}
      </head>
      <body>
        <h1>Merchant Dashboard</h1>
        <p><strong>User ID:</strong> ${userId} | <strong>Stripe Account ID:</strong> ${accountId}</p>

        <!-- Onboarding Status Section -->
        <div class="card">
          <h2>1. Stripe Connect Onboarding</h2>
          <p>
            <strong>Payment Capability Status:</strong> 
            <span class="status-badge ${readyToProcessPayments ? 'status-active' : 'status-pending'}">
              ${readyToProcessPayments ? 'Active' : 'Inactive / Action Required'}
            </span>
          </p>
          <p>
            <strong>Requirements Status:</strong> 
            <span class="status-badge ${onboardingComplete ? 'status-active' : 'status-pending'}">
              ${requirementsStatus || 'Pending'}
            </span>
          </p>

          <form action="/create-account-link" method="POST">
            <input type="hidden" name="accountId" value="${accountId}" />
            <button type="submit" class="btn">Onboard to collect payments</button>
          </form>
        </div>

        <!-- Product Creation Section -->
        <div class="card">
          <h2>2. Create a Product</h2>
          <form action="/create-product" method="POST">
            <input type="hidden" name="accountId" value="${accountId}" />
            <label>Product Name</label>
            <input type="text" name="name" required placeholder="e.g. Handmade Mug" />
            
            <label>Description</label>
            <input type="text" name="description" placeholder="e.g. 12oz ceramic mug" />
            
            <label>Price (in USD cents)</label>
            <input type="number" name="priceInCents" required value="2000" />
            
            <button type="submit" class="btn">Add Product to Store</button>
          </form>
          <p style="margin-top: 15px;">
            <a href="/store/${accountId}" target="_blank" class="btn btn-secondary">View Public Storefront &rarr;</a>
          </p>
        </div>

        <!-- Platform Subscription Section -->
        <div class="card">
          <h2>3. Platform Pro Subscription</h2>
          <p>Subscribe to our platform to unlock premium seller analytics and tools.</p>
          <p><strong>Current Subscription Status:</strong> <span class="status-badge ${subInfo.status === 'active' ? 'status-active' : 'status-pending'}">${subInfo.status}</span></p>
          
          <div style="display: flex; gap: 10px;">
            <form action="/create-platform-subscription" method="POST">
              <input type="hidden" name="accountId" value="${accountId}" />
              <button type="submit" class="btn">Subscribe to Platform ($29/mo)</button>
            </form>

            <form action="/create-billing-portal" method="POST">
              <input type="hidden" name="accountId" value="${accountId}" />
              <button type="submit" class="btn btn-secondary">Manage Subscription (Portal)</button>
            </form>
          </div>
        </div>
      </body>
    </html>
  `);
});

/**
 * Route: Generate Onboarding Link using V2 Account Links API
 */
app.post('/create-account-link', async (req, res) => {
  try {
    const { accountId } = req.body;
    const origin = `${req.protocol}://${req.get('host')}`;

    // Generate V2 Account Link
    const accountLink = await stripeClient.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant', 'customer'],
          refresh_url: `${origin}/dashboard`,
          return_url: `${origin}/dashboard?accountId=${accountId}`,
        },
      },
    });

    res.redirect(accountLink.url);
  } catch (error) {
    console.error('Error creating account link:', error);
    res.status(500).send(`Error creating account link: ${error.message}`);
  }
});

// =============================================================================
// 2. PRODUCT MANAGEMENT & STOREFRONT
// =============================================================================

/**
 * Route: Create Product for Connected Account
 * Uses the Stripe-Account header to scope the product to the connected account.
 */
app.post('/create-product', async (req, res) => {
  try {
    const { accountId, name, description, priceInCents } = req.body;

    // Create product on connected account using the `stripeAccount` option
    await stripeClient.products.create(
      {
        name: name,
        description: description,
        default_price_data: {
          unit_amount: parseInt(priceInCents, 10),
          currency: 'usd',
        },
      },
      {
        stripeAccount: accountId, // Pass connected account ID for Stripe-Account header
      }
    );

    res.redirect(`/dashboard?accountId=${accountId}`);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).send(`Error creating product: ${error.message}`);
  }
});

/**
 * Route: Public Storefront for Connected Account
 * NOTE: In a real app, use a slug or custom domain (e.g., /store/acme-corp) instead of raw account ID in URL.
 */
app.get('/store/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    // List active products from the connected account using stripeAccount header
    const productsResponse = await stripeClient.products.list(
      {
        limit: 20,
        active: true,
        expand: ['data.default_price'],
      },
      {
        stripeAccount: accountId, // Request scoped to connected account
      }
    );

    const products = productsResponse.data;

    const productCards = products.map((product) => {
      const price = product.default_price;
      const formattedPrice = price ? `$${(price.unit_amount / 100).toFixed(2)}` : 'N/A';

      return `
        <div class="product-card">
          <h3>${product.name}</h3>
          <p>${product.description || 'No description available'}</p>
          <p><strong>${formattedPrice}</strong></p>
          <form action="/create-checkout-session" method="POST">
            <input type="hidden" name="accountId" value="${accountId}" />
            <input type="hidden" name="priceId" value="${price ? price.id : ''}" />
            <button type="submit" class="btn" ${!price ? 'disabled' : ''}>Buy Now</button>
          </form>
        </div>
      `;
    }).join('');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Storefront</title>
          ${pageStyle}
        </head>
        <body>
          <h1>Welcome to Storefront</h1>
          <p>Browsing products for Merchant Account: <code>${accountId}</code></p>
          <div class="grid">
            ${productCards.length > 0 ? productCards : '<p>No products available for this merchant yet.</p>'}
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Error loading storefront:', error);
    res.status(500).send(`Error loading store: ${error.message}`);
  }
});

/**
 * Route: Process Purchase via Direct Charges using Hosted Checkout
 */
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { accountId, priceId } = req.body;
    const origin = `${req.protocol}://${req.get('host')}`;

    // Create Direct Charge Checkout Session
    const session = await stripeClient.checkout.sessions.create(
      {
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        payment_intent_data: {
          // Direct Charge Application Fee (e.g. $1.23 fee collected by platform)
          application_fee_amount: 123,
        },
        mode: 'payment',
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/store/${accountId}`,
      },
      {
        stripeAccount: accountId, // Direct charge targeting the connected account
      }
    );

    res.redirect(session.url);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).send(`Error creating checkout session: ${error.message}`);
  }
});

// =============================================================================
// 3. PLATFORM SUBSCRIPTIONS & BILLING PORTAL
// =============================================================================

/**
 * Route: Subscribe Connected Account to Platform Service
 * For V2 Accounts, `customer_account` allows charging connected accounts directly as customers on the platform.
 */
app.post('/create-platform-subscription', async (req, res) => {
  try {
    const { accountId } = req.body;
    const origin = `${req.protocol}://${req.get('host')}`;

    // Ensure PLATFORM_PRICE_ID environment variable is present
    const priceId = process.env.PLATFORM_PRICE_ID;
    if (!priceId) {
      console.warn('WARNING: process.env.PLATFORM_PRICE_ID is not set. Using fallback placeholder price.');
    }

    // Create Hosted Checkout session for Platform Subscription
    const session = await stripeClient.checkout.sessions.create({
      // Use customer_account with the connected account ID (acct_...)
      customer_account: accountId,
      mode: 'subscription',
      line_items: [
        {
          // Replace process.env.PLATFORM_PRICE_ID with your actual recurring platform Price ID
          price: priceId || 'price_1P0000000000000000000000',
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?subscription=canceled`,
    });

    res.redirect(session.url);
  } catch (error) {
    console.error('Error creating platform subscription session:', error);
    res.status(500).send(`Error setting up platform subscription: ${error.message}`);
  }
});

/**
 * Route: Billing Portal Session for Connected Account
 */
app.post('/create-billing-portal', async (req, res) => {
  try {
    const { accountId } = req.body;
    const origin = `${req.protocol}://${req.get('host')}`;

    // Create a Billing Portal session using customer_account
    const session = await stripeClient.billingPortal.sessions.create({
      customer_account: accountId,
      return_url: `${origin}/dashboard`,
    });

    res.redirect(session.url);
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(500).send(`Error opening billing portal: ${error.message}`);
  }
});

// Generic Success Route
app.get('/success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head><title>Success</title>${pageStyle}</head>
      <body>
        <div class="card">
          <h1>Payment Successful!</h1>
          <p>Thank you for your purchase. Session ID: <code>${req.query.session_id || ''}</code></p>
        </div>
      </body>
    </html>
  `);
});

// =============================================================================
// 4. WEBHOOK HANDLERS
// =============================================================================

/**
 * Webhook Handler: Thin Events (V2 Account Updates)
 * Listens for requirement changes and capability updates on connected accounts.
 */
app.post('/webhooks/thin', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_THIN_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('ERROR: Missing STRIPE_THIN_WEBHOOK_SECRET env variable.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let thinEvent;
  try {
    // 1. Parse thin event header/payload
    thinEvent = stripeClient.parseThinEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Thin Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // 2. Fetch full event details from Stripe API using event ID
    const event = await stripeClient.v2.core.events.retrieve(thinEvent.id);

    // 3. Handle specific V2 event types
    switch (event.type) {
      case 'v2.core.account[requirements].updated': {
        const account = event.data.object;
        console.log(`[V2 WEBHOOK] Requirements updated for account: ${account.id}`);
        // TODO: DB update - Notify merchant if requirements are now due
        break;
      }
      case 'v2.core.account[configuration.merchant].capability_status_updated': {
        const account = event.data.object;
        console.log(`[V2 WEBHOOK] Merchant capability updated for account: ${account.id}`);
        // TODO: DB update - Update stored merchant capability status
        break;
      }
      case 'v2.core.account[configuration.customer].capability_status_updated': {
        const account = event.data.object;
        console.log(`[V2 WEBHOOK] Customer capability updated for account: ${account.id}`);
        // TODO: DB update - Update stored customer capability status
        break;
      }
      default:
        console.log(`[V2 WEBHOOK] Unhandled thin event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error(`Error retrieving thin event details: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Webhook Handler: Standard Events (V1 Platform Subscriptions & Invoices)
 * Listens for subscription upgrades, downgrades, cancellations, and customer billing changes.
 */
app.post('/webhooks/standard', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_STANDARD_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('ERROR: Missing STRIPE_STANDARD_WEBHOOK_SECRET env variable.');
    return res.status(500).send('Webhook secret not configured.');
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`Standard Webhook Signature Verification Failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle standard subscription and customer events
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      
      // For V2 Customer Accounts, extract connected account ID from `customer_account`
      const accountId = subscription.customer_account;
      const priceId = subscription.items?.data[0]?.price?.id;
      const quantity = subscription.items?.data[0]?.quantity;
      const isCanceled = subscription.cancel_at_period_end;
      const pauseCollection = subscription.pause_collection;

      console.log(`[V1 WEBHOOK] Subscription updated for account: ${accountId}`);
      console.log(`Status: ${subscription.status}, Price: ${priceId}, Quantity: ${quantity}`);

      // Save subscription status to database
      if (accountId) {
        db.subscriptions[accountId] = {
          status: subscription.status,
          priceId: priceId,
          quantity: quantity,
          cancelAtPeriodEnd: isCanceled,
          isPaused: !!pauseCollection,
        };
        // TODO: DB Update - Persist database record for user access control
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const accountId = subscription.customer_account;
      console.log(`[V1 WEBHOOK] Subscription canceled for account: ${accountId}`);

      if (accountId) {
        db.subscriptions[accountId] = { status: 'canceled' };
        // TODO: DB Update - Revoke feature access for canceled subscriber
      }
      break;
    }

    case 'payment_method.attached': {
      const paymentMethod = event.data.object;
      console.log(`[V1 WEBHOOK] Payment method ${paymentMethod.id} attached.`);
      // TODO: DB Update - Log new payment method details if necessary
      break;
    }

    case 'payment_method.detached': {
      const paymentMethod = event.data.object;
      console.log(`[V1 WEBHOOK] Payment method ${paymentMethod.id} detached.`);
      // TODO: DB Update - Prompt user to add a replacement payment method
      break;
    }

    case 'customer.updated': {
      const customer = event.data.object;
      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;
      console.log(`[V1 WEBHOOK] Customer ${customer.id} updated. Default PM: ${defaultPaymentMethod}`);
      // TODO: DB Update - Treat as billing information changes only (do not use billing email as login credential)
      break;
    }

    case 'customer.tax_id.created':
    case 'customer.tax_id.updated':
    case 'customer.tax_id.deleted': {
      const taxId = event.data.object;
      console.log(`[V1 WEBHOOK] Tax ID event (${event.type}) for customer: ${taxId.customer}`);
      // TODO: DB Update - Sync customer tax ID validation status
      break;
    }

    case 'billing_portal.configuration.created':
    case 'billing_portal.configuration.updated':
    case 'billing_portal.session.created': {
      console.log(`[V1 WEBHOOK] Billing portal event triggered: ${event.type}`);
      break;
    }

    default:
      console.log(`[V1 WEBHOOK] Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// =============================================================================
// SERVER INITIALIZATION
// =============================================================================

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
  console.log(`Access Merchant Dashboard at http://localhost:${PORT}/dashboard`);
});
