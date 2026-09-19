import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join, relative, resolve, sep } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readdir, stat, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import { Roles, SuperAdmin } from '../common/decorators';
import { Principal } from '../common/enums';

export const UPLOAD_ROOT = join(process.cwd(), 'storage', 'uploads');

const ALLOWED = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.webm', '.mp3', '.pdf', '.doc', '.docx', '.zip',
]);

/**
 * Local disk storage driver. Files land in storage/uploads/<yyyy>/<mm> and are
 * served statically at /uploads/... (see main.ts). Swap for S3 by setting
 * STORAGE_DRIVER=s3 and implementing the S3 branch in `publicUrl`.
 */
@Injectable()
export class UploadsService {
  constructor(private config: ConfigService) {}

  publicUrl(relPath: string) {
    const apiUrl = process.env.API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
    return `${apiUrl}/uploads/${relPath.replace(/\\/g, '/')}`;
  }

  /** Recursively lists every file under storage/uploads (skips nothing — admin-only view). */
  async list() {
    if (!existsSync(UPLOAD_ROOT)) return [];
    const files: { path: string; url: string; size: number; modifiedAt: string }[] = [];
    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const rel = relative(UPLOAD_ROOT, full).replace(/\\/g, '/');
          const s = await stat(full);
          files.push({ path: rel, url: this.publicUrl(rel), size: s.size, modifiedAt: s.mtime.toISOString() });
        }
      }
    };
    await walk(UPLOAD_ROOT);
    return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
  }

  /** Deletes a single uploaded file by its path relative to UPLOAD_ROOT. */
  async remove(relPath: string) {
    // Resolve and verify the target stays inside UPLOAD_ROOT — blocks `../` traversal.
    const target = resolve(UPLOAD_ROOT, relPath);
    if (target !== UPLOAD_ROOT && !target.startsWith(UPLOAD_ROOT + sep)) {
      throw new ForbiddenException('Invalid file path');
    }
    if (!existsSync(target)) throw new NotFoundException('File not found');
    await unlink(target);
    return { removed: true };
  }
}

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  @Roles(Principal.INSTRUCTOR, Principal.ADMIN)
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const now = new Date();
          const dir = join(UPLOAD_ROOT, String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${randomBytes(12).toString('hex')}${ext}`);
        },
      }),
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED.has(ext)) {
          return cb(new BadRequestException(`File type ${ext} not allowed`), false);
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    // Rebuild the year/month/name relative path from the absolute stored path.
    const rel = file.path.split(/[\\/]uploads[\\/]/).pop()!;
    return { url: this.uploads.publicUrl(rel), size: file.size, name: file.originalname };
  }

  // File manager — browse/remove anything on the local disk driver. Restricted
  // to super-admins since it exposes every instructor's uploaded material.
  @Roles(Principal.ADMIN)
  @SuperAdmin()
  @Get()
  list() {
    return this.uploads.list();
  }

  @Roles(Principal.ADMIN)
  @SuperAdmin()
  @Delete()
  remove(@Query('path') path: string) {
    if (!path) throw new BadRequestException('path is required');
    return this.uploads.remove(path);
  }
}

@Module({
  providers: [UploadsService],
  controllers: [UploadsController],
})
export class UploadsModule {}
