# Stripe Integration Setup Guide

## 1. Stripe Dashboard Configuration

### Create Products and Prices
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add Product**
3. Create the following products:

#### Basic Plan
- Name: "VibePlanner Basic"
- Price: $19/month
- Copy the Price ID (starts with `price_`)

#### Pro Plan  
- Name: "VibePlanner Pro"
- Price: $49/month
- Copy the Price ID

#### Enterprise Plan
- Name: "VibePlanner Enterprise" 
- Price: $199/month
- Copy the Price ID

### Webhook Configuration
1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set endpoint URL: `https://your-domain.com/stripe`
4. Select events:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Webhook Secret**

## 2. Environment Variables

Add to your `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe Secret Key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook signing secret

# Optional: Public URL for webhooks (production)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## 3. Update Price IDs

Edit `convex/http.ts` in the `determinePlanFromPriceId` function:

```typescript
const priceIdToPlan: Record<string, string> = {
  "price_1234567890": "basic",      // Replace with your Basic monthly price ID
  "price_0987654321": "pro",        // Replace with your Pro monthly price ID  
  "price_1122334455": "enterprise", // Replace with your Enterprise monthly price ID
};
```

## 4. Update Subscription Card

Edit `components/ui/billing/SubscriptionCard.tsx` to use your actual price IDs:

```typescript
{Object.entries({
  basic: { priceId: "price_1234567890", popular: false },      // Your Basic price ID
  pro: { priceId: "price_0987654321", popular: true },         // Your Pro price ID
  enterprise: { priceId: "price_1122334455", popular: false }, // Your Enterprise price ID
}).map(([planKey, planData]) => {
```

## 5. Testing

### Test Mode
1. Use Stripe test keys (`sk_test_...`)
2. Use test card numbers from [Stripe Docs](https://stripe.com/docs/testing)
3. Test the full flow:
   - Create subscription
   - Test webhooks with Stripe CLI: `stripe listen --forward-to localhost:3000/stripe`

### Production
1. Switch to live keys (`sk_live_...`)
2. Update webhook endpoint to production URL
3. Test with real payments (small amounts)

## 6. Subscription Limits

Current plan limits are defined in `convex/stripe.ts`:

```typescript
export const SUBSCRIPTION_PLANS = {
  free: {
    maxProjects: 3,
    maxTeamMembers: 5,
    maxStorageGB: 1,
    hasAdvancedFeatures: false,
  },
  basic: {
    maxProjects: 10,
    maxTeamMembers: 15, 
    maxStorageGB: 10,
    hasAdvancedFeatures: false,
  },
  // ... etc
}
```

Adjust these limits as needed for your business model.

## 7. Security Notes

- Never expose Stripe secret keys in client-side code
- Always validate webhooks using the webhook secret
- Use HTTPS in production for webhook endpoints
- Regularly rotate webhook secrets

## Troubleshooting

### Common Issues

1. **Webhook not receiving events**
   - Check webhook URL is publicly accessible
   - Verify webhook secret matches
   - Check Stripe Dashboard webhook logs

2. **Payment not updating subscription**
   - Verify webhook events are enabled
   - Check Convex logs for errors
   - Ensure team metadata is passed correctly

3. **Type errors in Convex**
   - Run `npx convex dev` to check for TypeScript errors
   - Ensure all Stripe types are properly annotated

### Support

- Stripe Documentation: https://stripe.com/docs
- Convex Documentation: https://docs.convex.dev
- Create issues in your project repository 