import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { Id } from '@/convex/_generated/dataModel';
import { apiAny } from '@/lib/convexApiAny';

// Helper function to get the token from the request
function getTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.log("🚫 GET /api/clipper - No Authorization header found");
    return null;
  }
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7, authHeader.length);
    console.log(`✅ GET /api/clipper - Extracted token: ${token.substring(0, 20)}...`);
    return token;
  }
  console.log("🚫 GET /api/clipper - Authorization header is not a Bearer token");
  return null;
}

export async function GET(req: Request) {
  console.log("🚀 GET /api/clipper request received");
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      console.log("❌ No token found in request");
      return new NextResponse('Authorization token is missing.', { status: 401 });
    }
    
    // Debug token
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        const header = JSON.parse(Buffer.from(tokenParts[0], 'base64').toString());
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log("🔍 JWT Header:", header);
        console.log("🔍 JWT Payload:", { 
          iss: payload.iss, 
          aud: payload.aud,
          exp: payload.exp,
          sub: payload.sub?.substring(0, 10) + "..." 
        });
      }
    } catch {
      console.log("⚠️ Could not decode token for debugging");
    }

    console.log("🔗 CONVEX_URL:", process.env.NEXT_PUBLIC_CONVEX_URL);
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    console.log("🔧 Initialized Convex client");
    convex.setAuth(token);
    console.log("🔑 Set auth on Convex client");
    
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const projectId = searchParams.get('projectId');

    console.log("🔍 Query params - teamId:", teamId, "projectId:", projectId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convexAny = convex as any;
    if (teamId && projectId) {
      // Pobierz sekcje dla projektu
      console.log("📞 Calling getShoppingListSections");
      const sections = await convexAny.query(apiAny.clipper.getShoppingListSections, {
        projectId: projectId as Id<"projects">,
        teamId: teamId as Id<"teams">
      });
      console.log("✅ Sections query successful");
      return NextResponse.json({ sections });
    } else if (teamId) {
      // Pobierz projekty dla zespołu
      console.log("📞 Calling getProjectsForTeam");
      const projects = await convexAny.query(apiAny.clipper.getProjectsForTeam, {
        teamId: teamId as Id<"teams">
      });
      console.log("✅ Projects query successful");
      return NextResponse.json({ projects });
    } else {
      // Domyślne zachowanie: pobierz zespoły i projekty dla użytkownika
      console.log("📞 Calling convex.query(api.clipper.getTeamsAndProjects)");
      const data = await convexAny.query(apiAny.clipper.getTeamsAndProjects, {});
      console.log("🎉 Convex query successful, data:", JSON.stringify(data, null, 2));
      // Zakładamy, że getTeamsAndProjects zwraca { user, teams }
      return NextResponse.json(data);
    }

  } catch (error: unknown) {
    console.error('[CLIPPER_API_GET_ERROR]', error);
    console.error('[ERROR_DETAILS]', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      data: error && typeof error === 'object' && 'data' in error ? (error as { data: unknown }).data : undefined
    });
     // Zwróć błąd z Convex, jeśli jest dostępny
    if (error && typeof error === 'object' && 'data' in error) {
      const errorData = (error as { data: { message?: string; code?: string } }).data;
      console.error('[CONVEX_ERROR_DATA]', errorData);
      return NextResponse.json({ message: errorData.message, code: errorData.code }, { status: 400 });
    }
    return new NextResponse(`Internal Server Error: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return new NextResponse('Authorization token is missing.', { status: 401 });
    }
    
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    const body = await req.json();

    // Używamy nowej, bardziej szczegółowej mutacji
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convexAny = convex as any;
    const newItem = await convexAny.mutation(apiAny.clipper.addShoppingListItem, body);

    return NextResponse.json(newItem);

  } catch (error: unknown) {
    console.error('[CLIPPER_API_POST_ERROR]', error);
     if (error && typeof error === 'object' && 'data' in error) {
      return NextResponse.json((error as { data: unknown }).data, { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
} 
