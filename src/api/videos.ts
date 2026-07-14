import { respondWithJSON } from "./json";
import { type ApiConfig } from "../config";
import { type BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from './errors';
import { getBearerToken, validateJWT } from '../auth';
import { getVideo, updateVideo } from '../db/videos';

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
    const { videoId } = req.params as { videoId?: string };
    if (!videoId) {
      throw new BadRequestError("Invalid video ID");
    }
  
    const token = getBearerToken(req.headers);
    const userID = validateJWT(token, cfg.jwtSecret);
  
    const video = getVideo(cfg.db, videoId);
    if (!video) {
      throw new NotFoundError("Couldn't find video");
    }
    if (video.userID !== userID) {
      throw new UserForbiddenError("Not authorized to update this video");
    }
  
    const formData = await req.formData();
    const file = formData.get("video");
    if (!(file instanceof File)) {
      throw new BadRequestError("Thumbnail file missing");
    }
  
    const MAX_UPLOAD_SIZE = 1024 * 1024 * 1024;
  
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestError(
        `Video file exceeds the maximum allowed size of 10gb`,
      );
    }
  
    const mediaType = file.type;
    console.log('mediatype ', mediaType)
    if (!mediaType) {
      throw new BadRequestError("Missing Content-Type for video");
    }
  
    if (mediaType !== "video/mp4") {
      throw new BadRequestError("mp4 only allowed");
    }

    const fileName = `${videoId}.mp4`;
    await Bun.write(fileName, file);

    const s3file = cfg.s3Client.file(fileName);
    await s3file.write(Bun.file(fileName));
    console.log(s3file.name)

    await Bun.file(fileName).delete();

    // const urlPath = getAssetURL(cfg, fileName);
    video.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${s3file.name}`;
    updateVideo(cfg.db, video);

    return respondWithJSON(200, video);
}

