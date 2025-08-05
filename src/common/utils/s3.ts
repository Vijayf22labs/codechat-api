import AWS from "aws-sdk";
import "multer";
import { env } from "./envConfig";
type File = Express.Multer.File;

const s3 = new AWS.S3({
  accessKeyId: env.ACCESS_KEY_ID,
  secretAccessKey: env.SECRET_ACCESS_KEY,
  region: env.AWS_REGION,
  s3ForcePathStyle: true,
  endpoint: new AWS.Endpoint(env.MINIO_ENDPOINT),
});

export async function uploadToS3(file: File) {
  const uploadParams = {
    Bucket: env.BUCKET_NAME,
    Key: `${Date.now()} + '-' + ${file.originalname}`,
    Body: file.buffer,
    ContentType: file.mimetype,
  };
  return new Promise((resolve, reject) => {
    s3.upload(uploadParams, (err: any, data: { Location: unknown }) => {
      if (err) {
        console.log(err);
        reject("Error uploading file to s3");
      } else {
        console.log(data);
        resolve(data.Location);
      }
    });
  });
}
