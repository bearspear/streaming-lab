import database from '../config/database.js';
import { createReadStream, existsSync } from 'fs';

export const getSubtitles = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const subtitles = await database.all(
      `SELECT id, language, label, format, is_default
       FROM subtitles
       WHERE media_item_id = ?
       ORDER BY is_default DESC, language ASC`,
      [mediaId]
    );

    res.json({
      mediaId: parseInt(mediaId),
      subtitles
    });
  } catch (error) {
    console.error('Error fetching subtitles:', error);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
};

export const serveSubtitle = async (req, res) => {
  try {
    const { subtitleId } = req.params;

    // Get subtitle file path from database
    const subtitle = await database.get(
      'SELECT file_path, format FROM subtitles WHERE id = ?',
      [subtitleId]
    );

    if (!subtitle) {
      return res.status(404).json({ error: 'Subtitle not found' });
    }

    if (!existsSync(subtitle.file_path)) {
      return res.status(404).json({ error: 'Subtitle file not found on disk' });
    }

    // Set content type based on format
    const contentTypes = {
      'srt': 'text/plain; charset=utf-8',
      'vtt': 'text/vtt; charset=utf-8',
      'ass': 'text/plain; charset=utf-8'
    };

    const contentType = contentTypes[subtitle.format] || 'text/plain; charset=utf-8';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const stream = createReadStream(subtitle.file_path);
    stream.pipe(res);

    stream.on('error', (error) => {
      console.error('Error streaming subtitle:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream subtitle' });
      }
    });
  } catch (error) {
    console.error('Error serving subtitle:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to serve subtitle' });
    }
  }
};
