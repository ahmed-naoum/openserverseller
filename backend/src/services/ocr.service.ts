import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { pdfToPng } from 'pdf-to-png-converter';

export interface ExtractedCinData {
  cinNumber?: string;
  nom?: string;
  prenom?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  expiryDate?: string;
  isExpired?: boolean;
  rawText?: string;
}

export class OcrService {
  /**
   * Extracts data from an image buffer using OCR
   */
  static async extractCinData(fileBuffer: Buffer, type: 'recto' | 'verso' = 'recto'): Promise<ExtractedCinData> {
    try {
      let bufferToProcess = fileBuffer;

      // Check if file is PDF (PDF magic number: %PDF)
      if (fileBuffer.slice(0, 4).toString() === '%PDF') {
        const pngPages = await pdfToPng(fileBuffer, {
          pagesToProcess: [1],
          viewportScale: 2.0, // Better quality for OCR
        });
        if (pngPages.length > 0) {
          bufferToProcess = pngPages[0].content;
        }
      }

      // Pre-process image with sharp for better OCR accuracy
      const sharpInstance = sharp(bufferToProcess);
      
      if (type === 'verso') {
        // Verso: Focus on address and labels
        sharpInstance
          .resize(2500)
          .grayscale()
          .normalize()
          .sharpen() // Default sharpen is safer
          .clahe({ width: 30, height: 30, maxSlope: 2 });
      } else {
        // Recto: Focus on name and CIN
        sharpInstance
          .resize(2000)
          .grayscale()
          .normalize()
          .sharpen()
          .clahe({ width: 25, height: 25 });
      }

      const processedImage = await sharpInstance.toBuffer();

      // Initialize worker
      const worker = await createWorker('fra+ara');
      
      const { data: { text } } = await worker.recognize(processedImage);
      await worker.terminate();

      const parsedData = this.parseCinText(text);
      return { ...parsedData, rawText: text };
    } catch (error) {
      console.error('OCR Extraction Error Details:', error);
      throw error;
    }
  }

  /**
   * Basic parser for Moroccan CIN text
   */
  private static parseCinText(text: string): ExtractedCinData {
    const data: ExtractedCinData = {};
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const combinedText = lines.join(' ');
    const keywords = ['ROYAUME', 'MAROC', 'CARTE', 'NATIONALE', 'IDENTITE', 'VALABLE', 'JUSQU', 'NAISSANCE', 'CRE', 'CIN'];

    // 1. CIN Number: Pattern like AB123456 or A123456
    // Moroccan CINs start with 1 or 2 letters followed by numbers
    // We search the entire text for this pattern, excluding common keywords
    const cinRegex = /\b([A-Z]{1,2}\s?\d{3,8})\b/gi;
    const matches = combinedText.match(cinRegex);
    if (matches) {
      // Find the first match that isn't a known date part or keyword
      for (const m of matches) {
        const cleanCin = m.replace(/\s/g, '').toUpperCase();
        if (cleanCin.length >= 4 && !keywords.includes(cleanCin)) {
          data.cinNumber = cleanCin;
          break;
        }
      }
    }

    // 2. Dates: Usually DD.MM.YYYY
    const dateMatches = combinedText.match(/\d{2}[\.\/\-]\d{2}[\.\/\-]\d{4}/g);
    if (dateMatches && dateMatches.length > 0) {
      // Typically the first date is birth date, but we check labels
      for (const d of dateMatches) {
        const idx = combinedText.indexOf(d);
        const surrounding = combinedText.substring(Math.max(0, idx - 30), idx).toLowerCase();
        if (surrounding.includes('né le') || surrounding.includes('ne le') || surrounding.includes('naissance')) {
          data.birthDate = d;
        } else if (surrounding.includes('valable') || surrounding.includes('jusqu')) {
          data.expiryDate = d;
        }
      }
      
      // Fallback if labels missed
      if (!data.birthDate) data.birthDate = dateMatches[0];
      if (!data.expiryDate && dateMatches.length > 1) data.expiryDate = dateMatches[dateMatches.length - 1];
    }

    // Expiry Validation
    if (data.expiryDate) {
      try {
        const [day, month, year] = data.expiryDate.split(/[\.\/\-]/).map(Number);
        const expiry = new Date(year, month - 1, day);
        data.isExpired = expiry < new Date();
      } catch (e) {
        console.error('Date parsing failed', e);
      }
    }

    // 3. Names (French)
    // Moroccan cards often have names in all caps without labels
    // We look for blocks of capital letters that aren't keywords
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Sanitize line: remove non-printable/invisible characters but keep French accents
      const sanitizedLine = line.replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '').trim();
      const lowerLine = sanitizedLine.toLowerCase();

      if (lowerLine.includes('nom') && !data.nom) {
        const parts = sanitizedLine.split(/[:;\s]+/).filter(p => !p.toLowerCase().includes('nom'));
        if (parts.length >= 1 && parts[0].length > 2) {
          data.nom = parts.join(' ').replace(/[^A-Z\s\-]/gi, '').trim();
        }
      }
      if ((lowerLine.includes('prnom') || lowerLine.includes('prenom')) && !data.prenom) {
        const parts = sanitizedLine.split(/[:;\s]+/).filter(p => !p.toLowerCase().includes('prnom') && !p.toLowerCase().includes('prenom'));
        if (parts.length >= 1 && parts[0].length > 2) {
          data.prenom = parts.join(' ').replace(/[^A-Z\s\-]/gi, '').trim();
        }
      }
      if (lowerLine.includes('adresse') && !data.address) {
        const addrIdx = lowerLine.indexOf('adresse');
        let potentialAddr = sanitizedLine.substring(addrIdx + 7).replace(/^[:;\s\-\.\/]+/, '').trim();
        
        // If the line is just "Adresse" or too short, look at next line
        if (potentialAddr.length < 5 && i + 1 < lines.length) {
          potentialAddr = lines[i+1].replace(/[^\x20-\x7E\u00C0-\u00FF]/g, '').trim();
        }
        
        if (potentialAddr && !potentialAddr.toLowerCase().includes('civil') && !potentialAddr.toLowerCase().includes('sexe')) {
          data.address = potentialAddr;
        }
      }

      // City detection (look for "à CITY_NAME" or "a CITY_NAME")
      const MOROCCAN_CITIES = [
        'CASABLANCA', 'RABAT', 'FES', 'FEZ', 'MARRAKECH', 'AGADIR', 'TANGIER', 'TANGER', 'MEKNES', 'OUJDA', 
        'KENITRA', 'TETOUAN', 'SAFI', 'TEMARA', 'INZEGANE', 'MOHAMMEDIA', 'LAAYOUNE', 'KHOURIBGA', 'BENI MELLAL', 
        'EL JADIDA', 'TAZA', 'NADOR', 'SETTAT', 'KASR EL KEBIR', 'LARACHE', 'KHEMISSET', 'GUELMIM', 'BERRECHID', 
        'OUED ZEM', 'FKIH BEN SALAH', 'TAOURIRT', 'BERKANE', 'SIDI SLIMANE', 'ERRACHIDIA', 'SIDI KACEM', 'KHENIFRA', 
        'TIFELT', 'ESSAOUIRA', 'TAROUDANT', 'OUARZAZATE', 'SIDI BENNOUR', 'TIZNIT', 'AZROU', 'BENGUERIR', 'IFRANE', 'SKHIRAT'
      ];

      if ((lowerLine.includes('à ') || lowerLine.includes('a ')) && !data.city) {
        const cityIdx = Math.max(lowerLine.indexOf('à '), lowerLine.indexOf('a '));
        const cityPart = sanitizedLine.substring(cityIdx + 2).trim();
        if (cityPart.length >= 3) {
          const firstWord = cityPart.split(/[\s,]/)[0].replace(/[()]/g, '').toUpperCase();
          
          // Check if it's in our known cities list (highest priority)
          const matchedCity = MOROCCAN_CITIES.find(c => firstWord.includes(c) || c.includes(firstWord));
          if (matchedCity && firstWord.length >= 3) {
            data.city = matchedCity;
          } else if (!/^\d+$/.test(firstWord) && firstWord.length >= 4 && !keywords.includes(firstWord)) {
            // If not in list, only accept if >= 4 chars and not a keyword
            data.city = firstWord;
          }
        }
      }

      // Standalone uppercase name detection
      const cleanName = sanitizedLine.replace(/[:;,.|]/g, '').trim();
      if (/^[A-Z\s\-]{3,30}$/.test(cleanName) && !keywords.some(k => cleanName.includes(k))) {
        if (cleanName.length > 3) {
          // Remove common OCR junk at the start (like 'PO ' or 'LA ')
          const finalName = cleanName.replace(/^(PO|LA|DE|LE)\s+/i, '').trim();
          if (finalName.length > 2) {
            if (!data.prenom) {
              data.prenom = finalName;
            } else if (!data.nom && finalName !== data.prenom) {
              data.nom = finalName;
            }
          }
        }
      }
    }

    // Fallback for CIN if not found
    if (!data.cinNumber) {
      const cinRegex = /\b([A-Z]{1,2}\s?\d{3,8})\b/gi;
      const searchSpace = lines
        .filter(l => !l.toLowerCase().includes('adresse'))
        .join(' ')
        .replace(/[^\x20-\x7E]/g, '');
        
      const match = searchSpace.match(cinRegex);
      if (match) {
        data.cinNumber = match[0].replace(/\s/g, '').toUpperCase();
      }
    }
    
    // Final cleanup
    const clean = (val?: string, isAlphaOnly = false) => {
      if (!val) return undefined;
      let cleaned = val
        .replace(/[\u0600-\u06FF]/g, '') // Remove Arabic
        .replace(/[|§£]/g, 'I') // Replace OCR junk with I
        .replace(/([A-Z])0([A-Z])/g, '$1O$2') // Replace zero with O between letters
        .replace(/[()]/g, '') // Remove parentheses
        .replace(/[:;>.<]+$/, '') // Remove trailing punctuation
        .replace(/^[:;>.<]+/, '') // Remove leading punctuation
        .replace(/\b[0-9]{1,2}\b$/g, '') // Remove isolated small numbers at the end (noise)
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
        
      if (isAlphaOnly) {
        cleaned = cleaned.replace(/\d/g, '').trim();
      }
      
      return cleaned.length > 0 ? cleaned : undefined;
    };
    
    data.nom = clean(data.nom, true);
    data.prenom = clean(data.prenom, true);
    data.address = clean(data.address);
    data.city = clean(data.city, true);
    data.cinNumber = clean(data.cinNumber)?.replace(/[^A-Z0-9]/g, '').toUpperCase();
    
    if (data.nom === data.prenom) data.nom = undefined;

    return data;
  }
}
