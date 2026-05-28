import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const s3 = new S3Client({ region: process.env.AWS_REGION ?? "eu-west-3" });

const SIZES = [
  { suffix: "card",   width: 640,  height: 360  },
  { suffix: "thumb",  width: 320,  height: 180  },
  { suffix: "og",     width: 1200, height: 630  },
];

export const handler = async (event) => {
  const record = event.Records[0];
  const srcBucket = record.s3.bucket.name;
  const srcKey    = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  const destBucket = process.env.DEST_BUCKET ?? srcBucket;

  if (!isImage(srcKey)) {
    console.log(`Skipping non-image key: ${srcKey}`);
    return;
  }

  const original = await downloadImage(srcBucket, srcKey);
  const baseName = srcKey.replace(/^originals\//, "").replace(/\.[^.]+$/, "");

  await Promise.all(
    SIZES.map(({ suffix, width, height }) =>
      resizeAndUpload(original, destBucket, baseName, suffix, width, height)
    )
  );

  console.log(`Resized ${srcKey} → ${SIZES.length} variants`);
};

function isImage(key) {
  return /\.(jpe?g|png|webp|avif)$/i.test(key);
}

async function downloadImage(bucket, key) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function resizeAndUpload(buffer, bucket, baseName, suffix, width, height) {
  const resized = await sharp(buffer)
    .resize(width, height, { fit: "cover", position: "centre" })
    .webp({ quality: 82 })
    .toBuffer();

  const destKey = `resized/${baseName}-${suffix}.webp`;

  await s3.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         destKey,
    Body:        resized,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: {
      "original-key": baseName,
      "resize-variant": suffix,
    },
  }));

  console.log(`Uploaded ${destKey} (${width}x${height})`);
}
