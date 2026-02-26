import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface BrandDesignerProps {
  onSave: (designData: any) => void;
  initialDesign?: any;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
}

const packagingTypes = [
  { id: 'box', name: 'Box', nameAr: 'صندوق' },
  { id: 'bottle', name: 'Bottle', nameAr: 'زجاجة' },
  { id: 'jar', name: 'Jar', nameAr: 'علبة' },
  { id: 'tube', name: 'Tube', nameAr: 'أنبوب' },
  { id: 'sachet', name: 'Sachet', nameAr: 'كيس' },
];

export default function BrandDesigner({
  onSave,
  initialDesign,
  primaryColor = '#22c55e',
  secondaryColor = '#16a34a',
  logoUrl,
}: BrandDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [packagingType, setPackagingType] = useState('box');
  const [brandName, setBrandName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [selectedColor, setSelectedColor] = useState(primaryColor);
  const [fontSize, setFontSize] = useState(24);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (initialDesign) {
      setPackagingType(initialDesign.packagingType || 'box');
      setBrandName(initialDesign.brandName || '');
      setSlogan(initialDesign.slogan || '');
      setSelectedColor(initialDesign.primaryColor || primaryColor);
    }
    renderPackaging();
  }, [packagingType, brandName, slogan, selectedColor, logoUrl]);

  const renderPackaging = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = selectedColor;

    switch (packagingType) {
      case 'box':
        drawBox(ctx, canvas);
        break;
      case 'bottle':
        drawBottle(ctx, canvas);
        break;
      case 'jar':
        drawJar(ctx, canvas);
        break;
      case 'tube':
        drawTube(ctx, canvas);
        break;
      case 'sachet':
        drawSachet(ctx, canvas);
        break;
    }

    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const maxSize = 80;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (canvas.width - width) / 2;
        const y = canvas.height / 2 - height / 2 - 20;
        ctx.drawImage(img, x, y, width, height);
      };
      img.src = logoUrl;
    }

    if (brandName) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(brandName, canvas.width / 2, canvas.height / 2 + 30);
    }

    if (slogan) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `${fontSize * 0.5}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(slogan, canvas.width / 2, canvas.height / 2 + 55);
    }
  };

  const drawBox = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const padding = 40;

    ctx.fillStyle = selectedColor;
    ctx.fillRect(padding, padding, w - padding * 2, h - padding * 2);

    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, padding, w - padding * 2, h - padding * 2);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding + 30, padding - 20);
    ctx.lineTo(w - padding + 30, padding - 20);
    ctx.lineTo(w - padding, padding);
    ctx.closePath();
    ctx.fill();
  };

  const drawBottle = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;

    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.roundRect(centerX - 50, 80, 100, 220, 20);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(centerX - 20, 50, 40, 40);

    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.arc(centerX - 30, 150, 15, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawJar = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;

    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.roundRect(centerX - 70, 100, 140, 180, 30);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(centerX - 60, 80, 120, 30);
  };

  const drawTube = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;

    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.roundRect(centerX - 40, 60, 80, 250, 10);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.roundRect(centerX - 35, 60, 70, 50, 5);
    ctx.fill();
  };

  const drawSachet = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const w = canvas.width;
    const h = canvas.height;
    const padding = 50;

    ctx.fillStyle = selectedColor;
    ctx.beginPath();
    ctx.roundRect(padding, padding, w - padding * 2, h - padding * 2, 10);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(padding + 10, padding + 10, w - padding * 2 - 20, h - padding * 2 - 20);
    ctx.setLineDash([]);
  };

  const exportAsImage = async () => {
    setIsExporting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dataUrl = canvas.toDataURL('image/png');
      onSave({
        packagingType,
        brandName,
        slogan,
        primaryColor: selectedColor,
        previewImage: dataUrl,
      });
      toast.success('Design sauvegardé!');
    } catch (error) {
      toast.error('Erreur lors de l\'export');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Canvas Preview */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Aperçu du Packaging</h3>
        <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={300}
            height={350}
            className="bg-white shadow-lg rounded-lg"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Personnalisation</h3>

        <div className="space-y-5">
          {/* Packaging Type */}
          <div>
            <label className="label">Type de Packaging</label>
            <div className="grid grid-cols-5 gap-2">
              {packagingTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setPackagingType(type.id)}
                  className={`p-2 rounded-lg text-center transition-colors ${
                    packagingType === type.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  <div className="text-sm">{type.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Brand Name */}
          <div>
            <label className="label">Nom de la marque</label>
            <input
              type="text"
              className="input"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Votre marque"
              maxLength={20}
            />
          </div>

          {/* Slogan */}
          <div>
            <label className="label">Slogan</label>
            <input
              type="text"
              className="input"
              value={slogan}
              onChange={(e) => setSlogan(e.target.value)}
              placeholder="Votre slogan"
              maxLength={30}
            />
          </div>

          {/* Primary Color */}
          <div>
            <label className="label">Couleur principale</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer"
              />
              <input
                type="text"
                className="input w-28"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
              />
              <div className="flex gap-2">
                {['#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#ec4899'].map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Font Size */}
          <div>
            <label className="label">Taille du texte: {fontSize}px</label>
            <input
              type="range"
              min={16}
              max={40}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Export Button */}
          <button
            onClick={exportAsImage}
            className="btn-primary w-full"
            disabled={isExporting}
          >
            {isExporting ? 'Sauvegarde...' : 'Sauvegarder le Design'}
          </button>
        </div>
      </div>
    </div>
  );
}
