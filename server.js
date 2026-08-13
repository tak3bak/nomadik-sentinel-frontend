const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Resend } = require('resend');

const app = express();
const PORT = process.env.PORT || 3000;
const resend = new Resend(process.env.RESEND_API_KEY);

// Serve static assets from root directory
app.use(express.static(__dirname));

// Stripe Webhook Endpoint (requires raw body parser for signature verification)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`[WEBHOOK ERROR] Signature verification failed: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment checkout completion
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerEmail = session.customer_details?.email || session.customer_email;
        const customerName = session.customer_details?.name || 'Valued Client';
        const amountTotal = session.amount_total;

        // Determine purchased tier based on transaction amount
        let planTier = 'Starter Sentinel';
        let downloadUrl = 'https://nomadik.site/downloads/sentinel-starter.tar.gz';

        if (amountTotal >= 79900) {
            planTier = 'Pro Operations';
            downloadUrl = 'https://nomadik.site/downloads/sentinel-pro.tar.gz';
        }

        console.log(`[PAYMENT VERIFIED] ${customerName} (${customerEmail}) subscribed to ${planTier}`);

        // Automated dispatch email via Resend
        try {
            await resend.emails.send({
                from: 'Nomadik Security Operations <deploy@nomadik.site>',
                to: customerEmail,
                subject: `Deployment Granted: Your Nomadik Security Sentinel (${planTier}) Access`,
                html: `
                    <div style="font-family: Arial, sans-serif; background-color: #0b0f19; color: #f9fafb; padding: 32px; border-radius: 8px;">
                        <h2 style="color: #10b981; margin-bottom: 16px;">Infrastructure Security License Active</h2>
                        <p>Hello ${customerName},</p>
                        <p>Thank you for subscribing to <strong>Nomadik Security Sentinel (${planTier})</strong>.</p>
                        <p>Your continuous monitoring and active defense pipeline is ready for deployment.</p>
                        <div style="margin: 28px 0;">
                            <a href="${downloadUrl}" style="background-color: #10b981; color: #022c22; font-weight: bold; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">Download Sentinel Package</a>
                        </div>
                        <p style="font-size: 12px; color: #9ca3af; margin-top: 24px;">If you require onboarding assistance or 4-hour emergency response dispatch, contact ops@nomadik.site.</p>
                    </div>
                `
            });
            console.log(`[DISPATCH SUCCESS] License download link sent to ${customerEmail}`);
        } catch (emailErr) {
            console.error(`[DISPATCH ERROR] Failed to send email to ${customerEmail}:`, emailErr);
        }
    }

    res.json({ received: true });
});

app.listen(PORT, () => {
    console.log(`[NOMADIK SERVER] Sentinel Dispatcher running on port ${PORT}`);
});
