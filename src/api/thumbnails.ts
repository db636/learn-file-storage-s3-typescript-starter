import { Buffer } from 'node:buffer';
import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const MAX_UPLOAD_SIZE = 10 << 20; // 10mb

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const imageData = await formData.get('thumbnail');
  if (!(imageData instanceof File)) {
    throw new BadRequestError("Wrong thumbnail data type");
  }

  if (imageData.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File should be < 10mb");
  }

  const mediaType = imageData.type;
  const buffer = await imageData.arrayBuffer();
  const buf = Buffer.from(buffer)
  const imageStr = buf.toString('base64');
  const dataUrl = `data:${mediaType};base64,${imageStr}`
  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID !== userID) {
    throw new UserForbiddenError('Forbidden');
  }

  video.thumbnailURL = dataUrl

  updateVideo(cfg.db, video);

  return respondWithJSON(200, video);
}
