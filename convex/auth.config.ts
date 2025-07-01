console.log("🔧 Auth config - CLERK_JWT_ISSUER_DOMAIN:", process.env.CLERK_JWT_ISSUER_DOMAIN);

const authConfig = {
  providers: [
    {
      // Clerk JWT issuer domain - set directly for now to debug
      domain: "https://dominant-bengal-70.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
