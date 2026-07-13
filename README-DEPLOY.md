# Lodgely Backend - Render Deployment Guide

## Prerequisites
- GitHub account with backend code pushed
- Render account
- PostgreSQL database (you already have this on Aiven)

## Deployment Steps

### 1. Create Web Service on Render
1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your backend GitHub repository

### 2. Configure Service Settings
- **Name**: `lodgely-backend`
- **Root Directory**: Leave empty (since backend is at root of its repo)
- **Environment**: `Node`
- **Build Command**: 
  ```
  npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build
  ```
- **Start Command**: 
  ```
  npm run start:prod
  ```

### 3. Add Environment Variables
Add these in the "Environment" section:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your PostgreSQL connection string from Aiven |
| `JWT_SECRET` | Your secure JWT secret |
| `JWT_EXPIRES_IN` | `1d` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your Gmail address |
| `SMTP_PASS` | Your Gmail app password |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g. `https://lodgely.vercel.app`) |
| `PORT` | `5000` |

### 4. Deploy
- Click "Create Web Service"
- Wait for deployment (first deployment takes 5-10 minutes)
- Once deployed, you'll get a URL like: `https://lodgely-backend.onrender.com`

### 5. Test the API
Test your backend is working:
```bash
curl https://your-backend-url.onrender.com/accommodations
```

## Notes
- Free tier services spin down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- Consider upgrading to paid tier for production use
