# R2 Setup for PDF Analysis

## 1. Configure R2 Bucket
1. Go to Cloudflare Dashboard → R2 Object Storage
2. Create a new bucket (if not already done)
3. Note your bucket name and account ID

## 2. Set R2_PUBLIC_URL Environment Variable

Replace `your-r2-bucket.your-account.r2.cloudflarestorage.com` in `.env.local` with your actual R2 public URL:

```
R2_PUBLIC_URL=https://your-bucket-name.your-account-id.r2.cloudflarestorage.com
```

**Example:**
```
R2_PUBLIC_URL=https://vibeplanner-files.abc123def.r2.cloudflarestorage.com
```

## 3. Enable Public Access (for PDF Analysis)
1. In your R2 bucket settings, enable "Public URL Access"
2. Or set up a custom domain for public access

## 4. Test Configuration
1. Upload a PDF file through the app
2. Check that the file URL is accessible at: `{R2_PUBLIC_URL}/{file-storage-key}`
3. PDF analysis should work automatically

## Notes:
- PDF files must be publicly accessible for Gemini AI to analyze them
- The R2_PUBLIC_URL is used to construct direct links to uploaded PDFs
- Make sure your R2 bucket allows public read access for uploaded files