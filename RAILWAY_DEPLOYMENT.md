# Calendrax - Railway Deployment Guide

## Overview
This guide walks you through deploying Calendrax to Railway with separate services for Frontend, Backend, and MongoDB.

---

## Prerequisites
1. A [Railway](https://railway.app) account
2. Your code pushed to GitHub (use "Save to Github" in Emergent)
3. The following API keys ready:
   - Stripe Secret Key (you have this)
   - Twilio Account SID & Auth Token (you have this)
   - SendGrid API Key (optional, for emails)

---

## Step 1: Create a New Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"**
3. Select **"Empty Project"**

---

## Step 2: Add MongoDB Database

1. In your project, click **"+ New"**
2. Select **"Database"** → **"MongoDB"**
3. Railway will provision a MongoDB instance
4. Click on the MongoDB service → **"Variables"** tab
5. Copy the `MONGO_URL` value (you'll need this for the backend)

---

## Step 3: Deploy the Backend

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your Calendrax repository
3. When prompted for root directory, enter: `backend`
4. Railway will detect the Python app and start building

### Configure Backend Environment Variables:
Click on the backend service → **"Variables"** tab → Add these:

| Variable | Value |
|----------|-------|
| `MONGO_URL` | (paste from MongoDB service, or use `${{MongoDB.MONGO_URL}}` reference) |
| `DB_NAME` | `calendrax` |
| `JWT_SECRET` | (generate a secure random string - 32+ characters) |
| `STRIPE_API_KEY` | `sk_live_...` (your Stripe secret key) |
| `STRIPE_WEBHOOK_SECRET` | (get from Stripe dashboard after setting up webhook) |
| `TWILIO_ACCOUNT_SID` | `AC51c5fadb8eca1a729fbcf7f7b9a65100` |
| `TWILIO_AUTH_TOKEN` | `03ddb080bd89c14f51febd764af2df35` |
| `TWILIO_WHATSAPP_NUMBER` | `whatsapp:+14155238886` |
| `SENDGRID_API_KEY` | (your SendGrid key, when you have it) |
| `SENDGRID_FROM_EMAIL` | (your verified sender email) |

5. Click **"Deploy"** and wait for the build to complete
6. Once deployed, go to **"Settings"** → **"Networking"** → **"Generate Domain"**
7. Copy your backend URL (e.g., `https://calendrax-backend.up.railway.app`)

---

## Step 4: Deploy the Frontend

1. Click **"+ New"** → **"GitHub Repo"**
2. Select your Calendrax repository again
3. When prompted for root directory, enter: `frontend`
4. Railway will detect the React app

### Configure Frontend Environment Variables:
Click on the frontend service → **"Variables"** tab → Add:

| Variable | Value |
|----------|-------|
| `REACT_APP_BACKEND_URL` | `https://your-backend-url.up.railway.app` (from Step 3) |

5. Click **"Deploy"** and wait for the build
6. Go to **"Settings"** → **"Networking"** → **"Generate Domain"**
7. This is your live app URL!

---

## Step 5: Update Backend CORS (if needed)

The backend currently allows all origins (`*`), so CORS should work automatically.
If you want to restrict it, update `backend/server.py` line ~2964 to include your frontend domain.

---

## Step 6: Set Up Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter: `https://your-backend-url.up.railway.app/api/webhooks/stripe`
4. Select events: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`
5. Copy the **Signing Secret** and add it to Railway as `STRIPE_WEBHOOK_SECRET`

---

## Step 7: Verify Deployment

1. Visit your frontend URL
2. Try logging in with existing credentials or create a new account
3. Test the booking flow

---

## Environment Variables Summary

### Backend (`/backend`)
```
MONGO_URL=mongodb://...
DB_NAME=calendrax
JWT_SECRET=your-secure-secret-key-min-32-chars
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
TWILIO_ACCOUNT_SID=AC51c5fadb8eca1a729fbcf7f7b9a65100
TWILIO_AUTH_TOKEN=03ddb080bd89c14f51febd764af2df35
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
SENDGRID_API_KEY=SG....
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Frontend (`/frontend`)
```
REACT_APP_BACKEND_URL=https://your-backend.up.railway.app
```

---

## Troubleshooting

### Backend won't start
- Check the deploy logs in Railway
- Ensure all required environment variables are set
- Verify MONGO_URL is correct

### Frontend can't connect to backend
- Verify REACT_APP_BACKEND_URL is correct (include https://)
- Check that backend is running and accessible
- Check browser console for CORS errors

### Payments not working
- Verify STRIPE_API_KEY is the live key (not test)
- Ensure STRIPE_WEBHOOK_SECRET is set correctly
- Check Stripe dashboard for webhook delivery status

---

## Custom Domain (Optional)

1. In Railway, click on your frontend service
2. Go to **"Settings"** → **"Networking"**
3. Click **"+ Custom Domain"**
4. Add your domain and configure DNS as instructed

---

## Costs

Railway offers:
- **Free tier**: $5 credit/month, enough for small apps
- **Pro tier**: $20/month for more resources

MongoDB on Railway is included in your usage.

---

Need help? Check [Railway Docs](https://docs.railway.app) or reach out!
