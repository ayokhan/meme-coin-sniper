import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test if DATABASE_URL exists
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL not found in environment variables',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Database URL is configured',
      hasUrl: !!dbUrl,
      urlPreview: dbUrl.substring(0, 30) + '...',
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
