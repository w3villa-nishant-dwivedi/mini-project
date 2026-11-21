import { auth } from "@clerk/nextjs/server";
import {
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import storj from "@/lib/storj";

export async function POST(request) {
  try {
    // 1. Verify logged-in user
    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Receive image
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json(
        { message: "Please select an image" },
        { status: 400 }
      );
    }

    // 3. Validate image
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return Response.json(
        { message: "Only JPG, PNG and WEBP images are allowed" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return Response.json(
        { message: "Image must be smaller than 5 MB" },
        { status: 400 }
      );
    }

    // 4. Generate unique object key
    const key = `profile-images/${userId}/${randomUUID()}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Upload to Storj
    await storj.send(
      new PutObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    );

    // 6. Generate temporary URL to display image
    const imageUrl = await getSignedUrl(
      storj,
      new GetObjectCommand({
        Bucket: process.env.STORJ_BUCKET,
        Key: key,
      }),
      { expiresIn: 3600 }
    );

    return Response.json({
      success: true,
      key,
      imageUrl,
    });

  } catch (error) {
    console.error("Profile upload error:", error);

    return Response.json(
      { message: "Image upload failed" },
      { status: 500 }
    );
  }
}