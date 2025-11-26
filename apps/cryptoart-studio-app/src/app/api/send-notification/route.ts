import { notificationDetailsSchema } from "@farcaster/miniapp-sdk";
import { NextRequest } from "next/server";
import { z } from "zod";

// Force dynamic rendering to avoid build-time execution issues
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

const requestSchema = z.object({
  fid: z.number(),
  notificationDetails: notificationDetailsSchema,
});

export async function POST(request: NextRequest) {
  // Lazy load all modules to avoid build-time execution issues
  // This prevents Next.js from trying to analyze the route during build
  const [
    kvModule,
    notifsModule,
    neynarModule
  ] = await Promise.all([
    import("~/lib/kv"),
    import("~/lib/notifs"),
    import("~/lib/neynar"),
  ]);
  
  const { setUserNotificationDetails } = kvModule;
  const { sendMiniAppNotification } = notifsModule;
  const { sendNeynarMiniAppNotification } = neynarModule;

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

  // Only store notification details if not using Neynar
  if (!neynarEnabled) {
    await setUserNotificationDetails(
      Number(requestBody.data.fid),
      requestBody.data.notificationDetails
    );
  }

  // Use appropriate notification function based on Neynar status
  const sendNotification = neynarEnabled ? sendNeynarMiniAppNotification : sendMiniAppNotification;
  const sendResult = await sendNotification({
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
}
