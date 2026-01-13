import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

export const uploadToS3 = async ({ buffer, key, mimetype }) => {
    try {
        const params = {
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: mimetype,
            // ACL: "public-read",
        };

        await s3Client.send(new PutObjectCommand(params));

        // Return the public URL
        return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (err) {
        console.error("S3 upload error:", err);
        throw new Error("Failed to upload file to S3");
    }
};
