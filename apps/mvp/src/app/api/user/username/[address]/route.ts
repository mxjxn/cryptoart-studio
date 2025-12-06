import { NextRequest, NextResponse } from "next/server";
import { getUserFromCache } from "~/lib/server/user-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
): Promise<NextResponse<{ username: string | null }>> {
  const { address } = await params;
  
  if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) {
    return NextResponse.json(
      { username: null },
      { status: 400 }
    );
  }

  const user = await getUserFromCache(address.toLowerCase());
  
  if (user && user.username) {
    return NextResponse.json({ username: user.username });
  }

  return NextResponse.json({ username: null });
}



