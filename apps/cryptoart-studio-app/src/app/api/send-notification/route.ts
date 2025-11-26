import { NextRequest } from "next/server";

// Force dynamic rendering to avoid build-time execution issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

export async function POST(request: NextRequest) {
  // Lazy load all modules to avoid build-time execution issues
  // This prevents Next.js from trying to analyze the route during build
  const [
    { notificationDetailsSchema },
    { z },
    notifsModule,
    neynarModule
  ] = await Promise.all([
    import("@farcaster/miniapp-sdk"),
    import("zod"),
    import("~/lib/notifs"),
    import("~/lib/neynar"),
  ]);
  
  const { sendMiniAppNotification } = notifsModule;
  const { sendNeynarMiniAppNotification } = neynarModule;
  
  // Define schema inside function to avoid top-level module analysis
  const requestSchema = z.object({
    fid: z.number(),
    notificationDetails: notificationDetailsSchema,
  });

  // If Neynar is enabled, we don't need to store notification details
  // as they will be managed by Neynar's system
  const neynarEnabled = process.env.NEYNAR_API_KEY && process.env.NEYNAR_CLIENT_ID;

  const requestJson = await request.json();
  const requestBody = requestSchema.safeParse(requestJson);

  if (requestBody.success === false) {
    return Response.json(
      { success: false, errors: requestBody.error.errors },
      { status: 400 }
    );
  }

  // Use appropriate notification function based on Neynar status
  if (neynarEnabled) {
    // Use Neynar's notification system (doesn't need notification details)
    const sendResult = await sendNeynarMiniAppNotification({
      fid: Number(requestBody.data.fid),
      title: "Test notification",
      body: "Sent at " + new Date().toISOString(),
    });
    
    if (sendResult.state === "error") {
      return Response.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    } else if (sendResult.state === "rate_limit") {
      return Response.json(
        { success: false, error: "Rate limited" },
        { status: 429 }
      );
    }
    
    return Response.json({ success: true });
  } else {
    // Pass notification details directly - no need to store them
    const sendResult = await sendMiniAppNotification({
      fid: Number(requestBody.data.fid),
      title: "Test notification",
      body: "Sent at " + new Date().toISOString(),
      notificationDetails: requestBody.data.notificationDetails,
    });
    
    if (sendResult.state === "error") {
      return Response.json(
        { success: false, error: sendResult.error },
        { status: 500 }
      );
    } else if (sendResult.state === "rate_limit") {
      return Response.json(
        { success: false, error: "Rate limited" },
        { status: 429 }
      );
    }
    
    return Response.json({ success: true });
  }
}
